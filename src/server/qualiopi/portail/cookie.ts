/**
 * Qualiopi — Cookie portail stagiaire (AGENT A — T14).
 *
 * Helpers pour set/get/clear le cookie de session portail stagiaire.
 * Cookie : HttpOnly, Secure, SameSite=Lax, Path=/, maxAge 90 j.
 *
 * ⚠️ Appelable UNIQUEMENT depuis une Server Action ou un Route Handler
 * (not depuis un Server Component racine — Next.js impose le set cookie
 * dans une action/route uniquement).
 */

import { cookies } from "next/headers";
import { PORTAIL_COOKIE_NAME } from "@/server/portail/routes";

// SSOT du nom de cookie : il est aussi lu par la garde Edge de `src/proxy.ts`
// (bloc 0sexies), qui ne peut pas importer ce fichier-ci — il tire `next/headers`.
// Le renommer sans toucher `server/portail/routes.ts` rouvrirait le constat X3 EN
// SILENCE : la garde ne verrait plus jamais de cookie et redirigerait vers le
// formulaire de demande d'accès des stagiaires pourtant connectés.
const COOKIE_NAME = PORTAIL_COOKIE_NAME;
/** 90 jours en secondes. */
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/**
 * Pose le cookie de session portail stagiaire (HttpOnly, Secure, SameSite=Lax).
 * À appeler dans une Server Action ou un Route Handler après vérification du token.
 */
export async function setPortailCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Lit le token du cookie portail (null si absent).
 */
export async function getPortailToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Supprime le cookie de session portail (déconnexion).
 */
export async function clearPortailCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
