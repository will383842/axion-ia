/**
 * Content Generator — KB V4 client (READ-ONLY wrapper § 11.1 master prompt v2.5).
 *
 * Sprint 1 Day 4 AGT-E. Consomme les helpers KB V4 codés mergés `bd0f831` :
 * - searchKnowledge (FTS Postgres tsvector + trigram)
 * - generateEmbedding (Voyage AI dim 1024 — V1 stub SHA-256)
 * - prisma.knowledgeEntry/Translation/Embedding (lecture seule)
 *
 * Interdictions strictes (cf. references/kb-doctrine.md v2.0) :
 * - JAMAIS prisma.knowledgeEntry.create/update/delete depuis content-gen
 * - JAMAIS migration sur tables Knowledge*
 * - Embedding TOUJOURS via generateEmbedding (pas OpenAI/Cohere/etc.)
 * - Write KB → POST /api/internal/kb/ingest HMAC (cf. Sprint 5 kb-feeder.ts)
 */

import { searchKnowledge } from "@/lib/knowledge/search-fts";
import { searchKnowledgeVector } from "@/lib/knowledge/search-vector";
import { generateEmbedding } from "@/lib/knowledge/embeddings";
import { resolvePriceTokens } from "@/content/pricing-tokens";
import { prisma } from "@/lib/prisma";
import type { KbAudience, KbType, Locale } from "../../../prisma/generated/client";

export interface KbRetrieveOptions {
  readonly query: string;
  readonly locale: Locale;
  readonly k?: number;
  readonly filters?: {
    readonly types?: ReadonlyArray<KbType>;
    readonly audiences?: ReadonlyArray<KbAudience>;
  };
  readonly sectorTagSlugs?: ReadonlyArray<string>;
  readonly mode?: "fts" | "vector" | "hybrid";
}

export interface KbRetrievedChunk {
  readonly entryId: string;
  readonly translationId: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string | null;
  readonly type: KbType;
  readonly locale: Locale;
  readonly ftsRank?: number;
  readonly similarity?: number;
  /** Mode réellement utilisé pour trouver ce passage (voir `ModeRecherche`). */
  readonly modeUtilise?: ModeRecherche;
}

/**
 * Mode réellement utilisé. `fts_repli` = on demandait du vectoriel mais il n'a rien
 * renvoyé (clé Voyage absente, base non vectorisée, erreur) : on est retombé sur le lexical.
 */
export type ModeRecherche = "fts" | "vector" | "hybrid" | "fts_repli";

export interface KbRetrieveResult {
  readonly chunks: KbRetrievedChunk[];
  readonly modeDemande: "fts" | "vector" | "hybrid";
  readonly modeUtilise: ModeRecherche;
}

/** Similarité cosine minimale d'un passage vectoriel (en dessous, c'est du bruit). */
export const SEUIL_SIMILARITE_VECTEUR = 0.35;

/** Taille maximale de l'extrait remis au modèle, en caractères. */
export const EXTRAIT_MAX_CARACTERES = 600;

/** Fiches dépréciées exclues du RAG des articles. */
const STATUTS_RAG = ["published"] as const;

/**
 * Retire le préfixe « Axion-IA » que les générateurs collent devant la requête :
 * il est présent dans toutes les fiches, il noie donc le vrai sujet (en FTS comme en vectoriel).
 * Si la requête ne contient que ce mot, on la garde telle quelle.
 */
export function nettoyerRequete(query: string): string {
  const sans = query.replace(/^\s*axion[-\s]?ia\b[\s:,.-]*/i, "").trim();
  return sans.length > 0 ? sans : query.trim();
}

/** Constante RRF (Reciprocal Rank Fusion) — standard littérature IR. */
const RRF_K = 60;

/** Recherche FTS lexicale (tsvector). */
async function retrieveFts(opts: KbRetrieveOptions, k: number): Promise<KbRetrievedChunk[]> {
  const filters = opts.filters ?? {};
  const result = await searchKnowledge({
    query: opts.query,
    locale: opts.locale,
    ...(filters.types && filters.types.length > 0 ? { types: [...filters.types] } : {}),
    audiences:
      filters.audiences && filters.audiences.length > 0 ? [...filters.audiences] : ["public"],
    ...(opts.sectorTagSlugs ? { sectorTagSlugs: [...opts.sectorTagSlugs] } : {}),
    limit: k,
    offset: 0,
    statuts: STATUTS_RAG,
  });
  // Seuil FTS : un rang nul = aucun recouvrement utile, on ne le remet pas au modèle.
  return result.hits
    .filter((it) => it.rank > 0)
    .map((it) => ({
      entryId: it.entryId,
      translationId: it.translationId,
      title: it.title,
      slug: it.slug,
      excerpt: it.excerpt,
      type: it.type,
      locale: it.locale,
      ftsRank: it.rank,
    }));
}

