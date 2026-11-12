/**
 * Contrôle de fidélité aux fiches de connaissance (vague 3, chantier 2, 11/11/2026).
 *
 * Compare les affirmations CHIFFRÉES et JURIDIQUES d'un texte généré aux fiches qui
 * l'ont nourri : étayée (une fiche porte la valeur), CONTRADICTOIRE (une fiche du même
 * sujet porte une autre valeur de la même famille) ou NON ÉTAYÉE. Contrôle lexical :
 * il compare des valeurs, pas le sens, et sert à envoyer en RELECTURE, jamais à
 * supprimer ni dépublier. Réutilise `extractClaims` et la garde de prix
 * (`findNonSsotPrices`) ; les mots interdits restent à `detecterInterditsSurface`.
 * Voir `docs/knowledge/CONTROLE-FIDELITE.md`. Fonction pure.
 */

import { PATTERN_AMOUNT_EUR, extractClaims, splitSentences } from "./claims-extractor";
import { findNonSsotPrices } from "../quality/price-gate";

export interface FicheConnaissance {
  readonly id: string;
  readonly titre: string;
  /** Texte brut ou HTML de la fiche (version française). */
  readonly texte: string;
}

export type NatureConstat = "non-etaye" | "contradictoire";
export type FamilleConstat = "chiffre" | "juridique";

export interface ConstatFidelite {
  readonly nature: NatureConstat;
  readonly famille: FamilleConstat;
  /** La sous-chaîne affirmée (« 62 % », « 2 août 2027 », « article L. 6353-1 »). */
  readonly affirmation: string;
  /** La phrase qui la porte (tronquée à ~280 caractères). */
  readonly phrase: string;
  /** Fiche contredite, ou fiche la plus proche du sujet ; null si aucune. */
  readonly ficheId: string | null;
  readonly ficheTitre: string | null;
  /** Valeur portée par la fiche (contradiction seulement). */
  readonly valeurFiche: string | null;
}

export const MAX_CONSTATS = 30;
/** Mots significatifs communs à partir desquels une fiche « parle du même sujet ». */
const SEUIL_MEME_SUJET = 3;
const SEUIL_FICHE_PROCHE = 2;

// ─── Familles de valeurs ─────────────────────────────────────────────────────

type Famille = "pourcentage" | "montant" | "nombre" | "date" | "article" | "texte";

/** Mois sans accents, dans l'ordre (index + 1 = numéro du mois). */
const MOIS =
  "janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre".split(" ");
const sansAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "");

const RE_NOMBRE = /\b\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[,.]\d+)?\b|\d+(?:[,.]\d+)?/g;
const RE_POURCENTAGE = /\d{1,3}(?:[,.]\d{1,2})?\s*%/g;
const RE_DATE_LETTRES =
  /\b(\d{1,2})(?:er)?\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\b/giu;
const RE_DATE_CHIFFRES = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
const RE_ARTICLE = /\barticles?\s+(?:[LRD]\.?\s?)?\d+(?:[-.]\d+)*/giu;
const RE_TEXTE =
  /(?<!\p{L})(?:règlement|reglement|directive|décret|decret|loi)\s*(?:\((?:UE|CE)\)\s*)?(?:n[°o]\s*)?(\d{4}[-/]\d+)/giu;
/** Une date n'est « juridique » que dans une phrase qui parle de droit. */
const RE_CONTEXTE_JURIDIQUE =
  /\b(?:AI Act|RGPD|règlement|reglement|directive|loi|décret|decret|articles?|obligations?|vigueur|CNIL|code|annexe)\b/iu;

const MOTS_VIDES: ReadonlySet<string> = new Set(
  "selon entre depuis leurs cette toutes autres comme aussi avant après encore notre votre elles quand aujourd".split(
    " ",
  ),
);

function normaliserNombre(brut: string): string {
  let s = brut.replace(/[   ]/g, "");
  if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : s;
}

function nombresDe(s: string): string[] {
  return [...s.matchAll(RE_NOMBRE)].map((m) => normaliserNombre(m[0]));
}

function cleDate(jour: string, mois: string, annee: string): string {
  return `${annee}-${mois.padStart(2, "0")}-${jour.padStart(2, "0")}`;
}

