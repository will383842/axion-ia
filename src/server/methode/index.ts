/**
 * Couche « Méthode » — LE POINT D'ENTRÉE UNIQUE (ADR 0076 § 2.7).
 *
 * Toute automatisation qui parle à un client passe par `obtenirContexteMethode`.
 *
 *   - `noyau` : la fiche `methode/00-axion-ia-methode-de-vente/essentiel`
 *     (« L'ESSENTIEL EN 30 SECONDES » + « LE CHEMIN »), toujours servie ;
 *   - `extraits` : recherche plein texte Postgres (`search_vector`, `fr_unaccent`)
 *     dans la collection `methode-vente`, plus `methode-secteur-sante` SEULEMENT si
 *     `secteur = 'sante'` ; audience `team` uniquement.
 *
 * ⛔ INTERRUPTEUR `METHODE_ACTIVE` — ÉTEINT PAR DÉFAUT. Seule la valeur exacte
 * "true" l'allume. Éteint : `{ noyau: null, extraits: [] }`, sans aucun accès à la
 * base (le client Prisma n'est même pas chargé). Rien ne change nulle part.
 *
 * ⚠️ Les montants des fiches (290 €/mois, 1 900 €, acompte de 30 %, abonnement,
 * suivi à 30 jours…) sont des EXEMPLES d'entraînement, jamais des règles ni des
 * prix : tout extrait étiqueté `chiffres-exercice` (ou qui cite un montant) est
 * servi AVEC l'avertissement en tête, même si la fiche en base l'a perdu.
 *
 * Lecture seule. Jamais servi au chatbot public des visiteurs.
 */

import {
  AVERTISSEMENT_CHIFFRES,
  COLLECTION_SANTE,
  COLLECTION_VENTE,
  contientChiffresExercice,
  ETIQUETTE_CHIFFRES,
  ETIQUETTE_SANTE,
  SLUG_NOYAU,
  avecAvertissement,
} from "./decoupage";

export { AVERTISSEMENT_CHIFFRES, SLUG_NOYAU };

type Env = Readonly<Record<string, string | undefined>>;

/** L'interrupteur n'est allumé QUE par la valeur exacte "true". */
export function estMethodeActive(env: Env = process.env): boolean {
  return env.METHODE_ACTIVE === "true";
}

export const MAX_PAR_DEFAUT = 5;
export const MAX_PLAFOND = 10;
/** Longueur max d'un extrait servi (le noyau n'est pas tronqué). */
export const EXTRAIT_MAX_CARACTERES = 2_000;

export interface LigneMethode {
  readonly slug: string;
  readonly titre: string;
  readonly texte: string;
  readonly collection: string;
  readonly etiquettes: readonly string[];
}

export interface ExtraitMethode extends LigneMethode {
  /** Vrai si l'extrait cite des montants d'entraînement (avertissement posé en tête). */
  readonly chiffresExercice: boolean;
}

export interface ContexteMethode {
  readonly noyau: ExtraitMethode | null;
  readonly extraits: readonly ExtraitMethode[];
}

export interface ParametresContexte {
  /** Le sujet de la recherche (question, contexte du mail, objection…). */
  readonly sujet: string;
  /** `'sante'` ouvre la collection santé ; toute autre valeur l'ignore. */
  readonly secteur?: string | null;
  /** Nombre d'extraits (défaut 5, plafond 10). */
  readonly max?: number;
}

/** Lecture seule — injectable pour les tests. */
export interface LecteurMethode {
  lireNoyau(): Promise<LigneMethode | null>;
  rechercher(sujet: string, collections: readonly string[], max: number): Promise<LigneMethode[]>;
}

export const CONTEXTE_NEUTRE: ContexteMethode = Object.freeze({
  noyau: null,
  extraits: Object.freeze([]) as readonly ExtraitMethode[],
});

interface LigneSql {
  slug: string;
  titre: string;
  texte: string | null;
  collection: string;
  etiquettes: string[] | null;
}

function versLigne(r: LigneSql): LigneMethode {
  return {
    slug: r.slug,
    titre: r.titre,
    texte: r.texte ?? "",
    collection: r.collection,
    etiquettes: r.etiquettes ?? [],
  };
}

