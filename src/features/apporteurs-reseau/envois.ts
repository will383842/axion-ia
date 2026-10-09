/**
 * Réseau d'apporteurs (démarrage manuel) — TOUS les e-mails partent d'ici.
 *
 * Les noms de gabarit sont écrits EN TOUTES LETTRES : le catalogue des e-mails
 * (`server/email/apercu/catalogue.spec.ts`) retrouve l'émetteur d'un gabarit à son nom
 * littéral dans le fichier qui appelle `enqueueEmail`.
 *
 * `apercu()` rend l'e-mail exact (vrai gabarit) sans rien envoyer : la console le montre
 * à Williams avant chaque envoi décidé par lui.
 */

import { renderEmailTemplate } from "@/lib/email/templates";
import { texteParDefaut } from "@/lib/email/templates/apporteur-demarrage";
import { emailsQueue, enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";

import { signalerErreurReseau } from "./signaler";
import { prisma } from "@/lib/prisma";
import { urlDossier } from "./jeton";
import { GABARITS_ARGENT, retraitDe } from "./retrait";

export type GabaritApporteur =
  | "apporteur-dossier-lien"
  | "apporteur-dossier-a-completer"
  | "apporteur-dossier-refuse"
  | "apporteur-dossier-a-verifier"
  | "apporteur-dossier-recu"
  | "apporteur-commission-suspension"
  | "apporteur-manquement"
  | "apporteur-commission-avoir-client"
  | "apporteur-non-commissionne"
  | "apporteur-contrat-signe"
  | "apporteur-presentation-recue"
  | "apporteur-presentation-refusee"
  | "entreprise-prise-de-contact-apporteur"
  | "apporteur-vigilance"
  | "apporteur-commande-signee"
  | "apporteur-attribution-confirmee"
  | "apporteur-releve"
  | "apporteur-virement-fait"
  | "apporteur-lien-espace";

export const GABARITS_APPORTEUR: readonly GabaritApporteur[] = [
  "apporteur-dossier-lien",
  "apporteur-dossier-a-completer",
  "apporteur-dossier-refuse",
  // « apporteur-dossier-a-verifier » n'y est PAS (relecture de a1, 08/10) : c'est l'alerte
  // INTERNE envoyée à Williams, pas un e-mail à l'apporteur — elle ne se coupe jamais.
  "apporteur-dossier-recu",
  "apporteur-commission-suspension",
  "apporteur-manquement",
  "apporteur-commission-avoir-client",
  "apporteur-non-commissionne",
  "apporteur-contrat-signe",
  "apporteur-presentation-recue",
  "apporteur-presentation-refusee",
  "entreprise-prise-de-contact-apporteur",
  "apporteur-vigilance",
  "apporteur-commande-signee",
  "apporteur-attribution-confirmee",
  "apporteur-releve",
  "apporteur-virement-fait",
  "apporteur-lien-espace",
];

export interface EnvoiApporteur {
  gabarit: GabaritApporteur;
  destinataire: string;
  payload: Record<string, unknown>;
  /** Traçabilité (EmailLog) : l'apporteur ou la présentation concernés. */
  entityType: "ApporteurReseau" | "PresentationEntreprise";
  entityId: string;
  /** Clé d'idempotence : un même envoi n'est jamais doublé. */
  jobId?: string;
  attachments?: Array<{ filename: string; r2Key: string; contentType?: string }>;
}

/** L'aperçu exact d'un e-mail, plus (si modifiable) son texte par défaut en texte brut. */
export interface ApercuRendu {
  gabarit: GabaritApporteur;
  sujet: string;
  html: string;
  destinataire: string;
  /** Texte principal par défaut, pour pré-remplir « Modifier le texte » ; absent si non modifiable. */
  texteDefaut?: string;
}

/**
 * Ajoute le texte réécrit par Will au payload (jamais vide : validé en amont).
 * Sans texte, le payload est rendu tel quel.
 */
export function avecTexteLibre(
  payload: Record<string, unknown>,
  texte: string | undefined,
): Record<string, unknown> {
  return texte ? { ...payload, texteLibre: texte } : payload;
}

export async function apercu(
  e: Pick<EnvoiApporteur, "gabarit" | "destinataire" | "payload">,
): Promise<ApercuRendu> {
  const r = await renderEmailTemplate(e.gabarit as EmailJobName, "fr", e.payload, {
    destinataire: e.destinataire,
  });
  // Le texte par défaut se calcule SANS le texte réécrit : « Texte d'origine » reste possible.
  const { texteLibre: _ignore, ...sansTexte } = e.payload;
  const texteDefaut = texteParDefaut(e.gabarit, sansTexte);
  return {
    gabarit: e.gabarit,
    sujet: r.subject,
    html: r.html,
    destinataire: e.destinataire,
    ...(texteDefaut !== null ? { texteDefaut } : {}),
  };
}

/**
 * `fiche-retiree` (2026-10-07) : l'apporteur est retiré du réseau et l'e-mail n'est pas lié
 * à l'argent — il ne part pas.
 */
export type ResultatEnvoi =
  "envoye" | "en-validation" | "retenu" | "indisponible" | "fiche-retiree";

/**
 * Gabarits que reçoit l'APPORTEUR lui-même (et non une entreprise) : ce sont eux qui
 * s'arrêtent quand il est retiré, sauf ceux liés à l'argent (`GABARITS_ARGENT`).
 */
const GABARITS_VERS_L_APPORTEUR: ReadonlySet<string> = new Set([
  "apporteur-dossier-lien",
  "apporteur-dossier-a-completer",
  "apporteur-dossier-refuse",
  // « apporteur-dossier-a-verifier » n'y est PAS (relecture de a1, 08/10) : c'est l'alerte
  // INTERNE envoyée à Williams, pas un e-mail à l'apporteur — elle ne se coupe jamais.
  "apporteur-dossier-recu",
  "apporteur-commission-suspension",
  "apporteur-manquement",
  "apporteur-commission-avoir-client",
  "apporteur-non-commissionne",
  "apporteur-contrat-signe",
  "apporteur-presentation-recue",
  "apporteur-presentation-refusee",
  "apporteur-vigilance",
  "apporteur-commande-signee",
  "apporteur-attribution-confirmee",
  "apporteur-releve",
  "apporteur-virement-fait",
  // « apporteur-lien-espace » n'y est PAS (2026-10-09) : envoyé à SA demande depuis
  // « Retrouver mon espace », qui décide lui-même qui le reçoit (fiche retirée comprise,
  // pour qu'elle puisse encore déposer ses attestations).
]);

/** L'apporteur concerné par un envoi : l'entité elle-même, ou celui de la présentation. */
async function apporteurDeLEnvoi(e: EnvoiApporteur): Promise<string | null> {
  if (e.entityType === "ApporteurReseau") return e.entityId;
  const pr = await prisma.presentationEntreprise.findUnique({
    where: { id: e.entityId },
    select: { apporteurId: true },
  });
  return pr?.apporteurId ?? null;
}

/**
 * Un job ÉCHOUÉ reste 30 jours dans Redis (`removeOnFail`) : son identifiant fixe ferait
 * ignorer en silence la nouvelle tentative, alors que `enqueueEmail` répond « enfilé ».
 * On le retire AVANT de ré-enfiler. Un job terminé, actif ou en attente n'est JAMAIS
 * touché (l'idempotence est conservée). Fail-soft : ne lève jamais.
 */
export async function retirerEnvoiEchoue(jobId: string): Promise<void> {
  try {
    const file = emailsQueue;
    if (!file) return;
    const job = await file.getJob(jobId);
    if (job && (await job.isFailed())) await job.remove();
  } catch {
    // Au pire, on retombe sur le comportement d'avant.
  }
}

/**
 * « Ouvrir mon espace » (décision de Will, 2026-10-09) : chaque e-mail adressé à l'apporteur
 * porte son lien personnel, que le gabarit de base affiche en bas de la carte. Le dernier
 * e-mail reçu suffit donc à retrouver son espace. Jamais pour un dossier refusé ou résilié
 * (le lien mène à une page neutre ; vérifié sur la FICHE, pas seulement sur le gabarit) ni
 * pour un apporteur RETIRÉ du réseau (relecture sécurité, a1 :
 * le retrait change la version du lien pour le couper — on ne le recalcule pas) ;
 * fail-soft : sans lien, l'e-mail part tel quel. Le lien est TOUJOURS recalculé ici : un
 * `lienEspace` reçu dans le payload est retiré ou écrasé, jamais repris (relecture de #1408).
 */
async function avecLienEspace(e: EnvoiApporteur): Promise<Record<string, unknown>> {
  const { lienEspace: _ignore, ...sansLien } = e.payload;
  if (!GABARITS_VERS_L_APPORTEUR.has(e.gabarit) || e.gabarit === "apporteur-dossier-refuse") {
    return sansLien;
  }
  try {
    const apporteurId = await apporteurDeLEnvoi(e);
    if (!apporteurId || (await retraitDe(apporteurId))) return sansLien;
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { versionLien: true, statut: true, refuseAt: true, resilieAt: true },
    });
    if (!a || a.statut === "refuse" || a.statut === "resilie" || a.refuseAt || a.resilieAt) {
      return sansLien;
    }
    const lien = urlDossier(apporteurId, a.versionLien);
    return lien ? { ...sansLien, lienEspace: lien } : sansLien;
  } catch {
    return sansLien;
  }
}

