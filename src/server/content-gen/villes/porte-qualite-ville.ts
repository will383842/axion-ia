/**
 * Porte de qualité des pages de villes (`/fr/<service>/par-ville/<ville>`), 28/11/2026.
 *
 * Décision de Will : une page de ville n'est publiée ET indexée que si son contenu est vraiment
 * propre à la ville (tissu économique, secteurs, données publiques sourcées, exemple concret
 * d'usage de l'IA). Une page qui ne change que le nom de la ville n'est pas publiée : noindex.
 *
 * Module PUR : aucune lecture de base, de fichier ni d'environnement (sauf le drapeau, lu dans un
 * objet passé en argument). Il ne contient AUCUN contenu de ville et ne génère aucune page.
 * Même règle pour toutes les villes : aucun traitement par slug.
 *
 * Trois exigences (`raisons` les liste TOUTES, sans s'arrêter à la première) :
 *   (a) au moins `BLOCS_FAITS_MIN` blocs de faits propres à la ville, chacun avec une source publique ;
 *   (b) similarité (Jaccard sur 5-grammes de mots, nom de la ville retiré) avec chacune des
 *       autres villes ≤ `SEUIL_SIMILARITE_VILLES` ;
 *   (c) aucun gabarit vide (texte vide, variable non remplacée, marqueur de brouillon) et un
 *       exemple concret d'usage de l'IA.
 *
 * Drapeau : `VILLES_PORTE_QUALITE_ACTIVE=true` (ÉTEINT par défaut). Éteint, la règle actuelle
 * (toutes les pages par-ville en `noindex, follow`, hors sitemap) reste seule en vigueur.
 */

import {
  TAILLE_SHINGLE_VILLES,
  jaccardEnsembles,
  shinglesVille,
} from "../generators/anti-duplicate-check";

/** Nombre minimal de blocs de faits propres à la ville, chacun sourcé. */
export const BLOCS_FAITS_MIN = 3;

/** Au-delà de cette similarité (Jaccard 0..1) avec UNE autre ville, la page est un doublon. */
export const SEUIL_SIMILARITE_VILLES = 0.3;

/** Mots minimum d'un bloc de faits pour ne pas être un gabarit vide. */
export const MOTS_MIN_BLOC = 4;

/** Mots minimum de l'exemple d'usage de l'IA. */
export const MOTS_MIN_EXEMPLE_IA = 12;

export interface BlocFait {
  readonly id: string;
  readonly texte: string;
  /** URL publique (INSEE, CCI, URSSAF open data, data.gouv…) ou libellé de source nommée. */
  readonly source: string;
}

export interface ContenuVille {
  readonly slug: string;
  /** Nom affiché, retiré du texte avant comparaison. */
  readonly nom: string;
  readonly blocsFaits: ReadonlyArray<BlocFait>;
  /** Tout le texte propre à la ville que la page montrerait. */
  readonly texteVisible: string;
  /** Exemple concret d'usage de l'IA pour une entreprise des secteurs dominants. */
  readonly exempleIa?: string | undefined;
}

export interface VerdictVille {
  readonly slug: string;
  readonly publiable: boolean;
  readonly raisons: ReadonlyArray<string>;
  /** Similarité maximale mesurée avec une autre ville (0 si aucune comparaison). */
  readonly similariteMax: number;
  /** Slug de la ville la plus proche, si mesurée. */
  readonly plusProche?: string;
}

export { porteQualiteVilleActive } from "@/lib/villes-porte-qualite";

const SOURCE_NON_PUBLIQUE = /claude|llm|gpt|openai|pretraining|g[ée]n[ée]r[ée] par/i;
const SOURCE_URL = /^https?:\/\/\S+\.\S+/i;
const SOURCE_NOMMEE = /\b(insee|cci|urssaf|data\.gouv|inpi|inao|dares|acoss|banque de france)\b/i;

function sourceValide(source: string): boolean {
  const s = source.trim();
  if (s.length < 8 || SOURCE_NON_PUBLIQUE.test(s)) return false;
  return SOURCE_URL.test(s) || SOURCE_NOMMEE.test(s);
}

const GABARIT =
  /\{\{?[^}]*\}\}?|\[(?:ville|secteur|nom)[^\]]*\]|\btodo\b|\bfixme\b|lorem ipsum|\bxxx+\b|%s|\bundefined\b|\bnull\b/i;

const compterMots = (t: string): number => t.split(/\s+/).filter((m) => m.length > 0).length;

function texteVideOuGabarit(texte: string, motsMin: number): boolean {
  const t = texte.trim();
  return t.length === 0 || GABARIT.test(t) || compterMots(t) < motsMin;
}

