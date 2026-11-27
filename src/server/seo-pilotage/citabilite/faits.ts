/**
 * Pilotage SEO/GEO — cohérence des faits « canon » (module PUR, aucun modèle, aucun réseau).
 *
 * Les faits sont LUS dans `pricing.ts` et `journee-ia-commun.ts` : jamais recopiés ici.
 * Si l'un de ces fichiers change, la comparaison suit toute seule.
 */

import { JOURNEE_IA_TIER } from "@/content/pricing";
import { DELAI_RAPPORT_JOURS_OUVRES } from "@/content/journee-ia-commun";
import { detecterInterditsSurface, type CodeInterdit } from "@/lib/contenu/interdits-publication";

export interface FaitsCanon {
  /** Prix unique de la Journée IA, en euros. */
  readonly prixJourneeIaEur: number;
  /** Délai de remise du rapport, en jours ouvrés. */
  readonly delaiRapportJoursOuvres: number;
}

export type TypeDivergence = "prix-journee-ia" | "delai-rapport";

export interface DivergenceFait {
  readonly type: TypeDivergence;
  readonly attendu: number;
  readonly trouve: number;
  /** Phrase fautive (tronquée). */
  readonly extrait: string;
}

export interface InterditTrouve {
  readonly code: CodeInterdit;
  readonly extrait: string;
}

/** Lit les faits canon à la source. */
export function faitsCanon(): FaitsCanon {
  const prix = JOURNEE_IA_TIER.priceFlat;
  if (typeof prix !== "number" || !(prix > 0)) {
    throw new Error("faitsCanon : prix de la Journée IA absent de pricing.ts");
  }
  return {
    prixJourneeIaEur: prix,
    delaiRapportJoursOuvres: DELAI_RAPPORT_JOURS_OUVRES,
  };
}

function normaliser(t: string): string {
  return t.replace(/[   ]/g, " ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Montants en euros d'une phrase : « 1 490 € », « 1490 euros », « 1.490 EUR ». */
function montantsEuros(phrase: string): number[] {
  const propre = phrase.replace(/[   ]/g, " ");
  const out: number[] = [];
  const re =
    /(?<![\d.,])(\d{1,3}(?:[ .]\d{3}){1,4}|\d{1,12})(?:,\d{1,2})?\s*(?:€|eur\b|euros?\b)/gi;
  for (const m of propre.matchAll(re)) {
    const n = Number((m[1] ?? "").replace(/[ .]/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Cherche, dans le texte visible d'une page, les faits canon qui divergent :
 *  - un montant en euros dans une phrase qui parle de la Journée IA ;
 *  - un nombre de jours ouvrés dans une phrase qui parle du rapport.
 * Une phrase sans le sujet n'est jamais jugée (un autre prix peut être légitime).
 */
export function detecterFaitsDivergents(texte: string, canon: FaitsCanon): DivergenceFait[] {
  const phrases = texte.split(/(?<=[.!?…;])\s+|\n+/);
  const out: DivergenceFait[] = [];
  for (const phrase of phrases) {
    // « par rapport à » n'est pas le rapport remis au client.
    const n = normaliser(phrase).replace(/par rapport\b/g, " ");
    if (/journee ia/.test(n)) {
      // Une phrase qui contient déjà le prix canon peut citer d'autres montants (ex. le seuil de
      // déduction « 5 000 € ») : on ne juge que les phrases où AUCUN montant n'est le prix.
      const montants = montantsEuros(phrase);
      if (montants.length > 0 && !montants.includes(canon.prixJourneeIaEur)) {
        for (const montant of montants) {
          out.push({
            type: "prix-journee-ia",
            attendu: canon.prixJourneeIaEur,
            trouve: montant,
            extrait: phrase.trim().slice(0, 200),
          });
        }
      }
    }
    if (/rapport/.test(n)) {
      for (const m of n.matchAll(/(\d+)\s+jours?\s+ouvres?/g)) {
        const jours = Number(m[1]);
        if (jours !== canon.delaiRapportJoursOuvres) {
          out.push({
            type: "delai-rapport",
            attendu: canon.delaiRapportJoursOuvres,
            trouve: jours,
            extrait: phrase.trim().slice(0, 200),
          });
        }
      }
    }
  }
  return out;
}

/**
 * Interdits propres à la rédaction d'ARTICLES : sur une page (accueil : « Nous, si. », « Ils nous
 * font confiance »), ils sont légitimes et ne doivent pas coûter 20 points.
 */
const CODES_REDACTION_ARTICLE: ReadonlySet<CodeInterdit> = new Set<CodeInterdit>([
  "slogan-recopie",
  "partenariat",
  "etiquette-tpe-pme",
  "stat-axion",
  "temoignage-axion",
  "citation-temoin",
  "preuve-sociale-vague",
]);

/** Mots interdits de la doctrine (source unique : `interdits-publication.ts`) dans un texte. */
export function detecterInterditsDoctrine(texte: string): InterditTrouve[] {
  return detecterInterditsSurface(
    { page: texte },
    { actualite: false, financementPublicAutorise: false },
  )
    .filter((i) => !CODES_REDACTION_ARTICLE.has(i.code))
    .map((i) => ({ code: i.code, extrait: i.extrait }));
}
