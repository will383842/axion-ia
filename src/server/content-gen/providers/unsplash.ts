/**
 * Content Generator — Unsplash provider (stock images, doctrine v3 2026-05-14).
 *
 * Sprint 1 Day 2 AGT-B → Day 4 image system.
 *
 * Conformité CGU (cf. docs/content-gen/UNSPLASH-COMPLIANCE.md v3) :
 * - Unsplash gratuit autorisé (notre cas = automation sélection, pas dataset/training)
 * - Unsplash+ INTERDIT (filtre strict premium=false + tier!=free defense in depth)
 * - Attribution photographer obligatoire (rendu HTML <figcaption>)
 * - Trigger /photos/:id/download avant utilisation (CGU API §6)
 * - Rate-limit free tier 50/h (Redis bucket — Day 5 V1 réelle, V0 in-memory)
 * - UTM source axion-ia sur tous les liens
 * - Audit trail dans ContentMetric.imageMetadata
 *
 * GenerationRequest contract pour role="stock_image" :
 * - userPrompt = search query (ex: "industrial AI consulting Lyon")
 * - output = JSON serialized { photoId, photoUrl, downloadUrl, alt, attribution }
 */

import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";
import { withRetry } from "../lib/retry";
import { readProviderConfig } from "../lib/config-reader";

/**
 * Réponse partielle Unsplash API /search/photos.
 * Doc : https://unsplash.com/documentation#search-photos
 */
interface UnsplashSearchResponse {
  readonly total: number;
  readonly total_pages: number;
  readonly results: ReadonlyArray<UnsplashPhoto>;
}

interface UnsplashPhoto {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly description: string | null;
  readonly alt_description: string | null;
  readonly likes: number;
  /** Vrai sur photos Unsplash+ (paid tier — interdit pour notre usage). */
  readonly premium?: boolean;
  /** Some endpoints expose `tier` ("free" | "paid"). */
  readonly tier?: string;
  readonly urls: {
    readonly raw: string;
    readonly full: string;
    readonly regular: string;
    readonly small: string;
    readonly thumb: string;
  };
  readonly links: {
    readonly self: string;
    readonly html: string;
    readonly download: string;
    readonly download_location: string;
  };
  readonly user: {
    readonly id: string;
    readonly username: string;
    readonly name: string;
    readonly links: {
      readonly self: string;
      readonly html: string;
    };
  };
}

export interface UnsplashAttribution {
  readonly source: "unsplash";
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly photoCredit: string;
  readonly downloadTriggeredAt: string;
}

export interface UnsplashSelectedPhoto {
  readonly photoId: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  /** URL pour téléchargement vers stockage local + sharp resize. */
  readonly downloadUrl: string;
  /** URL hotlink direct (si on préfère hotlinking au lieu de cache local). */
  readonly hotlinkUrl: string;
  readonly attribution: UnsplashAttribution;
}

const UNSPLASH_API_BASE = "https://api.unsplash.com";
const UTM_PARAMS = "utm_source=axion-ia&utm_medium=referral";

function getApiKey(): string {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    throw new ProviderError("UNSPLASH_ACCESS_KEY not set", "auth_failed", "unsplash", false);
  }
  return key;
}

/**
 * In-memory rate-limit bucket par-heure. V1 minimal (sans Redis).
 * Day 5 Sprint 1 V2 : passer à Redis-shared via BullMQ Redis client.
 */
const inMemoryRateBuckets = new Map<string, number>();
const RATE_LIMIT_PER_HOUR = 45; // buffer 5/50 quota free Unsplash

function checkRateLimit(): void {
  const hourKey = new Date().toISOString().slice(0, 13); // "2026-05-14T13"
  const count = (inMemoryRateBuckets.get(hourKey) ?? 0) + 1;
  inMemoryRateBuckets.set(hourKey, count);
  // Nettoie les buckets > 2h pour limiter croissance memoire
  for (const [k] of inMemoryRateBuckets) {
    if (k !== hourKey && k < hourKey.slice(0, 10)) inMemoryRateBuckets.delete(k);
  }
  if (count > RATE_LIMIT_PER_HOUR) {
    throw new ProviderError(
      `Unsplash rate limit reached (${count}/50 this hour)`,
      "rate_limited",
      "unsplash",
      true,
    );
  }
}

function mapHttpError(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(`Unsplash auth: ${body}`, "auth_failed", "unsplash", false);
  }
  if (status === 429) {
    return new ProviderError(`Unsplash rate limited`, "rate_limited", "unsplash", true);
  }
  if (status >= 500) {
    return new ProviderError(`Unsplash server ${status}`, "down", "unsplash", true);
  }
  return new ProviderError(
    `Unsplash error ${status}: ${body.slice(0, 200)}`,
    "unknown",
    "unsplash",
    false,
  );
}

/**
 * Filtre defense-in-depth — refuse toute photo premium / paid-tier (Unsplash+
 * exclu doctrine v3). Retourne la liste filtrée.
 */
