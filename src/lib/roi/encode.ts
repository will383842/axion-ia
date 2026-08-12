// Simulateur de gains v2 — encodage des réponses dans l'URL.
//
// ── Pourquoi ──────────────────────────────────────────────────────────────
// Un dirigeant qui vient de découvrir qu'il peut récupérer l'équivalent d'un
// mi-temps ne va pas décider seul : il envoie le lien à son associé, à sa
// responsable administrative ou à son expert-comptable. Ce partage interne vaut
// plus que n'importe quelle séquence de relance, et il est gratuit — à
// condition que le rapport ait une adresse.
//
// Effet de bord utile : le retour arrière du navigateur redevient naturel, et
// un rechargement de page ne perd pas les réponses.
//
// ── Contrat de compatibilité ──────────────────────────────────────────────
// Les codes ci-dessous sont un CONTRAT PUBLIC : un lien partagé aujourd'hui
// doit rester lisible dans six mois. On ne renomme JAMAIS un code existant. On
// ajoute, et on incrémente `ENCODING_VERSION` si la grammaire change.
//
// Les codes sont volontairement découplés de l'ordre des tableaux du modèle :
// réordonner `VOLUME_DEFS` ou `CLIENT_SECTORS` ne doit pas casser les liens déjà
// partagés. Un test vérifie l'exhaustivité et l'unicité des tables.
//
// Format : d=1~<secteur>~<effectif>~<maturité>~<fonctions>~<volumes>~<coût>
// Exemple : d=1~cf~c~o~ac~fa20-de6~50
//
// Tous les séparateurs (`~`, `-`, `.`) sont des caractères « unreserved » au
// sens de la RFC 3986 : aucun échappement, donc aucune URL illisible.

import type {
  BusinessFunction,
  DigitalMaturity,
  HeadcountBand,
  RoiAnswers,
  VolumeKey,
} from "@/content/roi/model/types";
import { HEADCOUNT_BANDS } from "@/content/roi/model/types";
import { isClientSectorSlug, type ClientSectorSlug } from "@/content/sectors";

export const ENCODING_VERSION = "1";

/** Nom du paramètre d'URL portant le diagnostic complet. */
export const ROI_QUERY_PARAM = "d";

/**
 * Marqueur d'un parcours TERMINÉ.
 *
 * `d` porte les réponses, `r=1` dit qu'elles sont complètes. Un lien partagé
 * possède les deux et ouvre directement le rapport ; une URL laissée en cours
 * de questionnaire n'a que `d`, et reprend le questionnaire au lieu d'afficher
 * un rapport prématuré.
 */
export const REPORT_QUERY_PARAM = "r";

// ---------------------------------------------------------------------------
// Tables de codes — NE JAMAIS RENOMMER UNE VALEUR EXISTANTE
// ---------------------------------------------------------------------------

export const SECTOR_CODES: Readonly<Record<ClientSectorSlug | "generique", string>> = {
  generique: "gx",
  comptabilite_finance: "cf",
  btp_immobilier: "bi",
  restauration_hotellerie: "rh",
  sante_medecine: "sm",
  juridique: "ju",
  commerce_retail: "cr",
  industrie_logistique: "il",
  artisanat_services: "as",
  rh_recrutement: "rr",
  collectivites_public: "cp",
};

export const HEADCOUNT_CODES: Readonly<Record<HeadcountBand, string>> = {
  "1": "a",
  "2-5": "b",
  "6-10": "c",
  "11-20": "d",
  "21-50": "e",
  "51-100": "f",
  "100+": "g",
};

export const MATURITY_CODES: Readonly<Record<DigitalMaturity, string>> = {
  papier: "p",
  bureautique: "b",
  outille: "o",
  avance: "a",
};

export const FUNCTION_CODES: Readonly<Record<BusinessFunction, string>> = {
  direction: "d",
  administratif: "a",
  commercial: "c",
  relation_client: "r",
  production: "p",
  marketing: "m",
  rh: "h",
  finance: "f",
};

export const VOLUME_CODES: Readonly<Record<VolumeKey, string>> = {
  factures_emises_mois: "fa",
  saisie_documents_mois: "sd",
  emails_traites_jour: "em",
  rdv_planifies_semaine: "rv",
  devis_emis_semaine: "de",
  relances_commerciales_mois: "rc",
  prospects_qualifies_mois: "pq",
  propositions_longues_mois: "pl",
  appels_entrants_jour: "ae",
  demandes_ecrites_jour: "dw",
  reclamations_mois: "re",
  comptes_rendus_semaine: "cr",
  recherches_documentaires_semaine: "rd",
  documents_rediges_semaine: "dr",
  controles_conformite_mois: "cc",
  publications_mois: "pu",
  articles_rediges_mois: "ar",
  candidatures_recues_mois: "ca",
  entretiens_menes_mois: "en",
  onboardings_an: "on",
  reportings_produits_mois: "rp",
  rapprochements_mois: "ra",
};

