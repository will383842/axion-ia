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
import type { SearchIntent } from "../../../prisma/generated/client";
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
  readonly search_intent: string | null;
  readonly cluster_id: string | null;
}

/**
 * Résultat enrichi de la sélection : le `term` (mot-clé) + ses métadonnées
 * structurées (table `keywords`). `searchIntent`/`clusterId` sont `null` en
 * mode fallback in-memory ou géo (les seeds ne portent pas ces colonnes).
 */
export interface SelectedKeyword {
  readonly term: string;
  /** Intent natif du mot-clé (colonne `search_intent`), si défini. */
  readonly searchIntent: string | null;
  /** Cluster sémantique (colonne `cluster_id`) — anti-cannibalisation. */
  readonly clusterId: string | null;
}

/**
 * Sélectionne le prochain keyword + ses métadonnées (intent + cluster).
 *
 * Lock atomique Postgres : `FOR UPDATE OF k SKIP LOCKED` garantit que 2 workers
 * parallèles ne réservent jamais le même keyword (content-gen-worker concurrence
 * 5-10).
 *
 * Anti-cannibalisation (2026-06-25) : l'`ORDER BY` privilégie d'abord le CLUSTER
 * le moins récemment utilisé (`cluster_last ASC NULLS FIRST`), puis la rotation
 * équitable par mot-clé. Effet : on étale la génération sur tous les clusters
 * sémantiques d'une vertical avant de réutiliser un cluster déjà couvert → on
 * évite de produire 2 articles concurrents sur la même intention de cluster
 * (cannibalisation SEO). Les mots-clés sans cluster (NULL) restent prioritaires
 * (NULLS FIRST), donc comportement inchangé pour eux.
 *
 * Retourne `null` si aucun keyword disponible (DB vide + seeds vides).
 * Fire-and-forget safe : les erreurs DB sont absorbées, fallback in-memory.
 */
export async function selectKeywordRich(
  options: SelectKeywordOptions,
): Promise<SelectedKeyword | null> {
  const { vertical, campaignId, city } = options;

  // 0. Mode géo à la volée — villes tier 3/4 non seedées en DB. Pas de
  //    métadonnées intent/cluster (keyword synthétisé à la volée).
  if (city) {
    const geoKws = generateGeoKeywords(vertical, city);
    if (geoKws.length > 0) {
      const counter = inMemoryCounters.get(`geo_${vertical}_${city.name}`) ?? 0;
      const kw = selectGeoKeyword(vertical, city, counter);
      inMemoryCounters.set(`geo_${vertical}_${city.name}`, counter + 1);
      return kw ? { term: kw, searchIntent: null, clusterId: null } : null;
    }
  }

  // 1. Tentative DB mode avec lock atomique + rotation cluster-aware (Postgres).
  //    Le LEFT JOIN sur l'agrégat `c` calcule, par cluster, la dernière
  //    utilisation (toutes verticals). `FOR UPDATE OF k` ne verrouille QUE la
  //    ligne keyword `k` (pas le côté nullable de l'outer join, interdit en PG).
  try {
    const rows = await prisma.$queryRaw<readonly AtomicSelectResult[]>`
      UPDATE keywords
      SET usage_count = usage_count + 1,
          last_used_at = NOW()
      WHERE id = (
        SELECT k.id FROM keywords k
        LEFT JOIN (
          SELECT cluster_id, MAX(last_used_at) AS cluster_last
          FROM keywords
          WHERE cluster_id IS NOT NULL
          GROUP BY cluster_id
        ) c ON c.cluster_id = k.cluster_id
        WHERE k.vertical = ${vertical}
        ORDER BY c.cluster_last ASC NULLS FIRST,
                 k.last_used_at ASC NULLS FIRST,
                 k.usage_count ASC,
                 k.term ASC
        FOR UPDATE OF k SKIP LOCKED
        LIMIT 1
      )
      RETURNING term, search_intent, cluster_id
    `;
    const row = rows[0];
    if (row?.term) {
      return {
        term: row.term,
        searchIntent: row.search_intent ?? null,
        clusterId: row.cluster_id ?? null,
      };
    }
    // DB vide pour cette vertical → fallback in-memory.
  } catch {
    // DB unavailable (build SSG, tests, bootstrap) → fallback in-memory.
  }

  // 2. Fallback in-memory depuis les seeds (pas de métadonnées intent/cluster).
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
    return null;
  }

  return { term: memTerm, searchIntent: null, clusterId: null };
}

/**
 * Variante rétro-compatible : retourne uniquement le `term` (string|null).
 * Conserve la signature historique pour les appelants qui n'ont pas besoin
 * des métadonnées. Délègue à `selectKeywordRich`.
 */
