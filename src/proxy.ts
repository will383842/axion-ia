// Next.js 16 proxy.ts — fusion i18n (next-intl) + auth (Auth.js v5) + CSP nonce.
//
// Next 16 a renomme `middleware.ts` → `proxy.ts` et n'autorise plus qu'un seul
// fichier. On enchaine donc :
//   1. Auth.js wrapper (verifie session JWT, redirige vers /admin/login si KO)
//   2. next-intl handler (resolution locale fr|en, rewrites, redirects)
//   3. CSP nonce + COEP (Sprint 24 / B1 + B2)
//
// Auth.js applique d'abord callbacks.authorized (dans `auth.config.ts`), qui
// laisse passer les routes publiques et redirige uniquement les /admin/*.
// Ensuite handleI18nRouting traite la locale, puis on pose les headers
// securite (CSP avec nonce, COEP).
//
// Edge runtime — aucun import Node-only autorise (pas de Prisma, ioredis, etc).

import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";
import { buildCspHeader, generateNonce, isStrictCspPath, isEmbedPath } from "./lib/csp";
import { isEnLocaleDisabled, mapEnToFr } from "./lib/i18n/en-to-fr-redirect";
import { resolveLegacyRedirect } from "./lib/legacy-redirects";
import { isNoindexStubRoute } from "./lib/seo-noindex-routes";
import { parseUtmFromUrl, buildUtmSetCookie } from "./lib/utm";
import { verifyFormateurSession } from "./lib/formateur-session";
import { FORMATEUR_COOKIE_NAME } from "./server/formateur/routes";
import { RESSOURCES_COOKIE_NAME } from "./server/ressources/routes";
// Portail stagiaire — module PUR (aucun import Node : ni `next/headers`, ni Prisma).
// Volontairement placé sous `server/portail/` et NON sous la zone qualiopi : c'est
// exactement où vivent ses deux frères ci-dessus. Ainsi la proxy ne référence aucun
// symbole qualiopi et reste scannée par `pnpm qualiopi:isolation-check`.
// Import RELATIF comme ses deux voisins — pas d'alias.
import { PORTAIL_COOKIE_NAME, localeSiPortailProtege } from "./server/portail/routes";

const handleI18nRouting = createIntlMiddleware(routing);
const { auth } = NextAuth(authConfig);

