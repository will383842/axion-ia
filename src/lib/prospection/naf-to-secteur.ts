// SSOT — Mapping NAF/APE → secteur métier interne (T1).
//
// Module Prospection. Source de vérité UNIQUE : `SECTEUR_PREFIXES` (secteur →
// préfixes NAF). `secteurFromNaf` fait un match du **plus long préfixe** (donc le
// groupe `691` « activités juridiques » l'emporte sur la division `69`). Repli
// `autre` obligatoire → aucun code n'est jamais perdu (test « 100 % des divisions
// mappées »). L'inverse `nafPrefixesForSecteur` sert à détendre un `secteur[]` de
// campagne en codes NAF pour créer les `CoverageCell` (01-DATA-MODEL §CoverageCell).
//
// Nomenclature NAF rév.2 (INSEE) : division = 2 chiffres, groupe = 3, classe = 4,
// sous-classe = 4 + lettre (ex. `69.10Z`). On raisonne sur les chiffres.

import type { Secteur } from "./enums";

/**
 * Secteur → préfixes NAF (chiffres, sans point). Un préfixe de 3 chiffres (groupe)
 * raffine une division. Exhaustif sur les divisions NAF rév.2 valides (01-99).
 */
export const SECTEUR_PREFIXES: Record<Secteur, readonly string[]> = {
  agriculture: ["01", "02", "03"],
  // B extraction (05-09) + C manufacture (10-33) + D énergie (35) + E eau/déchets (36-39)
  industrie: [
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
    "30",
    "31",
    "32",
    "33",
    "35",
    "36",
    "37",
    "38",
    "39",
  ],
  btp: ["41", "42", "43"],
  commerce: ["45", "46", "47"],
  transport_logistique: ["49", "50", "51", "52", "53"],
  hotellerie_restauration: ["55", "56"],
  numerique: ["58", "59", "60", "61", "62", "63"],
  finance_assurance: ["64", "65", "66"],
  immobilier: ["68"],
  droit: ["691"], // 69.1x activités juridiques (raffine la division 69)
  conseil: ["69", "70", "71", "72", "73", "74", "75"], // 69 base (692 comptable), 70-75 scientifique/technique
  services_aux_entreprises: ["77", "78", "79", "80", "81", "82"],
  administration_publique: ["84"],
  enseignement: ["85"],
  sante: ["86", "87"], // santé humaine + hébergement médico-social
  action_sociale: ["88"], // action sociale sans hébergement
  arts_culture_sport: ["90", "91", "92", "93"],
  services_aux_particuliers: ["94", "95", "96", "97", "98"],
  autre: ["99"], // extraterritorial + repli
};

// Règles (préfixe → secteur) triées par longueur décroissante (longest-match).
const PREFIX_RULES: ReadonlyArray<{ prefix: string; secteur: Secteur }> = (() => {
  const rules: Array<{ prefix: string; secteur: Secteur }> = [];
  for (const secteur of Object.keys(SECTEUR_PREFIXES) as Secteur[]) {
    for (const prefix of SECTEUR_PREFIXES[secteur]) rules.push({ prefix, secteur });
  }
  return rules.sort((a, b) => b.prefix.length - a.prefix.length);
})();

/** Normalise un code NAF en chaîne de chiffres (retire point/lettre/espaces). */
export function nafDigits(naf: string | null | undefined): string {
  if (!naf) return "";
  return naf.replace(/[^0-9]/g, "");
}

/** Division NAF (2 premiers chiffres), ou "" si indéterminable. */
export function nafDivision(naf: string | null | undefined): string {
  const d = nafDigits(naf);
  return d.length >= 2 ? d.slice(0, 2) : "";
}

/** Lettre de section NAF (A-U) d'après la division, ou "" si inconnue. */
export function sectionFromNaf(naf: string | null | undefined): string {
  const div = parseInt(nafDivision(naf), 10);
  if (Number.isNaN(div)) return "";
  if (div >= 1 && div <= 3) return "A";
  if (div >= 5 && div <= 9) return "B";
  if (div >= 10 && div <= 33) return "C";
  if (div === 35) return "D";
  if (div >= 36 && div <= 39) return "E";
  if (div >= 41 && div <= 43) return "F";
  if (div >= 45 && div <= 47) return "G";
  if (div >= 49 && div <= 53) return "H";
  if (div >= 55 && div <= 56) return "I";
  if (div >= 58 && div <= 63) return "J";
  if (div >= 64 && div <= 66) return "K";
  if (div === 68) return "L";
  if (div >= 69 && div <= 75) return "M";
  if (div >= 77 && div <= 82) return "N";
  if (div === 84) return "O";
  if (div === 85) return "P";
  if (div >= 86 && div <= 88) return "Q";
  if (div >= 90 && div <= 93) return "R";
  if (div >= 94 && div <= 96) return "S";
  if (div >= 97 && div <= 98) return "T";
  if (div === 99) return "U";
  return "";
}

/**
 * Code NAF → secteur métier interne. Match du plus long préfixe (groupe > division).
 * Repli `autre` si aucun préfixe ne matche (jamais `null` — on ne perd pas le code).
 */
export function secteurFromNaf(naf: string | null | undefined): Secteur {
  const digits = nafDigits(naf);
  if (digits.length < 2) return "autre";
  for (const rule of PREFIX_RULES) {
    if (digits.startsWith(rule.prefix)) return rule.secteur;
  }
  return "autre";
}

/** Préfixes NAF d'un secteur (pour détendre `secteur[]` → codes NAF des CoverageCell). */
export function nafPrefixesForSecteur(secteur: Secteur): readonly string[] {
  return SECTEUR_PREFIXES[secteur] ?? [];
}

/** Détend une liste de secteurs en l'ensemble (dédupliqué) des préfixes NAF. */
export function nafPrefixesForSecteurs(secteurs: readonly Secteur[]): string[] {
  const set = new Set<string>();
  for (const s of secteurs) for (const p of nafPrefixesForSecteur(s)) set.add(p);
  return [...set];
}
