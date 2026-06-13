/**
 * Espace formateur — cookie de session passwordless (2026-06-13).
 *
 * Helpers set/get/clear du cookie de session formateur.
 * Cookie : HttpOnly, Secure, SameSite=Lax, Path=/, maxAge 30 j.
 * La valeur est un jeton signé HMAC (cf. src/lib/formateur-session.ts).
 *
 * ⚠️ `set`/`delete` appelables UNIQUEMENT depuis une Server Action ou un Route
 * Handler (Next.js interdit le set cookie depuis un Server Component racine).
 * Pattern aligné sur `src/server/qualiopi/portail/cookie.ts`.
 */

import { cookies } from "next/headers";
import { FORMATEUR_SESSION_MAX_AGE_SECONDS } from "@/lib/formateur-session";
import { FORMATEUR_COOKIE_NAME } from "./routes";

export { FORMATEUR_COOKIE_NAME };

/** Pose le cookie de session formateur après vérification du lien magique. */
export async function setFormateurCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(FORMATEUR_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: FORMATEUR_SESSION_MAX_AGE_SECONDS,
  });
}

/** Lit le jeton de session formateur (null si absent). */
export async function getFormateurToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(FORMATEUR_COOKIE_NAME)?.value ?? null;
}

/** Supprime le cookie de session formateur (déconnexion). */
export async function clearFormateurCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(FORMATEUR_COOKIE_NAME);
}
