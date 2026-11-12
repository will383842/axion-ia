// Base unique du chatbot (chantier V3-3, 2026-11-11) — lecteur KnowledgeEntry.
//
// Aujourd'hui le chatbot lit sa COPIE `chat_kb_chunks` (ingestion T-05). Ce module
// prépare la lecture directe des fiches publiées `knowledge_entries` /
// `knowledge_translations` (FTS `search_vector` fr_unaccent, déjà indexé GIN).
//
// ⛔ INTERRUPTEUR `CHATBOT_KB_UNIFIED` — ÉTEINT PAR DÉFAUT. Seule la valeur exacte
// "true" l'allume. Éteint, `rechercheChatbot` délègue à `hybridSearch` avec les
// MÊMES arguments et rend SON résultat tel quel (même référence) : le chatbot ne
// change rien. Allumé, il fusionne (RRF) les fiches publiées avec `chat_kb_chunks`
// et se replie sur `chat_kb_chunks` seul si la lecture est vide ou échoue. Il
// n'écrit alors rien dans le cache sémantique (cf. orchestrator.ts) : couper la
// variable suffit à revenir en arrière, sans réponse « fiches » restée en cache.
//
// Lecture seule : un unique SELECT paramétré ($queryRaw). Aucune écriture, aucune
// migration, aucune suppression de `chat_kb_chunks`.

import { prisma } from "@/lib/prisma";
import { resolvePriceTokens } from "@/content/pricing-tokens";
import { RETRIEVAL_TOP_K } from "@/server/chatbot/constants";
import {
  hybridSearch,
  reciprocalRankFusion,
  type RetrievedChunk,
} from "@/server/chatbot/retrieval/hybrid-search";

/** Longueur max d'un passage injecté au prompt (comparable à un chunk T-05). */
export const KE_CONTENU_MAX = 1_800;

/** L'interrupteur n'est allumé QUE par la valeur exacte "true". */
type Env = Readonly<Record<string, string | undefined>>;

export function estKbUnifieeActive(env: Env = process.env): boolean {
  return env.CHATBOT_KB_UNIFIED === "true";
}

export interface KnowledgeEntryRow {
  slug: string;
  type: string;
  title: string;
  excerpt: string | null;
  body_text: string | null;
}

/** Requête SQL (lecture seule) — injectable pour les tests. */
export type KnowledgeEntryQuery = (question: string, topK: number) => Promise<KnowledgeEntryRow[]>;

/**
 * Fiches PUBLIQUES et PUBLIÉES uniquement (mêmes garde-fous que la recherche
 * publique `search-fts.ts`) : non supprimées, `status = published`,
 * `audience = public`, `confidentiality = public`, publication et embargo échus.
 */
const requeteKnowledgeEntry: KnowledgeEntryQuery = (question, topK) =>
  prisma.$queryRaw<KnowledgeEntryRow[]>`
    SELECT ke.slug, ke.type::text AS type, kt.title, kt.excerpt, kt.body_text
    FROM knowledge_translations kt
    JOIN knowledge_entries ke ON ke.id = kt.entry_id,
         websearch_to_tsquery('fr_unaccent', ${question}) AS q
    WHERE kt.locale = 'fr'::"Locale"
      AND ke.deleted_at IS NULL
      AND ke.status = 'published'::"KbStatus"
      AND ke.audience = 'public'::"KbAudience"
      AND ke.confidentiality = 'public'::"KbConfidentiality"
      AND (ke.published_at IS NULL OR ke.published_at <= NOW())
      AND (ke.embargo_until IS NULL OR ke.embargo_until <= NOW())
      AND (ke.expires_at IS NULL OR ke.expires_at > NOW())
      AND kt.search_vector @@ q
    ORDER BY ts_rank_cd(kt.search_vector, q) DESC, ke.published_at DESC NULLS LAST
    LIMIT ${topK}
  `;

const MONTANT_RE = /(\d[\d\s\u00a0\u202f.]*\d|\d)(?:,\d+)?\s*(?:k\s*)?(?:€|euros?\b|EUR\b)/gi;

/** Montants en euros cités, autres que 1 490 (Journée IA, seul prix affiché). */
export function montantsHorsJourneeIa(texte: string): string[] {
  const hors: string[] = [];
  for (const m of texte.matchAll(MONTANT_RE)) {
    const n = Number((m[1] ?? "").replace(/[\s\u00a0\u202f.]/g, ""));
    if (n !== 1490) hors.push(m[0].trim());
  }
  return hors;
}

/** Passage injecté : titre + chapeau + corps, tokens prix résolus, borné. */
export function contenuDeFiche(r: KnowledgeEntryRow): string {
  const brut = [r.title, r.excerpt, r.body_text]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  const resolu = resolvePriceTokens(brut, "fr");
  return resolu.length > KE_CONTENU_MAX ? `${resolu.slice(0, KE_CONTENU_MAX)}…` : resolu;
}

/**
 * Score : même échelle que `hybridSearch` en FTS seul (RRF k0=60, une liste),
 * pour que le seuil de confiance T-11 se lise pareil sur les deux sources.
 */
const scoreDeRang = (rang: number): number => 1 / (60 + rang + 1);

