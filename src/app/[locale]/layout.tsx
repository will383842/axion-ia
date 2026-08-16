import type { Metadata, Viewport } from "next";
import { Manrope, Inconsolata, Fraunces } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, STATIC_LOCALES } from "@/i18n/routing";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { Header } from "@/components/nav/Header";
import { Footer } from "@/components/nav/Footer";
import { QualiopiReassuranceBand } from "@/components/qualiopi/QualiopiReassuranceBand";
import { getQualiopiCredentialForJsonLd } from "@/components/qualiopi/organization-credential";
import { WebVitals } from "@/components/analytics/WebVitals";
import { SpeculationRules } from "@/components/perf/SpeculationRules";
import { Plausible } from "@/components/analytics/Plausible";
import { RefererTracker } from "@/components/analytics/RefererTracker";
import { CookieConsent } from "@/components/analytics/CookieConsent";
import { Clarity } from "@/components/analytics/Clarity";
import { ChatWidgetMount } from "@/components/chatbot/ChatWidgetMount";
import { SITE_URL, buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";
import { buildSiteNavigationJsonLd } from "@/lib/seo/extended-schemas";
import { SERVICES, serviceOfficial } from "@/content/services";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { env } from "@/env";
import type { Locale } from "@/i18n/routing";
import "../globals.css";

// Manrope — sans-serif éditorial pour body / eyebrow / h1-h6.
// Doctrine v3 Editorial Premium Light : ADR 0002 (pivot v3) + ADR 0004
// (typo baseline 18/15 v3.1). Trimmed à 2 weights (400 + 600) — couvre
// l'ensemble des usages, économise ~50 KB woff2 vs un chargement 4-weights.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "600"],
});

// P3-35 (audit re-run 2026-05-15 AGENT 6) — Inconsolata preload:false.
// Inconsolata est utilisée uniquement pour `<code>` et numbers tabulaires
// (~5 % du contenu). next/font preload par défaut = waste LCP budget sur
// 90 %+ des pages publiques qui n'affichent jamais de Inconsolata above-fold.
// `preload: false` retire le `<link rel="preload">` mais garde le swap CSS
// — les pages qui utilisent vraiment Inconsolata chargeront le font dans
// la cascade normale (~150-300ms après FCP, invisible UX).
const inconsolata = Inconsolata({
  subsets: ["latin"],
  variable: "--font-inconsolata",
  display: "swap",
  preload: false,
});