export async function envoyer(e: EnvoiApporteur): Promise<ResultatEnvoi> {
  try {
    // 🔴 Retiré du réseau (2026-10-07) : seuls les e-mails liés à l'ARGENT lui parviennent
    // encore (commande signée, relevé, vigilance, virement) ; ils pointent vers le mode
    // restreint de sa page. Tous les autres s'arrêtent ICI, quel que soit l'appelant.
    if (GABARITS_VERS_L_APPORTEUR.has(e.gabarit) && !GABARITS_ARGENT.has(e.gabarit)) {
      const apporteurId = await apporteurDeLEnvoi(e);
      if (apporteurId && (await retraitDe(apporteurId))) return "fiche-retiree";
    }
    const jobId = e.jobId ? e.jobId.replace(/:/g, "-") : undefined;
    if (jobId) await retirerEnvoiEchoue(jobId);
    const payload = await avecLienEspace(e);
    const r = await enqueueEmail(e.gabarit as EmailJobName, e.destinataire, "fr", payload, {
      entityType: e.entityType,
      entityId: e.entityId,
      ...(jobId ? { jobId } : {}),
      ...(e.attachments ? { attachments: e.attachments } : {}),
    });
    if (r.garePourValidation) return "en-validation";
    if (r.enqueued) return "envoye";
    return r.retenu ? "retenu" : "indisponible";
  } catch (err) {
    signalerErreurReseau(`envoi ${e.gabarit}`, err);
    return "indisponible";
  }
}

