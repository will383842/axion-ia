/**
 * Portail stagiaire — Route Handler d'accès par token.
 *
 * URL : /{locale}/portail/acces/{token}
 * Méthode : GET
 *
 * Flux :
 *   1. Lit le token depuis les paramètres de route.
 *   2. Rate-limit par IP (10 tentatives / 60 s) — anti-brute-force. Fail-open si Redis indispo.
 *   3. Vérifie le token via `verifierToken` (timing-safe, non révoqué, non expiré).
 *   4. Pose le cookie HttpOnly via `setPortailCookie`.
 *   5. Redirige 302 vers /{locale}/portail/mon-espace SANS le token dans l'URL.
 *
 * Le cookie est posé ici (Route Handler) car Next.js n'autorise le set-cookie
 * que depuis des Route Handlers ou Server Actions — PAS depuis un Server Component.
 *
 * Robots : aucune meta nécessaire (route non-HTML).
 * Stub-aware : verifierToken retourne null si stub.invalid → 302 vers page d'erreur.
 *              checkRateLimit fail-open si Redis stub → aucune perturbation au build.
 */

import { type NextRequest, NextResponse } from "next/server";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import { setPortailCookie } from "@/server/qualiopi/portail/cookie";
import { checkRateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/site-url";

/** Extrait l'IP réelle depuis les headers Cloudflare / proxy / fallback. */
function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

interface RouteContext {
  params: Promise<{ locale: string; token: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { locale, token } = await params;

  // 🔴 2026-08-23 — ORIGINE CANONIQUE, ET NON UNE VARIABLE FANTÔME.
  //
  // Cette ligne lisait `process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com"`.
  // Or `NEXT_PUBLIC_APP_URL` n'était déclarée NULLE PART dans le dépôt — ni dans
  // les trois `.env*.example`, ni dans `ci.yml`, ni dans le schéma `env.ts` — et
  // trois modules la lisaient avec le MÊME repli codé en dur. Partout où elle
  // n'était pas posée à la main, l'URL produite pointait donc la PRODUCTION.
  //
  // Conséquence mesurée : le lien d'accès envoyé au stagiaire pointait
  // `https://axion-ia.com` quel que soit l'environnement. Correct en production,
  // faux partout ailleurs — et le parcours E2E du portail mesurait la production
  // au lieu du serveur sous test. En local il ne passait que parce qu'un
  // `.env.local` non versionné posait la variable ; en CI, non.
  //
  // 🔑 On ne DÉCLARE pas la variable manquante, on supprime le doublon :
  // `SITE_URL` (`@/lib/site-url`) est déjà l'origine canonique, validée par le
  // schéma (`env.ts:404`, défaut `http://localhost:3000`), déclarée dans les
  // trois `.env*.example` ET dans `ci.yml`, et munie de son propre filet de
  // sécurité en production. Un prédicat recopié diverge toujours : il n'y en a
  // plus qu'un.
  const baseUrl = SITE_URL;

  // ── Rate-limit anti-brute-force : 10 tentatives / 60 s par IP ─────────────
  const ip = clientIp(request);
  if (ip !== "unknown") {
    const rl = await checkRateLimit(`portail:acces:${ip}`, { limit: 10, windowSec: 60 });
    if (!rl.allowed) {
      // Trop de tentatives → redirection vers page d'erreur (pas de 429 HTML brut)
      return NextResponse.redirect(`${baseUrl}/${locale}/portail/acces-invalide`, { status: 302 });
    }
  }

  // ── Vérification du token (timing-safe, non révoqué, non expiré) ──────────
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
