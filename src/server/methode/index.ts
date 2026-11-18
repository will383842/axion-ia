/**
 * Couche « Méthode » — LE POINT D'ENTRÉE UNIQUE (ADR 0076).
 *
 * Rien n'appelle cette couche aujourd'hui : ni le chatbot, ni les générateurs de contenu,
 * ni une route. Tout futur appelant passe par `obtenirContexteMethode`. Elle rend :
 *   - `noyau` : la section « essentiel » de la fiche numérotée 00 (reconnue par la forme
 *     du slug, voir `estSlugNoyau`) ;
 *   - `extraits` : les fiches les plus proches du sujet (recherche plein texte Postgres),
 *     dans la collection `methode-vente` uniquement. Le secteur santé n'est pas servi.
 *
 * REFUS PAR DÉFAUT (décision du 18/11/2026) : une section n'est servie que si elle porte
 * la marque d'approbation posée à la main par le fondateur dans le corpus (`estApprouvee`) ;
 * sans cette marque, jamais, même saine. La couche ne pose la marque nulle part.
 *
 * Le noyau ET les extraits traversent `filtrerPourSortie` (filtre-sortie.ts), second filet
 * appliqué aux sections approuvées : une fiche qui porte un montant, un courriel, un téléphone, une promesse de gain, un témoignage ou
 * un ancrage local, ou une étiquette `chiffres-exercice` / `doctrine:a-revoir` /
 * `secteur:sante`, n'est jamais rendue.
 *
 * Cloisonnement (non négociable) : audience `team`, confidentialité `internal`, statut
 * `approved`, jamais `published`, issue de l'import (`sourceFactoryId = methode-import`).
 * Ces fiches ne sortent jamais par un lecteur public, et la console ne peut pas les
 * publier (garde dans `executeTransition`).
 *
 * Interrupteur : `METHODE_ACTIVE` (défaut éteint). Éteint, la fonction rend
 * `{ noyau: null, extraits: [] }` sans toucher la base.
 */

import { prisma } from "@/lib/prisma";
import { buildOrTsQuery } from "@/lib/knowledge/search-fts";

import {
  COLLECTION_VENTE,
  ETIQUETTE_CHIFFRES,
  ETIQUETTE_DOCTRINE,
  ETIQUETTE_SANTE,
  MOTIF_SLUG_NOYAU,
  MOTIF_SQL_APPROBATION,
  estSlugNoyau,
  retirerMarque,
} from "./decoupage";
import { filtrerPourSortie } from "./filtre-sortie";

export {
  AVERTISSEMENT_CHIFFRES,
  COLLECTION_SANTE,
  COLLECTION_VENTE,
  ETIQUETTE_CHIFFRES,
  ETIQUETTE_DOCTRINE,
  ETIQUETTE_SANTE,
  MOTIF_SLUG_NOYAU,
  estApprouvee,
  estSlugNoyau,
} from "./decoupage";
export { filtrerPourSortie, motifRefus } from "./filtre-sortie";

/** Origine des entrées de cette couche (posée par l'import, lue ici). */
export const SOURCE_IMPORT_METHODE = "methode-import";

/** Nombre d'extraits par défaut, et plafond. */
export const EXTRAITS_PAR_DEFAUT = 5;
export const EXTRAITS_MAXIMUM = 10;

/** Un extrait est borné : le modèle reçoit une fiche, pas un livre. */
export const EXTRAIT_MAX_CARACTERES = 1_500;

/**
 * On lit plus de lignes que demandé : le filtre de sortie en refuse, et un refus ne doit
 * pas vider la réponse. Plafond de lecture, jamais de sortie.
 */
const FACTEUR_DE_LECTURE = 4;

