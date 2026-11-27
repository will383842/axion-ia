// S6-3 — « Porte de qualité » des villes indexées (fiche S6, § 5). TEST SEUL : aucun code servi
// n'importe ce module, donc aucun effet sur le site, le bundle ou les sitemaps.
//
// But : une ville n'entre dans `villes-indexees.ts` que si sa page porte une vraie fiche locale
// sourcée, distincte des autres (anti pages-doublons). Pur : `fiches-locales` et
// `villes-indexees` seulement, jamais le barrel de contenu (29 Mo).
//
// Les règles de sources (liste blanche de domaines, dates de consultation, catégories fermées,
// longueurs, chiffres orphelins) et de mots interdits sont vérifiées par `fiches-locales.spec.ts`
// et `villes-sans-frais-ni-fausse-presence.spec.ts` sur TOUTES les fiches de `FICHES_LOCALES` :
// une ville dotée d'une fiche y est donc soumise. Ce module ajoute les critères de volume et d'unicité.

import { FICHES_LOCALES } from "@/content/villes/fiches-locales";
import type { FicheLocale } from "@/content/villes/fiches-locales/types";
import { VILLES_HORS_MAILLAGE } from "@/content/villes/villes-indexees";

/** Seuils de la porte (fiche S6, § 5). */
export const SEUILS_QUALITE = {
  secteursMin: 3,
  institutionsMin: 3,
  questionsLocales: 3,
  /** Mots de texte visible qui n'existent sur aucune autre fiche. */
  motsPropresMin: 250,
  /** Part maximale de suites de 6 mots communes avec UNE autre fiche. */
  partCommuneMax: 0.3,
} as const;

/**
 * Villes DÉJÀ indexées au 27/11/2026 sans fiche locale. CLIQUET : la liste ne peut que
 * diminuer (retirer un slug quand sa fiche est livrée), jamais grandir. Aucune n'est désindexée
 * automatiquement : c'est une décision humaine, après mesure (S6-10).
 * La ville du siège est suivie à part, via `VILLES_HORS_MAILLAGE` (règle de communication).
 */
export const VILLES_INDEXEES_SANS_FICHE: ReadonlyArray<string> = [
  "paris",
  "saint-denis",
  "boulogne-billancourt",
  "montreuil",
  "argenteuil",
  "toulon",
  "aix-en-provence",
  "saint-etienne",
  "villeurbanne",
  "clermont-ferrand",
  "annecy",
  "nimes",
  "perpignan",
  "angers",
  "le-mans",
  "reims",
  "metz",
  "mulhouse",
  "nancy",
  "limoges",
  "amiens",
  "brest",
  "le-havre",
  "rouen",
  "caen",
  "dijon",
  "besancon",
  "tours",
  "orleans",
];

/**
 * Villes indexées dont la fiche existe mais n'a que 2 institutions publiques (seuil : 3), au
 * 27/11/2026. Même cliquet : la liste ne peut que diminuer, un slug en sort quand la fiche est
 * complétée par une troisième institution (source publique, consultée et datée).
 */
export const FICHES_SOUS_LE_SEUIL: ReadonlyArray<string> = [
  "nice",
  "montpellier",
  "strasbourg",
  "rennes",
];

/** Dispensée de la porte, à titre transitoire : listes du cliquet ou ville du siège. */
export function estDispenseeDeFiche(slug: string): boolean {
  return (
    VILLES_INDEXEES_SANS_FICHE.includes(slug) ||
    FICHES_SOUS_LE_SEUIL.includes(slug) ||
    VILLES_HORS_MAILLAGE.has(slug)
  );
}

export interface ResultatCritere {
  readonly critere: string;
  readonly ok: boolean;
  /** Vide si le critère passe ; sinon la raison, chiffrée. */
  readonly motif: string;
}

export type Fiches = Readonly<Record<string, FicheLocale>>;

/** Textes visibles écrits pour la ville (prose et FAQ locale). */
export function textesEcrits(f: FicheLocale): string[] {
  return [
    f.prose.tissu,
    f.prose.ecosysteme,
    f.prose.zone,
    ...f.faqLocale.flatMap((q) => [q.q, q.a]),
  ];
}

const TAILLE_SUITE = 6;

