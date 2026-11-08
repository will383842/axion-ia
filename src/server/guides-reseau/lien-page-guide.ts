/**
 * Jeton signé du lien `/guide-reseau?j=<jeton>` (lot S1, chantier « page Recevoir le guide »).
 *
 * MODULE PUR : aucune base, aucun réseau, aucune lecture d'environnement. Le secret est
 * passé en argument (variable `GUIDES_RESEAU_LIEN_SECRET`, ≥ 32 caractères, DISTINCTE du
 * secret qui signe les appels Studio→site). Absent ou trop court = erreur explicite,
 * jamais de valeur par défaut.
 *
 * Forme : `base64url(JSON compact)` + "." + `base64url(HMAC-SHA256(partie 1))`.
 * Le jeton ne porte AUCUNE adresse e-mail, AUCUN pseudo, AUCUN nom : uniquement des
 * références opaques. Les alphabets de chaque champ interdisent d'ailleurs le « @ ».
 *
 * Expiration : le jeton est refusé dès que `maintenantMs >= exp * 1000` (exp exclu).
 * L'usage unique (table) viendra dans un autre lot ; ici seule l'empreinte est fournie.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const VERSION_JETON = 1;
export const DUREE_JETON_SECONDES = 7 * 24 * 3600;
export const TAILLE_MAX_JETON = 1024;
export const LONGUEUR_MIN_SECRET = 32;
export const RESEAUX = ["facebook", "instagram", "linkedin", "autre"] as const;

export type ReseauLien = (typeof RESEAUX)[number];

export interface DonneesLien {
  readonly conv: string;
  readonly mot: string;
  readonly reseau: ReseauLien;
  readonly guide: string;
  readonly compte: string;
  readonly post_ref?: string;
  readonly version_m1: string;
}

export type DonneesJeton = DonneesLien & { readonly v: 1; readonly exp: number };

export type ResultatVerification =
  | { readonly ok: true; readonly donnees: DonneesJeton }
  | { readonly ok: false; readonly motif: "format" | "signature" | "expire" | "champs" };

const OPAQUE = /^[A-Za-z0-9_-]{1,64}$/;
const CHAMPS: Readonly<Record<string, (x: unknown) => boolean>> = {
  v: (x) => x === VERSION_JETON,
  conv: (x) => typeof x === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(x),
  mot: (x) => typeof x === "string" && /^[A-Z0-9_-]{1,32}$/.test(x),
  reseau: (x) => typeof x === "string" && (RESEAUX as readonly string[]).includes(x),
  guide: (x) => typeof x === "string" && x.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x),
  compte: (x) => typeof x === "string" && OPAQUE.test(x),
  post_ref: (x) => typeof x === "string" && OPAQUE.test(x),
  version_m1: (x) => typeof x === "string" && /^[A-Za-z0-9._-]{1,32}$/.test(x),
  exp: (x) => typeof x === "number" && Number.isSafeInteger(x) && x > 0,
};
const OBLIGATOIRES = ["v", "conv", "mot", "reseau", "guide", "compte", "version_m1", "exp"];

function controlerSecret(secret: unknown): string {
  if (typeof secret !== "string" || secret.length < LONGUEUR_MIN_SECRET) {
    throw new Error(
      `GUIDES_RESEAU_LIEN_SECRET absent ou trop court (au moins ${LONGUEUR_MIN_SECRET} caractères requis).`,
    );
  }
  return secret;
}

/** Schéma strict : champs obligatoires présents, aucun champ inconnu, chaque valeur dans son alphabet. */
function chargeValide(c: unknown): c is DonneesJeton {
  if (typeof c !== "object" || c === null || Array.isArray(c)) return false;
  const cles = Object.keys(c);
  if (!cles.every((k) => Object.hasOwn(CHAMPS, k))) return false;
  if (!OBLIGATOIRES.every((k) => cles.includes(k))) return false;
  return cles.every((k) => CHAMPS[k]!((c as Record<string, unknown>)[k]));
}

function signature(partie: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(partie, "utf8").digest();
}

/** Crée un jeton valable 7 jours à partir de `maintenantMs`. Lève si les données sont invalides. */
export function creerJeton(donnees: DonneesLien, secret: string, maintenantMs: number): string {
  const s = controlerSecret(secret);
  const charge = {
    v: VERSION_JETON,
    conv: donnees.conv,
    mot: donnees.mot,
    reseau: donnees.reseau,
    guide: donnees.guide,
    compte: donnees.compte,
    ...(donnees.post_ref === undefined ? {} : { post_ref: donnees.post_ref }),
    version_m1: donnees.version_m1,
    exp: Math.floor(maintenantMs / 1000) + DUREE_JETON_SECONDES,
  };
  if (!chargeValide(charge)) throw new Error("Données du jeton invalides.");
  const partie = Buffer.from(JSON.stringify(charge), "utf8").toString("base64url");
  const jeton = `${partie}.${signature(partie, s).toString("base64url")}`;
  if (jeton.length > TAILLE_MAX_JETON) throw new Error("Jeton trop long.");
  return jeton;
}

/** Vérifie format, signature (temps constant), schéma puis expiration. */
export function verifierJeton(
  jeton: string,
  secret: string,
  maintenantMs: number,
): ResultatVerification {
  const s = controlerSecret(secret);
  if (typeof jeton !== "string" || jeton.length === 0 || jeton.length > TAILLE_MAX_JETON) {
    return { ok: false, motif: "format" };
  }
  const morceaux = jeton.split(".");
  if (morceaux.length !== 2) return { ok: false, motif: "format" };
  const [partie, sig] = morceaux as [string, string];
  if (!/^[A-Za-z0-9_-]+$/.test(partie) || !/^[A-Za-z0-9_-]+$/.test(sig)) {
    return { ok: false, motif: "format" };
  }
  const recue = Buffer.from(sig, "base64url");
  const attendue = signature(partie, s);
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) {
    return { ok: false, motif: "signature" };
  }
  let charge: unknown;
  try {
    charge = JSON.parse(Buffer.from(partie, "base64url").toString("utf8"));
  } catch {
    return { ok: false, motif: "champs" };
  }
  if (!chargeValide(charge)) return { ok: false, motif: "champs" };
  if (maintenantMs >= charge.exp * 1000) return { ok: false, motif: "expire" };
  return { ok: true, donnees: charge };
}

/** Empreinte SHA-256 hexadécimale du jeton complet, pour l'usage unique (table : autre lot). */
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}