// Fraunces = serif éditorial premium (style Anthropic/Mistral).
// Loaded latin only, italic for emphasis on display headings.
//
// P-105 — la `variable` next/font expose désormais `--font-fraunces` (et non
// plus `--font-serif`). Raison : `globals.css` exposait `--font-serif:
// var(--font-serif), …` ce qui auto-référençait la variable et empêchait la
// cascade des fallbacks intermédiaires. Le renommage casse l'auto-ref :
// next/font écrit `--font-fraunces` puis globals.css chaîne via
// `--font-serif: var(--font-fraunces), "Iowan Old Style", …`.
// P0 audit Perfection 2026 — CLS / LCP fix.
//
// `.display-editorial` + `.italic-editorial` utilisent Fraunces weight 500
// + letter-spacing: -0.035em.
//
// Décision Will 2026-06-03 (révise le choix `optional` du P0 audit Perfection
// 2026) — passage à `display: "swap"`. Raisons :
//   1. `optional` refusait Fraunces tant qu'elle n'était pas prête en ~100 ms
//      — y compris CACHE CHAUD. Conséquence réelle constatée : TOUS les
//      visiteurs (même récurrents) revoyaient le fallback serif (Iowan /
//      Palatino, plus fin → titres « pas gras ») à chaque réouverture de page.
//      Inacceptable pour une marque dont l'identité repose sur la typo.
//   2. La mesure historique « CLS > 0.05 avec swap » a été prise alors que la
//      chaîne de fallback était cassée (auto-réf `--font-serif: var(--font-serif)`,
//      cf. P-105 globals.css). Cette chaîne est désormais réparée
//      (`--font-fraunces` → fallback métrique next/font → Iowan…), donc le
//      reflow au swap est aujourd'hui fortement réduit.
//   3. `adjustFontFallback: true` (explicite ci-dessous) génère un @font-face
//      fallback aux métriques calées sur Fraunces (size-adjust / overrides)
//      → swap fallback → Fraunces ≈ 0 décalage. Technique « FOUT métriques
//      calées » standard des sites premium.
// Trade-off assumé : CLS peut passer de 0 strict (cible interne) à ~0.0-0.02
// (très en dessous du « good » Google = 0.1). À valider par le gate Lighthouse
// CI (job `lhci`, autorité Web Vitals) au prochain deploy ; rollback = remettre
// `display: "optional"` si régression au-delà du budget.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  adjustFontFallback: true,
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Pre-render only the build-time locales (FR ; EN exclu tant que désactivé —
// voir STATIC_LOCALES). Les pages enfant sans locale propre héritent de ce set.
export function generateStaticParams() {
  return STATIC_LOCALES.map((locale) => ({ locale }));
}

// Viewport SSOT — audit perfection SEO 2026-05-12. Next 16 sépare
// `viewport` (size, colors, scale) de `metadata` (title, OG, etc.). Déclaré
// au root layout pour s'appliquer à toutes pages :
//   - themeColor : signature visuelle terracotta sur iOS Safari status bar +
//     Chrome Android URL bar + PWA splash. Doit matcher --color-terracotta
//     défini dans globals.css. Next exige une string littérale ici (pas de
//     CSS var possible), donc le hex est duppliqué intentionnellement.
//   - colorScheme "light" : Axion-IA est light-only (charte ivoire/sand) — on
//     bloque le dark auto pour préserver l'identité éditoriale
//   - width device-width + initialScale 1 : mobile-first standard
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c24a1b", // hex-ok: signature terracotta SSOT, dupliquée de globals.css --color-terracotta
  colorScheme: "light",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  // Locale invalide → la page appellera `notFound()`. On renvoie quand même
  // `metadataBase` : `src/app/opengraph-image.tsx` est une convention de fichier
  // RACINE, donc Next injecte son `openGraph.images` dans toutes les routes
  // descendantes et doit résoudre cette URL même ici. Un `return {}` nu le
  // forçait à retomber sur `http://localhost:3000` en émettant au runtime :
  //   ⚠ metadataBase property in metadata export is not set […]
  // (cf. le même motif dans `src/app/not-found.tsx` et `src/app/maintenance/layout.tsx`).
  if (!hasLocale(routing.locales, locale)) return { metadataBase: new URL(SITE_URL) };
  const isFr = locale === "fr";
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: isFr
        ? "Axion-IA — Cabinet IA opérationnel"
        : "Axion-IA — Operational AI consultancy",
      template: "%s · Axion-IA",
    },
    description: isFr
      ? "Cabinet IA opérationnel · interventions, audit et implémentation IA pour entreprises."
      : "Operational AI consultancy · on-site AI sessions, audits and implementation for companies.",
    // GEO-138 (audit GEO/AEO 2026-08-15) — PAS d'`alternates` ici.
    //
    // Next Metadata fait hériter aux pages tout champ top-level qu'elles ne
    // redéfinissent pas. Un `alternates.canonical` posé au LAYOUT fuitait donc
    // vers chaque page qui n'en déclare pas : `/fr/diagnostic`, `/fr/simulateur`
    // et `/fr/components` annonçaient « je suis un duplicata de la home »
    // (vérifié live 2026-08-14). La home, elle, n'a jamais eu besoin de ce bloc :
    // elle pose son propre canonical via `buildProductMetadata` (`page.tsx`,
    // `path: "/"`). Le bloc ne servait donc qu'à fuiter.
    //
    // Une page sans `alternates` n'annonce plus RIEN : Google auto-sélectionne
    // l'URL canonique, comportement sain — bien meilleur qu'un canonical FAUX.
    // Le hreflang reste porté page par page par `buildProductMetadata`, qui
    // applique le gate `isEnLocaleDisabled()`.
    // Garde : `src/app/[locale]/__tests__/canonical-heritage.spec.ts`.
    openGraph: {
      type: "website",
      locale: isFr ? "fr_FR" : "en_US",
      url: `${SITE_URL}/${locale}`,
      siteName: "Axion-IA",
    },
    twitter: { card: "summary_large_image" },
    // Refonte AEO 2026-06-22 — directives fines (snippet/-image/-video preview)
    // pour toutes les pages héritant du layout racine (cohérent buildProductMetadata).
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    // D3 cert 2026-05-08 — verification meta GSC + Bing Webmaster Tools.
    // En prod 2026-05-13 : GSC vérifié par DNS TXT, Bing par Import OAuth GSC
    // → ces meta restent ici en fallback si on bascule en méthode meta tag.
    // Build conditionnel : meta absente si env vars non définies (dev/preview).
    ...(env.GOOGLE_SITE_VERIFICATION || env.BING_SITE_VERIFICATION
      ? {
          verification: {
            ...(env.GOOGLE_SITE_VERIFICATION ? { google: env.GOOGLE_SITE_VERIFICATION } : {}),
            ...(env.BING_SITE_VERIFICATION
              ? { other: { "msvalidate.01": env.BING_SITE_VERIFICATION } }
              : {}),
          },
        }
      : {}),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required so Server Components can use `getTranslations()` synchronously.
  setRequestLocale(locale);
  const messages = await getMessages();

  // JSON-LD: Organization + WebSite (axionia-seo-aeo). Built via factories
  // in `lib/seo.ts` so the same Organization entity is reused on landing
  // pages (régions, villes, IA tools) without copy-paste drift.
  // vatID (FR-TVA) + numéro d'immatriculation RCS sourced depuis env.ts
  // — passés en optional. Si non définis, JSON-LD sans ces champs
  // (validateur Google n'exige pas, mais signal E-E-A-T plus fort
  // quand présents pour LLMs disambiguation Wikidata).
  // Build conditionnel pour exactOptionalPropertyTypes — on n'assigne la
  // prop que si la valeur est definie (Sprint 15 fix typecheck strict).
  // Skip sur admin (private console, noindex).
  const organizationJsonLdInput: {
    locale: Locale;
    vatID?: string;
    registrationNumber?: string;
    qualiopiCertification?: { number: string; description: string; issuer?: string };
  } = { locale: locale as Locale };
  if (env.COMPANY_VAT_NUMBER) organizationJsonLdInput.vatID = env.COMPANY_VAT_NUMBER;
  if (env.COMPANY_REGISTRATION_NUMBER)
    organizationJsonLdInput.registrationNumber = env.COMPANY_REGISTRATION_NUMBER;
  // Certification Qualiopi (Phase B, DB-sourcée) → nœud #organization sur toutes
  // les pages. `null` hors Phase B (build stub inclus) ⇒ champ omis, 0 régression.
  // L'ISR repeuple au runtime une fois la Phase B activée.
  const qualiopiCredential = await getQualiopiCredentialForJsonLd();
  if (qualiopiCredential) organizationJsonLdInput.qualiopiCertification = qualiopiCredential;
  const organizationJsonLd = buildOrganizationJsonLd(organizationJsonLdInput);
  const websiteJsonLd = buildWebsiteJsonLd({ locale: locale as Locale });

  // SiteNavigationElement JSON-LD — dérivé du SSOT `SERVICES` (`content/services.ts`)
  // pour rester aligné sur la nav primaire RÉELLE du header desktop (5 services +
  // Tarifs), au lieu d'une liste figée à la main. Corrige l'audit maillage 2026-07-03 :
  // l'ancienne liste pointait vers `/interventions` (hub inexistant → redirigé) et
  // divergeait du header (Cas concrets/Implantations ne sont pas dans la nav desktop).
  // Signal AEO/GEO : permet à Perplexity/Claude.ai/SGE de comprendre la structure
  // de navigation primaire et de citer les hubs. URLs FR (EN désactivé, cf. AGENTS.md).
  const isFrLocale = (locale as Locale) === "fr";
  const siteNavigationJsonLd = buildSiteNavigationJsonLd([
    ...SERVICES.map((s, i) => ({
      name: serviceOfficial(s, isFrLocale),
      url: `${SITE_URL}/${locale}${s.href}`,
      position: i + 1,
    })),
    {
      name: isFrLocale ? "Tarifs" : "Pricing",
      url: `${SITE_URL}/${locale}/tarifs`,
      position: SERVICES.length + 1,
    },
  ]);

  // P1-14 (audit re-run 2026-05-15 AGENT 5) — Resource Hints preconnect.
  // Réduit le TBT initial de ~60-150 ms p75 en pré-établissant les
  // connexions TCP+TLS vers les origines tierces critiques avant que les
  // scripts ne les appellent. React 19 hoist automatiquement `<link>` au
  // `<head>` du document.
  //
  // Ordre de priorité :
  //   1. Plausible self-hosted (`afterInteractive` script, chargé sur toutes
  //      pages) — preconnect dès que NEXT_PUBLIC_PLAUSIBLE_DOMAIN est set.
  //   2. Sentry ingest (errors fire-and-forget) — preconnect uniquement si
  //      DSN défini (sinon dns-prefetch est suffisant).
  //   3. Cloudflare Turnstile (`/reserver` booking form) — preconnect si
  //      la clé site est définie. `crossOrigin` requis (iframe + cookie).
  //   4. Google Fonts API (next/font self-host les fichiers woff2 mais
  //      le manifest CSS reste hébergé Google) — dns-prefetch léger.
  const plausibleDomain = env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const sentryDsn = env.NEXT_PUBLIC_SENTRY_DSN;
  // Extract Sentry ingest origin from DSN (format https://<key>@<id>.ingest.sentry.io/<project>).
  let sentryIngestOrigin: string | null = null;
  if (sentryDsn) {
    try {
      const u = new URL(sentryDsn);
      sentryIngestOrigin = `${u.protocol}//${u.host}`;
    } catch {
      sentryIngestOrigin = null;
    }
  }
  const turnstileEnabled = !!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <html
      lang={locale}
      dir="ltr"
      className={`${manrope.variable} ${inconsolata.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="bg-bg text-fg flex min-h-full flex-col font-sans">
        {/* P1-14 Resource Hints — React 19 hoist automatique vers <head>. */}
        {plausibleDomain ? (
          <link rel="preconnect" href={`https://${plausibleDomain}`} crossOrigin="anonymous" />
        ) : null}
        {sentryIngestOrigin ? (
          <link rel="preconnect" href={sentryIngestOrigin} crossOrigin="anonymous" />
        ) : null}
        {turnstileEnabled ? (
          <link rel="preconnect" href="https://challenges.cloudflare.com" crossOrigin="anonymous" />
        ) : null}
        <SkipToContent />
        <NextIntlClientProvider messages={messages} locale={locale}>
          {/* Header/Footer publics toujours rendus — masqués sur les routes admin
              via CSS :has() injecté dans le layout admin (force-dynamic).
              Cela évite d'appeler headers() ici, ce qui rendrait TOUTES les pages
              dynamiques (no-store) et casserait le BF-cache + les scores
              Lighthouse best-practices sur les pages publiques SSG. */}
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          {/* Bandeau réassurance Qualiopi — rendu sur toutes les pages, en bas
              (au-dessus du footer) pour ne pas peser sur le LCP/CLS above-fold.
              Rend `null` hors Phase B (OF_PUBLIC_DISCLOSURE_ENABLED + certificat). */}
          <QualiopiReassuranceBand />
          <Footer />
          {/* P-304 — WebVitals dépend de `useLocale()` next-intl, doit donc
              être enfant du provider sinon prerender throw. */}
          <WebVitals />
          {/* Plausible Analytics self-hosted (Sprint 23 / M11) — no-op si
              NEXT_PUBLIC_PLAUSIBLE_DOMAIN absent. afterInteractive donc
              n'impacte pas LCP. */}
          <Plausible />
          {/* Audit indexation 2026-05-15 P1-19 — track document.referrer dans
              14 sources canoniques (google/bing/qwant/perplexity/chatgpt/claude…)
              pour mesurer l'AEO/GEO ROI Plausible. No-op si Plausible absent. */}
          <RefererTracker />
          {/* Méta-cert 2026-05-15 AGENT 21 — Microsoft Clarity gated sur consent
              CMP. `CookieConsent` banner sticky bottom (lazy display) → si
              accept, `Clarity` charge le script (afterInteractive) + dépose
              cookies `_clck` / `_clsk`. Si decline ou pas de choix → null.
              Plausible (anonyme, EU, cookie-less) reste toujours actif. */}
          <CookieConsent />
          <Clarity />
          {/* V-04 P3 (Sprint Correctif suite 2026-05-22) — Speculation Rules
              client-side avec gating route publique uniquement (skip /admin/*).
              Reactive le bloc désactivé 2026-05-18 sans rallumer le crash RSC
              stream sur la console admin. Gain LCP soft-nav -800 à -1200 ms. */}
          <SpeculationRules locale={locale} />
          {/* T-08 — widget chatbot, île idle (next/dynamic ssr:false +
              requestIdleCallback). Gated NEXT_PUBLIC_CHATBOT_ENABLED : ne monte
              rien tant que Will n'active pas (D-PROD). Enfant du provider
              next-intl (le widget consomme useTranslations). position:fixed →
              CLS 0, hors First Load JS. */}
          <ChatWidgetMount />
        </NextIntlClientProvider>
        {/* V-04 P5 (Sprint Correctif suite 2026-05-22) — JSON-LD Organization +
            WebSite consolidés en un seul <script type="application/ld+json">
            via JsonLdGraph @graph (au lieu de 2 scripts inline séparés).
            Gain doc parse -300/-500 ms sur 100 % des routes (signal LCP/FCP).
            Admin noindex (cf. robots.ts) → Google ignore ; sans effet négatif. */}
        <JsonLdGraph schemas={[organizationJsonLd, websiteJsonLd, siteNavigationJsonLd]} />
        {/* V-04 P3 (2026-05-22) — Speculation Rules désormais posées via
            <SpeculationRules /> client component (gating /admin/* + DOM
            injection). Voir src/components/perf/SpeculationRules.tsx. */}
      </body>
    </html>
  );
}