/**
 * Recherche vectorielle cosine. Retourne `[]` (sans throw) si l'embedding réel
 * n'est pas disponible — clé Voyage absente (embedding "-stub" non sémantique),
 * table d'embeddings vide, ou erreur réseau — pour que l'appelant retombe sur
 * le FTS. C'est la garantie « zéro casse » tant que la KB n'est pas embeddée.
 */
async function retrieveVector(opts: KbRetrieveOptions, k: number): Promise<KbRetrievedChunk[]> {
  try {
    // `query` : Voyage traite la question autrement qu'un document rangé.
    const emb = await generateEmbedding(opts.query, "public", "query");
    // Embedding stub (hash SHA-256, sans VOYAGE_API_KEY) = inutile sémantiquement.
    // On l'ignore pour ne pas polluer les résultats avec du bruit.
    if (emb.modelVersion.endsWith("-stub")) return [];

    const filters = opts.filters ?? {};
    const result = await searchKnowledgeVector({
      queryEmbedding: emb.embedding,
      locale: opts.locale,
      ...(filters.types && filters.types.length > 0 ? { types: [...filters.types] } : {}),
      audiences:
        filters.audiences && filters.audiences.length > 0 ? [...filters.audiences] : ["public"],
      ...(opts.sectorTagSlugs ? { sectorTagSlugs: [...opts.sectorTagSlugs] } : {}),
      limit: k,
      statuts: STATUTS_RAG,
    });
    // Seuil de pertinence : sous 0,35 de similarité cosine, le passage est du bruit.
    return result.hits
      .filter((it) => it.rank >= SEUIL_SIMILARITE_VECTEUR)
      .map((it) => ({
        entryId: it.entryId,
        translationId: it.translationId,
        title: it.title,
        slug: it.slug,
        excerpt: it.excerpt,
        type: it.type,
        locale: it.locale,
        similarity: it.rank,
      }));
  } catch (err) {
    console.warn("[kb-client] retrieveVector fallback (FTS):", (err as Error).message);
    return [];
  }
}

/**
 * Fusionne deux listes classées via Reciprocal Rank Fusion (RRF), dédupliquées
 * par `translationId`. Conserve les métadonnées (ftsRank/similarity) de la 1ʳᵉ
 * occurrence rencontrée.
 */
function rrfMerge(
  fts: readonly KbRetrievedChunk[],
  vector: readonly KbRetrievedChunk[],
  k: number,
): KbRetrievedChunk[] {
  const scores = new Map<string, number>();
  const byId = new Map<string, KbRetrievedChunk>();
  for (const list of [fts, vector]) {
    list.forEach((chunk, idx) => {
      const id = chunk.translationId;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + idx + 1));
      const prev = byId.get(id);
      byId.set(id, {
        ...(prev ?? chunk),
        ...(chunk.ftsRank !== undefined ? { ftsRank: chunk.ftsRank } : {}),
        ...(chunk.similarity !== undefined ? { similarity: chunk.similarity } : {}),
      });
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => byId.get(id)!)
    .filter(Boolean);
}

/** Minuscules, sans accents. */
function aplatir(texte: string): string {
  return texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Mots utiles d'une requête (sans accents, 4 lettres ou plus). */
function motsUtiles(texte: string): string[] {
  return Array.from(new Set(aplatir(texte).split(/[^a-z0-9]+/).filter((m) => m.length >= 4)));
}

/**
 * Choisit 1 à 3 passages du corps de la fiche, les plus proches de la requête
 * (nombre de mots utiles communs). Sans aucun recouvrement, on prend le premier paragraphe.
 * Les paragraphes trop courts (titres, puces seules) sont ignorés.
 */
export function choisirPassages(bodyText: string, query: string): string[] {
  const paragraphes = bodyText
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 40);
  if (paragraphes.length === 0) return [];
  const mots = motsUtiles(query);
  const notes = paragraphes.map((p, idx) => {
    const plat = aplatir(p);
    return { p, idx, note: mots.filter((m) => plat.includes(m)).length };
  });
  const retenus = notes
    .filter((n) => n.note > 0)
    .sort((a, b) => b.note - a.note || a.idx - b.idx)
    .slice(0, 3)
    // Remis dans l'ordre du texte pour que l'extrait se lise normalement.
    .sort((a, b) => a.idx - b.idx);
  if (retenus.length === 0) return [paragraphes[0]!];
  return retenus.map((n) => n.p);
}

/** Assemble l'extrait final : résumé de la fiche puis passages, 600 caractères au plus. */
export function assemblerExtrait(
  excerpt: string | null,
  passages: readonly string[],
): string | null {
  const morceaux = [excerpt?.trim() ?? "", ...passages].filter((m) => m.length > 0);
  if (morceaux.length === 0) return excerpt;
  const complet = morceaux.join(" … ");
  if (complet.length <= EXTRAIT_MAX_CARACTERES) return complet;
  return `${complet.slice(0, EXTRAIT_MAX_CARACTERES - 1).trimEnd()}…`;
}

