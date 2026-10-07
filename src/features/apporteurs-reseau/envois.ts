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

export type GabaritApporteur =
  | "apporteur-dossier-lien"
  | "apporteur-dossier-a-completer"
  | "apporteur-dossier-refuse"
  | "apporteur-dossier-a-verifier"
  | "apporteur-dossier-recu"
  | "apporteur-contrat-signe"
  | "apporteur-presentation-recue"
  | "apporteur-presentation-refusee"
  | "entreprise-prise-de-contact-apporteur"
  | "apporteur-vigilance"
  | "apporteur-commande-signee"
  | "apporteur-releve"
  | "apporteur-virement-fait";

export const GABARITS_APPORTEUR: readonly GabaritApporteur[] = [
  "apporteur-dossier-lien",
  "apporteur-dossier-a-completer",
  "apporteur-dossier-refuse",
  "apporteur-dossier-a-verifier",
  "apporteur-dossier-recu",
  "apporteur-contrat-signe",
  "apporteur-presentation-recue",
  "apporteur-presentation-refusee",
  "entreprise-prise-de-contact-apporteur",
  "apporteur-vigilance",
  "apporteur-commande-signee",
  "apporteur-releve",
  "apporteur-virement-fait",
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

export type ResultatEnvoi = "envoye" | "en-validation" | "retenu" | "indisponible";

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

export async function envoyer(e: EnvoiApporteur): Promise<ResultatEnvoi> {
  try {
    const jobId = e.jobId ? e.jobId.replace(/:/g, "-") : undefined;
    if (jobId) await retirerEnvoiEchoue(jobId);
    const r = await enqueueEmail(e.gabarit as EmailJobName, e.destinataire, "fr", e.payload, {
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
