/**
 * Espace ressources — cookie de session passwordless (2026-06-13).
 * Mirroir de src/server/formateur/cookie.ts (cookie distinct `ressources_session`).
 * Réutilise le même jeton signé HMAC (src/lib/formateur-session.ts, sujet opaque).
 */

import { cookies } from "next/headers";
import { FORMATEUR_SESSION_MAX_AGE_SECONDS } from "@/lib/formateur-session";
import { RESSOURCES_COOKIE_NAME } from "./routes";

export { RESSOURCES_COOKIE_NAME };

export async function setRessourcesCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(RESSOURCES_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: FORMATEUR_SESSION_MAX_AGE_SECONDS,
  });
}

export async function getRessourcesToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(RESSOURCES_COOKIE_NAME)?.value ?? null;
}

export async function clearRessourcesCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(RESSOURCES_COOKIE_NAME);
}
