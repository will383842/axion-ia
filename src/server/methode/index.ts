/**
 * Couche « Méthode » — LE POINT D'ENTRÉE UNIQUE (ADR 0076).
 *
 * Toute automatisation qui parle à un client (mail, offre, script d'appel,
 * outil MCP…) passe par `obtenirContexteMethode`. Elle rend :
 *   - `noyau` : la fiche 00 « Méthode de vente », section « L'essentiel en 30
 *     secondes » + « Le chemin », toujours injectée ;
 *   - `extraits` : les fiches les plus proches du sujet (recherche plein texte
 *     Postgres), dans la collection `methode-vente` — et `methode-secteur-sante`
 *     SEULEMENT si `secteur === "sante"`.
 *
 * Cloisonnement (non négociable) : audience `team`, statut `approved`, jamais
 * `published`. Ces fiches ne sortent donc jamais par la recherche publique
 * (`searchKnowledge` exige `published`/`deprecated` ET `confidentiality = public`),
 * ni par le sitemap, ni par le chatbot des visiteurs.
 *
 * Interrupteur : `METHODE_ACTIVE` (défaut éteint). Éteint, la fonction rend
 * `{ noyau: null, extraits: [] }` sans toucher la base : rien ne change nulle part.
 */

import { prisma } from "@/lib/prisma";
import { buildOrTsQuery } from "@/lib/knowledge/search-fts";

import {
  COLLECTION_SANTE,
  COLLECTION_VENTE,
  ETIQUETTE_DOCTRINE,
  ETIQUETTE_SANTE,
  SLUG_NOYAU,
} from "./decoupage";

export {
  AVERTISSEMENT_CHIFFRES,
  COLLECTION_SANTE,
  COLLECTION_VENTE,
  ETIQUETTE_CHIFFRES,
  ETIQUETTE_DOCTRINE,
  ETIQUETTE_SANTE,
  SLUG_NOYAU,
} from "./decoupage";

/** Nombre d'extraits par défaut, et plafond. */
export const EXTRAITS_PAR_DEFAUT = 5;
export const EXTRAITS_MAXIMUM = 10;

/** Un extrait est borné : le modèle reçoit une fiche, pas un livre. */
export const EXTRAIT_MAX_CARACTERES = 1_500;

export type SecteurMethode = "sante";

export interface DemandeContexteMethode {
  /** Ce dont parle le texte à produire (« relance après diagnostic », « objection prix »…). */
  readonly sujet: string;
  /** `"sante"` ouvre la collection santé. Toute autre valeur l'ignore. */
  readonly secteur?: string | null;
  /** Nombre d'extraits (défaut 5, plafond 10, 0 = noyau seul). */
  readonly max?: number;
}

export interface FicheMethode {
  readonly slug: string;
  readonly titre: string;
  readonly texte: string;
}

export interface ExtraitMethode extends FicheMethode {
  readonly collection: string;
  readonly etiquettes: readonly string[];
}

export interface ContexteMethode {
  readonly noyau: FicheMethode | null;
  readonly extraits: readonly ExtraitMethode[];
}

export const CONTEXTE_NEUTRE: ContexteMethode = Object.freeze({
  noyau: null,
  extraits: Object.freeze([]) as readonly ExtraitMethode[],
});

/** Seule la valeur exacte `"true"` allume la couche. */
export function methodeActive(): boolean {
  return process.env.METHODE_ACTIVE === "true";
}

/**
 * Étiquettes qui EXCLUENT une fiche des extraits : la doctrine toujours, la
 * santé sauf demande explicite.
 */
export function etiquettesExclues(secteur?: string | null): string[] {
  return secteur === "sante" ? [ETIQUETTE_DOCTRINE] : [ETIQUETTE_SANTE, ETIQUETTE_DOCTRINE];
}

/** Collections interrogées pour un secteur donné. */
export function collectionsPour(secteur?: string | null): string[] {
  return secteur === "sante" ? [COLLECTION_VENTE, COLLECTION_SANTE] : [COLLECTION_VENTE];
}

function borner(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const fin = coupe.lastIndexOf("\n");
  return `${(fin > max * 0.6 ? coupe.slice(0, fin) : coupe).trimEnd()}\n[…]`;
}

