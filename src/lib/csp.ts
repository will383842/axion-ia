// Content Security Policy helpers (Sprint 24 / B1 + B2).
//
// Stratégie :
//  - Le proxy.ts génère un nonce par requête et le pose en `x-nonce` sur la
//    requête + en `script-src 'nonce-…'` sur la response. La CSP retournée
//    dépend du chemin :
//      * `/<ADMIN_URL_PREFIX>/*` (admin déjà force-dynamic)  → CSP STRICT
//        (`nonce` + `strict-dynamic`, sans `unsafe-inline`, sans `unsafe-eval`).
//      * Tout le reste (SSG public massif, ~17500 routes)    → CSP SOFT
//        (compat avec les inline scripts JSON-LD + speculation rules pré-rendus
//        au build, donc nonce-less). La migration vers strict-dynamic sur tout
//        le site nécessite soit (a) le passage de `app/[locale]/layout.tsx`
//        en force-dynamic — gros impact LCP/cache HCU, soit (b) une CSP
//        hash-based pour les inline scripts. Décision parquée Sprint 16 PERF.
//  - Le helper `cspNonce()` lit `x-nonce` côté Server Component / Server Action
//    via `headers()`. Toute route qui l'invoque devient dynamique
//    automatiquement (Next.js opt-in via headers()).

import { headers } from "next/headers";

const STATIC_ASSETS_RE = /\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?|js|css|map)$/;

/**
 * Génère un nonce cryptographique 24 bytes encodé base64 (Edge-compatible —
 * pas de Node `crypto`). Format compatible CSP3 nonce-source.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Lit le nonce CSP de la requête courante. Renvoie `null` si la fonction est
 * appelée hors contexte requête (build SSG, vitest, edge cases). Toute route
 * qui appelle ce helper devient dynamique (cf. `headers()` Next.js docs).
 */
export async function cspNonce(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-nonce");
  } catch {
    return null;
  }
}

export interface BuildCspOptions {
  nonce: string;
  /** Mode strict (admin) → pas de `unsafe-inline` / `unsafe-eval`. */
  strict: boolean;
  /**
   * Route d'embed (widget offres d'emploi) → `frame-ancestors *` au lieu de
   * `'none'` pour autoriser l'iframe depuis n'importe quel domaine tiers.
   */
  embed?: boolean;
  /**
   * L'origine du document est-elle une adresse de bouclage
   * (`localhost`, `127.0.0.1`, `[::1]`) ?
   *
   * 🔴 2026-08-22 — `upgrade-insecure-requests` CASSAIT TROIS ROUTES EN CI.
   *
   * Le harnais rendait, sur `/fr/espace-ressources`, `/fr/mes-ressources` et la
   * page de connexion :
   *
   *     <schéma TLS>://localhost:3000/fr/espace-ressources/connexion
   *       — net::ERR_SSL_PROTOCOL_ERROR
   *
   * ⚠️ Le schéma est écrit ici en clair plutôt qu'en toutes lettres : la garde
   * RGPD `subprocessors-coherence.spec.ts` balaie CE fichier à la recherche
   * d'hôtes tiers et ne saute pas les commentaires — une URL citée en exemple y
   * serait comptée comme un hôte autorisé par la politique, et réclamerait un
   * sous-traitant au registre DPA. Même famille que l'anti-hex : une garde
   * statique voit la documentation qui la décrit.
   *       (type=fetch, redirigée depuis http://localhost:3000/fr/espace-ressources?_rsc=…)
   *
   * Le `?_rsc=` est la signature d'un PREFETCH de `next/link`. La page de
   * connexion porte un lien vers `/fr/espace-ressources`, préfixe gardé par la
   * garde Edge : le prefetch reçoit une redirection, et Chromium **upgrade la
   * CIBLE DE LA REDIRECTION** — le schéma est réécrit, le port conservé.
   *
   * 🔑 Ce qui a rendu le défaut invisible en local : Chromium n'upgrade PAS une
   * requête directe vers `http://localhost` (origine réputée sûre), et le
   * prefetch de `next/link` est éteint sous `next dev`. Il fallait donc un build
   * de PRODUCTION servi en HTTP nu — c'est-à-dire exactement la CI, et rien
   * d'autre. Deux reproductions locales ont conclu « rien à signaler ».
   *
   * Sur une origine de bouclage, cette directive n'a AUCUNE valeur de sécurité :
   * le bouclage est déjà une origine sûre au sens de la spécification. Elle n'y
   * fait donc que casser. On l'omet — et seulement là.
   *
   * ⚠️ Le critère est l'HÔTE, jamais le schéma perçu par le serveur : derrière
   * Coolify puis Cloudflare, le dernier saut interne est en clair, et gater sur
   * le schéma retirerait silencieusement la directive EN PRODUCTION.
   */
  origineBouclage?: boolean;
}

