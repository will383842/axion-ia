/**
 * Content Generator — Keyword Selector (B.5 P1.5 2026-05-21).
 *
 * Selectionne le prochain keyword a utiliser pour un type de contenu donne,
 * en privilegiant la rotation equitable (lastUsedAt ASC NULLS FIRST) pour
 * maximiser la couverture de la longue traine.
 *
 * Deux modes :
 *  1. DB mode (production) : table `keywords` seedee (747 seeds via
 *     prisma/seeds/content-gen/seed-keywords.ts). Reservation atomique via
 *     `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)
 *     RETURNING term` — pattern canonique Postgres pour file de travail
 *     concurrente sans doublons sur N workers paralleles.
 *  2. Fallback in-memory : si DB vide/unavailable, on puise dans les seeds
 *     en memoire avec compteur round-robin par module.
 *
 * Utilisation dans les generators :
 *   if (!input.primaryKeyword) {
 *     input.primaryKeyword = await selectKeyword({ vertical: 'audits' });
 *   }
 */

import { prisma } from "@/lib/prisma";
import { ALL_KEYWORD_SEEDS } from "@/content/keywords/master";
import type { KeywordModule } from "@/content/keywords/types";
import { generateGeoKeywords, selectGeoKeyword } from "./keyword-templates";
import type { CityRef } from "./keyword-templates";

// ── Mapping vertical (ServiceSector) → KeywordModule ─────────────────────────

const VERTICAL_TO_MODULE: Record<string, KeywordModule> = {
  audits: "audit",
  interventions_formations: "interventions-formations",
  implementations: "implementation",
  un_a_un: "coaching-1-to-1",
  sites_web_augmentes: "codage-developpement",
  // Fallback generique pour les jobs sans secteur cible.
  transversal: "transversal",
};

// ── Round-robin in-memory fallback ─────────────────────────────────────────────

const inMemoryCounters = new Map<string, number>();

function selectFromMemory(vertical: string): string | null {
  const mod = VERTICAL_TO_MODULE[vertical] ?? "transversal";
  const pool = ALL_KEYWORD_SEEDS.filter((s) => s.module === mod);
  if (pool.length === 0) {
    const all = ALL_KEYWORD_SEEDS;
    if (all.length === 0) return null;
    const idx = (inMemoryCounters.get("__all") ?? 0) % all.length;
    inMemoryCounters.set("__all", idx + 1);
    return all[idx]?.keyword ?? null;
  }
  const idx = (inMemoryCounters.get(mod) ?? 0) % pool.length;
  inMemoryCounters.set(mod, idx + 1);
  return pool[idx]?.keyword ?? null;
}

/** Reset du compteur in-memory — tests uniquement. */
export function __resetInMemoryCounters(): void {
  inMemoryCounters.clear();
}

// ── Interface publique ────────────────────────────────────────────────────────

export interface SelectKeywordOptions {
  /** Vertical Axion-IA (ServiceSector slug). Ex: 'audits', 'interventions_formations'. */
  readonly vertical: string;
  /** ContentType hint pour affiner la selection (optionnel). */
  readonly contentType?: string;
  /**
   * Phase 6 Sprint Perfection 2026-05-22 — ID ville pour keywords géo à la volée.
   * Si fourni + ville pas dans les 100 seeds en dur : génère keyword géo via keyword-templates.ts.
   */
  readonly city?: CityRef;
  /**
   * P1-8 — ID de la campagne appelante (ContentGenJob.campaignId).
   * Utilise pour le log structure keyword_select_exhausted et reserve
   * pour un futur filtre SQL quand la table `keywords` aura un campaign_id.
   *
   * TODO(P1-8): Une fois la colonne keywords.campaign_id ajoutee via migration,
   * activer le filtre AND campaign_id = <campaignId> dans la requete SKIP LOCKED
   * pour isoler les pools entre campagnes de meme vertical (ex: Paris x formation
   * vs Lyon x formation ne partagent plus le meme pool).
   */
  readonly campaignId?: string;
}

interface AtomicSelectResult {
  readonly term: string;
}

/**
 * Selectionne le prochain keyword pour le pipeline.
 *
 * Lock atomique Postgres : `SELECT ... FOR UPDATE SKIP LOCKED` garantit que
 * 2 workers paralleles ne reservent jamais le meme keyword (utilise dans
 * content-gen-worker concurrence 5-10).
 *
 * Retourne `null` si aucun keyword disponible (DB vide + seeds vides).
 * Fire-and-forget safe : les erreurs DB sont absorbees, fallback in-memory.
 */
export async function selectKeyword(options: SelectKeywordOptions): Promise<string | null> {
  const { vertical, campaignId, city } = options;

  // 0. Mode géo à la volée — villes tier 3/4 non seedées en DB.
  if (city) {
    const geoKws = generateGeoKeywords(vertical, city);
    if (geoKws.length > 0) {
      // Rotation simple basée sur le compteur in-memory de la vertical.
      const counter = inMemoryCounters.get(`geo_${vertical}_${city.name}`) ?? 0;
      const kw = selectGeoKeyword(vertical, city, counter);
      inMemoryCounters.set(`geo_${vertical}_${city.name}`, counter + 1);
      return kw;
    }
  }

  // 1. Tentative DB mode avec lock atomique (Postgres-only).
  try {
    const rows = await prisma.$queryRaw<readonly AtomicSelectResult[]>`
      UPDATE keywords
      SET usage_count = usage_count + 1,
          last_used_at = NOW()
      WHERE id = (
        SELECT id FROM keywords
        WHERE vertical = ${vertical}
        ORDER BY last_used_at ASC NULLS FIRST, usage_count ASC, term ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING term
    `;
    const term = rows[0]?.term ?? null;
    if (term) return term;
    // DB vide pour cette vertical → fallback in-memory.
  } catch {
    // DB unavailable (build SSG, tests, bootstrap) → fallback in-memory.
  }

  // 2. Fallback in-memory depuis les seeds 747.
  const memTerm = selectFromMemory(vertical);

  // P2-4 — Log structure si tous les keywords sont epuises (DB vide + seeds vides).
  if (memTerm === null) {
    console.warn(
      JSON.stringify({
        event: "keyword_select_exhausted",
        campaignId: campaignId ?? null,
        vertical,
        timestamp: new Date().toISOString(),
        message: "Tous les keywords de cette campagne sont epuises ou verrouilles",
      }),
    );
  }

  return memTerm;
}

/**
 * Normalisation FR : lowercase + strip accents + trim espaces.
 * Utilise `̀-ͯ` (combining diacritical marks) pour eviter
 * tout caractere invisible dans la regex source.
 */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Valide que le keyword (ou une forme normalisee) apparait dans le titre.
 * - Match exact normalise : ok.
 * - Sinon, si keyword >= 3 mots significatifs : ok si >= 60% des mots presents.
 *
 * Non-bloquant : retourne un boolean (warning seulement dans le worker).
 */
export function validateKeywordInTitle(title: string, keyword: string): boolean {
  const normTitle = normalize(title);
  const normKw = normalize(keyword);
  if (normTitle.includes(normKw)) return true;

  const kwWords = normKw.split(/\s+/).filter((w) => w.length > 2);
  if (kwWords.length < 3) return false;
  const matchCount = kwWords.filter((w) => normTitle.includes(w)).length;
  return matchCount >= Math.ceil(kwWords.length * 0.6);
}
