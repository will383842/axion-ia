/**
 * Actions serveur des RENCONTRES du dossier client (chantier visio, PR 4).
 *
 * Chacune vérifie ELLE-MÊME la session et le rôle (`exigerAccesEchanges`,
 * décision A2) : une Server Action s'appelle directement, masquer un bouton
 * n'est pas interdire. Elles ne font que lire le formulaire, appeler le module
 * métier (testé à part), et rediriger — une erreur revient en clair dans
 * l'adresse (`?erreur=`), jamais une page cassée.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { fromParisLocalInput } from "@/lib/calendar-grid";
import {
  dateDeLEcheance,
  garderSuiteEtEcheance,
  suiviApresLAppelSchema,
} from "@/features/admin-rendezvous/suivi";
import { exigerAccesEchanges } from "./acces";
import { assurerRencontrePourCalendly } from "./rencontre-calendly";
import { relancerApresRattachement, validerRattachement } from "./rattacher";
import { creerProspectDepuisRencontre } from "./creer-prospect";
import { creerRencontre } from "./creer-rencontre";
import { deplacerRencontre } from "./deplacer";
import { fusionnerFiches } from "./fusionner";
import { defaireFusion } from "./defaire-fusion";
import { validerApresLAppel, type ChoixProjet } from "./valider";
import { lireChoixDesGroupes } from "./projets-evoques";
import { CHAMPS_DE_LA_NOTE, type SaisieNote } from "./note-manuelle";
import { executerGesteCompteRendu } from "./compte-rendu-gestes";
import { MessagePourWill, messageAffichable } from "./message-affichable";

const uuid = z.string().uuid();

function texte(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

function base(chemin: string): string {
  return adminPath("fr", chemin);
}

/**
 * Redirige avec le message d'erreur, lisible par Will. S4 : seuls les messages
 * MÉTIER vont dans l'URL (`messageAffichable`) ; une erreur Prisma ou un bogue
 * devient un texte générique, le détail part au journal serveur.
 */
function erreurVers(chemin: string, e: unknown): never {
  const message = messageAffichable(e);
  const sep = chemin.includes("?") ? "&" : "?";
  redirect(`${base(chemin)}${sep}erreur=${encodeURIComponent(message.slice(0, 300))}`);
}

