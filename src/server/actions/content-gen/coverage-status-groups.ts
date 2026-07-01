/**
 * Groupes de statuts de campagne pour l'ARCHIVAGE de la liste (2026-07-01).
 *
 * Sans champ dédié ni migration : une campagne "archivée" = un statut TERMINAL
 * (completed/failed/cancelled). La vue liste par défaut n'affiche que les
 * campagnes ACTIVES (non terminales) → auto-archivage gratuit dès qu'une
 * campagne se termine, sans encombrer la console.
 *
 * Fichier SANS "use server" (pure data) : importable par `coverage.ts`
 * (qui, en "use server", ne peut exporter que des fonctions async), par le
 * composant liste, et par les tests vitest.
 */

import type { CoverageStatus } from "../../../../prisma/generated/client";

/** Statuts non terminaux — affichés par défaut dans la liste. */
export const ACTIVE_CAMPAIGN_STATUSES: ReadonlyArray<CoverageStatus> = [
  "draft",
  "queued",
  "running",
  "paused",
  "scheduled",
];

/** Statuts terminaux — "archivés" (masqués par défaut, visibles via la vue dédiée). */
export const ARCHIVED_CAMPAIGN_STATUSES: ReadonlyArray<CoverageStatus> = [
  "completed",
  "failed",
  "cancelled",
];

/** Vue de la liste : actives (défaut) · archivées · toutes. */
export type CampaignListView = "active" | "archived" | "all";

/** Garde de type : normalise une valeur d'URL en vue valide (défaut "active"). */
export function parseCampaignListView(raw: string | undefined): CampaignListView {
  return raw === "archived" || raw === "all" ? raw : "active";
}
