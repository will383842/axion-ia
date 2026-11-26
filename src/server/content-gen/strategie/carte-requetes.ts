/**
 * Carte des requêtes : « une requête = une seule URL propriétaire ».
 *
 * Module PUR (aucun accès base, aucun réseau) : il reçoit des entrées déjà
 * lues — mots-clés suivis (KeywordTracking), requêtes Search Console,
 * plan éditorial — et rend la carte normalisée requête → URL, plus la liste
 * des requêtes servies par deux URL ou plus (cannibalisation).
 * La lecture Prisma est dans `carte-requetes-source.ts`.
 */

export type SourceEntree = "plan" | "gsc" | "suivi";

export interface EntreeCarte {
  readonly requete: string;
  readonly url: string;
  readonly source: SourceEntree;
  /** Position moyenne SERP (1 = meilleur). Absente pour le plan. */
  readonly position?: number | null;
  readonly impressions?: number | null;
}

export interface Cannibalisation {
  /** Requête normalisée. */
  readonly requete: string;
  /** URL distinctes qui la servent, triées. */
  readonly urls: readonly string[];
  /** URL retenue comme propriétaire. */
  readonly proprietaire: string;
}

export interface CarteRequetes {
  /** requête normalisée → URL propriétaire. */
  readonly carte: ReadonlyMap<string, string>;
  readonly cannibalisations: readonly Cannibalisation[];
  proprietaire(requete: string): string | null;
  estLibre(requete: string): boolean;
}

const MOTS_VIDES = new Set([
  "le",
  "la",
  "les",
  "l",
  "un",
  "une",
  "des",
  "de",
  "du",
  "d",
  "et",
  "en",
  "a",
  "au",
  "aux",
  "pour",
  "par",
  "sur",
  "dans",
  "avec",
  "ce",
  "ces",
  "se",
  "son",
  "sa",
  "ses",
  "ou",
  "que",
  "qui",
]);

function singulier(mot: string): string {
  if (mot.length > 3 && (mot.endsWith("s") || mot.endsWith("x"))) return mot.slice(0, -1);
  return mot;
}

/**
 * Minuscules, sans accents ni ponctuation, sans mots vides, singulier simple (collisions possibles, ex. « cas »/« ca », symétriques donc sans effet),
 * mots triés (l'ordre ne change pas la requête visée). Chaîne vide si rien
 * ne reste.
 */
export function normaliserRequete(brut: string): string {
  const mots = brut
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((m) => m.length > 0 && !MOTS_VIDES.has(m))
    .map(singulier);
  return [...new Set(mots)].sort().join(" ");
}

/** URL sans requête, ancre ni barre finale ; hôte en minuscules. */
export function normaliserUrl(brut: string): string {
  const s = brut.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    const chemin = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host}${chemin}`.toLowerCase();
  } catch {
    return "";
  }
}

const RANG_SOURCE: Record<SourceEntree, number> = { plan: 0, gsc: 1, suivi: 2 };

interface Candidate {
  url: string;
  rang: number;
  position: number;
  impressions: number;
}

function meilleure(a: Candidate, b: Candidate): Candidate {
  if (a.rang !== b.rang) return a.rang < b.rang ? a : b;
  if (a.position !== b.position) return a.position < b.position ? a : b;
  if (a.impressions !== b.impressions) return a.impressions > b.impressions ? a : b;
  return a.url <= b.url ? a : b;
}

/**
 * Propriétaire = le plan éditorial d'abord, puis la meilleure position,
 * puis le plus d'impressions, puis l'URL par ordre alphabétique (stable).
 */
export function construireCarte(entrees: readonly EntreeCarte[]): CarteRequetes {
  const parRequete = new Map<string, Map<string, Candidate>>();

  for (const e of entrees) {
    const requete = normaliserRequete(e.requete);
    const url = normaliserUrl(e.url);
    if (!requete || !url) continue;
    const cand: Candidate = {
      url,
      rang: RANG_SOURCE[e.source],
      position: e.position ?? Number.POSITIVE_INFINITY,
      impressions: e.impressions ?? 0,
    };
    const urls = parRequete.get(requete) ?? new Map<string, Candidate>();
    const deja = urls.get(url);
    urls.set(url, deja ? meilleure(deja, cand) : cand);
    parRequete.set(requete, urls);
  }

  const carte = new Map<string, string>();
  const cannibalisations: Cannibalisation[] = [];
  for (const [requete, urls] of parRequete) {
    const candidats = [...urls.values()];
    const gagnante = candidats.reduce(meilleure);
    carte.set(requete, gagnante.url);
    if (candidats.length > 1) {
      cannibalisations.push({
        requete,
        urls: candidats.map((c) => c.url).sort(),
        proprietaire: gagnante.url,
      });
    }
  }
  cannibalisations.sort((a, b) => a.requete.localeCompare(b.requete));

  const proprietaire = (requete: string): string | null =>
    carte.get(normaliserRequete(requete)) ?? null;
  return {
    carte,
    cannibalisations,
    proprietaire,
    estLibre: (requete) => proprietaire(requete) === null,
  };
}
