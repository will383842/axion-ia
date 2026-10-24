/**
 * Ville nommée dans un mot-clé : détecte un mot-clé qui vise UNE AUTRE ville que
 * celle du job.
 *
 * Audit blog/RAG du 24/10/2026 : un article « formation IA Strasbourg Grand Est »
 * contenait « Opportunités à Bezons — bien que cet article se concentre sur
 * Strasbourg ». Cause : le vivier de mots-clés contient des mots-clés qui portent
 * déjà une ville, et le job (campagne) porte une AUTRE ville (`anchorVilleSlug`).
 * Le bloc d'ancrage local demandait alors au modèle de situer l'article à
 * Bezons, alors que le sujet était Strasbourg.
 *
 * Module PUR (pas de base, pas de réseau). Il évite les faux positifs : plusieurs
 * communes portent un nom de mot courant (« Ligne », « Change », « Sens »,
 * « Publier »…), donc un nom de commune n'est reconnu que s'il est écrit avec une
 * majuscule, ou si la commune compte au moins `POPULATION_MIN_MINUSCULE` habitants.
 * Un faux positif ne coûte qu'un mot-clé sauté pour ce job ; un faux négatif
 * laisse le comportement d'avant.
 */

import { VILLES_CORE } from "@/content/villes/core";

/** En dessous, une commune n'est reconnue que si son nom est écrit avec une majuscule. */
const POPULATION_MIN_MINUSCULE = 50_000;

/** Noms de grandes communes qui sont aussi des mots courants : majuscule exigée. */
const NOMS_AMBIGUS: ReadonlySet<string> = new Set(["tours", "nice", "orange", "sens", "vienne"]);

interface VilleReconnaissable {
  readonly nom: string;
  readonly reMajuscule: RegExp;
  readonly reInsensible: RegExp | null;
}

/** Retire les accents et ramène tirets et apostrophes à des espaces (casse conservée). */
function aplatir(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-'’‘`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let cache: ReadonlyArray<VilleReconnaissable> | null = null;

function villesReconnaissables(): ReadonlyArray<VilleReconnaissable> {
  if (cache) return cache;
  const liste: VilleReconnaissable[] = [];
  for (const v of VILLES_CORE) {
    const aplati = aplatir(v.nameFr);
    if (aplati.length < 4) continue;
    const motif = echapper(aplati);
    // Majuscule exigée sur la première lettre du nom, bornes de mot explicites.
    const premiere = aplati.charAt(0);
    const reste = echapper(aplati.slice(1));
    const reMajuscule = new RegExp(
      `(?<![A-Za-z0-9])${echapper(premiere.toUpperCase())}${reste}(?![A-Za-z0-9])`,
    );
    const insensiblePermis =
      v.population >= POPULATION_MIN_MINUSCULE &&
      !NOMS_AMBIGUS.has(aplati.toLowerCase().replace(/ /g, "-"));
    const reInsensible = insensiblePermis
      ? new RegExp(`(?<![a-z0-9])${motif}(?![a-z0-9])`, "i")
      : null;
    liste.push({ nom: aplati.toLowerCase(), reMajuscule, reInsensible });
  }
  cache = liste;
  return liste;
}

/**
 * Noms (aplatis, minuscules) des communes nommées dans le texte. Un nom contenu
 * dans un autre nom trouvé (« Saint Etienne » dans « Saint Etienne du Rouvray »)
 * est écarté : seul le plus long compte.
 */
export function villesNommeesDansTexte(texte: string): string[] {
  const aplati = aplatir(texte ?? "");
  if (!aplati) return [];
  const trouves = new Set<string>();
  for (const v of villesReconnaissables()) {
    if (v.reMajuscule.test(aplati) || (v.reInsensible !== null && v.reInsensible.test(aplati))) {
      trouves.add(v.nom);
    }
  }
  const noms = [...trouves];
  return noms.filter((n) => !noms.some((autre) => autre !== n && ` ${autre} `.includes(` ${n} `)));
}

/**
 * Ce mot-clé vise-t-il une autre commune que la commune du job ?
 * `nomVilleJob` est le nom de la commune d'ancrage (« Bezons »). Faux si le
 * mot-clé ne nomme aucune commune, ou seulement celle du job.
 */
export function motCleVisUneAutreVille(motCle: string, nomVilleJob: string): boolean {
  const nomJob = aplatir(nomVilleJob).toLowerCase();
  return villesNommeesDansTexte(motCle).some((n) => {
    if (n === nomJob) return false;
    // Le nom trouvé fait partie du nom de la ville du job (« Saint Denis » dans
    // « Saint Denis de la Reunion ») : ce n'est pas une autre ville.
    return !` ${nomJob} `.includes(` ${n} `);
  });
}