/** Texte comparé : la page entière, y compris les blocs de faits et l'exemple d'IA. */
function texteCompare(c: ContenuVille): string {
  return [c.texteVisible, ...c.blocsFaits.map((b) => b.texte), c.exempleIa ?? ""].join(" ");
}

function evaluerAvecSimilarite(
  c: ContenuVille,
  similariteMax: number,
  plusProche: string | undefined,
): VerdictVille {
  const raisons: string[] = [];

  // (a) blocs de faits sourcés
  const sourcés = c.blocsFaits.filter(
    (b) => sourceValide(b.source) && !texteVideOuGabarit(b.texte, MOTS_MIN_BLOC),
  );
  if (sourcés.length < BLOCS_FAITS_MIN) {
    const sansSource = c.blocsFaits.filter((b) => !sourceValide(b.source)).length;
    raisons.push(
      `${sourcés.length} blocs de faits sourcés sur ${BLOCS_FAITS_MIN} requis` +
        (sansSource > 0 ? ` (${sansSource} sans source publique valide)` : ""),
    );
  }

  // (c) gabarits vides
  const vides = c.blocsFaits.filter((b) => texteVideOuGabarit(b.texte, MOTS_MIN_BLOC));
  if (vides.length > 0) {
    raisons.push(`gabarit vide ou non rempli dans le bloc : ${vides.map((b) => b.id).join(", ")}`);
  }
  if (texteVideOuGabarit(c.texteVisible, MOTS_MIN_BLOC)) {
    raisons.push("gabarit vide : texte de la page absent ou non rempli");
  }
  if (c.exempleIa === undefined || c.exempleIa.trim().length === 0) {
    raisons.push("exemple concret d'usage de l'IA absent");
  } else if (texteVideOuGabarit(c.exempleIa, MOTS_MIN_EXEMPLE_IA)) {
    raisons.push("gabarit vide : exemple d'usage de l'IA trop court ou non rempli");
  }

  // (b) similarité entre villes
  if (similariteMax > SEUIL_SIMILARITE_VILLES) {
    raisons.push(
      `similarité ${similariteMax.toFixed(2)} avec ${plusProche ?? "une autre ville"} ` +
        `au-dessus du seuil ${SEUIL_SIMILARITE_VILLES}`,
    );
  }

  return {
    slug: c.slug,
    publiable: raisons.length === 0,
    raisons,
    similariteMax,
    ...(plusProche ? { plusProche } : {}),
  };
}

/**
 * Verdict d'une ville, comparée aux `autres` (la ville elle-même, si présente, est ignorée).
 * `ville` doit être le slug de `contenu`.
 */
export function evaluerPageVille(
  ville: string,
  contenu: ContenuVille,
  autres: ReadonlyArray<ContenuVille>,
): VerdictVille {
  const mien = shinglesVille(texteCompare(contenu), contenu.nom);
  let max = 0;
  let proche: string | undefined;
  for (const o of autres) {
    if (o.slug === ville) continue;
    const s = jaccardEnsembles(mien, shinglesVille(texteCompare(o), o.nom));
    if (s > max) {
      max = s;
      proche = o.slug;
    }
  }
  return evaluerAvecSimilarite({ ...contenu, slug: ville }, max, proche);
}

/**
 * Verdict de TOUTES les villes en une passe (index inversé shingle → villes : pas de comparaison
 * deux à deux sur 2 157 villes). Même résultat que `evaluerPageVille` pour chaque ville.
 */
export function evaluerToutesLesVilles(
  contenus: ReadonlyArray<ContenuVille>,
): Map<string, VerdictVille> {
  const ens = contenus.map((c) => shinglesVille(texteCompare(c), c.nom));
  const index = new Map<string, number[]>();
  ens.forEach((set, i) => {
    for (const sh of set) {
      const l = index.get(sh);
      if (l) l.push(i);
      else index.set(sh, [i]);
    }
  });
  const resultat = new Map<string, VerdictVille>();
  contenus.forEach((c, i) => {
    const communs = new Map<number, number>();
    for (const sh of ens[i]!) {
      for (const j of index.get(sh)!) {
        if (j !== i && contenus[j]!.slug !== c.slug) communs.set(j, (communs.get(j) ?? 0) + 1);
      }
    }
    let max = 0;
    let proche: string | undefined;
    for (const [j, inter] of communs) {
      const s = inter / (ens[i]!.size + ens[j]!.size - inter);
      if (s > max) {
        max = s;
        proche = contenus[j]!.slug;
      }
    }
    resultat.set(c.slug, evaluerAvecSimilarite(c, max, proche));
  });
  return resultat;
}

export { TAILLE_SHINGLE_VILLES };