async function lireNoyau(): Promise<FicheMethode | null> {
  const entree = await prisma.knowledgeEntry.findFirst({
    where: { slug: SLUG_NOYAU, deletedAt: null, audience: "team", status: "approved" },
    select: {
      slug: true,
      translations: {
        where: { locale: "fr" },
        select: { title: true, bodyText: true },
        take: 1,
      },
    },
  });
  const trad = entree?.translations[0];
  if (!entree || !trad) return null;
  return { slug: entree.slug, titre: trad.title, texte: trad.bodyText ?? "" };
}

interface LigneExtrait {
  slug: string;
  titre: string;
  texte: string | null;
  collection: string;
  etiquettes: string[] | null;
}

async function chercherExtraits(
  sujet: string,
  collections: readonly string[],
  exclues: readonly string[],
  limite: number,
): Promise<ExtraitMethode[]> {
  const requete = buildOrTsQuery(sujet);
  if (!requete || limite <= 0) return [];

  // SQL paramétré. Le filtre « santé » est DOUBLÉ : par la collection, et par
  // l'étiquette `secteur:sante` — une fiche santé rangée par erreur dans la
  // collection générale ne sort pas pour autant. Une fiche `doctrine:a-revoir`
  // ne sort jamais.
  const lignes = await prisma.$queryRawUnsafe<LigneExtrait[]>(
    `
    SELECT
      ke.slug            AS "slug",
      kt.title           AS "titre",
      kt.body_text       AS "texte",
      kc.slug            AS "collection",
      (
        SELECT array_agg(tg.slug ORDER BY tg.slug)
        FROM knowledge_tags_on_entries te
        JOIN knowledge_tags tg ON tg.id = te.tag_id
        WHERE te.entry_id = ke.id
      )                  AS "etiquettes"
    FROM knowledge_translations kt
    JOIN knowledge_entries ke          ON ke.id = kt.entry_id
    JOIN knowledge_collection_items ki ON ki.entry_id = ke.id
    JOIN knowledge_collections kc      ON kc.id = ki.collection_id
    WHERE kt.locale = 'fr'::"Locale"
      AND ke.deleted_at IS NULL
      AND ke.audience = 'team'::"KbAudience"
      AND ke.status = 'approved'::"KbStatus"
      AND kc.slug = ANY($2::text[])
      AND ke.slug <> $3
      AND NOT EXISTS (
        SELECT 1 FROM knowledge_tags_on_entries te2
        JOIN knowledge_tags tg2 ON tg2.id = te2.tag_id
        WHERE te2.entry_id = ke.id AND tg2.slug = ANY($5::text[])
      )
      AND kt.search_vector @@ websearch_to_tsquery('fr_unaccent'::regconfig, $1)
    ORDER BY ts_rank_cd(kt.search_vector, websearch_to_tsquery('fr_unaccent'::regconfig, $1)) DESC,
             ke.slug ASC
    LIMIT $4;
    `,
    requete,
    [...collections],
    SLUG_NOYAU,
    limite,
    [...exclues],
  );

  return lignes.map((l) => ({
    slug: l.slug,
    titre: l.titre,
    texte: borner(l.texte ?? "", EXTRAIT_MAX_CARACTERES),
    collection: l.collection,
    etiquettes: l.etiquettes ?? [],
  }));
}

/**
 * LE point d'entrée. Ne jette jamais : une panne de base rend le contexte
 * neutre (l'outil appelant continue sans méthode, comme interrupteur éteint).
 */
export async function obtenirContexteMethode(
  demande: DemandeContexteMethode,
): Promise<ContexteMethode> {
  if (!methodeActive()) return CONTEXTE_NEUTRE;

  const max = Math.max(
    0,
    Math.min(EXTRAITS_MAXIMUM, Math.trunc(demande.max ?? EXTRAITS_PAR_DEFAUT)),
  );
  try {
    const [noyau, extraits] = await Promise.all([
      lireNoyau(),
      chercherExtraits(
        demande.sujet.trim(),
        collectionsPour(demande.secteur),
        etiquettesExclues(demande.secteur),
        max,
      ),
    ]);
    return { noyau, extraits };
  } catch (err) {
    console.warn("[methode] contexte indisponible, rendu neutre :", (err as Error).message);
    return CONTEXTE_NEUTRE;
  }
}
