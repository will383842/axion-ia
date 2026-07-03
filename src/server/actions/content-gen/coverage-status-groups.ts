/**
 * Groupes de statuts + vues de la liste des campagnes de couverture.
 *
 * Refonte 2026-07-03 : l'archivage devient EXPLICITE via le champ
 * `CoverageCampaign.archivedAt` (migration `..._coverage_campaign_archived_at`),
 * orthogonal au statut. On peut donc archiver/désarchiver n'importe quelle
 * campagne (même en pause ou brouillon) réversiblement, sans changer son statut.
 *
 * Les vues de la liste ne mélangent plus les statuts : on distingue clairement
 * « Actives » (en cours + en pause + brouillons, non archivées), « En pause »,
 * « Terminées » et « Archivées ». cf. `listCampaigns` dans `coverage.ts`.
 *
 * Fichier SANS "use server" (pure data) : importable par `coverage.ts`
 * (qui, en "use server", ne peut exporter que des fonctions async), par le
 * composant liste, et par les tests vitest.
 */

import type { CoverageStatus } from "../../../../prisma/generated/client";

/** Statuts non terminaux — une campagne « vivante » (en cours / à venir). */
export const ACTIVE_CAMPAIGN_STATUSES: ReadonlyArray<CoverageStatus> = [
  "draft",
  "queued",
  "running",
  "paused",
  "scheduled",
];

/** Statuts terminaux — campagne « Terminée » (finie / échouée / annulée). */
export const TERMINAL_CAMPAIGN_STATUSES: ReadonlyArray<CoverageStatus> = [
  "completed",
  "failed",
  "cancelled",
];

/**
 * @deprecated Alias historique (PR #185) — conservé pour compat des imports.
 * Utiliser `TERMINAL_CAMPAIGN_STATUSES`. « Archivé » se lit désormais via
 * `archivedAt`, pas via le statut.
 */
export const ARCHIVED_CAMPAIGN_STATUSES = TERMINAL_CAMPAIGN_STATUSES;

/**
 * Vue de la liste :
 * - `active` (défaut) : non archivées + statut non terminal (en cours/pause/brouillon)
 * - `paused` : non archivées + en pause
 * - `terminated` : non archivées + terminées (finie/échouée/annulée)
 * - `archived` : archivées (archivedAt renseigné), quel que soit le statut
 * - `all` : toutes, sans filtre
 */
export type CampaignListView = "active" | "paused" | "terminated" | "archived" | "all";

const VALID_VIEWS: ReadonlyArray<CampaignListView> = [
  "active",
  "paused",
  "terminated",
  "archived",
  "all",
];

/** Garde de type : normalise une valeur d'URL en vue valide (défaut "active"). */
export function parseCampaignListView(raw: string | undefined): CampaignListView {
  return VALID_VIEWS.includes(raw as CampaignListView) ? (raw as CampaignListView) : "active";
}