/** Lecteur Postgres par défaut. Prisma n'est chargé qu'au premier appel. */
export const lecteurPostgres: LecteurMethode = {
  async lireNoyau() {
    const { prisma } = await import("@/lib/prisma");
    const lignes = await prisma.$queryRaw<LigneSql[]>`
      SELECT ke.slug, kt.title AS titre, kt.body_text AS texte, c.slug AS collection,
             ARRAY(SELECT t.slug FROM knowledge_tags_on_entries te
                   JOIN knowledge_tags t ON t.id = te.tag_id
                   WHERE te.entry_id = ke.id) AS etiquettes
      FROM knowledge_entries ke
      JOIN knowledge_translations kt ON kt.entry_id = ke.id AND kt.locale = 'fr'::"Locale"
      JOIN knowledge_collection_items ci ON ci.entry_id = ke.id
      JOIN knowledge_collections c ON c.id = ci.collection_id
      WHERE ke.slug = ${SLUG_NOYAU}
        AND c.slug = ${COLLECTION_VENTE}
        AND ke.deleted_at IS NULL
        AND ke.audience = 'team'::"KbAudience"
      LIMIT 1
    `;
    return lignes[0] ? versLigne(lignes[0]) : null;
  },
  async rechercher(sujet, collections, max) {
    const { prisma } = await import("@/lib/prisma");
    const lignes = await prisma.$queryRaw<LigneSql[]>`
      SELECT ke.slug, kt.title AS titre, kt.body_text AS texte, c.slug AS collection,
             ARRAY(SELECT t.slug FROM knowledge_tags_on_entries te
                   JOIN knowledge_tags t ON t.id = te.tag_id
                   WHERE te.entry_id = ke.id) AS etiquettes
      FROM knowledge_translations kt
      JOIN knowledge_entries ke ON ke.id = kt.entry_id
      JOIN knowledge_collection_items ci ON ci.entry_id = ke.id
      JOIN knowledge_collections c ON c.id = ci.collection_id,
           websearch_to_tsquery('fr_unaccent', ${sujet}) AS q
      WHERE kt.locale = 'fr'::"Locale"
        AND c.slug = ANY(${[...collections]}::text[])
        AND ke.deleted_at IS NULL
        AND ke.audience = 'team'::"KbAudience"
        AND ke.slug <> ${SLUG_NOYAU}
        AND kt.search_vector @@ q
      ORDER BY ts_rank_cd(kt.search_vector, q) DESC, ke.slug
      LIMIT ${max}
    `;
    return lignes.map(versLigne);
  },
};

/** Pose l'avertissement en tête si l'extrait cite des montants d'entraînement. */
export function preparerExtrait(ligne: LigneMethode, tronquer: boolean): ExtraitMethode {
  const chiffres =
    ligne.etiquettes.includes(ETIQUETTE_CHIFFRES) || contientChiffresExercice(ligne.texte);
  let texte = ligne.texte.trim();
  if (chiffres) {
    // Retirer un avertissement déjà présent avant de tronquer, puis le reposer.
    if (texte.startsWith(AVERTISSEMENT_CHIFFRES)) {
      texte = texte.slice(AVERTISSEMENT_CHIFFRES.length).trim();
    }
  }
  if (tronquer && texte.length > EXTRAIT_MAX_CARACTERES) {
    texte = `${texte.slice(0, EXTRAIT_MAX_CARACTERES - 1)}…`;
  }
  return {
    ...ligne,
    texte: chiffres ? avecAvertissement(texte) : texte,
    chiffresExercice: chiffres,
  };
}

export interface DependancesContexte {
  readonly env?: Env;
  readonly lecteur?: LecteurMethode;
}

/**
 * Le point d'entrée unique. Éteint (`METHODE_ACTIVE` ≠ "true") : contexte neutre,
 * aucun accès à la base.
 */
export async function obtenirContexteMethode(
  params: ParametresContexte,
  deps: DependancesContexte = {},
): Promise<ContexteMethode> {
  if (!estMethodeActive(deps.env ?? process.env)) return CONTEXTE_NEUTRE;
  const lecteur = deps.lecteur ?? lecteurPostgres;

  const sante = params.secteur === "sante";
  const collections = sante ? [COLLECTION_VENTE, COLLECTION_SANTE] : [COLLECTION_VENTE];
  const max = Math.min(Math.max(Math.trunc(params.max ?? MAX_PAR_DEFAUT), 0), MAX_PLAFOND);
  const sujet = params.sujet.trim().slice(0, 500);

  const [noyauBrut, trouvees] = await Promise.all([
    lecteur.lireNoyau(),
    sujet && max > 0 ? lecteur.rechercher(sujet, collections, max) : Promise.resolve([]),
  ]);

  // Défense en profondeur : le secteur santé ne sort JAMAIS sans `secteur = 'sante'`,
  // même si le lecteur l'a rendu.
  const extraits = trouvees
    .filter((l) => l.slug !== SLUG_NOYAU)
    .filter(
      (l) =>
        sante || (l.collection !== COLLECTION_SANTE && !l.etiquettes.includes(ETIQUETTE_SANTE)),
    )
    .filter((l) => collections.includes(l.collection))
    .slice(0, max)
    .map((l) => preparerExtrait(l, true));

  return {
    noyau: noyauBrut ? preparerExtrait(noyauBrut, false) : null,
    extraits,
  };
}

/** Rend le contexte en un bloc de texte pour un prompt système (vide si neutre). */
export function formaterContextePourPrompt(contexte: ContexteMethode): string {
  const parties: string[] = [];
  if (contexte.noyau) {
    parties.push(`## Méthode de vente Axion-IA (noyau)\n\n${contexte.noyau.texte}`);
  }
  for (const e of contexte.extraits) parties.push(`### ${e.titre}\n\n${e.texte}`);
  if (parties.length === 0) return "";
  return [
    "# Contexte interne « Méthode » (équipe, ne jamais citer tel quel au client)",
    "Les montants cités dans ces fiches sont des EXEMPLES d'entraînement, jamais des prix : " +
      "le seul prix affiché est la Journée IA à 1 490 € HT.",
    ...parties,
  ].join("\n\n");
}
