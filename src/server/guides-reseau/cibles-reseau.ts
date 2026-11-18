/**
 * CIBLES D'UN MOT (F1a-bis, 2026-11-12) — validation PURE d'un guide, d'une adresse et d'un mot.
 *
 * Décision de Williams : un mot mène soit à un guide du catalogue, soit à une adresse de page,
 * et une adresse n'est acceptée que si son hôte figure dans une LISTE BLANCHE
 * (`CIBLES_ADRESSES_HOTES`, séparée par des virgules ; défaut dans le code).
 *
 * Module sans accès base ni réseau. Les refus rendent une raison courte, jamais l'adresse.
 */

export const HOTES_PAR_DEFAUT = "axion-ia.com,www.axion-ia.com";
export const URL_MAX = 300;
export const TITRE_MIN = 3;
export const TITRE_MAX = 120;
/** `gde-` (guide) ou `adr-` (adresse) + 6 à 24 caractères minuscules, chiffres ou tirets. */
export const RE_CODE_CIBLE = /^(gde|adr)-[a-z0-9-]{6,24}$/;
/** Fiche de départ créée par la migration : son code est celui déjà écrit sur les demandes. */
export const CODE_GUIDE_DEPART = "guide-ia";
export const TYPES_CIBLE = ["guide", "adresse"] as const;
export type TypeCible = (typeof TYPES_CIBLE)[number];
export const RESEAUX_MOT = ["facebook", "instagram", "linkedin", "tiktok", "tous"] as const;
export type ReseauMot = (typeof RESEAUX_MOT)[number];
export const CHEMIN_PDF_MAX = 200;

/** Liste blanche des hôtes, lue dans l'environnement ; vide ou absente → valeur par défaut. */
export function hotesAutorises(
  env: Readonly<Record<string, string | undefined>> = process.env,
): readonly string[] {
  const lus = (env.CIBLES_ADRESSES_HOTES ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
  return lus.length > 0 ? lus : HOTES_PAR_DEFAUT.split(",");
}

export type RaisonAdresse =
  | "adresse_vide"
  | "adresse_trop_longue"
  | "adresse_caracteres_interdits"
  | "adresse_illisible"
  | "adresse_https_obligatoire"
  | "adresse_identifiants_interdits"
  | "adresse_fragment_interdit"
  | "adresse_port_interdit"
  | "adresse_hote_non_autorise";

export type VerdictAdresse =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly raison: RaisonAdresse };

const CARACTERES_DE_CONTROLE = /[\u0000-\u001f\u007f-\u009f\s]/;

export function validerAdresse(
  brute: unknown,
  hotes: readonly string[] = hotesAutorises(),
): VerdictAdresse {
  if (typeof brute !== "string" || brute.length === 0) return { ok: false, raison: "adresse_vide" };
  if (brute.length > URL_MAX) return { ok: false, raison: "adresse_trop_longue" };
  if (CARACTERES_DE_CONTROLE.test(brute)) {
    return { ok: false, raison: "adresse_caracteres_interdits" };
  }
  let u: URL;
  try {
    u = new URL(brute);
  } catch {
    return { ok: false, raison: "adresse_illisible" };
  }
  if (u.protocol !== "https:") return { ok: false, raison: "adresse_https_obligatoire" };
  if (u.username !== "" || u.password !== "") {
    return { ok: false, raison: "adresse_identifiants_interdits" };
  }
  if (brute.includes("#")) return { ok: false, raison: "adresse_fragment_interdit" };
  // `URL` efface le port 443 : on regarde l'adresse brute pour refuser tout port écrit.
  if (u.port !== "" || /^https:\/\/[^/?#]*:\d*(?:[/?#]|$)/i.test(brute)) {
    return { ok: false, raison: "adresse_port_interdit" };
  }
  if (!hotes.includes(u.hostname.toLowerCase())) {
    return { ok: false, raison: "adresse_hote_non_autorise" };
  }
  // `//` dans le chemin : certains relais le lisent comme un changement d'hôte
  // (`https://axion-ia.com//evil.tld/x`). Raison existante du Studio, sans en inventer une.
  if (u.pathname.includes("//")) return { ok: false, raison: "adresse_illisible" };
  if (u.href.length > URL_MAX) return { ok: false, raison: "adresse_trop_longue" };
  return { ok: true, url: u.href };
}

/** Titre : espaces de bord retirés, 3 à 120 caractères. */
export function validerTitre(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const t = brut.trim();
  return t.length >= TITRE_MIN && t.length <= TITRE_MAX ? t : null;
}

/** Code accepté pour une cible : forme `gde-`/`adr-` accordée au type, ou la fiche de départ. */
export function codeAccordeAuType(code: string, type: TypeCible): boolean {
  if (code === CODE_GUIDE_DEPART) return type === "guide";
  return RE_CODE_CIBLE.test(code) && code.startsWith(type === "guide" ? "gde-" : "adr-");
}

/**
 * Mots d'opposition : COPIE EXACTE de `MOTS_OPPOSITION` du Studio (`opposition.ts`). Un mot de
 * déclenchement ne peut pas en être un, sinon il serait lu comme un arrêt de message.
 */
export const MOTS_INTERDITS: readonly string[] = [
  "STOP",
  "STOPPEZ",
  "ARRET",
  "ARRETE",
  "ARRETEZ",
  "ARRETER",
  "DESINSCRIRE",
  "DESINSCRIPTION",
  "DESINSCRIVEZ",
  "DESABONNER",
  "DESABONNEZ",
  "DESABONNEMENT",
];
export const MOT_MIN = 2;
export const MOT_MAX = 20;
const RE_MOT_STUDIO = /^[A-Z0-9]{2,20}$/;

/**
 * Mot : MÊME règle que le Studio (`normaliserMot`) — NFKC, ponctuation de bord retirée, sans accent,
 * lettres et chiffres, 2 à 20, pas uniquement des chiffres, hors mots d'opposition. Rendu en minuscules
 * (forme stockée). `null` si inutilisable.
 */
export function normaliserMot(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const t = brut
    .normalize("NFKC")
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "");
  const m = t.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  if (!RE_MOT_STUDIO.test(m) || /^\d+$/.test(m)) return null;
  return MOTS_INTERDITS.includes(m) ? null : m.toLowerCase();
}

/** Chemin d'un PDF sous `public/` : relatif, sans `..`, extension .pdf. */
export function validerCheminPdf(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const c = brut.trim();
  if (c.length === 0 || c.length > CHEMIN_PDF_MAX) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*\.pdf$/.test(c) || c.includes("..") || c.includes("//")) {
    return null;
  }
  return c;
}
