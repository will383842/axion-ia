/**
 * Knowledge Base — 4 audiences.
 * Détermine visibilité runtime + sitemap inclusion + robots noindex.
 */

import type { KbAudience } from "../../../prisma/generated/client";

export const KB_AUDIENCES: readonly KbAudience[] = [
  "public",
  "client",
  "team",
  "will_only",
] as const;

export const KB_AUDIENCE_LABELS_FR: Record<KbAudience, string> = {
  public: "Public",
  client: "Client connecté",
  team: "Équipe interne",
  will_only: "Will uniquement",
};

export const KB_AUDIENCE_LABELS_EN: Record<KbAudience, string> = {
  public: "Public",
  client: "Authenticated client",
  team: "Internal team",
  will_only: "Will only",
};

export function getAudienceLabel(audience: KbAudience, locale: "fr" | "en"): string {
  return locale === "fr" ? KB_AUDIENCE_LABELS_FR[audience] : KB_AUDIENCE_LABELS_EN[audience];
}

/** Audiences qui apparaissent dans le sitemap public + indexables. */
export function isPublicAudience(audience: KbAudience): boolean {
  return audience === "public";
}

/** Audiences accessibles depuis surface client `/mes-ressources/`. */
export function isClientReadableAudience(audience: KbAudience): boolean {
  return audience === "public" || audience === "client";
}

/** Audiences réservées à l'admin (rôle >= editor). */
export function isTeamOnlyAudience(audience: KbAudience): boolean {
  return audience === "team" || audience === "will_only";
}
