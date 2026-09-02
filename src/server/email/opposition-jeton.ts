// Jeton d'opposition — partie PURE du lot 1b (2026-09-02).
//
// Ce fichier n'importe ni Prisma, ni le CRM, ni les files : il est importé par
// le registre des gabarits (`templates/index.tsx`) et par le worker. Une
// première version l'avait laissé dans `opposition.ts`, avec le registre en
// base et la synchronisation CRM — et le rendu d'un e-mail tirait alors les
// files BullMQ et `next-auth` : neuf suites de gabarits tombaient à la
// collecte. Le jeton n'a besoin que de `node:crypto`.
//
// Format : `op1.<adresse en base64url>.<HMAC-SHA256 tronqué>`. Le préfixe
// permet à `/api/unsubscribe` de le distinguer d'un jeton newsletter (chaîne
// opaque en base). Clé HMAC dérivée d'`AUTH_SECRET` avec séparation de
// domaine : compromettre ce jeton ne donne rien d'autre qu'une opposition.

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const PREFIXE_JETON_OPPOSITION = "op1";
const LONGUEUR_SIGNATURE = 32;

let avertiSansSecret = false;

function cleSignature(): Buffer {
  const secret = process.env["AUTH_SECRET"];
  if (!secret) {
    // `env.ts` exige AUTH_SECRET en production : on n'arrive ici qu'en dev ou
    // en test. On le dit une fois, et on signe avec une clé de développement
    // pour que le lien existe quand même dans Mailhog.
    if (!avertiSansSecret) {
      avertiSansSecret = true;
      console.warn(
        "[email-opposition] AUTH_SECRET absent : jetons d'opposition signés avec la clé de développement.",
      );
    }
    return createHash("sha256").update("axion-email-opposition|dev").digest();
  }
  return createHash("sha256").update(`axion-email-opposition|${secret}`).digest();
}

/** Adresse telle qu'elle est signée et stockée : sans espaces, en minuscules. */
export function normaliserAdresse(email: string): string {
  return email.trim().toLowerCase();
}

function signer(adresse: string): string {
  return createHmac("sha256", cleSignature())
    .update(adresse)
    .digest("base64url")
    .slice(0, LONGUEUR_SIGNATURE);
}

/** Jeton d'opposition pour une adresse. Stable : même adresse, même jeton. */
export function jetonOpposition(email: string): string {
  const adresse = normaliserAdresse(email);
  const corps = Buffer.from(adresse, "utf8").toString("base64url");
  return `${PREFIXE_JETON_OPPOSITION}.${corps}.${signer(adresse)}`;
}

export function estJetonOpposition(token: string | null | undefined): boolean {
  return typeof token === "string" && token.startsWith(`${PREFIXE_JETON_OPPOSITION}.`);
}

/** Adresse portée par un jeton, ou null si la signature ne tient pas. */
export function lireJetonOpposition(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIXE_JETON_OPPOSITION) return null;
  const [, corps, signature] = parts as [string, string, string];
  let adresse: string;
  try {
    adresse = Buffer.from(corps, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (adresse === "" || !adresse.includes("@") || normaliserAdresse(adresse) !== adresse)
    return null;
  const attendue = signer(adresse);
  const a = Buffer.from(attendue, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return adresse;
}

/** URL absolue du lien « Ne plus recevoir de sollicitations » pour une adresse. */
export function urlOpposition(email: string): string {
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
  return `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(jetonOpposition(email))}`;
}