/** Mots du texte, noms de villes et d'intercommunalités masqués, nombres remplacés. */
function motsMasques(f: FicheLocale, toutes: ReadonlyArray<FicheLocale>): string[] {
  let t = textesEcrits(f).join(" ").toLowerCase();
  for (const g of [f, ...toutes])
    for (const nom of [g.nomVille, g.epci.nom]) t = t.split(nom.toLowerCase()).join("x");
  t = t.replace(/[  ]/g, " ").replace(/\d+/g, "n");
  return t.split(/[^\p{L}'’]+/u).filter(Boolean);
}

function suitesDe(mots: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  for (let i = 0; i + TAILLE_SUITE <= mots.length; i++)
    out.push(mots.slice(i, i + TAILLE_SUITE).join(" "));
  return out;
}

/** Part des suites de 6 mots de `a` qu'on retrouve dans `b` (noms et nombres masqués). */
export function partSuitesCommunes(
  a: FicheLocale,
  b: FicheLocale,
  toutes: ReadonlyArray<FicheLocale> = [],
): number {
  const sa = new Set(suitesDe(motsMasques(a, [b, ...toutes])));
  const sb = new Set(suitesDe(motsMasques(b, [a, ...toutes])));
  if (sa.size === 0) return 0;
  let communs = 0;
  for (const g of sa) if (sb.has(g)) communs++;
  return communs / sa.size;
}

/**
 * Mots de la fiche couverts par au moins une suite de 6 mots absente de toutes les autres
 * fiches : mesure de la part de texte qui n'existe nulle part ailleurs.
 */
export function motsPropres(f: FicheLocale, autres: ReadonlyArray<FicheLocale>): number {
  const mots = motsMasques(f, autres);
  const ailleurs = new Set<string>();
  for (const g of autres) for (const s of suitesDe(motsMasques(g, [f, ...autres]))) ailleurs.add(s);
  const couverts = new Array<boolean>(mots.length).fill(false);
  suitesDe(mots).forEach((s, i) => {
    if (!ailleurs.has(s)) for (let k = i; k < i + TAILLE_SUITE; k++) couverts[k] = true;
  });
  return couverts.filter(Boolean).length;
}

/**
 * Évalue la porte de qualité d'une ville. Sans fiche, un seul critère échoue (« fiche locale »)
 * et les autres ne sont pas évalués. `fiches` est injectable pour les tests.
 */
export function evaluerQualiteVille(
  slug: string,
  fiches: Fiches = FICHES_LOCALES,
): ResultatCritere[] {
  const f = fiches[slug];
  if (!f)
    return [
      { critere: "fiche locale présente", ok: false, motif: `aucune fiche pour « ${slug} »` },
    ];
  const autres = Object.values(fiches).filter((g) => g.slug !== slug);
  const res: ResultatCritere[] = [{ critere: "fiche locale présente", ok: true, motif: "" }];
  const regle = (critere: string, ok: boolean, motif: string) =>
    res.push({ critere, ok, motif: ok ? "" : motif });

  const nbSecteurs = f.entreprises.secteurs.length;
  regle(
    "au moins 3 secteurs chiffrés",
    nbSecteurs >= SEUILS_QUALITE.secteursMin,
    `${nbSecteurs} secteur(s) chiffré(s)`,
  );
  const nbInst = f.institutions.length;
  regle(
    "au moins 3 institutions publiques",
    nbInst >= SEUILS_QUALITE.institutionsMin,
    `${nbInst} institution(s)`,
  );
  const nbQ = f.faqLocale.length;
  regle("3 questions locales", nbQ === SEUILS_QUALITE.questionsLocales, `${nbQ} question(s)`);

  let pire = 0;
  let pireAvec = "";
  for (const g of autres) {
    const part = Math.max(partSuitesCommunes(f, g, autres), partSuitesCommunes(g, f, autres));
    if (part > pire) {
      pire = part;
      pireAvec = g.slug;
    }
  }
  regle(
    "moins de 30 % de suites de 6 mots communes avec chaque autre fiche",
    pire < SEUILS_QUALITE.partCommuneMax,
    `${Math.round(pire * 100)} % avec « ${pireAvec} »`,
  );
  const propres = motsPropres(f, autres);
  regle(
    "au moins 250 mots propres à la ville",
    propres >= SEUILS_QUALITE.motsPropresMin,
    `${propres} mot(s) propre(s)`,
  );
  const nomSiege = VILLES_HORS_MAILLAGE.has(slug)
    ? false
    : textesEcrits(f).some((t) =>
        [...VILLES_HORS_MAILLAGE].some((s) => t.toLowerCase().includes(s)),
      );
  regle(
    "nom de la ville du siège absent",
    !nomSiege,
    "le nom de la ville du siège figure dans le texte",
  );
  return res;
}

/** True si tous les critères passent. */
export function villePasseLaPorte(slug: string, fiches: Fiches = FICHES_LOCALES): boolean {
  return evaluerQualiteVille(slug, fiches).every((c) => c.ok);
}
