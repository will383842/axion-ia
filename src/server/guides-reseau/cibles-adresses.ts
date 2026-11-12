/**
 * ADRESSES DE PAGE CIBLABLES PAR UN MOT (F1a, 2026-11-12) — validation PURE.
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
/** `adr-` + 6 à 24 caractères minuscules, chiffres ou tirets. */
export const RE_CODE_ADRESSE = /^adr-[a-z0-9-]{6,24}$/;

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
  if (u.href.length > URL_MAX) return { ok: false, raison: "adresse_trop_longue" };
  return { ok: true, url: u.href };
}

/** Titre : espaces de bord retirés, 3 à 120 caractères. */
export function validerTitre(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const t = brut.trim();
  return t.length >= TITRE_MIN && t.length <= TITRE_MAX ? t : null;
}