/**
 * Ajoute au résumé de chaque fiche 1 à 3 passages du corps (lecture seule).
 * Échec de lecture = on garde les extraits d'origine (jamais de casse du générateur).
 */
async function enrichirExtraits(
  chunks: KbRetrievedChunk[],
  query: string,
): Promise<KbRetrievedChunk[]> {
  if (chunks.length === 0) return chunks;
  try {
    const lignes = await prisma.knowledgeTranslation.findMany({
      where: { id: { in: chunks.map((c) => c.translationId) } },
      select: { id: true, bodyText: true },
    });
    const corps = new Map(lignes.map((l) => [l.id, l.bodyText ?? ""]));
    return chunks.map((c) => {
      const texte = corps.get(c.translationId) ?? "";
      if (!texte) return c;
      return { ...c, excerpt: assemblerExtrait(c.excerpt, choisirPassages(texte, query)) };
    });
  } catch (err) {
    console.warn("[kb-client] enrichissement des extraits ignoré:", (err as Error).message);
    return chunks;
  }
}

/**
 * RAG retrieve — consomme la KB en lecture seule via FTS / vector / hybrid.
 * Version qui renvoie aussi le mode RÉELLEMENT utilisé (traçabilité).
 *
 * - `fts`    : recherche lexicale tsvector (toujours disponible).
 * - `vector` : recherche sémantique cosine pgvector ; fallback FTS si embeddings
 *              réels indisponibles (clé Voyage absente / table vide).
 * - `hybrid` : fusion RRF FTS + vectoriel. Si le vectoriel ne renvoie rien
 *              (cas par défaut tant que la KB n'est pas embeddée), retourne le
 *              FTS pur → comportement identique à l'ancien V1.
 */
export async function retrieveAvecMode(opts: KbRetrieveOptions): Promise<KbRetrieveResult> {
  const modeDemande = opts.mode ?? "fts";
  const k = opts.k ?? 8;
  // Le préfixe « Axion-IA » des générateurs est retiré ici, une seule fois.
  const requete: KbRetrieveOptions = { ...opts, query: nettoyerRequete(opts.query) };

  let chunks: KbRetrievedChunk[];
  let modeUtilise: ModeRecherche;
  if (modeDemande === "fts") {
    chunks = await retrieveFts(requete, k);
    modeUtilise = "fts";
  } else if (modeDemande === "vector") {
    const vector = await retrieveVector(requete, k);
    if (vector.length > 0) {
      chunks = vector;
      modeUtilise = "vector";
    } else {
      chunks = await retrieveFts(requete, k);
      modeUtilise = "fts_repli";
    }
  } else {
    // hybrid : FTS + vectoriel fusionnés (RRF). Sur-échantillonne chaque canal.
    const [fts, vector] = await Promise.all([
      retrieveFts(requete, k * 2),
      retrieveVector(requete, k * 2),
    ]);
    if (vector.length === 0) {
      chunks = fts.slice(0, k);
      modeUtilise = "fts_repli";
    } else {
      chunks = rrfMerge(fts, vector, k);
      modeUtilise = "hybrid";
    }
  }

  // Observabilité RAG (P1) : un retrieval vide = génération SANS grounding KB.
  if (chunks.length === 0) {
    console.warn(
      `[kb-client] retrieval vide — génération sans grounding KB pour query="${requete.query}" (mode=${modeDemande}, utilisé=${modeUtilise}, locale=${opts.locale})`,
    );
  } else if (modeUtilise === "fts_repli") {
    console.warn(
      `[kb-client] mode ${modeDemande} demandé mais repli sur le lexical (vecteurs indisponibles ou sous le seuil)`,
    );
  }

  const enrichis = await enrichirExtraits(chunks, requete.query);

  // Audit KB 2026-08-11 — résout les tokens `{{price:…}}` avant injection dans
  // le prompt : le LLM ne doit jamais voir un token brut (il le recopierait tel
  // quel dans le contenu généré). Idempotent sur du texte déjà résolu.
  return {
    modeDemande,
    modeUtilise,
    chunks: enrichis.map((c) => ({
      ...c,
      modeUtilise,
      title: resolvePriceTokens(c.title, opts.locale),
      excerpt: c.excerpt === null ? null : resolvePriceTokens(c.excerpt, opts.locale),
    })),
  };
}

/** Même appel qu'avant pour les générateurs ; le mode utilisé est porté par chaque passage. */
export async function retrieve(opts: KbRetrieveOptions): Promise<KbRetrievedChunk[]> {
  return (await retrieveAvecMode(opts)).chunks;
}