const authPipeline = auth(async (req) => {
  // 0. EN locale disabled (2026-05-16) — 301 redirect /en/* → /fr/équivalent.
  //    Toggle via Coolify env var `EN_LOCALE_ENABLED=true` pour réactiver.
  //    Voir AGENTS.md « EN re-enable procedure ».
  //
  //    Pourquoi ce check est en tête : on évite que next-intl middleware
  //    traite la requête /en/* (qui déclenche un bug 307 self-loop avec
  //    pathnames mappés FR↔EN — voir issue interne 2026-05-16). Le redirect
  //    301 prend précédence sur tout le reste.
  if (isEnLocaleDisabled()) {
    const path = req.nextUrl.pathname;
    if (path === "/en" || path.startsWith("/en/")) {
      const frPath = mapEnToFr(path);
      const dest = new URL(frPath + req.nextUrl.search, req.url);
      return NextResponse.redirect(dest, 301);
    }
  }

  // 0a. Racine `/` → 301 (permanent) vers `/fr`. next-intl émet un 307 (temporaire)
  //     sur la racine ; or `/` est l'URL la plus crawlée et EN est désactivé →
  //     defaultLocale toujours `fr`. Un 307 fait re-crawler `/` en boucle (Google
  //     re-teste les redirections temporaires) → gaspillage de crawl budget. Le 301
  //     consolide définitivement vers `/fr` (audit indexation 2026-06-17).
  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(`/fr${req.nextUrl.search}`, req.url), 301);
  }

  // 0a-ter. 410 Gone — famille fantôme `/ia-<ville>` (audit GSC 2026-08-01).
  //
  //   Les buckets GSC « Introuvable (404) » et « Erreur serveur (5xx) » sont
  //   dominés par des CENTAINES d'URLs `/fr/ia-<ville>` (ia-paris, ia-caen…).
  //   Ce motif n'a JAMAIS existé dans ce codebase (vérifié : aucune route, rien
  //   dans l'historique git, rien dans llms.txt/llms-full.txt). Signature d'un
  //   MIROIR EXTERNE du site (copieur type HTTrack — mêmes listes GSC : URLs
  //   suffixées `-1/-2/-3` comme `contact-1`, `appel-2`) dont les liens mangés
  //   pointent vers le domaine réel.
  //
  //   Un 404 laisse Google re-tester ces URLs pendant des mois ; le 410 signale
  //   « définitivement disparu » → purge rapide de l'index + arrêt des re-crawls
  //   (économie directe de budget de crawl). Périmètre STRICT : premier segment
  //   (après locale éventuelle) commençant par `ia-` — aucune route légitime ne
  //   matche (vérifié routing.ts + arborescence app/). Les suffixes `-N` du même
  //   miroir ne sont PAS traités : des slugs villes légitimes finissent en -N
  //   (bassens-73, valence-82…), un motif générique serait dangereux.
  //
  //   `Cache-Control` public : CF cache la réponse, l'origin n'est plus tapée.
  {
    const m = req.nextUrl.pathname.match(/^\/(?:(?:fr|en)\/)?ia-[a-z0-9-]+\/?$/);
    if (m) {
      return new NextResponse("Gone", {
        status: 410,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400, s-maxage=604800",
        },
      });
    }
  }

  // 0a-bis. Aplatissement des chaînes de redirection legacy (audit indexation 2026-06-17).
  //   Un ancien slug NON-préfixé créait une chaîne à 2 sauts :
  //     `/interventions` → (0bis ajoute /fr) `/fr/interventions` → (next.config) `/fr/formations`.
  //   On résout ici DIRECTEMENT vers la cible finale en UN SEUL 301. La carte vit dans
  //   `lib/legacy-redirects` (miroir des redirections figées de next.config). Si aucun
  //   match → fall-through vers 0bis (préfixage `/fr` normal, comportement inchangé).
  //   NB : les formes PRÉFIXÉES (`/fr/interventions`) restent gérées en 1 saut par next.config.
  {
    const path = req.nextUrl.pathname;
    const firstSeg = path.split("/")[1] ?? "";
    if (firstSeg !== "fr" && firstSeg !== "en") {
      const target = resolveLegacyRedirect(path);
      if (target) {
        return NextResponse.redirect(new URL(`/fr${target}${req.nextUrl.search}`, req.url), 301);
      }
    }
  }

  // 0bis. Force 301 (permanent) au lieu du 307 (temporary) émis par next-intl
  //       pour les routes sans préfixe locale (`/a-propos`, `/galerie`, etc.).
  //       Audit GSC 2026-05-28 D-6 (`_AUDIT/GSC-INDEXATION-2026-05-28`) — le 307
  //       garde l'URL source dans l'index Google plus longtemps (« Page avec
  //       redirection » section GSC = 39 URLs partiellement expliquées). Le 301
  //       signale « permanent » et accélère l'absorption.
  //
  //       Heuristique : tout pathname qui (1) commence par `/` autre chose
  //       que `/fr` ou `/en`, (2) n'est pas une asset/sitemap/api/manifest/icon
  //       (matcher filter le fait déjà), (3) n'est pas la racine `/` (next-intl
  //       gère la racine via redirect to defaultLocale). On préfixe avec `/fr`.
  //
  //       Exclusions explicites : `_next`, `api`, `.well-known`, etc. — déjà
  //       écartées par le `matcher` config en bas du fichier. Donc ici on a
  //       seulement des routes publiques type `/a-propos`, `/contact`, etc.
  {
    const path = req.nextUrl.pathname;
    const firstSeg = path.split("/")[1] ?? "";
    const isLocalePrefixed = firstSeg === "fr" || firstSeg === "en";
    const isRoot = path === "/" || path === "";
    if (!isLocalePrefixed && !isRoot) {
      const dest = new URL(`/fr${path}${req.nextUrl.search}`, req.url);
      return NextResponse.redirect(dest, 301);
    }
  }

  // 0ter. Recrutement commercial — une seule page indexée (page France). Toute
  //       URL /devenir-commercial-ia/<ville> (héritage des anciennes pages ville,
  //       ou liens de pubs) fait un 301 vers la page France. Seule exception :
  //       /candidature (formulaire). Évite tout 404 et concentre l'autorité.
  {
    const m = req.nextUrl.pathname.match(/^\/(fr|en)\/devenir-commercial-ia\/([^/]+)\/?$/);
    if (m && m[2] !== "candidature") {
      const dest = new URL(`/${m[1]}/devenir-commercial-ia${req.nextUrl.search}`, req.url);
      return NextResponse.redirect(dest, 301);
    }
  }

  // 0quater. Espace formateur (passwordless, 2026-06-13) — garde de session.
  //   Protège `/espace-formateur/*` SAUF la connexion (`/espace-formateur/connexion`
  //   et la route de vérif `/espace-formateur/connexion/<token>`). Vérification
  //   Edge-safe du cookie signé HMAC (src/lib/formateur-session.ts) ; le check
  //   `Trainer.actif` (révocation) se fait côté Node via requireFormateur().
  //   Pas d'appel DB ici (Edge runtime).
  {
    const m = req.nextUrl.pathname.match(/^\/(fr|en)\/espace-formateur(\/.*)?$/);
    if (m) {
      const sub = m[2] ?? "";
      const isConnexion = sub === "/connexion" || sub.startsWith("/connexion/");
      if (!isConnexion) {
        const token = req.cookies.get(FORMATEUR_COOKIE_NAME)?.value;
        const session = token
          ? await verifyFormateurSession(token, "formateur")
          : { ok: false as const };
        if (!session.ok) {
          const dest = new URL(`/${m[1]}/espace-formateur/connexion`, req.url);
          return NextResponse.redirect(dest);
        }
      }
    }
  }

  // 0quinquies. Espace ressources (passwordless, 2026-06-13) — même garde Edge
  //   que l'espace formateur (cookie signé HMAC partagé), pour commerciaux +
  //   formateurs. Protège `/espace-ressources/*` sauf `/connexion`.
  {
    const m = req.nextUrl.pathname.match(/^\/(fr|en)\/espace-ressources(\/.*)?$/);
    if (m) {
      const sub = m[2] ?? "";
      const isConnexion = sub === "/connexion" || sub.startsWith("/connexion/");
      if (!isConnexion) {
        const token = req.cookies.get(RESSOURCES_COOKIE_NAME)?.value;
        const session = token
          ? await verifyFormateurSession(token, "ressources")
          : { ok: false as const };
        if (!session.ok) {
          const dest = new URL(`/${m[1]}/espace-ressources/connexion`, req.url);
          return NextResponse.redirect(dest);
        }
      }
    }
  }

  // 0sexies. Portail stagiaire — garde de session Edge (audit certif X3, 2026-07-26).
  //
  //   AVANT ce bloc, `/fr/portail/mon-espace` répondait 200 à un visiteur SANS
  //   cookie : le refus était un `return <AccesRefuse/>` dans le Server Component.
  //   Or dans l'App Router, un composant qui RETOURNE du JSX produit toujours un
  //   rendu réussi — il n'existe aucun moyen d'y fixer le statut HTTP. Le portail
  //   était donc le SEUL espace privé du site dont le contrôle d'accès vivait dans
  //   le rendu et pas ici. C'est cette singularité qu'on supprime.
  //
  //   ⚠️ Contrairement à 0quater/0quinquies, le cookie portail est un jeton OPAQUE
  //   validé en base, PAS un jeton signé HMAC : l'Edge ne peut donc tester que sa
  //   PRÉSENCE, jamais sa validité (aucun appel Prisma possible en Edge runtime).
  //   C'est suffisant pour ce qu'on ferme ici — un scanner n'a aucun cookie. Le cas
  //   « cookie présent mais expiré » reste traité dans la page, qui garde son message.
  //
  //   ⚠️ GET/HEAD seulement, et c'est délibéré : les Server Actions du portail
  //   POSTent sur l'URL de la page elle-même. Un 307 CONSERVE la méthode — garder
  //   aussi les POST rejouerait l'action sur `/portail/demander-acces`. Rien n'est
  //   perdu côté sécurité : chaque action s'authentifie seule via
  //   `resolveTraineeIdFromCookie` (server/actions/qualiopi/portail.ts:86).
  //
  //   ⚠️ `emarger/[token]` est VOLONTAIREMENT hors du motif (voir portail/routes.ts) :
  //   son jeton est dans le CHEMIN et le stagiaire arrive par e-mail SANS cookie.
  //   L'y inclure casserait l'émargement en entier.
  {
    const localePortail = localeSiPortailProtege(req.nextUrl.pathname);
    if (
      localePortail &&
      (req.method === "GET" || req.method === "HEAD") &&
      !req.cookies.get(PORTAIL_COOKIE_NAME)?.value
    ) {
      const dest = new URL(`/${localePortail}/portail/demander-acces`, req.url);
      // 307 (défaut de `NextResponse.redirect`) et surtout PAS 301/308 : la réponse
      // dépend de l'état de session. Une redirection permanente serait mémorisée par
      // le navigateur et enfermerait le stagiaire hors de son espace APRÈS connexion.
      const res = NextResponse.redirect(dest);
      // Même raison côté CDN : cette réponse varie selon le cookie. Sans en-tête, une
      // règle « cache everything » Cloudflare pourrait la servir à un stagiaire
      // authentifié — et le verrouiller dehors sans qu'aucun code ne soit en cause.
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }
  }

  // 1. Génère un nonce et l'expose à la requête via `x-nonce` AVANT que
  //    next-intl process la requête, pour que les Server Components qui
  //    appellent `cspNonce()` voient le bon header.
  const nonce = generateNonce();
  // Mutation in-place du Headers — Edge runtime garantit la propagation du
  // header request vers les RSC quand intl rewrite/next sans transformer
  // les headers explicitement.
  req.headers.set("x-nonce", nonce);

  // 1bis. Signal "route admin" pour le layout `[locale]/layout.tsx`.
  //    Le shell admin V2 a déjà son propre header/sidebar (AdminTopbar +
  //    AdminSidebarNav). Sans ce header, le layout racine rendait le Header
  //    public marketing (orange) AU-DESSUS de la console admin — pollution
  //    visuelle confirmée sur prod 2026-05-20.
  //    Le secret `ADMIN_URL_PREFIX` reste côté Edge runtime (jamais exposé
  //    au bundle client), donc utiliser un header propagé est la seule
  //    approche compatible.
  const adminSegment = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";
  const adminPathRegex = new RegExp(`^/(fr|en)/${adminSegment}(?:/|$)`);
  if (adminPathRegex.test(req.nextUrl.pathname)) {
    req.headers.set("x-admin-route", "1");
    // Propage le pathname courant aux Server Components admin (via `headers()`).
    // Les layouts à onglets (documents-interventions, contacts) dérivent l'onglet
    // actif de `x-pathname` ; sans lui ils retombaient sur `referer` (URL
    // précédente en nav SPA, souvent absente au refresh) → onglet surligné faux.
    req.headers.set("x-pathname", req.nextUrl.pathname);
  }

  // 2. Run intl (locale resolution + rewrites)
  const response = handleI18nRouting(req as unknown as NextRequest);

  // 3. Securite headers (CSP per-path + COEP toujours + X-* OWASP).
  if (response) {
    const strict = isStrictCspPath(req.nextUrl.pathname);
    // Route d'embed widget → framable partout (frame-ancestors *) + pas de
    // X-Frame-Options DENY (sinon le navigateur refuse l'iframe quoi qu'en dise
    // la CSP). next.config.ts exclut aussi ce chemin de son X-Frame-Options.
    const embed = isEmbedPath(req.nextUrl.pathname);
    response.headers.set("Content-Security-Policy", buildCspHeader({ nonce, strict, embed }));
    // COEP `unsafe-none` site-wide (audit Calendly 2026-07-07).
    //
    // Historique : on posait `credentialless` partout, puis `unsafe-none` sur le
    // SEUL chemin `/appel` (PR 182) pour que l'iframe credentialée Calendly
    // reçoive ses cookies. Ce correctif ne tenait QUE sur un chargement direct
    // ou un F5 de /appel — car COEP est une propriété du DOCUMENT, fixée à sa
    // création réseau. En navigation SPA (next/link), aucun nouveau document
    // n'est créé : la page d'arrivée (ex. accueil, servie en `credentialless`)
    // garde sa COEP, et l'iframe Calendly injectée ensuite est chargée SANS
    // credentials → « calendly.com n'autorise pas la connexion ». D'où le bug
    // INTERMITTENT « il faut F5 » : F5 recharge le document → `unsafe-none`.
    //
    // `credentialless` n'apportait AUCUN bénéfice réel ici : `crossOriginIsolated`
    // exige COOP same-origin + COEP, mais AUCUN code n'utilise SharedArrayBuffer
    // ni `crossOriginIsolated` (grep = 0). On supprime donc l'isolation inutile
    // et on pose `unsafe-none` PARTOUT — strictement plus permissif que
    // `credentialless`, donc sans risque de régresser l'incident require-corp de
    // 2026-05-09 (Plausible/Turnstile/fonts). Les embeds tiers credentialés
    // (Calendly, Stripe, YouTube) fonctionnent alors quel que soit le mode de
    // navigation (SPA ou chargement direct).
    response.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
    // Audit 2026-05-15 P1-16 — X-* OWASP headers explicites en defense-in-depth.
    // CSP `frame-ancestors 'none'` couvre déjà le clickjacking côté navigateurs
    // modernes, mais X-Frame-Options: DENY garantit le comportement sur les
    // browsers legacy + scanners de sécurité (OWASP ZAP) qui le checkent.
    response.headers.set("X-Content-Type-Options", "nosniff");
    // X-Frame-Options DENY partout SAUF la route d'embed (qui doit être framable).
    if (!embed) response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    // Permissions-Policy minimaliste : on bloque les capabilities qu'on n'utilise
    // pas pour réduire la surface d'attaque + les warnings Lighthouse.
    response.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",
    );
    // Forward le nonce sur la response aussi pour tooling (ex. browser ext audit).
    response.headers.set("x-nonce", nonce);

    // 3bis. X-Robots-Tag HTTP pour stubs pSEO anti-doorway (HCU 2024).
    //
    // RESSUSCITÉ de `middleware.ts` racine (audit indexation 2026-07-31) : ce
    // fichier était du CODE MORT — Next 16 ne charge les conventions
    // middleware/proxy que depuis `src/`, or il vivait à la racine du projet.
    // Le header n'a donc JAMAIS été servi en prod malgré son commentaire
    // « divise le coût crawl budget par ~5 ».
    //
    // Doublonne le `<meta robots noindex>` posé par `generateMetadata()` côté
    // Server Component. Le header HTTP permet à Googlebot de voir le `noindex`
    // SANS rendre le HTML complet → gain crawl budget sur les stubs pSEO
    // (villes non pilotes, services×ville sans copy dédiée). `follow` préservé
    // pour que le link juice traverse les stubs vers les pages pilotes et les
    // hubs. Whitelist edge-safe : `lib/seo-noindex-routes.ts` (superset sûr,
    // sync test `seo-noindex-routes.test.ts` — jamais de noindex sur une page
    // indexable). Header statique par URL → aucun impact cache CDN.
    if (isNoindexStubRoute(req.nextUrl.pathname)) {
      response.headers.set("X-Robots-Tag", "noindex, follow");
    }

    // 3ter. Attribution UTM (ressuscité de `middleware.ts` racine, cf. 3bis) :
    // cookie `axion_utm` (30 j) quand l'URL porte des paramètres utm_* (arrivée
    // Google Ads / LinkedIn / newsletter). Fire UNIQUEMENT sur URL à query
    // utm_* : les réponses concernées ne sont de toute façon pas des candidates
    // utiles au cache CDN (variantes de query), donc pas de régression sur le
    // fix crawl-perf Set-Cookie ci-dessous — qui whiteliste ce cookie.
    //
    // ⚠️ Les cookies `axion_ref_city`/`axion_ref_region` du middleware mort ne
    // sont PAS portés : les poser sur chaque page ville (GET public sans query)
    // remettrait un `Set-Cookie` sur toute la surface pSEO → Cloudflare
    // repasserait en BYPASS (cf. bloc « Crawl perf ⭐ » ci-dessous), défaisant
    // le déblocage du cache CDN du 2026-06-17. L'attribution ville/région
    // reste donc dormante (comme elle l'a toujours été en prod, le middleware
    // n'ayant jamais tourné) — la réactiver = décision produit à arbitrer
    // contre le cache (piste : pose côté client).
    const utm = parseUtmFromUrl(req.nextUrl.searchParams);
    if (Object.keys(utm).length > 0) {
      response.headers.append("set-cookie", buildUtmSetCookie(utm));
    }
  }
  return response;
});

