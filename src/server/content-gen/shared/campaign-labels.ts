/**
 * Content-gen — Libellés FR d'une campagne de couverture (SSOT d'affichage).
 *
 * Une campagne (`CoverageCampaign`) est affichée par DEUX écrans : la liste
 * des campagnes (`coverage`) et la liste des lots géographiques
 * (`geo/batches`), qui lit la même table filtrée sur le périmètre. Chacun
 * portait sa propre table de libellés : la seconde ignorait `draft` et
 * laissait passer « DRAFT » et « multi » à l'écran.
 *
 * Fichier PUR (pas de "use server", pas d'I/O, pas de JSX). Les deux tables
 * sont typées `satisfies Record<EnumPrisma, string>` : une valeur d'enum
 * oubliée est une erreur de compilation, pas une chaîne anglaise en prod.
 */

import type { CoverageScope, CoverageStatus } from "../../../../prisma/generated/client";
import type { AdminTone } from "./admin-labels";

// ─── Périmètre (CoverageScope, 4 valeurs) ────────────────────────────────────
export const PERIMETRE_CAMPAGNE_LABELS_FR = {
  ville: "Une ville",
  departement: "Un département",
  region: "Une région",
  multi: "Plusieurs zones",
} as const satisfies Record<CoverageScope, string>;

/** Libellé FR d'un périmètre lu depuis un `string` ; l'inconnu est CITÉ. */
export function perimetreCampagneLabelFr(scope: string): string {
  return (PERIMETRE_CAMPAGNE_LABELS_FR as Record<string, string>)[scope] ?? `« ${scope} »`;
}

// ─── Statut (CoverageStatus, 8 valeurs) ──────────────────────────────────────
export const STATUT_CAMPAGNE_LABELS_FR = {
  draft: "Brouillon",
  scheduled: "Planifiée",
  queued: "En file",
  running: "En cours",
  paused: "En pause",
  completed: "Terminée",
  failed: "Échouée",
  cancelled: "Annulée",
} as const satisfies Record<CoverageStatus, string>;

/** Libellé FR d'un statut de campagne lu depuis un `string` ; l'inconnu est CITÉ. */
export function statutCampagneLabelFr(status: string): string {
  return (STATUT_CAMPAGNE_LABELS_FR as Record<string, string>)[status] ?? `« ${status} »`;
}

export const STATUT_CAMPAGNE_TONE = {
  draft: "neutral",
  scheduled: "warning",
  queued: "warning",
  running: "warning",
  paused: "warning",
  completed: "success",
  failed: "destructive",
  cancelled: "neutral",
} as const satisfies Record<CoverageStatus, AdminTone>;

export function statutCampagneTone(status: string): AdminTone {
  return (STATUT_CAMPAGNE_TONE as Record<string, AdminTone>)[status] ?? "neutral";
}