function datesDe(s: string): Array<{ cle: string; brut: string }> {
  const out: Array<{ cle: string; brut: string }> = [];
  for (const m of s.matchAll(RE_DATE_LETTRES)) {
    const mois = MOIS.indexOf(sansAccents((m[2] ?? "").toLowerCase())) + 1;
    if (mois > 0) out.push({ cle: cleDate(m[1] ?? "", String(mois), m[3] ?? ""), brut: m[0] });
  }
  for (const m of s.matchAll(RE_DATE_CHIFFRES)) {
    out.push({ cle: cleDate(m[1] ?? "", m[2] ?? "", m[3] ?? ""), brut: m[0] });
  }
  return out;
}

type SorteJuridique = "date" | "article" | "texte";
interface RefJuridique {
  readonly sorte: SorteJuridique;
  /** Clé normalisée (« date:2027-12-02 », « article:articlel6353-1 », « texte:2026/1744 »). */
  readonly cle: string;
  readonly brut: string;
}

/** Références juridiques d'un texte ; les dates seulement si `avecDates`. */
function refsJuridiques(s: string, avecDates: boolean): RefJuridique[] {
  const ref = (sorte: SorteJuridique, cle: string, brut: string): RefJuridique => ({
    sorte,
    cle: `${sorte}:${cle}`,
    brut: brut.trim(),
  });
  return [
    ...[...s.matchAll(RE_ARTICLE)].map((m) =>
      ref(
        "article",
        m[0]
          .toLowerCase()
          .replace(/^articles/, "article")
          .replace(/[\s.\u00a0]/g, ""),
        m[0],
      ),
    ),
    ...[...s.matchAll(RE_TEXTE)].map((m) => ref("texte", (m[1] ?? "").replace("-", "/"), m[0])),
    ...(avecDates ? datesDe(s).map((d) => ref("date", d.cle, d.brut)) : []),
  ];
}

function motsDe(s: string): Set<string> {
  const mots = new Set<string>();
  for (const m of s.toLowerCase().matchAll(/\p{L}{5,}/gu)) {
    if (!MOTS_VIDES.has(m[0])) mots.add(m[0]);
  }
  return mots;
}

