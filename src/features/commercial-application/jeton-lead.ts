// Jeton signé du tunnel apporteurs avec vidéo (2026-10-05).
//
// ── À quoi il sert ────────────────────────────────────────────────────────
// L'étape 1 (prénom + e-mail) crée une ligne ; l'étape 2 (téléphone + question)
// la COMPLÈTE. Entre les deux, le navigateur ne connaît que ce jeton : il prouve
// « cette personne est bien celle de l'étape 1 ». Sans lui, n'importe qui
// pourrait écrire un téléphone sur la ligne de quelqu'un d'autre — ou deviner
// qu'une adresse est déjà connue.
//
// Format : `<base64url(JSON)>.<HMAC-SHA256 en hexa>`, comme les jetons de
// prévisualisation du dépôt (`server/content-gen/shared/preview-token.ts`), sans
// dépendance JWT. Comparaison à temps constant.
//
// ── Ce que le jeton porte ─────────────────────────────────────────────────
//   · `lead`    identifiant de la ligne (un identifiant sans ligne pour une adresse
//     déjà connue : voir ci-dessous) ;
//   · `genre`   `saisie` (visite, 24 h) ou `reprise` (e-mail de relance, 10 j) ;
//   · `iat/exp` émission et expiration (ms) — `iat` sert au DÉLAI MINIMAL de
//     l'étape 2 : un téléphone posté moins de 2 s après l'émission est suspect ;
//   · `suspect` la ligne a été créée trop vite après l'affichage (étape 1) ;
//
// 🔑 Le jeton est LISIBLE (base64) par qui le reçoit : il ne doit donc RIEN dire
// de ce que le serveur sait. Pour une adresse déjà connue (ou un robot qui a
// rempli le leurre), le serveur signe un jeton qui porte un identifiant de forme
// identique mais SANS ligne derrière ; l'étape 2 y répond « succès » sans rien
// écrire. Aucun drapeau « fantôme » n'existe dans le jeton : il trahirait
// exactement ce qu'on veut taire (une adresse connue).
//
// Aucune adresse, aucun prénom, aucun téléphone dans le jeton : il circule dans
// des adresses d'e-mail et des journaux.
//
// Clé : dérivée de `AUTH_SECRET` par séparation de domaine (aucun secret de plus
// à poser dans Coolify : un secret oublié aurait cassé le tunnel en silence).
// Hors production, repli de développement ; en production, on REFUSE de signer
// plutôt que de signer avec une clé connue.
//
// Module sans `server-only` ni `next/*` : il est aussi lu par les tests et par
// le worker.

import crypto from "node:crypto";
import {
  VALIDITE_JETON_MS,
  VALIDITE_JETON_REPRISE_MS,
} from "@/lib/commercial-application/vsl-apporteur";

export type GenreJeton = "saisie" | "reprise";

export interface ContenuJeton {
  readonly lead: string;
  readonly genre: GenreJeton;
  readonly iat: number;
  readonly exp: number;
  readonly suspect: boolean;
}

const DOMAINE = "jeton-lead-vsl-v1";
const REPLI_DEV = "axionia-jeton-lead-dev-only-not-for-production";

function cle(): string {
  const secret = process.env["AUTH_SECRET"]?.trim();
  if (secret && secret.length >= 16) {
    return crypto.createHmac("sha256", secret).update(DOMAINE).digest("hex");
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      "AUTH_SECRET (≥ 16 caractères) requis pour signer le jeton du tunnel apporteurs.",
    );
  }
  return REPLI_DEV;
}

function signer(corps: string): string {
  return crypto.createHmac("sha256", cle()).update(corps).digest("hex");
}

export interface OptionsJeton {
  readonly lead: string;
  readonly genre?: GenreJeton;
  readonly suspect?: boolean;
  /** Heure d'émission (ms) — injectable pour les tests. */
  readonly maintenant?: number;
}

/** Fabrique un jeton. Lève si la clé de signature est absente en production. */
export function creerJeton(o: OptionsJeton): string {
  const iat = o.maintenant ?? Date.now();
  const genre = o.genre ?? "saisie";
  const contenu: ContenuJeton = {
    lead: o.lead,
    genre,
    iat,
    exp: iat + (genre === "reprise" ? VALIDITE_JETON_REPRISE_MS : VALIDITE_JETON_MS),
    suspect: o.suspect === true,
  };
  const corps = Buffer.from(JSON.stringify(contenu)).toString("base64url");
  return `${corps}.${signer(corps)}`;
}

/**
 * Vérifie un jeton : signature, expiration, forme. Rend `null` pour tout ce qui
 * n'est pas un jeton valide et non expiré — jamais d'exception.
 */
export function verifierJeton(jeton: string, maintenant: number = Date.now()): ContenuJeton | null {
  if (typeof jeton !== "string" || jeton.length > 1500) return null;
  const parts = jeton.split(".");
  if (parts.length !== 2) return null;
  const [corps, sig] = parts;
  if (!corps || !sig) return null;
  try {
    const attendu = signer(corps);
    if (sig.length !== attendu.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(attendu, "hex"))) return null;
    const c = JSON.parse(Buffer.from(corps, "base64url").toString("utf8")) as Partial<ContenuJeton>;
    if (typeof c.lead !== "string" || typeof c.iat !== "number" || typeof c.exp !== "number") {
      return null;
    }
    if (c.genre !== "saisie" && c.genre !== "reprise") return null;
    if (c.exp < maintenant) return null;
    return {
      lead: c.lead,
      genre: c.genre,
      iat: c.iat,
      exp: c.exp,
      suspect: c.suspect === true,
    };
  } catch {
    return null;
  }
}
