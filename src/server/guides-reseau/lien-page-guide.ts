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
import { COMPTES_PUBLICATION } from "./contrat";

export const VERSION_JETON = 1;
/** Décision du 11/11/2026 : le lien est valable 48 h (et non plus 7 jours). Le format du jeton ne change pas. */
export const DUREE_JETON_SECONDES = 48 * 3600;
/** Dérive d'horloge tolérée entre le Studio (qui signe) et le site (qui vérifie) : 5 minutes. */
export const DERIVE_HORLOGE_SECONDES = 300;
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

/** Ponctuation qu'un client de messagerie colle parfois à la fin d'un lien (jamais dans l'alphabet base64url). */
const PONCTUATION_FINALE = new Set([".", ",", ";", ":", "!", "?", ")"]);

/** Longueur au-delà de laquelle un `j` est refusé sans autre examen (jeton + ponctuation collée). */
export const TAILLE_MAX_JETON_RECU = TAILLE_MAX_JETON + 16;

/**
 * Retire la ponctuation collée à la fin du jeton reçu (« …AbC. », « …AbC) »). À appeler dans les
 * routes AVANT `verifierJeton` ET AVANT `empreinteJeton` : la vérification et l'usage unique voient
 * ainsi le même jeton, avec ou sans le point final.
 *
 * Temps LINÉAIRE (une regex `[…]+$` était quadratique : 200 000 points = plusieurs secondes de
 * serveur bloqué sur une requête non authentifiée). Une entrée démesurée est tronquée : elle sera
 * de toute façon refusée par `verifierJeton`.
 */
export function normaliserJetonRecu(j: string): string {
  if (typeof j !== "string") return j;
  const borne = j.length > TAILLE_MAX_JETON_RECU ? j.slice(0, TAILLE_MAX_JETON_RECU) : j;
  let fin = borne.length;
  while (fin > 0 && PONCTUATION_FINALE.has(borne[fin - 1]!)) fin -= 1;
  return borne.slice(0, fin);
}

const OPAQUE = /^[A-Za-z0-9_-]{1,64}$/;
const CHAMPS: Readonly<Record<string, (x: unknown) => boolean>> = {
  v: (x) => x === VERSION_JETON,
  conv: (x) => typeof x === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(x),
  // 30 = colonne VarChar(30) du registre des demandes ET longueur maximale du mot du contrat v3.
  mot: (x) => typeof x === "string" && /^[A-Z0-9_-]{1,30}$/.test(x),
  reseau: (x) => typeof x === "string" && (RESEAUX as readonly string[]).includes(x),
  guide: (x) => typeof x === "string" && x.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x),
  // Liste FERMÉE du contrat (`COMPTES_PUBLICATION`), jamais un pseudo : tout autre compte → « champs ».
  compte: (x) => typeof x === "string" && (COMPTES_PUBLICATION as readonly string[]).includes(x),
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

/**
 * Contrôle pur, à appeler par le lot qui lira l'environnement : le secret du lien et le
 * secret des appels Studio→site doivent être distincts et faire ≥ 32 caractères chacun.
 */
export function verifierSecretsDistincts(secretLien: unknown, secretAppels: unknown): void {
  for (const [nom, v] of [
    ["GUIDES_RESEAU_LIEN_SECRET", secretLien],
    ["secret des appels Studio→site", secretAppels],
  ] as const) {
    if (typeof v !== "string" || v.length < LONGUEUR_MIN_SECRET) {
      throw new Error(
        `${nom} absent ou trop court (au moins ${LONGUEUR_MIN_SECRET} caractères requis).`,
      );
    }
  }
  if (secretLien === secretAppels) {
    throw new Error("Les secrets du lien et des appels Studio→site doivent être distincts.");
  }
}

/** Forme canonique base64url : ré-encoder l'octet décodé doit redonner exactement le texte. */
function estCanonique(texte: string): boolean {
  return Buffer.from(texte, "base64url").toString("base64url") === texte;
}

/** Crée un jeton valable 48 h à partir de `maintenantMs`. Lève si les données sont invalides. */
export function creerJeton(donnees: DonneesLien, secret: string, maintenantMs: number): string {
  const s = controlerSecret(secret);
  if (!Number.isFinite(maintenantMs)) throw new Error("Horloge invalide (maintenantMs non fini).");
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

/** Vérifie format, signature (temps constant), schéma, durée maximale puis expiration. */
export function verifierJeton(
  jeton: string,
  secret: string,
  maintenantMs: number,
): ResultatVerification {
  const s = controlerSecret(secret);
  if (!Number.isFinite(maintenantMs)) return { ok: false, motif: "expire" };
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
  if (
    recue.length !== attendue.length ||
    recue.toString("base64url") !== sig ||
    !timingSafeEqual(recue, attendue)
  ) {
    return { ok: false, motif: "signature" };
  }
  // Les bits de queue de la charge sont ignorés eux aussi : une seule écriture est admise.
  if (!estCanonique(partie)) return { ok: false, motif: "format" };
  let charge: unknown;
  try {
    charge = JSON.parse(Buffer.from(partie, "base64url").toString("utf8"));
  } catch {
    return { ok: false, motif: "champs" };
  }
  if (!chargeValide(charge)) return { ok: false, motif: "champs" };
  // Un jeton plus long que la durée prévue (+ dérive d'horloge) n'a pas été fabriqué par le Studio : refus.
  if (charge.exp * 1000 > maintenantMs + (DUREE_JETON_SECONDES + DERIVE_HORLOGE_SECONDES) * 1000) {
    return { ok: false, motif: "champs" };
  }
  if (maintenantMs >= charge.exp * 1000) return { ok: false, motif: "expire" };
  return { ok: true, donnees: charge };
}

/**
 * Empreinte SHA-256 hexadécimale du jeton sous sa forme canonique (chaque partie ré-encodée),
 * pour l'usage unique (table : autre lot). Plusieurs écritures d'un même jeton donnent
 * donc une seule empreinte.
 */
export function empreinteJeton(jeton: string): string {
  const morceaux = jeton.split(".");
  const canonique =
    morceaux.length === 2 && morceaux.every((m) => /^[A-Za-z0-9_-]+$/.test(m))
      ? morceaux.map((m) => Buffer.from(m, "base64url").toString("base64url")).join(".")
      : jeton;
  return createHash("sha256").update(canonique, "utf8").digest("hex");
}