/** Les erreurs de `redirect()` doivent traverser : on ne les attrape pas. */
function estRedirection(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

/**
 * Depuis une carte de l'onglet « Rendez-vous » : « Après l'appel » ou « Pas
 * d'enregistrement : note manuelle ». Assure la rencontre du rendez-vous
 * Calendly (liste blanche), puis ouvre l'écran.
 */
export async function ouvrirApresLAppelAction(fd: FormData): Promise<void> {
  await exigerAccesEchanges();
  const calendlyEventId = texte(fd, "calendlyEventId");
  const note = texte(fd, "vers") === "note";
  let rencontreId: string | null = null;
  try {
    const r = await assurerRencontrePourCalendly(prisma, calendlyEventId);
    if (r.statut === "creee" || r.statut === "existante") rencontreId = r.rencontreId;
  } catch (e) {
    erreurVers("rendez-vous?vue=point", e);
  }
  if (rencontreId === null) {
    erreurVers(
      "rendez-vous?vue=point",
      new MessagePourWill(
        "Ce rendez-vous n'entre pas au dossier client (type hors de la liste des rendez-vous clients).",
      ),
    );
  }
  redirect(
    `${base(`rendez-vous/rencontres/${rencontreId}`)}?vue=apres-l-appel${note ? "#note" : ""}`,
  );
}

/** « Confirmer le client proposé », ou « Ranger chez… » un autre client (A4 : Will valide). */
export async function rangerRencontreAction(fd: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const rencontreId = uuid.parse(texte(fd, "rencontreId"));
  const clientId = uuid.safeParse(texte(fd, "clientId"));
  const retour =
    texte(fd, "retour") === "a-classer"
      ? "rendez-vous?vue=a-classer"
      : `rendez-vous/rencontres/${rencontreId}?vue=apres-l-appel`;
  if (!clientId.success) erreurVers(retour, new MessagePourWill("Choisissez la fiche client."));
  try {
    await prisma.$transaction((tx) =>
      validerRattachement(tx, { rencontreId, clientId: clientId.data, parAdminId: userId }),
    );
    await relancerApresRattachement(prisma, rencontreId);
  } catch (e) {
    if (estRedirection(e)) throw e;
    erreurVers(retour, e);
  }
  revalidatePath(base("rendez-vous"));
  updateTag("admin:rendez-vous-a-faire");
  redirect(base(retour));
}

/** « Créer la fiche prospect depuis ce rendez-vous » — par la porte unique. */
export async function creerProspectAction(fd: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const rencontreId = uuid.parse(texte(fd, "rencontreId"));
  const retour = `rendez-vous/rencontres/${rencontreId}?vue=apres-l-appel`;
  const siren = texte(fd, "siren");
  const r = await creerProspectDepuisRencontre(
    prisma,
    {
      rencontreId,
      raisonSociale: texte(fd, "raisonSociale"),
      type: texte(fd, "type") === "particulier" ? "particulier" : "entreprise",
      ville: texte(fd, "ville") || null,
      sirenConfirme: siren !== "" && siren !== "aucun" ? siren : null,
      motifCreationForcee: texte(fd, "motif") || null,
      parAdminId: userId,
    },
    { sirenPropose: texte(fd, "sirenPropose") || null },
  ).catch((e: unknown) => erreurVers(retour, e));
  if (r.statut !== "cree") erreurVers(retour, new MessagePourWill(r.message));
  // La fiche créée RANGE le rendez-vous : son compte rendu est complété (P2 à P5).
  // P-6 : si la relance échoue, la fiche EXISTE déjà — le message le dit, et
  // nomme le geste qui reprend le compte rendu.
  await relancerApresRattachement(prisma, rencontreId).catch(() =>
    erreurVers(
      retour,
      new MessagePourWill(
        "La fiche est créée et le rendez-vous rangé, mais le compte rendu n'a pas pu être " +
          "complété : ouvrez-le et cliquez « Compléter avec la fiche client ».",
      ),
    ),
  );
  revalidatePath(base("rendez-vous"));
  redirect(base(retour));
}

function lireNote(fd: FormData): SaisieNote {
  const saisie: Record<string, unknown> = {};
  for (const { champ } of CHAMPS_DE_LA_NOTE) saisie[champ] = texte(fd, champ) || null;
  saisie["objection"] = fd.get("objection") === "on";
  saisie["objectionTexte"] = texte(fd, "objectionTexte") || null;
  return saisie as SaisieNote;
}

/** Le bouton unique « Valider et préparer le devis ». */
export async function validerApresLAppelAction(fd: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const rencontreId = uuid.parse(texte(fd, "rencontreId"));
  const retour = `rendez-vous/rencontres/${rencontreId}?vue=apres-l-appel`;

  // Le schéma et la règle de l'onglet « Rendez-vous » : une seule source.
  const suivi = suiviApresLAppelSchema.safeParse({
    issue: texte(fd, "issue") || null,
    suite: texte(fd, "suite") || null,
    suiteLe: texte(fd, "suiteLe") || null,
  });
  if (!suivi.success) {
    erreurVers(
      retour,
      new MessagePourWill(
        suivi.error.issues[0]?.message ?? "Indiquez comment s'est passé le rendez-vous.",
      ),
    );
  }
  const garde = garderSuiteEtEcheance(suivi.data.issue, suivi.data.suite, suivi.data.suiteLe);

  const modeProjet = texte(fd, "projet");
  const projet: ChoixProjet =
    modeProjet === "nouveau"
      ? { mode: "nouveau", titre: texte(fd, "projetTitre") }
      : uuid.safeParse(modeProjet).success
        ? { mode: "existant", projetId: modeProjet }
        : { mode: "aucun" };

  // V1-03 : un choix de projet par AUTRE projet évoqué ; un groupe sans choix est refusé.
  let groupes: ReturnType<typeof lireChoixDesGroupes> = [];
  try {
    groupes = lireChoixDesGroupes(fd);
  } catch (e) {
    erreurVers(retour, e);
  }

  const r = await validerApresLAppel(prisma, {
    rencontreId,
    parAdminId: userId,
    projet,
    groupes,
    faitsCoches: fd.getAll("fait").filter((x): x is string => typeof x === "string"),
    note: lireNote(fd),
    suivi: {
      issue: suivi.data.issue,
      suite: garde.suite,
      suiteLe: garde.suiteLe ? dateDeLEcheance(garde.suiteLe) : null,
    },
  }).catch((e: unknown) => erreurVers(retour, e));

  revalidatePath(base("rendez-vous"));
  updateTag("admin:rendez-vous-a-faire");
  if (garde.suite === "devis") {
    const q = new URLSearchParams({ clientId: r.clientId });
    if (r.projetId) q.set("projetId", r.projetId);
    redirect(`${base("qualiopi/devis/new")}?${q.toString()}`);
  }
  redirect(base(`rendez-vous/rencontres/${rencontreId}`));
}

/** « Nouveau rendez-vous » depuis la fiche client ou un projet (B9 : 2 clics). */
export async function creerRencontreAction(fd: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const clientId = uuid.parse(texte(fd, "clientId"));
  const projetBrut = texte(fd, "projetId");
  const projetId = uuid.safeParse(projetBrut).success ? projetBrut : null;
  const retour = projetId
    ? `qualiopi/clients/${clientId}/projets/${projetId}`
    : `qualiopi/clients/${clientId}?onglet=echanges`;
  const debut = fromParisLocalInput(texte(fd, "debut"));
  if (debut === null)
    erreurVers(retour, new MessagePourWill("Indiquez la date et l'heure du rendez-vous."));
  const typeBrut = texte(fd, "type");
  const type = typeBrut === "telephone" || typeBrut === "presentiel" ? typeBrut : "visio";

  const r = await creerRencontre(prisma, {
    clientId,
    projetId,
    type,
    debut,
    dureeMin: Number(texte(fd, "duree") || "45"),
    titre: texte(fd, "titre") || null,
    lienVisio: texte(fd, "lien") || null,
    contactIds: fd.getAll("contact").filter((x): x is string => typeof x === "string"),
    testInterne: fd.get("testInterne") === "on",
    parAdminId: userId,
  }).catch((e: unknown) => erreurVers(retour, e));

  if (r.invitation !== null) {
    // L'invitation est GARÉE pour validation : rien ne part sans Will.
    const { enqueueEmail } = await import("@/server/queue/queues");
    await enqueueEmail(
      "rencontre-invitation",
      r.invitation.destinataire,
      "fr",
      r.invitation.payload,
      {
        exigerValidation: true,
        clientId,
        entityType: "Rencontre",
        entityId: r.rencontreId,
        sujet: `Invitation : ${r.invitation.payload.titre}`,
      },
    );
  }
  revalidatePath(base(retour.split("?")[0] ?? retour));
  redirect(base(`rendez-vous/rencontres/${r.rencontreId}`));
}

/** « Déplacer » une rencontre rangée chez le mauvais client. */
export async function deplacerRencontreAction(fd: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const rencontreId = uuid.parse(texte(fd, "rencontreId"));
  const retour = `rendez-vous/rencontres/${rencontreId}`;
  const versClientId = uuid.safeParse(texte(fd, "versClientId"));
  if (!versClientId.success)
    erreurVers(retour, new MessagePourWill("Choisissez la fiche d'arrivée."));
  const projetBrut = texte(fd, "versProjetId");
  await deplacerRencontre(prisma, {
    rencontreId,
    versClientId: versClientId.data,
    versProjetId: uuid.safeParse(projetBrut).success ? projetBrut : null,
    parAdminId: userId,
  }).catch((e: unknown) => erreurVers(retour, e));
  revalidatePath(base(retour));
  redirect(base(retour));
}

/** « Fusionner cette fiche dans… » (A3 : déclenchée par Will, journalisée, réversible). */
export async function fusionnerFichesAction(fd: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const absorbeeId = uuid.parse(texte(fd, "absorbeeId"));
  const retour = `qualiopi/clients/${absorbeeId}?onglet=personnes`;
  const absorbante = uuid.safeParse(texte(fd, "absorbanteId"));
  if (!absorbante.success)
    erreurVers(retour, new MessagePourWill("Choisissez la fiche qui reste."));
  await fusionnerFiches(prisma, {
    absorbeeId,
    absorbanteId: absorbante.data,
    motif: texte(fd, "motif"),
    reporterSiren: fd.get("reporterSiren") === "on",
    parAdminId: userId,
  }).catch((e: unknown) => erreurVers(retour, e));
  revalidatePath(base("qualiopi/clients"));
  redirect(base(`qualiopi/clients/${absorbante.data}?onglet=personnes`));
}

/** « Défaire la fusion ». */
export async function defaireFusionAction(fd: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const fusionId = uuid.parse(texte(fd, "fusionId"));
  const clientId = uuid.parse(texte(fd, "clientId"));
  const retour = `qualiopi/clients/${clientId}?onglet=personnes`;
  await defaireFusion(prisma, { fusionId, motif: texte(fd, "motif"), parAdminId: userId }).catch(
    (e: unknown) => erreurVers(retour, e),
  );
  revalidatePath(base("qualiopi/clients"));
  redirect(base(retour));
}

/**
 * « Compte rendu de l'enregistrement » (chantier visio, PR 6) : UNE action pour
 * tous les gestes de la carte (champ caché `geste`). La session et le rôle
 * sont vérifiés par `executerGesteCompteRendu` AVANT tout geste. Elle vit ici,
 * dans le module d'actions que la page du rendez-vous charge déjà, pour ne pas
 * ajouter un module d'actions à la console (cliquet de poids).
 */
export async function gesteCompteRenduAction(fd: FormData): Promise<void> {
  await executerGesteCompteRendu(fd);
}
