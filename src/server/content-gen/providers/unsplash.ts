/**
 * Content Generator — Unsplash stock images (V1 — doctrine v2.0 acté Will).
 *
 * Sprint 1 Day 1 AGT-B = STUB typé. Implémentation Day 4 § 09:00 :
 * - recherche par query (depuis seed `unsplash-search-queries.json`)
 * - sélection meilleure photo (heuristic likes + colors)
 * - rate-limit Redis `unsplash:rate:{Y-m-d-H}` (free tier 50/h)
 * - srcset auto 3 variantes (320w, 768w, 1280w) via sharp
 * - attribution photographer obligatoire dans metadata + alt text
 *
 * Q4 v2.0 acté Will (2026-05-14) : Unsplash uniquement, pas de génération IA
 * d'image V1 (réduit coût + qualité photographique garantie + crédit auteur).
 */

import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";

export const unsplashProvider: IProvider = {
  key: "unsplash",
  supportedRoles: ["stock_image"],

  async generate(_req: GenerationRequest): Promise<GenerationResponse> {
    if (!process.env.UNSPLASH_ACCESS_KEY) {
      throw new ProviderError("UNSPLASH_ACCESS_KEY not set", "auth_failed", "unsplash", false);
    }
    throw new ProviderError(
      "unsplash.generate not yet implemented (Sprint 1 Day 4)",
      "unknown",
      "unsplash",
      false,
    );
  },

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.UNSPLASH_ACCESS_KEY);
  },
};
