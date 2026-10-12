/**
 * Département et région d'un CODE POSTAL (lot L11b, repli sans la phase 7).
 *
 * Le tri des cartes de choix (département, puis région) se lit sur le code
 * postal du formateur (`Trainer.codePostalPro`) et sur celui du lieu de la
 * session. Aucun référentiel des communes ici : il arrive avec la phase 7
 * (`formateurs-proches/`), et un module des groupes 5-6 n'en importe aucun.
 *
 * ⚠️ Un code postal n'est pas toujours dans le département dont il porte les
 * deux chiffres (bureaux distributeurs frontaliers). L'erreur reste rare et ne
 * va que vers un tri moins fin, jamais vers un refus : c'est le repli prévu.
 *
 * Module PUR.
 */

/** Les 13 régions métropolitaines et les 5 régions d'outre-mer (2016). */
const REGIONS: Readonly<Record<string, ReadonlyArray<string>>> = {
  "Auvergne-Rhône-Alpes": ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
  "Bourgogne-Franche-Comté": ["21", "25", "39", "58", "70", "71", "89", "90"],
  Bretagne: ["22", "29", "35", "56"],
  "Centre-Val de Loire": ["18", "28", "36", "37", "41", "45"],
  Corse: ["2A", "2B"],
  "Grand Est": ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
  "Hauts-de-France": ["02", "59", "60", "62", "80"],
  "Île-de-France": ["75", "77", "78", "91", "92", "93", "94", "95"],
  Normandie: ["14", "27", "50", "61", "76"],
  "Nouvelle-Aquitaine": ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
  Occitanie: ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
  "Pays de la Loire": ["44", "49", "53", "72", "85"],
  "Provence-Alpes-Côte d'Azur": ["04", "05", "06", "13", "83", "84"],
  Guadeloupe: ["971"],
  Martinique: ["972"],
  Guyane: ["973"],
  "La Réunion": ["974"],
  Mayotte: ["976"],
};

const REGION_PAR_DEPARTEMENT: ReadonlyMap<string, string> = new Map(
  Object.entries(REGIONS).flatMap(([region, deps]) => deps.map((d) => [d, region] as const)),
);

/** « 38 », « 2A », « 974 » ; `null` si le code postal est illisible. */
export function departementDeCodePostal(cp: string | null | undefined): string | null {
  const c = (cp ?? "").trim();
  if (!/^\d{5}$/.test(c)) return null;
  if (c.startsWith("97") || c.startsWith("98")) return c.slice(0, 3);
  // Corse : 20000 à 20199 en Corse-du-Sud, au-delà en Haute-Corse.
  if (c.startsWith("20")) return Number(c) < 20200 ? "2A" : "2B";
  if (c === "00000") return null;
  return c.slice(0, 2);
}

/** La région d'un département, ou `null` (département inconnu, collectivité). */
export function regionDeDepartement(departement: string | null | undefined): string | null {
  if (departement == null) return null;
  return REGION_PAR_DEPARTEMENT.get(departement) ?? null;
}

/** Le nombre de départements connus (101). */
export const NOMBRE_DEPARTEMENTS = REGION_PAR_DEPARTEMENT.size;