/** Cherche dans les fiches KnowledgeEntry publiées. Lecture seule. */
export async function chercherDansKnowledgeEntry(
  question: string,
  opts: { topK?: number; query?: KnowledgeEntryQuery } = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? RETRIEVAL_TOP_K;
  const query = opts.query ?? requeteKnowledgeEntry;
  if (!question.trim()) return [];
  const rows = await query(question, topK);
  return (
    rows
      .map((r, rang) => ({
        id: `ke:${r.slug}`,
        sourceType: "knowledge_entry",
        sourceRef: r.slug,
        categorie: r.type,
        contenu: contenuDeFiche(r),
        contexte: `Fiche de la base de connaissances — ${r.title}`,
        score: scoreDeRang(rang),
      }))
      // Une fiche qui cite un autre montant que 1 490 € n'entre pas au prompt.
      .filter((c) => c.contenu.length > 0 && montantsHorsJourneeIa(c.contenu).length === 0)
  );
}

/** Borne de lecture des fiches : au-delà, on se replie sur la recherche actuelle. */
export const FICHES_DELAI_MAX_MS = 1_500;

/** Rejette si `p` ne répond pas avant `ms` (le minuteur est toujours libéré). */
function avecDelai<T>(p: Promise<T>, ms: number): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejet) => {
    minuteur = setTimeout(() => rejet(new Error(`lecture des fiches > ${ms} ms`)), ms);
  });
  return Promise.race([p, limite]).finally(() => clearTimeout(minuteur));
}

export interface RechercheChatbotDeps {
  readonly env?: Env;
  /** Borne de lecture des fiches (ms) — 1 500 par défaut ; injectable pour les tests. */
  readonly delaiFichesMs?: number;
  readonly hybrid?: typeof hybridSearch;
  readonly knowledgeEntry?: typeof chercherDansKnowledgeEntry;
}

/**
 * Point d'entrée du retrieval du chatbot (même signature que `hybridSearch`).
 * Interrupteur éteint → `hybridSearch` à l'identique (mêmes arguments, même
 * objet rendu). Allumé → fiches KnowledgeEntry FUSIONNÉES (RRF) avec la base
 * actuelle : les faits vérifiés (kb_fact, FAQ) ne sortent pas du prompt. Si la
 * lecture des fiches est vide, échoue ou dépasse 1,5 s → repli : résultat de
 * `hybridSearch` seul.
 *
 * ⚠️ Seuil de confiance : `assessConfidence` (retrieval/confidence.ts) divise par
 * RRF_MAX = 2/61 ; le rerank Voyage garde les scores RRF. Score normalisé du 1er
 * passage fusionné = (1/61) ÷ (2/61) = 0,5 > seuil 0,35 : allumé, le seuil ne
 * déclenche l'escalade que s'il n'y a AUCUN résultat. À traiter avant mise en
 * service.
 *
 * Note : le cache sémantique est clé sur la version de knowledge DÉCALÉE par
 * l'interrupteur (`versionDeCle`, semantic-cache/cache.ts) : une réponse mise en cache
 * avant l'allumage n'est plus servie une fois allumé.
 */
export function creerRechercheChatbot(deps: RechercheChatbotDeps = {}): typeof hybridSearch {
  const hybrid = deps.hybrid ?? hybridSearch;
  const ke = deps.knowledgeEntry ?? chercherDansKnowledgeEntry;
  return async (tenantId, query, opts = {}) => {
    if (!estKbUnifieeActive(deps.env ?? process.env)) return hybrid(tenantId, query, opts);
    // Fiches et recherche actuelle partent EN PARALLÈLE : la lecture des fiches,
    // bornée à 1,5 s, n'ajoute donc aucune latence à la recherche actuelle.
    const [lecture, actuelle] = await Promise.allSettled([
      avecDelai(
        Promise.resolve().then(() => ke(query, opts.topK !== undefined ? { topK: opts.topK } : {})),
        deps.delaiFichesMs ?? FICHES_DELAI_MAX_MS,
      ),
      hybrid(tenantId, query, opts),
    ]);
    // La recherche actuelle en erreur reste une erreur (comportement d'avant).
    if (actuelle.status === "rejected") throw actuelle.reason;
    const chunks = actuelle.value;
    let fiches: RetrievedChunk[] = [];
    if (lecture.status === "fulfilled") {
      fiches = lecture.value;
    } else {
      console.warn(
        "[chatbot:kb-unifiee] lecture KnowledgeEntry en erreur ou trop lente → repli chat_kb_chunks:",
        lecture.reason,
      );
    }
    // Doublon : une fiche déjà présente dans les chunks est ignorée. Les chunks
    // découpés portent un sourceRef `slug#i` (ingestion/ingest.ts) : on retire le
    // suffixe avant de comparer. Seules les FAQ (sourceRef = slug) peuvent coïncider.
    const refsConnues = new Set(chunks.map((c) => c.sourceRef.replace(/#\d+$/, "")));
    fiches = fiches.filter((f) => !refsConnues.has(f.sourceRef));
    if (fiches.length === 0) return chunks;
    const topK = opts.topK ?? RETRIEVAL_TOP_K;
    return reciprocalRankFusion<RetrievedChunk>([fiches, chunks], { topK }).map(
      ({ item, score }) => ({
        ...item,
        score,
      }),
    );
  };
}

export const rechercheChatbot: typeof hybridSearch = creerRechercheChatbot();