// ── Crawl perf ⭐ (audit indexation 2026-06-17) — DÉBLOCAGE DU CACHE CDN ──────────
// Auth.js pose `__Host-authjs.csrf-token` + `__Secure-authjs.callback-url` sur
// CHAQUE réponse, et il les ajoute APRÈS l'exécution du handler ci-dessus (le
// wrapper `auth()` enveloppe le handler). Un `delete` à l'intérieur du handler ne
// les retire donc pas (confirmé en prod : seul `NEXT_LOCALE`, posé par next-intl
// dans le handler, disparaissait). Cloudflare refuse de cacher toute réponse portant
// `Set-Cookie` → `cf-cache-status: BYPASS` sur 100 % du HTML → Googlebot tape
// l'origine à froid (~900-1600 ms) → Google bride le crawl rate.
//
// Solution : on enveloppe le pipeline auth dans une fonction EXTERNE qui nettoie la
// réponse FINALE (après qu'Auth.js a posé ses cookies). On retire les Set-Cookie des
// pages PUBLIQUES (GET, hors admin + espaces authentifiés) mais on PRÉSERVE le cookie
// de session (`*session-token*`) → les admins connectés gardent leur session, et le
// login admin (route non strippée) garde son csrf. Les requêtes anonymes / Googlebot
// n'ont pas de session-token → réponse SANS Set-Cookie → cacheable à l'edge.
//
// `try/catch` fail-safe : un échec de strip ne doit JAMAIS casser la réponse — pire
// cas, on retombe sur le comportement actuel (BYPASS). proxy.ts s'exécutant à chaque
// requête, c'est la garantie anti-régression site-wide.
const STRIP_AUTH_SPACE = /^\/(fr|en)\/(espace-formateur|espace-ressources|mes-donnees)(\/|$)/;