/**
 * L'hôte d'une requête est-il une adresse de bouclage ?
 *
 * Volontairement strict : un nom d'hôte inconnu n'est PAS du bouclage. Le
 * défaut sûr est de garder `upgrade-insecure-requests`.
 */
export function estHoteDeBouclage(hote: string | null | undefined): boolean {
  if (!hote) return false;
  const sansPort = hote.replace(/:\d+$/, "").toLowerCase();
  return sansPort === "localhost" || sansPort === "127.0.0.1" || sansPort === "[::1]";
}

/**
 * Construit la chaîne CSP. En mode strict, l'inline-without-nonce est bloqué.
 * En mode soft, l'inline reste autorisé (SSG public preserved).
 *
 * Mode strict (admin) : nonce + strict-dynamic, pas d'unsafe-inline / unsafe-eval.
 *
 * Mode soft (SSG public) : `unsafe-inline` + `unsafe-eval` SEULS, **sans nonce
 * ni strict-dynamic**. Cause : selon CSP3 (et tous les browsers modernes),
 * dès qu'un `nonce-*` ou hash apparaît dans script-src, `unsafe-inline` est
 * IGNORÉ. Idem pour `strict-dynamic` qui désactive les host allowlists ET
 * bypass `unsafe-inline`. Combiner les deux régimes dans la même directive
 * = tout l'inline non-noncé est bloqué → hydration Next.js cassée → pages
 * "vides" en prod (bug observé 2026-05-09 sur axion-ia.com).
 *
 * Tradeoff assumé : la SSG publique reste sur CSP relaxed (acceptable pour
 * un site marketing public sans auth ; ADR pas de PII saisi sur ces routes).
 * L'admin garde la CSP nonce+strict-dynamic, qui est le vrai périmètre
 * sensible. Migration globale vers strict-dynamic = Sprint 16 PERF (cf.
 * commentaire en tête de fichier).
 */