// ---------------------------------------------------------------------------
// Tables inverses
// ---------------------------------------------------------------------------

function invert<K extends string>(table: Readonly<Record<K, string>>): ReadonlyMap<string, K> {
  return new Map((Object.entries(table) as [K, string][]).map(([k, v]) => [v, k]));
}

const SECTOR_BY_CODE = invert(SECTOR_CODES);
const HEADCOUNT_BY_CODE = invert(HEADCOUNT_CODES);
const MATURITY_BY_CODE = invert(MATURITY_CODES);
const FUNCTION_BY_CODE = invert(FUNCTION_CODES);
const VOLUME_BY_CODE = invert(VOLUME_CODES);

// ---------------------------------------------------------------------------
// Encodage
// ---------------------------------------------------------------------------

/** Sérialise un nombre au plus court : `20` plutôt que `20.0`, `1.5` conservé. */
function num(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export function encodeAnswers(answers: RoiAnswers): string {
  const fns = answers.functions
    .map((f) => FUNCTION_CODES[f])
    .filter(Boolean)
    .join("");

  const vols = (Object.entries(answers.volumes) as [VolumeKey, number | undefined][])
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([k, v]) => `${VOLUME_CODES[k]}${num(v as number)}`)
    .join("-");

  const cost = answers.hourlyCostEur === undefined ? "" : num(answers.hourlyCostEur);

  return [
    ENCODING_VERSION,
    SECTOR_CODES[answers.sector] ?? SECTOR_CODES.generique,
    HEADCOUNT_CODES[answers.headcount] ?? HEADCOUNT_CODES["2-5"],
    MATURITY_CODES[answers.maturity] ?? MATURITY_CODES.outille,
    fns,
    vols,
    cost,
  ].join("~");
}

// ---------------------------------------------------------------------------
// Décodage
// ---------------------------------------------------------------------------

/**
 * Décode un paramètre d'URL. Retourne `null` si la chaîne est absente, dans une
 * version inconnue ou structurellement invalide.
 *
 * Tolérance délibérée sur le CONTENU : un code de fonction ou de grandeur
 * inconnu (lien fabriqué à la main, ou produit par une version ultérieure) est
 * simplement ignoré, jamais fatal. Un dirigeant qui reçoit un lien tronqué doit
 * voir un rapport partiel, pas une page d'erreur.
 */
export function decodeAnswers(raw: string | null | undefined): RoiAnswers | null {
  if (!raw) return null;

  const parts = raw.split("~");
  if (parts.length < 6) return null;

  const [version, secCode, hcCode, matCode, fnCodes, volCodes, costCode] = parts;
  if (version !== ENCODING_VERSION) return null;

  const sectorKey = SECTOR_BY_CODE.get(secCode ?? "");
  const sector: ClientSectorSlug | "generique" =
    sectorKey && (sectorKey === "generique" || isClientSectorSlug(sectorKey))
      ? sectorKey
      : "generique";

  const headcount: HeadcountBand =
    HEADCOUNT_BY_CODE.get(hcCode ?? "") ?? (HEADCOUNT_BANDS[1]!.id as HeadcountBand);
  const maturity: DigitalMaturity = MATURITY_BY_CODE.get(matCode ?? "") ?? "outille";

  const functions: BusinessFunction[] = [];
  for (const ch of (fnCodes ?? "").split("")) {
    const fn = FUNCTION_BY_CODE.get(ch);
    if (fn && !functions.includes(fn)) functions.push(fn);
  }

  const volumes: Partial<Record<VolumeKey, number>> = {};
  for (const token of (volCodes ?? "").split("-")) {
    if (token.length < 3) continue;
    const key = VOLUME_BY_CODE.get(token.slice(0, 2));
    if (!key) continue;
    const value = Number.parseFloat(token.slice(2));
    if (!Number.isFinite(value) || value < 0) continue;
    volumes[key] = value;
  }

  const parsedCost = costCode ? Number.parseFloat(costCode) : Number.NaN;

  return {
    sector,
    headcount,
    maturity,
    functions,
    volumes,
    ...(Number.isFinite(parsedCost) ? { hourlyCostEur: parsedCost } : {}),
  };
}

/** Construit la query string complète (sans le `?`) pour un jeu de réponses. */
export function answersToQuery(answers: RoiAnswers): string {
  return `${ROI_QUERY_PARAM}=${encodeAnswers(answers)}`;
}
