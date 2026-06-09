// Middleware Edge — Sprint X.18 / Booking V1.
//
// 2 responsabilités :
//   1. Set cookie `axion_ref_city` / `axion_ref_region` quand le visiteur
//      arrive sur une page pSEO ville/région. Permet d'attribuer une
//      conversion ultérieure (booking/contact/devis) à cette source pSEO.
//   2. Set cookie `axion_utm` quand des UTM params sont présents dans
//      l'URL (visiteur depuis Google Ads, LinkedIn, etc.).
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.18 § Préfill + funnel attribution
//   - Doctrine privacy-first : cookies SameSite=Lax + HttpOnly + Secure, 30j TTL
//
// Routes pSEO matchées (matcher config en bas) :
//   - /[locale]/audit/par-ville/[ville]
//   - /[locale]/interventions/par-ville/[ville]
//   - /[locale]/implementation/par-ville/[ville]
//   - /[locale]/implantations/[region]
//   - /[locale]/implantations/[region]/[ville]

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseUtmFromUrl, buildUtmSetCookie } from "@/lib/utm";
import {
  REFERRER_CITY_COOKIE_NAME,
  REFERRER_REGION_COOKIE_NAME,
  sanitizeSlugValue,
} from "@/lib/pseo-referrer";
import { isNoindexStubRoute } from "@/lib/seo-noindex-routes";

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 jours

/**
 * Extrait le segment ville/région depuis le pathname si match pSEO connu.
 *
 * Patterns matchés :
 *   /fr/audit/par-ville/lyon                       → city=lyon
 *   /fr/interventions/par-ville/lyon              → city=lyon
 *   /fr/implementation/par-ville/lyon             → city=lyon
 *   /fr/implantations/auvergne-rhone-alpes        → region=...
 *   /fr/implantations/auvergne-rhone-alpes/lyon   → region=..., city=lyon
 */
function extractPseoReferrer(pathname: string): { city?: string; region?: string } {
  // Supporte FR + EN locale prefix.
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 3) return {};
  // [locale, section, ...]
  const [, section, sub3, sub4, sub5] = parts;

  // par-ville → city à index 3
  if (sub3 === "par-ville" && sub4) {
    const city = sanitizeSlugValue(sub4);
    return city ? { city } : {};
  }

  // implantations/[region] ou implantations/[region]/[ville]
  if (section === "implantations" && sub3 && sub3 !== "page") {
    const out: { city?: string; region?: string } = {};
    const region = sanitizeSlugValue(sub3);
    if (region) out.region = region;
    if (sub4 && sub4 !== "page") {
      const city = sanitizeSlugValue(sub4);
      if (city) out.city = city;
    }
    return out;
  }

  // by-city (EN mirror)
  if (sub3 === "by-city" && sub4) {
    const city = sanitizeSlugValue(sub4);
    return city ? { city } : {};
  }

  // locations/[region]/[city] (EN mirror potentiel)
  if (section === "locations" && sub3) {
    const out: { city?: string; region?: string } = {};
    const region = sanitizeSlugValue(sub3);
    if (region) out.region = region;
    if (sub4) {
      const city = sanitizeSlugValue(sub4);
      if (city) out.city = city;
    }
    return out;
  }

  void sub5; // réservé pour future granularité (ex. quartier).
  return {};
}

export function middleware(req: NextRequest): NextResponse {
  const res = NextResponse.next();
  const { pathname, searchParams } = req.nextUrl;

  // -- 1. UTM params dans l'URL → set cookie `axion_utm` (30j).
  const utm = parseUtmFromUrl(searchParams);
  if (Object.keys(utm).length > 0) {
    // buildUtmSetCookie retourne la chaîne complète "name=value; attrs..."
    const cookieStr = buildUtmSetCookie(utm);
    res.headers.append("set-cookie", cookieStr);
  }

  // -- 2. pSEO ville/région → set cookies `axion_ref_city` / `..._region`.
  const ref = extractPseoReferrer(pathname);
  if (ref.city) {
    res.cookies.set({
      name: REFERRER_CITY_COOKIE_NAME,
      value: ref.city,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      path: "/",
    });
  }
  if (ref.region) {
    res.cookies.set({
      name: REFERRER_REGION_COOKIE_NAME,
      value: ref.region,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      path: "/",
    });
  }

  // -- 3. X-Robots-Tag HTTP pour stubs pSEO anti-doorway (HCU 2024).
  //
  // Doublonne le `<meta robots noindex>` posé par `generateMetadata()` côté
  // Server Component. Le header HTTP permet à Googlebot de voir le `noindex`
  // SANS rendre le HTML complet → divise le coût crawl budget par ~5 sur
  // les ~17 K stubs SSG (villes sans copy, services×ville sans copy.services,
  // Corse). Cohérent et idempotent : signal identique dans HTML + HTTP.
  //
  // `follow` préservé pour que le link juice traverse les stubs vers les
  // pages pilotes (Paris) et les hubs (/implantations, /interventions).
  if (isNoindexStubRoute(pathname)) {
    res.headers.set("X-Robots-Tag", "noindex, follow");
  }

  return res;
}

/**
 * Limiter le middleware aux routes utiles pour ne pas pénaliser le reste
 * de l'app (cf. doctrine perf Web Vitals 2026).
 *
 * Match :
 *   - Toute page sous /[fr|en]/audit /interventions /implementation /implantations /locations
 *   - Toute page racine /[fr|en]/* qui peut porter des UTM params (homepage etc.)
 *
 * Skip :
 *   - /api/* (API routes — pas besoin de cookie attribution)
 *   - /_next/* (assets Next)
 *   - /static, /icons, /images, /favicon, robots.txt, sitemap*.xml, llms*.txt
 */
export const config = {
  matcher: [
    /*
     * Match toutes les routes SAUF :
     *   - _next/static (build assets)
     *   - _next/image (Image optimization files)
     *   - favicon.ico (favicon)
     *   - api (routes API — cookies inutiles)
     *   - sitemap*.xml, robots.txt, llms*.txt (fichiers statiques)
     *   - icon* (Next 13+ icon convention)
     *   - apple-icon (PWA)
     */
    "/((?!api|widget/|_next/static|_next/image|favicon.ico|sitemap.*\\.xml|robots\\.txt|llms.*\\.txt|ai\\.txt|icon.*|apple-icon|manifest.webmanifest).*)",
  ],
};