function texteBrut(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Index des fiches ────────────────────────────────────────────────────────

interface FicheIndexee {
  readonly fiche: FicheConnaissance;
  readonly nombres: ReadonlySet<string>;
  readonly cles: ReadonlySet<string>;
  readonly mots: ReadonlySet<string>;
  /** Phrases de la fiche qui portent des valeurs, pour ne citer que la valeur du même propos. */
  readonly phrases: ReadonlyArray<PhraseFiche>;
  /** Valeurs affichables par famille, pour montrer ce que la fiche affirme. */
  readonly valeurs: Readonly<Partial<Record<Famille, ReadonlyArray<string>>>>;
}

interface PhraseFiche {
  readonly mots: ReadonlySet<string>;
  readonly valeurs: Readonly<Partial<Record<Famille, ReadonlyArray<string>>>>;
}

function valeursDe(t: string): Readonly<Partial<Record<Famille, ReadonlyArray<string>>>> {
  const refs = refsJuridiques(t, true);
  const deSorte = (sorte: SorteJuridique): string[] =>
    refs.filter((r) => r.sorte === sorte).map((r) => r.brut);
  return {
    pourcentage: [...t.matchAll(RE_POURCENTAGE)].map((m) => m[0].trim()),
    montant: [...t.matchAll(new RegExp(PATTERN_AMOUNT_EUR.source, "gi"))].map((m) => m[0].trim()),
    date: deSorte("date"),
    article: deSorte("article"),
    texte: deSorte("texte"),
  };
}

function indexer(fiche: FicheConnaissance): FicheIndexee {
  const t = texteBrut(`${fiche.titre}. ${fiche.texte}`);
  const refs = refsJuridiques(t, true);
  return {
    fiche,
    nombres: new Set(nombresDe(t)),
    cles: new Set(refs.map((r) => r.cle)),
    mots: motsDe(t),
    phrases: splitSentences(t).map((p) => ({ mots: motsDe(p), valeurs: valeursDe(p) })),
    valeurs: valeursDe(t),
  };
}

// ─── Affirmations ────────────────────────────────────────────────────────────

interface Affirmation {
  readonly famille: FamilleConstat;
  readonly sorte: Famille;
  readonly brut: string;
  readonly phrase: string;
  /** Étayée si UNE fiche porte toutes ces valeurs. */
  readonly nombres?: ReadonlyArray<string>;
  /** Étayée si UNE fiche porte cette clé. */
  readonly cle?: string;
}

function estPrixDeLaGrille(montant: string): boolean {
  return /€|\bEUR\b|euros?/i.test(montant) && findNonSsotPrices(montant).length === 0;
}

function affirmationsDe(texte: string): Affirmation[] {
  const out: Affirmation[] = [];

  for (const phrase of splitSentences(texte)) {
    const courte = phrase.length > 280 ? `${phrase.slice(0, 280)}…` : phrase;
    // Une date n'est une affirmation juridique que dans une phrase qui parle de droit.
    for (const r of refsJuridiques(phrase, RE_CONTEXTE_JURIDIQUE.test(phrase))) {
      out.push({ famille: "juridique", sorte: r.sorte, brut: r.brut, phrase: courte, cle: r.cle });
    }
  }

  for (const c of extractClaims(texte)) {
    // Une « statistique datée » n'est qu'un doublon de ses pourcentages et dates, et sa regex
    // coupe parfois une année finale (« au 2 décembre 2027 » → 202) : ignorée ici.
    if (c.kind === "stat_year") continue;
    if (c.kind === "attribution") continue; // une source citée sans chiffre n'est pas comparée
    if (c.kind === "amount" && estPrixDeLaGrille(c.match)) continue; // étayé par pricing.ts
    const sorte: Famille =
      c.kind === "percentage" ? "pourcentage" : c.kind === "amount" ? "montant" : "nombre";
    const nombres = nombresDe(c.match);
    out.push({ famille: "chiffre", sorte, brut: c.match, phrase: c.sentence, nombres });
  }
  return out;
}

function estEtayee(a: Affirmation, fiche: FicheIndexee): boolean {
  if (a.cle) return fiche.cles.has(a.cle);
  const nombres = a.nombres ?? [];
  return nombres.length > 0 && nombres.every((n) => fiche.nombres.has(n));
}

function motsCommuns(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0;
  for (const m of a) if (b.has(m)) n += 1;
  return n;
}

/**
 * Compare les affirmations chiffrées et juridiques de `texte` (HTML ou texte brut)
 * aux `fiches`. Rend la liste des constats ; tableau vide = rien à relire.
 */
export function controleFidelite(
  texte: string,
  fiches: ReadonlyArray<FicheConnaissance>,
): ConstatFidelite[] {
  const index = fiches.map(indexer);
  const constats: ConstatFidelite[] = [];
  const vus = new Set<string>();

  for (const a of affirmationsDe(texteBrut(texte))) {
    if (constats.length >= MAX_CONSTATS) break;
    // Sans `sorte` : un même chiffre vu comme « nombre » puis « pourcentage » ne ressort qu'une fois.
    const cleVue = `${a.famille}::${(a.nombres ?? [a.cle ?? a.brut]).join("|")}::${a.phrase.slice(0, 60)}`;
    if (vus.has(cleVue)) continue;
    vus.add(cleVue);
    if (index.some((f) => estEtayee(a, f))) continue;

    const motsPhrase = motsDe(a.phrase);
    let proche: FicheIndexee | null = null;
    let score = 0;
    for (const f of index) {
      const s = motsCommuns(motsPhrase, f.mots);
      if (s > score) {
        score = s;
        proche = f;
      }
    }

    // Contradiction : une phrase d'une fiche, qui parle du même sujet (au moins 3 mots en commun
    // avec la phrase de l'article), porte une valeur de la même famille. C'est CETTE valeur qui
    // est montrée. La famille « nombre » (ratios, années) est trop vague pour conclure.
    let contradiction: { fiche: FicheIndexee; valeur: string } | null = null;
    if (a.sorte !== "nombre") {
      let meilleur = 0;
      for (const f of index) {
        for (const p of f.phrases) {
          const valeur = p.valeurs[a.sorte]?.[0];
          if (!valeur) continue;
          const s = motsCommuns(motsPhrase, p.mots);
          if (s >= SEUIL_MEME_SUJET && s > meilleur) {
            meilleur = s;
            contradiction = { fiche: f, valeur };
          }
        }
      }
    }
    const contradictoire = contradiction !== null;
    const designee = contradiction
      ? contradiction.fiche
      : score >= SEUIL_FICHE_PROCHE
        ? proche
        : null;

    constats.push({
      nature: contradictoire ? "contradictoire" : "non-etaye",
      famille: a.famille,
      affirmation: a.brut,
      phrase: a.phrase,
      ficheId: designee?.fiche.id ?? null,
      ficheTitre: designee?.fiche.titre ?? null,
      valeurFiche: contradiction ? contradiction.valeur : null,
    });
  }
  return constats;
}
