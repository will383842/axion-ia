/**
 * Portail stagiaire — Route Handler d'accès par token.
 *
 * URL : /{locale}/portail/acces/{token}
 * Méthode : GET
 *
 * Flux :
 *   1. Lit le token depuis les paramètres de route.
 *   2. Vérifie le token via `verifierToken` (timing-safe, non révoqué, non expiré).
 *   3. Pose le cookie HttpOnly via `setPortailCookie`.
 *   4. Redirige 302 vers /{locale}/portail/mon-espace SANS le token dans l'URL.
 *
 * Le cookie est posé ici (Route Handler) car Next.js n'autorise le set-cookie
 * que depuis des Route Handlers ou Server Actions — PAS depuis un Server Component.
 *
 * Robots : aucune meta nécessaire (route non-HTML).
 * Stub-aware : verifierToken retourne null si stub.invalid → 302 vers page d'erreur.
 */

import { NextResponse } from "next/server";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import { setPortailCookie } from "@/server/qualiopi/portail/cookie";

interface RouteContext {
  params: Promise<{ locale: string; token: string }>;
}

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { locale, token } = await params;

  const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com";

  // Vérification du token (timing-safe, non révoqué, non expiré)
  const result = await verifierToken(token);

  if (!result) {
    // Token invalide, expiré ou révoqué → redirection vers page d'erreur
    return NextResponse.redirect(`${baseUrl}/${locale}/portail/acces-invalide`, { status: 302 });
  }

  // Poser le cookie HttpOnly avant la redirection
  await setPortailCookie(token);

  // Redirection vers l'espace stagiaire SANS token dans l'URL
  const response = NextResponse.redirect(`${baseUrl}/${locale}/portail/mon-espace`, {
    status: 302,
  });

  return response;
}