export interface DemandeContexteMethode {
  /** Ce dont parle le texte à produire (« relance après diagnostic », « objection prix »…). */
  readonly sujet: string;
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
 * Étiquettes qui EXCLUENT une fiche dès la requête (le filtre de sortie les refuse de
 * toute façon) : le chiffré, la doctrine à revoir et la santé, toujours.
 */
export function etiquettesExclues(): string[] {
  return [ETIQUETTE_CHIFFRES, ETIQUETTE_DOCTRINE, ETIQUETTE_SANTE];
}

function borner(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const fin = coupe.lastIndexOf("\n");
  return `${(fin > max * 0.6 ? coupe.slice(0, fin) : coupe).trimEnd()}\n[…]`;
}

async function lireNoyau(): Promise<FicheMethode | null> {
  const candidates = await prisma.knowledgeEntry.findMany({
    where: {
      slug: { startsWith: "methode/", endsWith: "/essentiel" },
      deletedAt: null,
      audience: "team",
      confidentiality: "internal",
      status: "approved",
      sourceFactoryId: SOURCE_IMPORT_METHODE,
    },
    orderBy: { slug: "asc" },
    take: 20,
    select: {
      slug: true,
      tags: { select: { tag: { select: { slug: true } } } },
      translations: {
        where: { locale: "fr" },
        select: { title: true, bodyText: true },
        take: 1,
      },
    },
  });
  // Le premier noyau SERVABLE : un noyau refusé par le filtre n'est jamais remplacé par
  // une fiche qui n'est pas le noyau, mais un autre « 00 » sain peut l'être.
  for (const c of candidates) {
    if (!estSlugNoyau(c.slug)) continue;
    const trad = c.translations[0];
    if (!trad) continue;
    const fiche: FicheMethode & { etiquettes: readonly string[] } = {
      slug: c.slug,
      titre: trad.title,
      texte: trad.bodyText ?? "",
      etiquettes: (c.tags ?? []).map((t) => t.tag.slug),
    };
    if (filtrerPourSortie([fiche]).length === 0) continue;
    return { slug: fiche.slug, titre: fiche.titre, texte: retirerMarque(fiche.texte) };
  }
  return null;
}

interface LigneExtrait {
  slug: string;
  titre: string;
  texte: string | null;
  collection: string;
  etiquettes: string[] | null;
}

async function chercherExtraits(sujet: string, limite: number): Promise<ExtraitMethode[]> {
  const requete = buildOrTsQuery(sujet);
  if (!requete || limite <= 0) return [];

  // SQL paramétré. Seule la collection « vente » est interrogée (la santé n'est pas servie)
  // et une fiche étiquetée chiffres, doctrine à revoir ou santé ne sort jamais.
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
      AND ke.confidentiality = 'internal'::"KbConfidentiality"
      AND ke.status = 'approved'::"KbStatus"
      AND ke.source_factory_id = 'methode-import'
      AND kc.slug = ANY($2::text[])
      AND ke.slug !~ $3
      AND kt.body_text LIKE $6
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
    [COLLECTION_VENTE],
    MOTIF_SLUG_NOYAU.source,
    limite * FACTEUR_DE_LECTURE,
    etiquettesExclues(),
    MOTIF_SQL_APPROBATION,
  );

  const lues: ExtraitMethode[] = lignes.map((l) => ({
    slug: l.slug,
    titre: l.titre,
    texte: l.texte ?? "",
    collection: l.collection,
    etiquettes: l.etiquettes ?? [],
  }));
  // Le filtre lit le texte ENTIER ; seule la sortie est ensuite bornée.
  return filtrerPourSortie(lues)
    .slice(0, limite)
    .map((e) => ({ ...e, texte: borner(retirerMarque(e.texte), EXTRAIT_MAX_CARACTERES) }));
}

/**
 * LE point d'entrée. Ne jette jamais : une panne de base rend le contexte neutre
 * (l'appelant continue sans méthode, comme interrupteur éteint).
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
      chercherExtraits(demande.sujet.trim(), max),
    ]);
    return { noyau, extraits };
  } catch (err) {
    console.warn("[methode] contexte indisponible, rendu neutre :", (err as Error).message);
    return CONTEXTE_NEUTRE;
  }
}
