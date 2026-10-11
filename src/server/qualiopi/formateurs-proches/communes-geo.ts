/**
 * Référentiel des communes de France — lecture PURE (lot L2c, ADR 0066).
 *
 * Source : geo.api.gouv.fr, un seul appel qui rend toutes les communes. On
 * télécharge un référentiel public : aucune donnée personnelle n'est envoyée.
 *
 * ⚠️ Deux pièges vérifiés sur la vraie réponse (W6 §1) :
 * - `centre.coordinates` est en [LONGITUDE, LATITUDE] (GeoJSON), pas l'inverse ;
 * - le département se lit dans `codeDepartement` (« 2A », « 971 »), jamais dans
 *   les deux premiers chiffres du code postal (20000 → 2A ou 2B).
 *
 * Aucun import : sûr pour le worker comme pour la console.
 */

/** URL du téléchargement complet (champs utiles seulement). */
export const URL_COMMUNES_GEO =
  "https://geo.api.gouv.fr/communes?fields=code,nom,codesPostaux,centre,codeDepartement,population&format=json&geometry=centre";

/**
 * Une réponse plus courte est tenue pour TRONQUÉE et n'est pas écrite. La France
 * compte environ 34 900 communes ; la marge couvre les fusions à venir.
 */
export const MINIMUM_COMMUNES_ATTENDUES = 30_000;

/** Le référentiel est retéléchargé quand il a 30 jours ou plus. */
export const FRAICHEUR_REFERENTIEL_JOURS = 30;

export interface CommuneGeoLue {
  readonly codeInsee: string;
  readonly nom: string;
  readonly codesPostaux: string[];
  readonly latitude: number;
  readonly longitude: number;
  readonly departement: string;
  readonly population: number | null;
}

const RE_INSEE = /^(?:\d{5}|2[AB]\d{3})$/;
const RE_CODE_POSTAL = /^\d{5}$/;
const RE_DEPARTEMENT = /^(?:\d{2}|2[AB]|\d{3})$/;

function nombreFini(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function lireCommune(brut: unknown): CommuneGeoLue | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const code = o["code"];
  const nom = o["nom"];
  const dep = o["codeDepartement"];
  if (typeof code !== "string" || !RE_INSEE.test(code)) return null;
  if (typeof nom !== "string" || nom.trim() === "" || nom.length > 120) return null;
  if (typeof dep !== "string" || !RE_DEPARTEMENT.test(dep)) return null;

  const centre = o["centre"];
  const coords =
    centre && typeof centre === "object"
      ? (centre as Record<string, unknown>)["coordinates"]
      : null;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [longitude, latitude] = coords as unknown[];
  if (!nombreFini(longitude) || !nombreFini(latitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const cps = Array.isArray(o["codesPostaux"]) ? (o["codesPostaux"] as unknown[]) : [];
  const population = o["population"];
  return {
    codeInsee: code,
    nom: nom.trim(),
    codesPostaux: cps.filter((c): c is string => typeof c === "string" && RE_CODE_POSTAL.test(c)),
    latitude,
    longitude,
    departement: dep,
    population: nombreFini(population) ? Math.round(population) : null,
  };
}

/**
 * Lit la réponse complète. Une ligne illisible est écartée (et comptée) sans
 * faire tomber les autres ; une réponse qui n'est pas une liste ne rend rien.
 */
export function analyserCommunesGeo(brut: unknown): {
  communes: CommuneGeoLue[];
  rejets: number;
  lisible: boolean;
} {
  if (!Array.isArray(brut)) return { communes: [], rejets: 0, lisible: false };
  const communes: CommuneGeoLue[] = [];
  let rejets = 0;
  for (const ligne of brut) {
    const c = lireCommune(ligne);
    if (c) communes.push(c);
    else rejets += 1;
  }
  return { communes, rejets, lisible: true };
}

/**
 * Département d'un code INSEE de commune : 3 caractères outre-mer (`97…`),
 * 2 sinon (« 2A004 » → « 2A », « 75108 » → « 75 »). Illisible → `null`.
 */
export function departementDeCommune(codeInsee: string): string | null {
  if (!RE_INSEE.test(codeInsee)) return null;
  return codeInsee.startsWith("97") ? codeInsee.slice(0, 3) : codeInsee.slice(0, 2);
}

/** Vrai si la dernière mise à jour a moins de 30 jours. Table vide → faux. */
export function referentielAJour(derniereMaj: Date | null, maintenant: Date): boolean {
  if (!derniereMaj) return false;
  const ageMs = maintenant.getTime() - derniereMaj.getTime();
  return ageMs < FRAICHEUR_REFERENTIEL_JOURS * 24 * 60 * 60 * 1000;
}
