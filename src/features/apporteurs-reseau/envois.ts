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

import * as Sentry from "@sentry/nextjs";

import { renderEmailTemplate } from "@/lib/email/templates";
import { texteParDefaut } from "@/lib/email/templates/apporteur-demarrage";
import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";

export type GabaritApporteur =
  | "apporteur-dossier-lien"
  | "apporteur-dossier-a-completer"
  | "apporteur-dossier-refuse"
  | "apporteur-dossier-a-verifier"
  | "apporteur-contrat-signe"
  | "apporteur-presentation-recue"
  | "apporteur-presentation-refusee"
  | "entreprise-prise-de-contact-apporteur"
  | "apporteur-vigilance"
  | "apporteur-commande-signee"
  | "apporteur-releve";

export const GABARITS_APPORTEUR: readonly GabaritApporteur[] = [
  "apporteur-dossier-lien",
  "apporteur-dossier-a-completer",
  "apporteur-dossier-refuse",
  "apporteur-dossier-a-verifier",
  "apporteur-contrat-signe",
  "apporteur-presentation-recue",
  "apporteur-presentation-refusee",
  "entreprise-prise-de-contact-apporteur",
  "apporteur-vigilance",
  "apporteur-commande-signee",
  "apporteur-releve",
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

export async function envoyer(e: EnvoiApporteur): Promise<ResultatEnvoi> {
  try {
    const r = await enqueueEmail(e.gabarit as EmailJobName, e.destinataire, "fr", e.payload, {
      entityType: e.entityType,
      entityId: e.entityId,
      ...(e.jobId ? { jobId: e.jobId.replace(/:/g, "-") } : {}),
      ...(e.attachments ? { attachments: e.attachments } : {}),
    });
    if (r.garePourValidation) return "en-validation";
    if (r.enqueued) return "envoye";
    return r.retenu ? "retenu" : "indisponible";
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-reseau", gabarit: e.gabarit } });
    return "indisponible";
  }
}
