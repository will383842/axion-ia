/**
 * Actions serveur de la page du COMPTE RENDU d'un rendez-vous (chantier visio, PR 6).
 *
 * Chaque action vérifie ELLE-MÊME la session (décision A2 : Will et les
 * administrateurs) : une Server Action s'appelle directement, masquer un
 * bouton n'est pas interdire. Aucune n'appelle OpenAI : elles programment des
 * étapes, que le worker exécute.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { retirerAccordRencontre } from "@/lib/rgpd-erase";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import {
  attribuerVoix,
  confirmerEnregistrementCourt,
  GesteRefuse,
  reecrireCompteRendu,
  reextraireCompteRendu,
  relancerApresRattachement,
  reprendreEtapesSuspendues,
  validerCompteRendu,
} from "@/server/visio/gestes-compte-rendu";

const uuid = z.string().uuid();

function lireRencontre(fd: FormData): string {
  return uuid.parse(fd.get("rencontreId"));
}

/** L'adresse de retour : la vue du compte rendu (jamais une URL extérieure). */
function lireRetour(fd: FormData): string {
  const r = String(fd.get("retour") ?? "");
  return /^\/[a-z]{2}\/[\w-]+\/rendez-vous\?compteRendu=[0-9a-f-]{36}$/.test(r) ? r : "/";
}

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
    cle = "erreur";
    message =
      err instanceof GesteRefuse
        ? err.message
        : err instanceof z.ZodError
          ? "Demande incomplète."
          : err instanceof Error
            ? err.message
            : "Erreur inattendue.";
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
    await reextraireCompteRendu(prisma, rencontreId);
    return "L'extraction est relancée depuis la transcription.";
  },
  completer: async (_fd, rencontreId) => {
    const id = await relancerApresRattachement(prisma, rencontreId);
    return id === null
      ? "Rien à compléter pour ce rendez-vous."
      : "Le compte rendu est complété avec la fiche client (sans refaire l'extraction).";
  },
  voix: async (fd, rencontreId) => {
    await attribuerVoix(prisma, {
      rencontreId,
      voix: z.string().min(1).max(8).parse(fd.get("voix")),
      participantId: uuid.parse(fd.get("participantId")),
      maintenant: new Date(),
    });
    return "Voix attribuée.";
  },
  court: async (_fd, rencontreId) => {
    await confirmerEnregistrementCourt(prisma, rencontreId, new Date());
    return "L'enregistrement court sera traité.";
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
 * UNE seule action pour toute la page (champ caché `geste`) : chaque action
 * importée par une page ajoute sa référence au JavaScript de la console, et le
 * cliquet de poids de la console n'a pas de marge (mesuré sur #1229 : huit
 * actions séparées le dépassaient de 209 o).
 */
export async function gesteCompteRenduAction(fd: FormData): Promise<void> {
  const geste = GESTES[String(fd.get("geste") ?? "")];
  await executer(fd, async (rencontreId, adminId) => {
    if (!geste) throw new GesteRefuse("Geste inconnu.");
    return geste(fd, rencontreId, adminId);
  });
}