export default async function proxy(req: NextRequest, ev: NextFetchEvent) {
  const res = await (
    authPipeline as unknown as (r: NextRequest, e: NextFetchEvent) => Promise<Response | undefined>
  )(req, ev);
  try {
    if (res && req.method === "GET") {
      const pathname = req.nextUrl.pathname;
      const adminSegment = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";
      const isAdminRoute = new RegExp(`^/(fr|en)/${adminSegment}(?:/|$)`).test(pathname);
      if (
        !isAdminRoute &&
        !STRIP_AUTH_SPACE.test(pathname) &&
        typeof res.headers.getSetCookie === "function"
      ) {
        const setCookies = res.headers.getSetCookie();
        if (setCookies.length > 0) {
          res.headers.delete("set-cookie");
          // Réinjecte UNIQUEMENT le cookie de session (préserve les sessions connectées)
          // + `axion_utm` (attribution paid, posé seulement sur URL ?utm_* — cf. 3ter) ;
          // retire csrf/callback/NEXT_LOCALE qui bloquent le cache CDN.
          for (const cookie of setCookies) {
            if (/session-token/i.test(cookie) || cookie.startsWith("axion_utm=")) {
              res.headers.append("set-cookie", cookie);
            }
          }
        }
      }
    }
  } catch {
    // fail-safe — ne jamais casser la réponse pour un strip de cookie.
  }
  return res;
}

