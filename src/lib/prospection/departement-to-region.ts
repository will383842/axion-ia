// SSOT — Mapping département → région (codes officiels INSEE 2016+).
//
// Module Prospection & Base Entreprises (T1). Source de vérité pour :
//   - le write de `Company.region` / `Establishment` (dérivé du département du siège) ;
//   - le rollup de couverture `département → région → France` (`coverage-worker`, §03-SPEC-STATS).
//
// Pur (aucune dépendance runtime). 101 départements = 96 métropole (01-95 hors 20,
// + 2A/2B Corse) + 5 DROM (971 Guadeloupe, 972 Martinique, 973 Guyane, 974 La Réunion,
// 976 Mayotte). Repli explicite `inconnu` — on ne perd jamais une entreprise.

/** Codes région officiels (13 métropole + 5 DROM) + repli. */
export const REGION_CODES = [
  "84", // Auvergne-Rhône-Alpes
  "27", // Bourgogne-Franche-Comté
  "53", // Bretagne
  "24", // Centre-Val de Loire
  "94", // Corse
  "44", // Grand Est
  "32", // Hauts-de-France
  "11", // Île-de-France
  "28", // Normandie
  "75", // Nouvelle-Aquitaine
  "76", // Occitanie
  "52", // Pays de la Loire
  "93", // Provence-Alpes-Côte d'Azur
  "01", // Guadeloupe (DROM)
  "02", // Martinique (DROM)
  "03", // Guyane (DROM)
  "04", // La Réunion (DROM)
  "06", // Mayotte (DROM)
  "inconnu", // repli — département non reconnu
] as const;

export type RegionCode = (typeof REGION_CODES)[number];

/** Libellés région (FR canonique). */
export const REGION_LABELS: Record<RegionCode, string> = {
  "84": "Auvergne-Rhône-Alpes",
  "27": "Bourgogne-Franche-Comté",
  "53": "Bretagne",
  "24": "Centre-Val de Loire",
  "94": "Corse",
  "44": "Grand Est",
  "32": "Hauts-de-France",
  "11": "Île-de-France",
  "28": "Normandie",
  "75": "Nouvelle-Aquitaine",
  "76": "Occitanie",
  "52": "Pays de la Loire",
  "93": "Provence-Alpes-Côte d'Azur",
  "01": "Guadeloupe",
  "02": "Martinique",
  "03": "Guyane",
  "04": "La Réunion",
  "06": "Mayotte",
  inconnu: "Région inconnue",
};

// Composition région → départements (ordre stable, source INSEE).
const REGION_TO_DEPARTEMENTS: Record<Exclude<RegionCode, "inconnu">, readonly string[]> = {
  "84": ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
  "27": ["21", "25", "39", "58", "70", "71", "89", "90"],
  "53": ["22", "29", "35", "56"],
  "24": ["18", "28", "36", "37", "41", "45"],
  "94": ["2A", "2B"],
  "44": ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
  "32": ["02", "59", "60", "62", "80"],
  "11": ["75", "77", "78", "91", "92", "93", "94", "95"],
  "28": ["14", "27", "50", "61", "76"],
  "75": ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
  "76": ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
  "52": ["44", "49", "53", "72", "85"],
  "93": ["04", "05", "06", "13", "83", "84"],
  "01": ["971"],
  "02": ["972"],
  "03": ["973"],
  "04": ["974"],
  "06": ["976"],
};

// Index inverse département → région (construit une fois au chargement du module).
const DEPARTEMENT_TO_REGION: Record<string, RegionCode> = (() => {
  const map: Record<string, RegionCode> = {};
  for (const region of Object.keys(REGION_TO_DEPARTEMENTS) as Exclude<RegionCode, "inconnu">[]) {
    for (const dep of REGION_TO_DEPARTEMENTS[region]) map[dep] = region;
  }
  return map;
})();

/**
 * Normalise un code département : trim, majuscule (Corse), zéro-padding des
 * codes numériques à 2 chiffres (`"1"` → `"01"`, `"5"` → `"05"`). Les codes
 * Corse (`2A`/`2B`) et DROM (`971`…) sont conservés tels quels.
 */
export function normalizeDepartement(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim().toUpperCase();
  if (trimmed === "") return "";
  // Corse (2A / 2B) et DROM (3 chiffres) : pas de padding.
  if (trimmed === "2A" || trimmed === "2B") return trimmed;
  if (/^\d{3}$/.test(trimmed)) return trimmed;
  if (/^\d{1,2}$/.test(trimmed)) return trimmed.padStart(2, "0");
  return trimmed;
}

/** Liste des 101 départements connus (ordre région puis code). */
export const ALL_DEPARTEMENTS: readonly string[] = Object.freeze(
  Object.values(REGION_TO_DEPARTEMENTS).flat(),
);

/**
 * Retourne le code région d'un département, ou `"inconnu"` si non reconnu.
 * Ne jette jamais : un département inconnu est agrégé sous `inconnu` (traçable),
 * pas perdu.
 */
export function regionOfDepartement(departement: string | null | undefined): RegionCode {
  const dep = normalizeDepartement(departement);
  return DEPARTEMENT_TO_REGION[dep] ?? "inconnu";
}

/** Libellé région d'un département (via {@link regionOfDepartement}). */
export function regionLabelOfDepartement(departement: string | null | undefined): string {
  return REGION_LABELS[regionOfDepartement(departement)];
}

/** Départements d'une région (vide si code région inconnu). */
export function departementsOfRegion(region: RegionCode): readonly string[] {
  if (region === "inconnu") return [];
  return REGION_TO_DEPARTEMENTS[region] ?? [];
}
