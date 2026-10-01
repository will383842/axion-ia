/**
 * Les gestes du COMPTE RENDU de l'enregistrement, sur la page du rendez-vous
 * (chantier visio, PR 6).
 *
 * Module serveur ORDINAIRE (pas `"use server"`) : il n'est appelé que par
 * l'action `gesteCompteRenduAction` de `actions-rencontres.ts`, module
 * d'actions que la page du rendez-vous charge déjà. Un module d'actions de
 * plus sur une page coûte ~0,9 kB au cliquet de la console (mesuré sur la
 * PR 1229 : 470,01 kB pour 470), une action de plus dans un module déjà chargé
 * quelques dizaines d'octets.
 *
 * `executerGesteCompteRendu` vérifie ELLE-MÊME la session (décision A2 : Will
 * et les administrateurs) avant tout geste : une Server Action s'appelle
 * directement, masquer un bouton n'est pas interdire. Aucun geste n'appelle
 * OpenAI : ils programment des étapes, que le worker exécute.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { retirerAccordRencontre } from "@/lib/rgpd-erase";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { messageAffichable } from "@/features/dossier-client/message-affichable";
import {
  ajouterPersonnePourVoix,
  attribuerVoix,
  confirmerAccordALaMain,
  confirmerEnregistrementCourt,
  confirmerFenetresVerifiees,
  GesteRefuse,
  reecrireCompteRendu,
  reextraireCompteRendu,
  completerApresRattachement,
  marquerVoixDeWilliams,
  reprendreEtapesSuspendues,
  validerCompteRendu,
} from "@/server/visio/gestes-compte-rendu";

const uuid = z.string().uuid();

function lireRencontre(fd: FormData): string {
  return uuid.parse(fd.get("rencontreId"));
}

/** L'adresse de retour : la page du rendez-vous (jamais une URL extérieure). */
function lireRetour(fd: FormData): string {
  const r = String(fd.get("retour") ?? "");
  return /^\/[a-z]{2}\/[\w-]+\/rendez-vous\/rencontres\/[0-9a-f-]{36}$/.test(r) ? r : "/";
}

const voixLue = z.string().min(1).max(8);

/**
 * Exécute un geste et revient sur la page avec un message (formulaire sans
 * JavaScript : aucun îlot client, la console garde son poids).
 */
async function executer(
  fd: FormData,
  geste: (rencontreId: string, adminId: string) => Promise<string>,
): Promise<never> {
  const retour = lireRetour(fd);
  let cle = "message";
  let message: string;
  try {
    const { userId } = await exigerAccesEchanges();
    const rencontreId = lireRencontre(fd);
    message = await geste(rencontreId, userId);
    revalidatePath(retour.split("?")[0] ?? "/");
  } catch (err) {
    // S4 : seuls les messages métier vont dans l'URL, jamais une erreur Prisma.
    cle = "erreur";
    message = messageAffichable(err);
  }
  const joint = retour.includes("?") ? "&" : "?";
  redirect(`${retour}${joint}${cle}=${encodeURIComponent(message)}`);
}

/** Les gestes de la page, par leur nom (champ caché `geste` du formulaire). */
const GESTES: Readonly<
  Record<string, (fd: FormData, rencontreId: string, adminId: string) => Promise<string>>
> = {
  valider: async (fd, _rencontreId, adminId) => {
    await validerCompteRendu(prisma, {
      compteRenduId: uuid.parse(fd.get("compteRenduId")),
      parAdminId: adminId,
      maintenant: new Date(),
    });
    return "Compte rendu validé. Le son de l'appel va être supprimé.";
  },
  reecrire: async (_fd, rencontreId) => {
    await reecrireCompteRendu(prisma, rencontreId);
    return "La réécriture est lancée : le compte rendu revient dans quelques minutes.";
  },
  reextraire: async (_fd, rencontreId) => {
    return (await reextraireCompteRendu(prisma, rencontreId)) === "transcription"
      ? "La transcription est relancée."
      : "L'extraction est relancée depuis la transcription.";
  },
  completer: async (_fd, rencontreId) => {
    const id = await completerApresRattachement(prisma, rencontreId);
    return id === null
      ? "Rien à compléter pour ce rendez-vous."
      : "Le compte rendu est complété avec la fiche client (sans refaire l'extraction).";
  },
  voix: async (fd, rencontreId) => {
    await attribuerVoix(prisma, {
      rencontreId,
      voix: voixLue.parse(fd.get("voix")),
      participantId: uuid.parse(fd.get("participantId")),
      maintenant: new Date(),
    });
    return "Voix attribuée.";
  },
  voix_nouvelle_personne: async (fd, rencontreId, adminId) => {
    const fonction = String(fd.get("fonction") ?? "");
    await ajouterPersonnePourVoix(prisma, {
      rencontreId,
      voix: voixLue.parse(fd.get("voix")),
      nom: String(fd.get("nom") ?? ""),
      fonction: fonction === "" ? null : fonction,
      parAdminId: adminId,
      maintenant: new Date(),
    });
    return "Personne ajoutée au rendez-vous (et à la fiche client), voix attribuée.";
  },
  voix_williams: async (fd, rencontreId) => {
    await marquerVoixDeWilliams(prisma, {
      rencontreId,
      voix: voixLue.parse(fd.get("voix")),
      maintenant: new Date(),
    });
    return "Voix attribuée : c'est la vôtre (écho).";
  },
  confirmer_accord: async (fd, rencontreId) => {
    if (fd.get("confirmation") !== "oui") {
      throw new GesteRefuse("Cochez la case pour confirmer l'accord de chaque personne.");
    }
    await confirmerAccordALaMain(prisma, { rencontreId, maintenant: new Date() });
    return "Accord confirmé : le compte rendu peut être validé.";
  },
  court: async (fd, rencontreId) => {
    await confirmerEnregistrementCourt(prisma, {
      rencontreId,
      enregistrementId: uuid.parse(fd.get("enregistrementId")),
      maintenant: new Date(),
    });
    return "L'enregistrement court sera traité.";
  },
  fenetres: async (fd, rencontreId) => {
    await confirmerFenetresVerifiees(prisma, {
      rencontreId,
      enregistrementId: uuid.parse(fd.get("enregistrementId")),
      maintenant: new Date(),
    });
    return "Vérifié : la transcription peut partir.";
  },
  retrait: async (fd, rencontreId, adminId) => {
    if (fd.get("confirmation") !== "oui") {
      throw new GesteRefuse("Cochez la case pour confirmer le retrait de l'accord.");
    }
    const r = await retirerAccordRencontre(rencontreId, adminId);
    return (
      `Accord retiré : ${r.segments} passage(s) de transcription, ${r.comptesRendus} version(s) ` +
      `du compte rendu et ${r.faits} fait(s) effacés ; le son est supprimé. La preuve de l'accord ` +
      `initial est gardée.`
    );
  },
  reprendre: async () => {
    const n = await reprendreEtapesSuspendues(prisma);
    return `${n} étape(s) reprise(s).`;
  },
};

/**
 * UN seul point d'entrée pour tous les gestes (champ caché `geste`) : huit
 * actions séparées dépassaient le cliquet de poids de la console de 209 o
 * (mesuré sur la PR 1229).
 */
export async function executerGesteCompteRendu(fd: FormData): Promise<void> {
  const geste = GESTES[String(fd.get("geste") ?? "")];
  await executer(fd, async (rencontreId, adminId) => {
    if (!geste) throw new GesteRefuse("Geste inconnu.");
    return geste(fd, rencontreId, adminId);
  });
}
