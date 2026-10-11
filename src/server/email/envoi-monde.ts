/**
 * Module d'envoi « monde » (FAC-1, ADR 0066, règles R-C1 à R-C3).
 *
 * Ce que chaque réseau (apporteurs aujourd'hui, formateurs demain) partage pour
 * enfiler ses e-mails : aperçu exact, texte réécrit, retrait d'un job échoué,
 * résultat typé, lien d'espace recalculé. Ce qui change d'un monde à l'autre
 * (gabarits, texte par défaut, calcul du lien) arrive par l'ADAPTATEUR, jamais
 * par une condition ici.
 *
 * ⚠️ Chaque adaptateur garde SON appel à `enqueueEmail` et la liste littérale de
 * ses gabarits : le catalogue des e-mails retrouve l'émetteur d'un gabarit à son
 * nom écrit dans le fichier qui enfile (`apercu/catalogue.spec.ts`).
 */

import { renderEmailTemplate } from "@/lib/email/templates";
import type { TexteParDefaut } from "@/lib/email/texte-par-defaut";
import { emailsQueue } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";

/**
 * `fiche-retiree` : la personne n'est plus dans le réseau et l'e-mail n'est pas
 * lié à l'argent — il ne part pas.
 */
export type ResultatEnvoi =
  "envoye" | "en-validation" | "retenu" | "indisponible" | "fiche-retiree";

/** L'aperçu exact d'un e-mail, plus (si modifiable) son texte par défaut en texte brut. */
export interface ApercuRendu<G extends string = string> {
  gabarit: G;
  sujet: string;
  html: string;
  destinataire: string;
  /** Texte principal par défaut, pour pré-remplir « Modifier le texte » ; absent si non modifiable. */
  texteDefaut?: string;
}

export type { TexteParDefaut };

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

/** L'e-mail exact (vrai gabarit), sans rien envoyer. */
export async function apercuGabarit<G extends string>(
  e: { gabarit: G; destinataire: string; payload: Record<string, unknown> },
  texteParDefaut: TexteParDefaut,
): Promise<ApercuRendu<G>> {
  const r = await renderEmailTemplate(e.gabarit as unknown as EmailJobName, "fr", e.payload, {
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
    ...(texteDefaut !== null ? { texteDefaut: texteDefaut as string } : {}),
  };
}

/** La réponse d'`enqueueEmail`, traduite pour l'écran (l'ordre des tests compte). */
export function resultatDeLEnfilage(r: {
  enqueued: boolean;
  garePourValidation?: boolean | undefined;
  /** Le motif de la retenue (liste de suppression, opposition…), ou rien. */
  retenu?: string | boolean | undefined;
}): ResultatEnvoi {
  if (r.garePourValidation) return "en-validation";
  if (r.enqueued) return "envoye";
  return r.retenu ? "retenu" : "indisponible";
}

/** BullMQ refuse `:` dans un identifiant de job personnalisé. */
export function jobIdSansDeuxPoints(jobId: string | undefined): string | undefined {
  return jobId ? jobId.replace(/:/g, "-") : undefined;
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
 * « Ouvrir mon espace » : le lien est TOUJOURS recalculé par l'adaptateur. Un
 * `lienEspace` reçu dans le payload est retiré ou écrasé, jamais repris.
 * Fail-soft : sans lien (ou sur erreur), l'e-mail part tel quel.
 */
export async function avecLienEspaceRecalcule(
  payload: Record<string, unknown>,
  calculer: () => Promise<string | null>,
): Promise<Record<string, unknown>> {
  const { lienEspace: _ignore, ...sansLien } = payload;
  try {
    const lien = await calculer();
    return lien ? { ...sansLien, lienEspace: lien } : sansLien;
  } catch {
    return sansLien;
  }
}