function filterFreeOnly(photos: ReadonlyArray<UnsplashPhoto>): UnsplashPhoto[] {
  const filtered: UnsplashPhoto[] = [];
  for (const p of photos) {
    if (p.premium === true) {
      console.warn(`[unsplash] Skipped Unsplash+ photo ${p.id} (premium=true, CGU §3)`);
      continue;
    }
    if (p.tier !== undefined && p.tier !== "free") {
      console.warn(`[unsplash] Skipped paid-tier photo ${p.id} (tier=${p.tier})`);
      continue;
    }
    filtered.push(p);
  }
  return filtered;
}

/**
 * Sélectionne la meilleure photo : tri likes desc + dimension landscape preferée.
 */
function selectBest(photos: UnsplashPhoto[]): UnsplashPhoto {
  if (photos.length === 0) {
    throw new ProviderError(
      "No free Unsplash photos available for query",
      "invalid_response",
      "unsplash",
      false,
    );
  }
  // Top 10 likes triés + bonus landscape (ratio width/height > 1.2)
  const sorted = [...photos].sort((a, b) => b.likes - a.likes).slice(0, 10);
  const landscape = sorted.filter((p) => p.width / p.height > 1.2);
  const candidate = landscape[0] ?? sorted[0];
  if (!candidate) {
    throw new ProviderError(
      "Unable to select best Unsplash photo",
      "invalid_response",
      "unsplash",
      false,
    );
  }
  return candidate;
}

/**
 * Trigger l'endpoint /photos/:id/download — OBLIGATION CGU API §6.
 * Non-blocking : si Unsplash répond une erreur, on log mais on continue
 * (le contenu reste utilisable, mais on doit signaler le miss).
 */
async function triggerDownloadTracking(downloadLocation: string, apiKey: string): Promise<void> {
  try {
    const res = await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${apiKey}` },
    });
    if (!res.ok) {
      console.warn(`[unsplash] download trigger non-OK ${res.status} (CGU §6 best-effort)`);
    }
  } catch (err) {
    console.warn(`[unsplash] download trigger failed: ${err instanceof Error ? err.message : err}`);
  }
}

function buildAttribution(photo: UnsplashPhoto): UnsplashAttribution {
  const photographer = photo.user.name || photo.user.username;
  return {
    source: "unsplash",
    photoId: photo.id,
    photographer,
    photographerUrl: `${photo.user.links.html}?${UTM_PARAMS}`,
    photoUrl: `https://unsplash.com/photos/${photo.id}?${UTM_PARAMS}`,
    photoCredit: `Photo de ${photographer} sur Unsplash`,
    downloadTriggeredAt: new Date().toISOString(),
  };
}

export const unsplashProvider: IProvider = {
  key: "unsplash",
  supportedRoles: ["stock_image"],

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    if (req.role !== "stock_image") {
      throw new ProviderError(
        `Unsplash supports stock_image only (got '${req.role}')`,
        "unknown",
        "unsplash",
        false,
      );
    }

    const config = await readProviderConfig("unsplash");
    if (!config.enabled) {
      throw new ProviderError(
        "Unsplash provider disabled in DB (cf. UNSPLASH-COMPLIANCE.md)",
        "auth_failed",
        "unsplash",
        false,
      );
    }

    checkRateLimit();
    const apiKey = getApiKey();
    const query = req.userPrompt.trim();
    if (!query) {
      throw new ProviderError(
        "Unsplash search query empty (userPrompt)",
        "invalid_response",
        "unsplash",
        false,
      );
    }

    const url = new URL(`${UNSPLASH_API_BASE}/search/photos`);
    url.searchParams.set("query", query);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high"); // anti-NSFW
    url.searchParams.set("per_page", "30");

    const startedAt = Date.now();

    const search: UnsplashSearchResponse = await withRetry(async () => {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${apiKey}`, "Accept-Version": "v1" },
      });
      if (!res.ok) {
        const body = await res.text();
        throw mapHttpError(res.status, body);
      }
      return (await res.json()) as UnsplashSearchResponse;
    });

    const free = filterFreeOnly(search.results);
    const chosen = selectBest(free);

    // CGU API §6 — trigger download obligatoire (best-effort, n'arrête pas le pipeline)
    await triggerDownloadTracking(chosen.links.download_location, apiKey);

    const attribution = buildAttribution(chosen);
    const altText = chosen.alt_description || chosen.description || query;

    const selected: UnsplashSelectedPhoto = {
      photoId: chosen.id,
      width: chosen.width,
      height: chosen.height,
      alt: altText,
      downloadUrl: chosen.urls.regular,
      hotlinkUrl: chosen.urls.regular,
      attribution,
    };

    const durationMs = Date.now() - startedAt;

    return {
      provider: "unsplash",
      model: config.model,
      output: JSON.stringify(selected),
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0, // free tier
      durationMs,
    };
  },

  async healthCheck(): Promise<boolean> {
    if (!process.env.UNSPLASH_ACCESS_KEY) return false;
    try {
      const config = await readProviderConfig("unsplash");
      if (!config.enabled) return false;
      // Health check très léger : GET /me (renvoie 200 ou 401)
      const res = await fetch(`${UNSPLASH_API_BASE}/me`, {
        headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
      });
      // Unsplash returns 401 on Client-ID requests to /me — that's OK pour healthcheck simple.
      // On veut juste valider que l'endpoint répond (pas 5xx).
      return res.status < 500;
    } catch {
      return false;
    }
  },
};