export function buildCspHeader({
  nonce,
  strict,
  embed = false,
  origineBouclage = false,
}: BuildCspOptions): string {
  // Microsoft Clarity (NEXT_PUBLIC_CLARITY_PROJECT_ID + consent CMP gated).
  // Domaines : www.clarity.ms (tag loader) + *.clarity.ms (collecteurs régionaux,
  // c.clarity.ms ingest, b.clarity.ms beacon). Sans whitelist explicite, le script
  // est bloqué CSP même en mode soft. Le composant `Clarity` (use client) ne
  // déclenche un fetch que post-consent visiteur (`CookieConsent` banner).
  // Next 16 émet automatiquement un `<script type="speculationrules">` inline
  // dans le <head> pour pré-fetcher les routes hover (perf LCP/INP). Avec CSP
  // strict + strict-dynamic, ce script INLINE est bloqué car il n'a pas le
  // nonce attribut (Next ne l'injecte PAS sur les Speculation Rules scripts —
  // bug Next 16 #XXX). Sans fix, l'admin affiche en console :
  //
  //   Applying inline speculation rules violates ... script-src 'self' 'nonce-...'
  //   'strict-dynamic'... Either 'unsafe-inline', a hash ('sha256-vy7BO95...'),
  //   or a nonce is required.
  //
  // Le hash sha256 fourni est STABLE par version Next.js (le contenu JSON
  // speculation rules est identique pour toutes les pages : config globale
  // prefetch on-hover). On l'autorise explicitement avec 'unsafe-hashes' +
  // hash → conserve la sécurité strict-dynamic SANS bloquer Next 16.
  //
  // Si une future version Next change le contenu speculation rules, ce hash
  // doit être mis à jour. À monitorer en CI via test e2e qui vérifie
  // /admin /login affiche 0 erreur CSP en console.
  const SPECULATION_RULES_HASH = "'sha256-vy7BO95SqCwcPVAwxQTU/zWpSiYL9C1CWCCb1LB+ni4='";
  // Calendly inline widget (`/appel` Sprint A correctif 2026-05-25) charge
  // `assets.calendly.com/assets/external/widget.js` via next/script lazyOnload.
  // Connect + frame ajoutés plus bas pour l'iframe `calendly.com/{user}/{event}`.
  //
  // LinkedIn Insight Tag (2026-08-20) — `snap.licdn.com/li.lms-analytics/insight.min.js`,
  // injecté par `<LinkedInInsight />` UNIQUEMENT après consentement explicite.
  // Le collecteur est `px.ads.linkedin.com` (connect-src plus bas). Le domaine
  // reste whitelisté même quand `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` est absent :
  // sans l'ID le composant rend `null`, donc aucune requête n'est émise, et une
  // CSP conditionnelle rendrait le diagnostic illisible le jour de l'activation.
  // 🔴 2026-08-21 — LA CONSOLE ADMIN N'ÉTAIT PAS UTILISABLE EN DÉVELOPPEMENT.
  //
  // `next dev` compile avec `devtool: eval-source-map` : chaque module client
  // est livré dans un `eval()`. La CSP stricte, qui n'autorise pas
  // `'unsafe-eval'`, bloquait donc le bundle client de TOUT l'espace admin. La
  // page se rendait (le HTML est serveur), mais React n'hydratait jamais.
  //
  // Le symptôme est perfide : rien n'a l'air cassé. Les boutons existent, les
  // champs se remplissent, une case à cocher bascule même — c'est le navigateur
  // qui le fait, pas React. Seul l'ÉTAT ne suit pas. C'est ainsi que le parcours
  // de vente e2e cochait « Nouveau client » et se voyait resservir le panneau
  // « Client existant » : la console rendait
  //
  //   EvalError: Evaluating a string as JavaScript violates the following
  //   Content Security Policy directive ... 'unsafe-eval' is not an allowed source
  //
  // et personne ne la lisait, parce que la seule suite qui aurait pu la lire se
  // `test.skip`ait sur un sélecteur cassé.
  //
  // ⚠️ L'exemption est STRICTEMENT limitée au hors-production, et
  // `src/lib/__tests__/csp-unsafe-eval-hors-production.spec.ts` la verrouille :
  // aucune CSP de production ne peut porter `'unsafe-eval'`, en mode strict
  // comme en mode souple.
  const evalDeDeveloppement = process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"];

  const scriptSrc = strict
    ? [
        "script-src",
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        ...evalDeDeveloppement,
        SPECULATION_RULES_HASH,
        "https://challenges.cloudflare.com",
        "https://plausible.axion-ia.com",
        "https://www.clarity.ms",
        "https://*.clarity.ms",
        "https://snap.licdn.com",
      ].join(" ")
    : [
        "script-src",
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://challenges.cloudflare.com",
        "https://plausible.axion-ia.com",
        "https://www.clarity.ms",
        "https://*.clarity.ms",
        "https://snap.licdn.com",
        "https://assets.calendly.com",
      ].join(" ");

  // 🔴 ORIGINES STRIPE — CONDITIONNÉES À L'ACTIVATION (2026-08-04).
  //
  // Elles étaient autorisées en dur « pour Stripe.js (publishable key client) »
  // et « si on bascule un jour à Stripe Elements ». Or Stripe est éteint :
  // `STRIPE_ENABLED` n'est pas posé en production, `isStripeConfigured()`
  // renvoie false, et **aucun code client ne charge Stripe.js** — pas une seule
  // occurrence de `@stripe/stripe-js` ou `loadStripe` dans le dépôt. La clé
  // publiable n'est même pas définie en prod.
  //
  // Une CSP qui autorise des origines inutilisées élargit la surface sans
  // contrepartie : c'est la définition d'une permission à retirer. On les gate
  // sur le même drapeau que le reste, pour qu'elles se rétablissent d'elles-mêmes
  // le jour où le paiement en ligne est réactivé — plutôt que de les retirer et
  // de laisser un iframe blanc à qui rallumera Stripe sans penser à la CSP.
  const stripeActif = process.env["STRIPE_ENABLED"] === "true";
  const stripeConnect = stripeActif ? " https://api.stripe.com" : "";
  const stripeFrame = stripeActif ? " https://checkout.stripe.com" : "";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https://challenges.cloudflare.com https://plausible.axion-ia.com https://api.telegram.org https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io${stripeConnect} https://www.clarity.ms https://*.clarity.ms https://snap.licdn.com https://px.ads.linkedin.com https://calendly.com https://*.calendly.com https://*.r2.cloudflarestorage.com`,
    // `*.r2.cloudflarestorage.com` : upload présigné direct navigateur→R2
    // (import de kit + uploads admin documents-interventions). Sans ça, la CSP
    // bloque le PUT du fichier vers le stockage (fix 2026-06-13).
    // `plausible.axion-ia.com` autorisé pour l'embed dashboard dans
    // /fr/{prefix}/analytics (Plausible "Shared link" iframe).
    // `calendly.com` + `*.calendly.com` autorisés pour l'embed booking inline
    // sur /appel — le widget Calendly charge des iframes enfants sur des
    // sous-domaines (event.calendly.com, calendar.calendly.com) qui doivent
    // être whitelistés sinon l'iframe reste blanche (fix 2026-05-27).
    `frame-src 'self' https://challenges.cloudflare.com${stripeFrame} https://plausible.axion-ia.com https://calendly.com https://*.calendly.com`,
    // Route d'embed widget → framable partout. Sinon `'none'` (anti-clickjacking).
    embed ? "frame-ancestors *" : "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // Omise sur une origine de bouclage : sans valeur de sécurité, et elle y
    // casse les prefetch RSC qui traversent une redirection (cf. `origineBouclage`).
    ...(origineBouclage ? [] : ["upgrade-insecure-requests"]),
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Détermine si un pathname doit recevoir la CSP strict (admin) ou soft.
 * Edge-runtime safe — pas d'accès DB, lecture env-only.
 */
export function isStrictCspPath(pathname: string): boolean {
  if (STATIC_ASSETS_RE.test(pathname)) return false;
  const adminSegment = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";
  // Match `/<locale>/<adminSegment>` (ex: /fr/admin-dev-x7k2n9/...)
  // et `/<adminSegment>` (sans locale → redirect probable, durcir quand même).
  return pathname.includes(`/${adminSegment}`);
}

// Route d'embed du widget offres d'emploi : `/<locale>/carrieres/widget`
// (avec ou sans slash final). EXCLUT `/carrieres/widget-builder` (le suffixe
// `-builder` empêche le match car suivi ni de `/` ni de fin de chaîne).
const EMBED_PATH_RE = /^\/(?:fr|en)\/carrieres\/widget(?:\/|$)/;

/**
 * `true` si le chemin est la route d'embed framable (CSP `frame-ancestors *`,
 * pas de `X-Frame-Options`). Edge-runtime safe (regex pure).
 */
export function isEmbedPath(pathname: string): boolean {
  return EMBED_PATH_RE.test(pathname);
}

// Pages qui EMBARQUENT une iframe tierce nécessitant ses cookies/session :
// `/<locale>/appel` (+ `/book-a-call` EN, redirigé vers FR mais inclus par
// sûreté) chargent le widget Calendly. `Cross-Origin-Embedder-Policy:
// credentialless` charge les iframes cross-origin SANS credentials → Calendly
// ne peut pas établir sa session → « calendly.com refused to connect ». Ces
// chemins reçoivent donc `COEP: unsafe-none`. Audit 2026-07-01.
const CREDENTIALED_EMBEDDER_PATH_RE = /^\/(?:fr|en)\/(?:appel|book-a-call)(?:\/|$)/;

/**
 * `true` si la page embarque une iframe tierce credentialée (Calendly sur
 * `/appel`) et doit donc RELÂCHER `Cross-Origin-Embedder-Policy` (unsafe-none)
 * au lieu de `credentialless`. Edge-runtime safe (regex pure).
 */
export function isCredentialedEmbedderPath(pathname: string): boolean {
  return CREDENTIALED_EMBEDDER_PATH_RE.test(pathname);
}