export const config = {
  // Tout sauf API publiques + assets statiques + sitemap/robots/llms/manifest/icons.
  // Without `manifest\.webmanifest` exclusion, the i18n middleware rewrites
  // /manifest.webmanifest to /fr/manifest.webmanifest which does not exist
  // (Next.js manifest is root-level via app/manifest.ts), producing a HTML 404
  // that the browser fails to parse as JSON ("Manifest: Syntax error" in
  // DevTools). Same fix already applied for sitemap/robots/llms.
  // `icon` and `apple-icon` are similarly root-only generated routes.
  matcher: [
    // ALL `api/*` routes are root-mounted (no locale variants exist under
    // [locale]/api/* in this project), so the i18n middleware must never
    // touch them. Otherwise Auth.js (api/auth/*), admin exports
    // (api/admin/*/export), GDPR export (api/gdpr-export/*),
    // unsubscribe (api/unsubscribe), indexnow webhook (api/indexnow),
    // healthz (api/healthz), vitals (api/vitals), etc. all 307-redirect
    // to /fr/api/* and break externally-signed callbacks (Auth.js
    // CredentialsSignin throw, IndexNow Bing rejected, unsubscribe link
    // 307→200 instead of action, RGPD export form silently failing…).
    //
    // Discovered live during M9 admin first sign-in 2026-05-10 by
    // observing 307 → location: https://axion-ia.com/fr/api/auth/callback/credentials.
    // Audit then revealed 4 more API routes silently broken by the same
    // middleware bug.
    //
    // Special files (manifest, robots, sitemap, icons, opengraph) and
    // static asset extensions are also excluded — same rationale: no
    // locale variants.
    // `.*\\.txt$` exclut TOUT fichier .txt à la racine — couvre robots.txt,
    // llms.txt, et la clé IndexNow `/<key>.txt` (servie depuis /public/, le
    // proto IndexNow exige racine sans préfixe locale). Sans cette
    // exclusion, le middleware redirige `/3a5c32d22b04f1430690cc33eaec6be9.txt`
    // → `/fr/3a5c32d22b04f1430690cc33eaec6be9.txt` → 404.
    // `\.well-known/` exclu : RFC 9116 security.txt, ai-policy.json (2026
    // emerging), futurs `.well-known/*` doivent rester ROOT (pas de prefix
    // locale). Sans cette exclusion, middleware rewrite `/.well-known/x` →
    // `/fr/.well-known/x` → 404 (pas de route locale variant).
    // `widget/` exclu : le loader public du widget offres d'emploi
    // (`/public/widget/offres-emploi.js`) est un asset racine SANS préfixe
    // locale. Sans cette exclusion, le redirect 0bis le 301 vers
    // `/fr/widget/offres-emploi.js` (404) → le format script de l'embed casse.
    // `qr/` exclu : redirection publique des QR dynamiques (src/app/qr/[slug]/route.ts),
    // route racine NON localisée qui émet elle-même son 302. Sans exclusion, la
    // règle 0bis 301 `/qr/x` → `/fr/qr/x` (404 + fige la cible dans les caches).
    // `.html` exclu : un fichier .html ne peut venir que de /public/ — aucune
    // route Next ne se termine par cette extension. Sans l'exclusion, le
    // middleware préfixe la locale et `/catalogue/index.html` (le catalogue à
    // feuilleter, cible d'un QR imprimé) part dans le routeur puis en 404,
    // alors que le PDF voisin passe. Constaté en prod le 2026-08-16.
    // `.vcf` exclu : la fiche contact `/williams-jullin.vcf`
    // (src/app/williams-jullin.vcf/route.ts) est la cible du QR imprimé sur la
    // carte de visite. Route racine, aucune variante localisée. Sans
    // l'exclusion, la règle 0bis 301 vers `/fr/williams-jullin.vcf` → 404, et
    // les cartes déjà distribuées ne mènent plus nulle part.
    "/((?!api/|widget/|qr/|_next/static|_next/image|favicon\\.ico|sitemap|opengraph-image|twitter-image|manifest\\.webmanifest|\\.well-known/|^icon$|^apple-icon$|.*\\.txt$|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2|woff|pdf|html|vcf)$).*)",
  ],
};