/**
 * Clé d'idempotence de « Votre commission est virée » : une par lot d'autofactures
 * virées ensemble. Triée, donc stable quel que soit l'ordre des numéros.
 */
export function jobIdVirementFait(numeros: readonly string[]): string {
  return `apporteur-virement-fait-${[...numeros].sort().join("-")}`;
}

/**
 * « Votre commission est virée » — envoyé à l'apporteur quand Williams clique
 * « Virement fait » dans la console. Texte non modifiable ; aucune date d'arrivée promise.
 */
export async function envoyerConfirmationVirement(e: {
  apporteurId: string;
  destinataire: string;
  contactName: string;
  montant: string;
  numeros: readonly string[];
  dateVirement: string;
}): Promise<ResultatEnvoi> {
  const numeros =
    e.numeros.length === 0
      ? null
      : e.numeros.length > 1
        ? `n° ${e.numeros.join(", n° ")}`
        : `n° ${e.numeros[0]}`;
  return envoyer({
    gabarit: "apporteur-virement-fait",
    destinataire: e.destinataire,
    entityType: "ApporteurReseau",
    entityId: e.apporteurId,
    jobId: jobIdVirementFait(e.numeros),
    payload: {
      contactName: e.contactName,
      montant: e.montant,
      ...(numeros ? { numeros } : {}),
      dateVirement: e.dateVirement,
    },
  });
}