export async function selectKeyword(options: SelectKeywordOptions): Promise<string | null> {
  const r = await selectKeywordRich(options);
  return r?.term ?? null;
}

// ── Garde-fou intent (2026-06-25) ───────────────────────────────────────────────

/**
 * Normalise l'intent BRUT de la table `keywords` (vocabulaire mixte FR/custom du
 * seed : "transactionnel", "informationnel", "aeo", "comparatif", "sectoriel",
 * "benefice", "partenaire"…) vers l'enum `SearchIntent`. Retourne `null` pour les
 * valeurs sans intent de recherche propre (angles de contenu : sectoriel, benefice,
 * partenaire) → pas d'override. Idempotent sur les valeurs déjà-enum.
 */
export function normalizeKeywordIntent(raw: string | null): SearchIntent | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase();
  const map: Record<string, SearchIntent> = {
    // déjà enum (identité)
    informational: "informational",
    commercial_investigation: "commercial_investigation",
    transactional: "transactional",
    navigational: "navigational",
    local: "local",
    voice_search: "voice_search",
    ai_overview: "ai_overview",
    featured_snippet: "featured_snippet",
    // vocabulaire FR/custom du seed `keywords`
    informationnel: "informational",
    transactionnel: "transactional",
    comparatif: "commercial_investigation",
    aeo: "ai_overview",
    // NON mappés (angles de contenu, pas des intents de recherche) :
    //   sectoriel, benefice, partenaire → null (aucun override)
  };
  return map[k] ?? null;
}

/**
 * Content-types qui produisent TOUJOURS un `<table>` récapitulatif (cf. configs
 * commercial_investigation : comparison + vs_comparator + alternative_to +
 * top_x_in_y). Seuls ceux-là peuvent recevoir l'intent `commercial_investigation`
 * sans risquer le hard-fail "table manquante" du validateur d'intent (qui
 * rétrograde l'article en tier_3_noindex_nofollow).
 */
const TABLE_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "comparison",
  "vs_comparator",
  "alternative_to",
  "top_x_in_y",
]);

/**
 * Un intent cible est-il SÛR pour ce content-type, c.-à-d. son gate
 * `validateIntentAlignment` (hardFail → tier_3_noindex) sera-t-il satisfait par
 * le pipeline ? On n'autorise l'override QUE vers des intents garantis :
 *  - `informational` / `ai_overview` : gate = citations (≥3 / ≥2). TOUJOURS
 *    satisfait (appendSourcesSection injecte ≥4 liens d'autorité partout).
 *  - `commercial_investigation` : gate = `<table>`. Sûr UNIQUEMENT pour les
 *    content-types qui en produisent toujours un (TABLE_CONTENT_TYPES).
 * Les autres (transactional → CTA, local → JSON-LD geo, featured_snippet →
 * data-aeo tldr, voice_search → H1 question) ne sont PAS garantis selon le type
 * → on NE force PAS (on garde l'intent par défaut, indexable, plutôt que risquer
 * une rétrogradation noindex). Décision conservatrice = zéro régression SEO.
 */
function intentSafeForType(intent: SearchIntent, contentType: string): boolean {
  if (intent === "informational" || intent === "ai_overview") return true;
  if (intent === "commercial_investigation") return TABLE_CONTENT_TYPES.has(contentType);
  return false;
}

/**
 * Résout l'intent EFFECTIF d'un job en arbitrant entre l'intent du job
 * (choisi par la campagne / config globale) et l'intent natif du mot-clé.
 *
 * DEUX garde-fous cumulés (zéro régression) :
 *  1. `allowKeywordOverride` : l'intent du mot-clé ne prime QUE si la campagne
 *     n'a pas choisi de distribution d'intent (défaut "informational" hardcodé).
 *  2. `intentSafeForType` : on n'applique l'intent du mot-clé QUE si son gate
 *     d'alignement sera satisfait par ce content-type — sinon on garderait un
 *     article indexable qu'on rétrograderait en tier_3_noindex. Donc on ne force
 *     jamais un intent qui pourrait dégrader le SEO.
 *
 * Sûr aussi face aux données : `keywordIntent` null / hors-vocabulaire → ignoré.
 */
export function resolveEffectiveIntent(
  jobIntent: SearchIntent,
  keywordIntent: string | null,
  allowKeywordOverride: boolean,
  contentType: string,
): SearchIntent {
  if (!allowKeywordOverride) return jobIntent;
  const normalized = normalizeKeywordIntent(keywordIntent);
  if (!normalized) return jobIntent;
  if (normalized === jobIntent) return jobIntent;
  if (!intentSafeForType(normalized, contentType)) return jobIntent;
  return normalized;
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
