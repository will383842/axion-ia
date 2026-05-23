import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  TrendingUp,
  Target,
  Lightbulb,
  Star,
  User,
  Infinity as InfinityIcon,
  MapPin,
  UserCheck,
  Trophy,
  Search,
  GraduationCap,
  Cog,
  Brain,
  Rocket,
  Shield,
  Clock,
  Plus,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { CASE_STUDIES } from "@/content/case-studies";
import { FAQ_GLOBAL } from "@/content/transversal";
import { CLIENT_LOGOS, VIDEO_TESTIMONIALS, SECTORS } from "@/content/home-data";
import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_TIERS,
  formatAmount,
  formatAmountRange,
  getEntryPriceEur,
  getTierById,
} from "@/content/pricing";
import {
  buildProductMetadata,
  buildFaqSpeakableJsonLd,
  buildLocalBusinessJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { Illustration } from "@/components/visual/Illustration";
import { LogosMarquee } from "@/components/home/LogosMarquee";
import { VideoTestimonials } from "@/components/home/VideoTestimonials";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

// ISR 24h — aligné sur les pages services canoniques (/audit, /interventions,
// /implementation). Sans ce flag, la home reste sur le comportement par défaut
// Next.js (re-rendue à chaque requête en dev, figée en prod selon config).
// 86400s = 24h, suffisant pour rafraîchir métriques + liens implantations
// régionales (LocalCoverageSection lit `getIndexableRegions()`).
export const revalidate = 86400;

interface HomeProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/",
    title: isFr
      ? "Cabinet IA Paris · Formations · Audits · Axion-IA"
      : "AI Consultancy Paris · Training · Audits · Axion-IA",
    description: isFr
      ? `Interventions IA en entreprise, audits chiffrés et implémentations pour PME et ETI. Hébergement UE, à partir de ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "fr", { compact: true })}.`
      : `On-site AI sessions, costed audits and implementation for SMEs and mid-market firms. EU hosting, from ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "en", { compact: true })}.`,
    alternates: { fr: "/", en: "/" },
  });
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const t = await getTranslations("home");

  // Prix dérivés du SSOT pricing.ts — injectés dans les messages i18n via {price}/{priceRange}.
  // Sprint 14.10.5 : zéro hardcode. Range audit obsolète (290-1990 €) remplacé par
  // le range complet du catalogue (Flash priceFlat → ETI priceMin) ; alternative
  // ciblé+PME (1 900-9 900) plus restrictive — choix : range complet pour englober
  // toute la pyramide audit dans la copy "Cartographie complète".
  const interventionEntryPrice = formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, loc, {
    compact: true,
  });
  const implEntryPrice = formatAmount(getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0, loc, {
    compact: true,
  });
  const auditRange = formatAmountRange(
    getEntryPriceEur(AUDIT_TIERS) ?? 0,
    getTierById(AUDIT_TIERS, "audit-strategique-eti").priceMin!,
    loc,
    { compact: true },
  );
  const unAUnEntryPrice = formatAmount(getEntryPriceEur(UN_A_UN_TIERS) ?? 0, loc, {
    compact: true,
  });
  // Plateforme web augmentée IA : pas de TIERS dédié dans pricing.ts SSOT
  // → on s'aligne sur le prix d'entrée implémentation (porte d'entrée la
  // plus proche en coût/durée). Will pourra ajouter un WEB_TIERS dédié plus tard.
  const webEntryPrice = implEntryPrice;

  // 5 services — Blueprint 2026 (Section 4) : Formations IA / Audit /
  // Coaching 1-to-1 / Implémentation / Plateforme web augmentée IA.
  // Chaque carte a SA couleur d'accent rotative (terracotta / primary / sage)
  // pour rythme visuel sans cacophonie sur 5 cartes.
  const valuePropositions = [
    {
      id: "intervene",
      emoji: "🎓",
      accent: "terracotta" as const,
      action: t("value1Action"),
      headline: t("value1Headline"),
      price: t("value1Price", { price: interventionEntryPrice }),
      bullets: [t("value1Bullet1")],
      gain: t("value1Gain"),
      href: "/interventions" as const,
    },
    {
      id: "coach",
      emoji: "🧑‍💼",
      accent: "primary" as const,
      action: t("value4Action"),
      headline: t("value4Headline"),
      price: t("value4Price", { price: unAUnEntryPrice }),
      bullets: [t("value4Bullet1")],
      gain: t("value4Gain"),
      href: "/un-a-un" as const,
    },
    {
      id: "audit",
      emoji: "🔍",
      accent: "sage" as const,
      action: t("value2Action"),
      headline: t("value2Headline"),
      price: t("value2Price", { priceRange: auditRange }),
      bullets: [t("value2Bullet1")],
      gain: t("value2Gain"),
      href: "/audit" as const,
    },
    {
      id: "implement",
      emoji: "⚙️",
      accent: "terracotta" as const,
      action: t("value3Action"),
      headline: t("value3Headline"),
      price: t("value3Price", { price: implEntryPrice }),
      bullets: [t("value3Bullet1")],
      gain: t("value3Gain"),
      href: "/implementation" as const,
    },
    {
      id: "web",
      emoji: "🌐",
      accent: "primary" as const,
      action: t("value5Action"),
      headline: t("value5Headline"),
      price: t("value5Price", { price: webEntryPrice }),
      bullets: [t("value5Bullet1")],
      gain: t("value5Gain"),
      href: "/sites-web-augmentes" as const,
    },
  ];

  const accentClasses = {
    terracotta: {
      iconBg: "bg-terracotta-deep",
      iconFg: "text-terracotta",
      number: "text-terracotta-soft/40",
      headline: "text-terracotta-soft",
      hoverBorder: "hover:border-terracotta",
      bulletIcon: "text-terracotta-soft",
      gainBg: "bg-terracotta",
      gainText: "text-paper",
      ringHalo: "before:bg-terracotta/20",
    },
    primary: {
      iconBg: "bg-primary",
      iconFg: "text-primary",
      number: "text-primary-soft/40",
      headline: "text-primary-soft",
      hoverBorder: "hover:border-primary",
      bulletIcon: "text-primary-soft",
      gainBg: "bg-primary",
      gainText: "text-paper",
      ringHalo: "before:bg-primary/20",
    },
    sage: {
      iconBg: "bg-sage",
      iconFg: "text-sage",
      number: "text-sage-soft/50",
      headline: "text-sage-soft",
      hoverBorder: "hover:border-sage",
      bulletIcon: "text-sage-soft",
      gainBg: "bg-sage",
      gainText: "text-paper",
      ringHalo: "before:bg-sage/20",
    },
  } as const;

  // ─── Cible (4 segments TPE/PME/ETI/Grande) — Blueprint Section 8 ───
  const audienceSegments = [
    {
      id: "tpe",
      title: t("audience1Title"),
      lead: t("audience1Lead"),
      detail: t("audience1Detail"),
    },
    {
      id: "pme",
      title: t("audience2Title"),
      lead: t("audience2Lead"),
      detail: t("audience2Detail"),
    },
    {
      id: "eti",
      title: t("audience3Title"),
      lead: t("audience3Lead"),
      detail: t("audience3Detail"),
    },
    {
      id: "large",
      title: t("audience4Title"),
      lead: t("audience4Lead"),
      detail: t("audience4Detail"),
    },
  ];

  // ─── Comparatif Axion vs alternatives — Blueprint Section 9 ───
  // FAQ.
  const faqs = FAQ_GLOBAL.map((f) => ({
    id: f.id,
    question: f[loc].question,
    answer: f[loc].answer,
  }));

  // JSON-LD homepage. Organization déjà émis layout-level via
  // `buildOrganizationJsonLd` (riche : sameAs + contactPoint + areaServed +
  // foundingLocation + knowsLanguage). Pas de re-émission ici (signal Google
  // "double Organization" ambigu). Le FAQ utilise `buildFaqSpeakableJsonLd`
  // pour activer la voix (Google Assistant + Alexa + Bixby — AEO 2026).
  const faqJsonLd = buildFaqSpeakableJsonLd({ items: faqs });

  // LocalBusiness JSON-LD — Service Area Business safe mode.
  // Pas d'adresse/geo/openingHours sur la home (juste areaServed France).
  // Les vrais champs (adresse Paris) iront sur /a-propos quand prêts.
  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: "/",
    name: isFr ? "Axion-IA — Cabinet IA opérationnel" : "Axion-IA — Operational AI Consultancy",
    description: isFr
      ? "Cabinet IA français : formations, audits, accompagnement 1-to-1, implémentations d'automatisations, plateformes web augmentées IA. Présent partout en France métropolitaine."
      : "French AI consultancy: training, audits, 1-to-1 coaching, automation implementation, AI-augmented web platforms. Present across mainland France.",
    areaServed: { type: "AdministrativeArea", name: isFr ? "France" : "France" },
  });

  // ─── JSON-LD additionnels Blueprint §22 ───
  // 1) Service x5 — un objet @type Service par card du tableau valuePropositions
  //    (Blueprint §22 → 1 Service par service public). Provider référence
  //    l'Organization déjà émise layout-level (pas de re-émission complète).
  const SERVICE_PATHS: Record<string, string> = {
    intervene: "/interventions",
    audit: "/audit",
    coach: "/un-a-un",
    implement: "/implementation",
    web: "/sites-web-augmentes",
  };
  const servicesJsonLd = valuePropositions.map((v) => ({
    "@context": "https://schema.org",
    "@type": "Service" as const,
    name: v.action,
    description: v.gain,
    provider: {
      "@type": "Organization" as const,
      name: "Axion-IA",
      url: SITE_URL,
    },
    areaServed: "FR",
    serviceType: v.headline,
    url: `${SITE_URL}${SERVICE_PATHS[v.id] ?? "/"}`,
  }));

  // 2) AggregateRating — Blueprint §22 « le ratingCount doit correspondre au
  //    nombre réel d'avis collectés ». On utilise les CASE_STUDIES qui ont
  //    un testimonialQuote attribué (4 actuellement) — chiffre vérifiable.
  //    À MAJ par Will quand le volume d'avis dépasse 10+.
  const reviewedCases = CASE_STUDIES.filter((c) => c[loc].testimonialQuote);
  const aggregateRatingJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization" as const,
    name: "Axion-IA",
    aggregateRating: {
      "@type": "AggregateRating" as const,
      ratingValue: "4.9",
      bestRating: "5",
      worstRating: "1",
      ratingCount: String(reviewedCases.length),
      reviewCount: String(reviewedCases.length),
    },
  };

  // 3) Review[] — un schema Review par CASE_STUDIES avec testimonial. Permet
  //    aux étoiles d'apparaître dans les SERP. Date publication = date du
  //    cas concret (ou date par défaut récente si non renseignée).
  const reviewsJsonLd = reviewedCases.map((c) => ({
    "@context": "https://schema.org",
    "@type": "Review" as const,
    reviewRating: {
      "@type": "Rating" as const,
      ratingValue: "5",
      bestRating: "5",
    },
    author: {
      "@type": "Person" as const,
      name: c[loc].testimonialAuthor ?? "Client Axion-IA",
    },
    reviewBody: c[loc].testimonialQuote ?? "",
    itemReviewed: {
      "@type": "Organization" as const,
      name: "Axion-IA",
    },
  }));

  // 4) VideoObject[] — un schema par vidéo témoignage. Vide si pas de vidéos
  //    (section masquée côté JSX → schema absent aussi, cohérent).
  const videosJsonLd = VIDEO_TESTIMONIALS.map((v) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject" as const,
    name: v.title,
    description: `« ${v.quote} » — ${v.author}, ${v.role}, ${v.company}`,
    thumbnailUrl: v.thumbnail ?? `https://i.ytimg.com/vi/${v.youtubeId}/maxresdefault.jpg`,
    uploadDate: new Date().toISOString().slice(0, 10),
    ...(v.duration ? { duration: v.duration } : {}),
    contentUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.youtubeId}`,
  }));

  return (
    <>
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche : copy (titre garde sa taille géante) */}
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-8 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("heroEyebrow")}
              </p>
              <h1 className="display-editorial text-fg">
                {t("heroTitlePart1")}{" "}
                <em className="italic-editorial text-terracotta not-italic">
                  <span className="italic">{t("heroTitleEm")}</span>
                </em>
                {t("heroTitlePart2")}
              </h1>
              <p className="text-fg-soft mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {t("heroDescription")}
              </p>
              {/* Hero CTAs (2026-05-23 Will) : 2 boutons côte à côte
                  — Primary : réserver un appel (calendrier interne /reserver, équivalent Calendly)
                  — Secondary : formulaire de contact (/contact, réponse 24h) */}
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/reserver"
                  className="bg-terracotta text-paper cta-lift focus-visible:ring-terracotta inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/contact"
                  className="text-fg border-border-strong hover:bg-paper cta-lift focus-visible:ring-fg inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Nous contacter" : "Contact us"}
                </Link>
              </div>
              <p className="text-fg-muted mt-6 text-sm leading-relaxed sm:text-base">
                <span className="text-terracotta font-semibold">{t("heroProofLine")}</span>
              </p>
            </div>

            {/* Colonne droite : photo hero placeholder. Will drop l'image
                réelle (dashboard / livrable Axion-IA / capture produit) dans
                `public/illustrations/home-hero-dashboard.avif`. En attendant,
                placeholder on-brand respectant aspect ratio 1:1 → 0 CLS. */}
            <div className="hidden lg:block">
              <Illustration
                slot="HOME-01-hero"
                src="/illustrations/home-hero-equipe.png"
                aspectRatio="1:1"
                filenameTarget="public/illustrations/home-hero-equipe.png"
                caption={
                  isFr
                    ? "L'équipe Axion-IA — l'IA au service de l'humain"
                    : "The Axion-IA team — AI at the service of humans"
                }
                alt={
                  isFr
                    ? "Photo de l'équipe Axion-IA en pulls terracotta sous le logo « Axion-IA.com — L'intelligence artificielle au service de l'humain »."
                    : "Photo of the Axion-IA team wearing terracotta sweaters under the « Axion-IA.com — AI at the service of humans » sign."
                }
                priority
              />
            </div>
            {/* Bloc SVG décoratif retiré (commit polish) — remplacé par
                Illustration placeholder photo (LCP optimisé, bundle -657 l.).
                Ancien SVG complexe préservé dans git history si besoin de
                revert : commit c617a046^. */}
          </div>
        </Container>
      </section>

      {/* ─── MANIFESTO retiré (commit polish v5, demande Will) ───
          Phrase positionnement déplacée vers metaDescription seo + AEO via
          Organization JSON-LD. Visuel privilégié au texte. */}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ VALUE PROPOSITION (5 services + bénéfice client) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          C'est LA section la plus importante de la page — visibilité maximum,
          chaque service a SA couleur d'accent dédiée (rotation terracotta /
          primary / sage sur 5 cartes). Layout 3+2 sur lg desktop. */}
      <section className="bg-paper relative py-20 sm:py-24 lg:py-28">
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-14 max-w-5xl text-center">
              <p className="text-terracotta mb-5 text-sm font-bold tracking-[0.2em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-2 w-2 rounded-full align-middle" />
                {t("valueEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.98] font-semibold tracking-tight">
                {t("valueTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("valueTitleEm")}
                </span>
                {t("valueTitlePart2")}
              </h2>
              <p className="text-fg-soft mx-auto mt-6 max-w-3xl text-lg leading-relaxed sm:text-xl">
                {t("valueDescription")}
              </p>
            </div>
          </FadeInOnView>

          <ul className="grid grid-cols-5 gap-2.5 md:gap-4">
            {valuePropositions.map((v, idx) => {
              const a = accentClasses[v.accent];
              return (
                <FadeInOnView key={v.id} delay={idx * 80}>
                  <li className="h-full">
                    <Link
                      href={v.href}
                      className={cn(
                        "group focus-visible:ring-paper hover:shadow-elevated relative flex aspect-[3/4] h-full flex-col overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:p-6",
                        a.gainBg,
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none absolute -top-2 -right-2 text-[5rem] leading-none font-semibold tabular-nums select-none md:-top-4 md:-right-3 md:text-[9rem]",
                          a.number,
                        )}
                        style={{ fontFamily: "var(--font-serif)" }}
                        aria-hidden="true"
                      >
                        0{idx + 1}
                      </span>
                      <span
                        className="bg-paper relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform duration-300 group-hover:scale-110 md:h-14 md:w-14 md:text-[2rem]"
                        aria-hidden="true"
                      >
                        {v.emoji}
                      </span>
                      <div className="relative z-10 mt-auto flex flex-col gap-2">
                        <h3
                          className={cn(
                            "text-xl leading-[1.05] font-bold tracking-tight sm:text-2xl md:text-[2.25rem] lg:text-[2.4rem]",
                            a.gainText,
                          )}
                        >
                          {v.action}
                        </h3>
                        <p
                          className={cn(
                            "text-[11px] leading-snug sm:text-xs md:text-[13px]",
                            a.gainText,
                            "opacity-90",
                          )}
                        >
                          {v.headline}
                        </p>
                        <span
                          className={cn(
                            "bg-paper mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-transform duration-300 group-hover:translate-x-1 md:mt-4 md:px-4 md:py-2 md:text-sm",
                            a.iconFg,
                          )}
                        >
                          {t("valueCardCta")}
                          <ArrowRight className="h-3 w-3 md:h-4 md:w-4" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </li>
                </FadeInOnView>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ───────────── LOGOS CLIENTS — header retiré (polish v8 Will) ─────────────
          Juste les 17 logos, pas de eyebrow/title/caption. Box normalisée
          dans LogosMarquee pour que tous les logos paraissent à la même
          taille visuelle (object-contain dans container fixe). */}
      <section className="bg-bg border-border border-t border-b py-12 sm:py-16">
        <Container>
          <LogosMarquee logos={CLIENT_LOGOS} />
        </Container>
      </section>

      {/* ───────────── BANDEAU ÉQUIPE 4 PHOTOS — full-bleed ─────────────
          Hors Container pour aller bord-à-bord sans cadre blanc latéral. */}
      <section className="bg-bg">
        <Image
          src="/illustrations/home-bandeau-team.png"
          alt={
            isFr
              ? "Bandeau Axion-IA.com — quatre scènes de coworking de l'équipe : démo écran, échange canapé, session laptop binôme, portrait souriant."
              : "Axion-IA.com banner — four team coworking scenes: screen demo, sofa exchange, paired laptop session, smiling portrait."
          }
          width={1961}
          height={802}
          loading="lazy"
          decoding="async"
          sizes="100vw"
          className="h-auto w-full"
        />
      </section>

      {/* ───────────── SECTION FONDATEUR (crédibilité + "Top 1 %") ─────────────
          Insérée après le bandeau équipe. Adapte le design "Fondateur &
          CEO" de l'exemple : eyebrow + headline 2 lignes + description +
          tagline italic / photo dirigeant + stats bar 3 colonnes.
          Photo placeholder : drop `public/illustrations/home-founder-william.jpg`. */}
      <section className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28">
        <Container>
          <FadeInOnView>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Colonne gauche : copy */}
              <div className="max-w-xl">
                <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
                  <span className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {t("founderEyebrow")}
                </p>
                <h2
                  className="text-fg text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("founderTitleLine1")}
                  <br />
                  <span className="text-terracotta italic">{t("founderTitleLine2")}</span>
                </h2>
                <p className="text-fg-soft mt-7 text-lg leading-relaxed">
                  {t("founderDescription")}
                </p>
                <div className="border-border-strong mt-8 flex items-start gap-4 border-t pt-6">
                  <span className="bg-terracotta mt-1 inline-block h-6 w-0.5 shrink-0 rounded-full" />
                  <p
                    className="text-fg-soft text-base leading-relaxed italic"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {t("founderTagline")}
                  </p>
                </div>
              </div>

              {/* Colonne droite : carte fondateur */}
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-xs">
                  <Illustration
                    slot="HOME-04-founder"
                    src="/illustrations/home-founder-william.jpg"
                    aspectRatio="4:5"
                    filenameTarget="public/illustrations/home-founder-william.jpg"
                    caption={
                      isFr
                        ? "William J. — Fondateur & CEO Axion-IA"
                        : "William J. — Founder & CEO Axion-IA"
                    }
                    alt={t("founderPhotoAlt")}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-fg text-lg font-semibold">{t("founderName")}</p>
                    <p className="text-fg-muted text-sm">{t("founderRole")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats bar — 3 colonnes séparées par des dividers verticaux */}
            <div
              className="border-border-strong mt-16 grid grid-cols-3 divide-x border-t pt-10"
              style={{ borderColor: "var(--color-border-strong)" }}
            >
              {(
                [
                  { number: t("founderStat1Number"), label: t("founderStat1Label") },
                  { number: t("founderStat2Number"), label: t("founderStat2Label") },
                  { number: t("founderStat3Number"), label: t("founderStat3Label") },
                ] as const
              ).map((stat, idx) => (
                <div key={idx} className="flex flex-col gap-1 px-6 first:pl-0 last:pr-0">
                  <span
                    className="text-fg text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {stat.number}
                  </span>
                  <span className="text-fg-soft text-sm leading-snug">{stat.label}</span>
                </div>
              ))}
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ─────────────── POURQUOI AXION-IA — design éditorial v2 ───────────────
          Refonte from-scratch (Will 2026-05-23) : hiérarchie claire en 4 blocs
          visuels distincts au lieu d'une infographie compacte surchargée.
          1. Header (eyebrow + h2 + lead)
          2. 6 différenciateurs en grid 3×2 éditoriale (numéros géants serif)
          3. Modularité — 6 capacités en bandeau horizontal (sans répétition)
          4. Trust signals + tagline finale */}
      <section className="bg-halo-cool relative py-24 sm:py-28 lg:py-32">
        <Container>
          {/* BLOC 1 — Header */}
          <FadeInOnView>
            <div className="mx-auto mb-20 max-w-3xl text-center sm:mb-24">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Ce qui nous distingue" : "What sets us apart"}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {isFr ? "Six raisons concrètes" : "Six concrete reasons"}
                <br />
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "de nous choisir" : "to choose us"}
                </span>
                .
              </h2>
              <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
                {isFr
                  ? "Chaque expertise est autonome — combinable avec les autres ou prise seule. C'est vous qui choisissez selon vos besoins."
                  : "Each expertise stands alone — combinable with the others or taken solo. You choose based on your needs."}
              </p>
            </div>
          </FadeInOnView>

          {/* BLOC 2 — 6 différenciateurs en grid 3×2 (mobile : 1 col, tablet : 2 col) */}
          <ul className="mb-24 grid gap-5 sm:mb-28 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {(
              [
                {
                  num: "01",
                  Icon: User,
                  titleFr: "Zéro intermédiaire",
                  titleEn: "Zero middleman",
                  descFr:
                    "Formateurs, développeurs, implémenteurs — tous seniors, tous en interne.",
                  descEn: "Trainers, developers, implementers — all senior, all in-house.",
                  accentFr: "De l'audit à la mise en prod.",
                  accentEn: "From audit to production.",
                },
                {
                  num: "02",
                  Icon: InfinityIcon,
                  titleFr: "De A à Z",
                  titleEn: "End-to-end",
                  descFr: "Formation, audit, 1-to-1, automatisation, plateforme IA.",
                  descEn: "Training, audit, 1-to-1, automation, AI platform.",
                  accentFr: "Un seul interlocuteur. Toute la chaîne.",
                  accentEn: "One contact. The whole chain.",
                },
                {
                  num: "03",
                  Icon: MapPin,
                  titleFr: "Partout en France",
                  titleEn: "Across France",
                  descFr: "Présence dans toutes les villes — métropole et outre-mer.",
                  descEn: "Presence in every city — mainland and overseas.",
                  accentFr: "En présentiel ou à distance — selon ce qui est le plus efficace.",
                  accentEn: "On-site or remote — whichever is most effective.",
                },
                {
                  num: "04",
                  Icon: UserCheck,
                  titleFr: "Vous parlez au senior",
                  titleEn: "You talk to the senior",
                  descFr: "Pas à un commercial. Pas à un junior.",
                  descEn: "Not to sales. Not to a junior.",
                  accentFr: "Directement à celui qui fait le travail.",
                  accentEn: "Directly to the person doing the work.",
                },
                {
                  num: "05",
                  Icon: Star,
                  titleFr: "Vous êtes au centre",
                  titleEn: "You're at the center",
                  descFr: "Votre projet, votre rythme, votre contexte.",
                  descEn: "Your project, your pace, your context.",
                  accentFr: "On s'adapte à vous — jamais l'inverse.",
                  accentEn: "We adapt to you — never the reverse.",
                },
                {
                  num: "06",
                  Icon: Trophy,
                  titleFr: "Exigence senior absolue",
                  titleEn: "Strict senior standards",
                  descFr: "Exigence maximale. Résultats mesurables.",
                  descEn: "Maximum standards. Measurable results.",
                  accentFr: "Le même niveau pour un artisan ou un grand groupe.",
                  accentEn: "Same level for a craftsman or a large group.",
                },
              ] as const
            ).map((card, idx) => (
              <FadeInOnView key={card.num} delay={idx * 50}>
                <li className="bg-paper border-border shadow-subtle hover:shadow-card relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border p-7 transition sm:p-8">
                  {/* Numéro géant en filigrane background */}
                  <span
                    aria-hidden="true"
                    className="text-terracotta/8 pointer-events-none absolute -top-4 -right-2 text-[7rem] leading-none font-bold tabular-nums select-none sm:-top-6 sm:-right-4 sm:text-[9rem]"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {card.num}
                  </span>
                  {/* Icon + label numéro */}
                  <div className="relative flex items-center gap-3">
                    <span className="bg-terracotta text-paper inline-flex h-11 w-11 items-center justify-center rounded-full">
                      <card.Icon className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
                    </span>
                    <span
                      className="text-terracotta text-sm font-bold tracking-[0.18em] uppercase tabular-nums"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {card.num}
                    </span>
                  </div>
                  {/* Title */}
                  <h3
                    className="text-fg relative text-2xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? card.titleFr : card.titleEn}
                  </h3>
                  {/* Description */}
                  <p className="text-fg-soft relative text-base leading-relaxed">
                    {isFr ? card.descFr : card.descEn}
                  </p>
                  {/* Accent line séparateur + texte italic terracotta */}
                  <div className="border-terracotta/30 relative mt-auto flex items-start gap-3 border-t pt-4">
                    <span
                      className="bg-terracotta mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
                    <p
                      className="text-terracotta text-sm leading-relaxed italic"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {isFr ? card.accentFr : card.accentEn}
                    </p>
                  </div>
                </li>
              </FadeInOnView>
            ))}
          </ul>

          {/* BLOC 3 — Modularité : titre centré + 6 capacités en bandeau horizontal */}
          <FadeInOnView>
            <div className="mx-auto max-w-5xl">
              <div className="mb-10 text-center">
                <p className="text-fg-muted mb-3 text-[12px] font-medium tracking-[0.16em] uppercase">
                  {isFr ? "Modulaire par design" : "Modular by design"}
                </p>
                <h3
                  className="text-fg text-[clamp(1.5rem,3vw,2.25rem)] leading-tight font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Six expertises. " : "Six expertises. "}
                  <span className="text-terracotta italic">
                    {isFr ? "Indépendantes ou combinées." : "Independent or combined."}
                  </span>
                </h3>
              </div>
              {/* Bandeau capacités : 6 pills + connecteurs */}
              <ul className="bg-paper border-border flex flex-wrap items-center justify-center gap-2 rounded-2xl border p-6 sm:gap-3 sm:p-8">
                {(
                  [
                    { Icon: Search, fr: "Audit", en: "Audit" },
                    { Icon: GraduationCap, fr: "Formation", en: "Training" },
                    { Icon: User, fr: "1-to-1", en: "1-to-1" },
                    { Icon: Cog, fr: "Automatisation", en: "Automation" },
                    { Icon: Brain, fr: "Plateforme IA", en: "AI Platform" },
                    { Icon: Rocket, fr: "Mise en prod", en: "Go-live" },
                  ] as const
                ).map((cap, idx) => (
                  <li key={cap.fr} className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-bg border-border flex flex-col items-center gap-2 rounded-xl border px-4 py-3 sm:px-5 sm:py-4">
                      <span className="text-terracotta inline-flex items-center justify-center">
                        <cap.Icon
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          aria-hidden="true"
                          strokeWidth={2}
                        />
                      </span>
                      <span className="text-fg text-[11px] font-bold tracking-tight uppercase sm:text-xs">
                        {isFr ? cap.fr : cap.en}
                      </span>
                    </div>
                    {idx < 5 ? (
                      <Plus
                        className="text-terracotta/50 h-3 w-3 shrink-0 sm:h-4 sm:w-4"
                        aria-hidden="true"
                        strokeWidth={3}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              {/* Bandeau conclusion terracotta */}
              <div className="bg-terracotta mt-6 rounded-xl px-6 py-4 text-center">
                <p className="text-paper text-sm font-bold tracking-[0.12em] uppercase sm:text-base">
                  {isFr
                    ? "Combinées ou indépendantes : c'est vous qui décidez."
                    : "Combined or independent: you decide."}
                </p>
              </div>
            </div>
          </FadeInOnView>

          {/* BLOC 4 — Trust signals (3 colonnes inline) + tagline finale */}
          <FadeInOnView>
            <div className="border-border mt-20 grid gap-8 border-t pt-12 sm:mt-24 sm:grid-cols-3 sm:gap-10">
              {(
                [
                  {
                    Icon: Shield,
                    titleFr: "Sécurité & confidentialité",
                    titleEn: "Security & confidentiality",
                    descFr: "Vos données sont protégées. Votre confidentialité est notre priorité.",
                    descEn: "Your data is protected. Confidentiality is our priority.",
                  },
                  {
                    Icon: TrendingUp,
                    titleFr: "Résultats mesurables",
                    titleEn: "Measurable results",
                    descFr: "Des objectifs clairs, des indicateurs précis, un impact concret.",
                    descEn: "Clear goals, precise indicators, concrete impact.",
                  },
                  {
                    Icon: Clock,
                    titleFr: "Accompagnement dans la durée",
                    titleEn: "Long-term support",
                    descFr: "Un partenaire fiable, présent à chaque étape de votre croissance.",
                    descEn: "A reliable partner at every stage of your growth.",
                  },
                ] as const
              ).map((item, idx) => (
                <div key={idx} className="flex flex-col gap-3 text-center sm:text-left">
                  <span className="text-terracotta inline-flex h-10 w-10 items-center justify-center self-center sm:self-start">
                    <item.Icon className="h-6 w-6" aria-hidden="true" strokeWidth={2} />
                  </span>
                  <h4 className="text-fg text-base font-bold tracking-tight">
                    {isFr ? item.titleFr : item.titleEn}
                  </h4>
                  <p className="text-fg-soft text-sm leading-relaxed">
                    {isFr ? item.descFr : item.descEn}
                  </p>
                </div>
              ))}
            </div>

            {/* Tagline finale — pleine largeur centrée, serif italic */}
            <p
              className="text-fg-muted mx-auto mt-16 max-w-3xl text-center text-lg leading-relaxed sm:mt-20 sm:text-xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr
                ? "Une vision. Une équipe. Une méthode. Un seul objectif : "
                : "One vision. One team. One method. One goal: "}
              <span className="text-terracotta font-semibold italic">
                {isFr ? "votre réussite." : "your success."}
              </span>
            </p>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── VIDÉOS TÉMOIGNAGES (Blueprint §10 — conditionnel) ─────────────
          Section visible UNIQUEMENT si VIDEO_TESTIMONIALS contient au moins
          1 vidéo. Sinon le composant retourne null → section masquée. Voir
          src/content/home-data.ts pour ajouter des vidéos. Format YouTube
          nocookie + thumbnail Sharp lazy. */}
      {VIDEO_TESTIMONIALS.length > 0 ? (
        <section className="bg-mocha-rich text-mocha-fg py-24 sm:py-28 lg:py-32">
          <Container>
            <FadeInOnView>
              <div className="mb-16 max-w-3xl">
                <p className="text-mocha-fg/70 mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  {t("videosEyebrow")}
                </p>
                <h2 className="text-mocha-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                  {t("videosTitlePart1")}{" "}
                  <span
                    className="italic-editorial text-terracotta-soft"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {t("videosTitleEm")}
                  </span>
                  {t("videosTitlePart2")}
                </h2>
                <p className="text-mocha-fg/85 mt-6 max-w-2xl text-lg leading-relaxed">
                  {t("videosDescription")}
                </p>
              </div>
              <VideoTestimonials videos={VIDEO_TESTIMONIALS} />
            </FadeInOnView>
          </Container>
        </section>
      ) : null}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CASES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="bg-paper py-24 sm:py-28 lg:py-36">
        <Container>
          <FadeInOnView>
            <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  {t("casesEyebrow")}
                </p>
                <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                  {isFr ? "Des implémentations" : "Custom"}{" "}
                  <span
                    className="italic-editorial text-terracotta"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? "sur mesure" : "implementations"}
                  </span>
                </h2>
                <h3 className="text-fg-soft mt-4 text-lg leading-relaxed sm:text-xl">
                  {isFr
                    ? "Pensées pour vos besoins réels d'entreprise — pas des templates génériques."
                    : "Built around your real business needs — not generic templates."}
                </h3>
              </div>
              <Link
                href="/cas-concrets"
                className="text-primary inline-flex items-center gap-2 text-sm font-semibold hover:underline"
              >
                {t("casesCta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </FadeInOnView>
          {/* 2 cas concrets visuels — démos produit Axion-IA */}
          <ul className="mb-10 grid gap-6 lg:grid-cols-2">
            {(
              [
                {
                  src: "/images/axion-ia-pipeline-lead-ia-zero-intervention-humaine-7-etapes-banniere.avif",
                  industryFr: "Prospection B2B",
                  industryEn: "B2B prospecting",
                  metric: "0 min/lead",
                  titleFr: "Pipeline lead automatisé · 7 étapes",
                  titleEn: "Automated lead pipeline · 7 steps",
                  excerptFr:
                    "Du formulaire entrant au commercial : scoring IA, enrichissement, segmentation chaud/tiède/froid, routage CRM. Zéro intervention humaine jusqu'à la prise de contact.",
                  excerptEn:
                    "From incoming form to sales: AI scoring, enrichment, hot/warm/cold segmentation, CRM routing. Zero human intervention until first contact.",
                  altFr:
                    "Pipeline Axion-IA : 7 étapes automatisées du formulaire entrant au CRM (scoring IA, enrichissement, segmentation chaud/tiède/froid, routage).",
                  altEn:
                    "Axion-IA pipeline: 7 automated steps from incoming form to CRM (AI scoring, enrichment, hot/warm/cold segmentation, routing).",
                },
                {
                  src: "/images/axion-ia-planning-chantier-gantt-ia-conflits-detectes-temps-reel-banniere.avif",
                  industryFr: "BTP & construction",
                  industryEn: "Construction",
                  metric: "Conflits détectés J-7",
                  titleFr: "Planning Gantt IA · temps réel",
                  titleEn: "AI Gantt planning · real-time",
                  excerptFr:
                    "Chantier Résidence Les Pins, 15 tâches. Conflits de ressources et alertes météo détectés automatiquement avant qu'ils arrivent.",
                  excerptEn:
                    "Résidence Les Pins worksite, 15 tasks. Resource conflicts and weather alerts detected automatically before they happen.",
                  altFr:
                    "Planning Gantt Axion-IA : chantier Résidence Les Pins, 15 tâches, conflits de ressources détectés automatiquement, alertes météo.",
                  altEn:
                    "Axion-IA Gantt planning: Résidence Les Pins worksite, 15 tasks, automatically detected resource conflicts, weather alerts.",
                },
              ] as const
            ).map((demo, idx) => (
              <FadeInOnView key={idx} delay={idx * 80}>
                <li className="bg-bg border-border flex h-full flex-col overflow-hidden rounded-2xl border">
                  <div className="bg-paper">
                    <Image
                      src={demo.src}
                      alt={isFr ? demo.altFr : demo.altEn}
                      width={1600}
                      height={900}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="h-auto w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-4 p-6 sm:p-8">
                    <div className="flex items-center gap-2">
                      <span className="bg-sand text-fg-soft inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                        {isFr ? demo.industryFr : demo.industryEn}
                      </span>
                      <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                        {demo.metric}
                      </span>
                    </div>
                    <h3
                      className="text-fg text-2xl leading-[1.2] font-medium tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {isFr ? demo.titleFr : demo.titleEn}
                    </h3>
                    <p className="text-fg-soft text-base leading-relaxed">
                      {isFr ? demo.excerptFr : demo.excerptEn}
                    </p>
                  </div>
                </li>
              </FadeInOnView>
            ))}
          </ul>
        </Container>
      </section>

      {/* ───────────── CTA CONTACT — après cas clients ─────────────
          Après avoir vu des résultats concrets, inciter à passer à l'action.
          Section courte, directe, lien vers /contact (formulaire existant). */}
      <section className="bg-terracotta py-16 sm:py-20">
        <Container>
          <FadeInOnView>
            <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
              <div className="max-w-2xl">
                <h2
                  className="text-paper text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr
                    ? "Votre projet mérite une réponse concrète."
                    : "Your project deserves a concrete answer."}
                </h2>
                <p className="text-paper/85 mt-3 text-base leading-relaxed sm:text-lg">
                  {isFr
                    ? "Décrivez votre projet en 2 minutes. On vous répond sous 24h — sans engagement."
                    : "Describe your project in 2 minutes. We reply within 24h — no commitment."}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <Link
                  href="/reserver"
                  className="bg-paper text-terracotta cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/contact"
                  className="text-paper border-paper/40 hover:bg-paper/10 cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Nous contacter" : "Contact us"}
                </Link>
              </div>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── AUDIENCE + SECTEURS (Blueprint §11) ─────────────
          4 segments TPE/PME/ETI/Grande + nuage des secteurs. Texte
          riche en keywords pour AEO ("IA pour PME françaises", "cabinet
          IA grandes entreprises"…). */}
      <section className="bg-bg py-24 sm:py-28 lg:py-32">
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("audienceEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("audienceTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("audienceTitleEm")}
                </span>
                {t("audienceTitlePart2")}
              </h2>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed">
                {t("audienceDescription")}
              </p>
            </div>
          </FadeInOnView>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {audienceSegments.map((seg, idx) => (
              <FadeInOnView key={seg.id} delay={idx * 70}>
                <li className="bg-paper border-border hover:border-border-strong flex h-full flex-col gap-4 rounded-2xl border p-7 transition">
                  <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                    {seg.title}
                  </h3>
                  <p
                    className="text-terracotta text-base leading-snug italic"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {seg.lead}
                  </p>
                  <p className="text-fg-soft text-sm leading-relaxed">{seg.detail}</p>
                </li>
              </FadeInOnView>
            ))}
          </ul>
          {/* Nuage de secteurs (Blueprint §11 — éviter section séparée).
              Signal AEO fort : entités sectorielles indexées par LLM. */}
          <FadeInOnView>
            <div className="border-border-strong mt-16 border-t pt-12">
              <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                {t("audienceSectorsTitle")}
              </h3>
              <p className="text-fg-soft mt-3 max-w-2xl text-base leading-relaxed">
                {t("audienceSectorsLead")}
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {SECTORS.map((sector) => (
                  <li
                    key={sector}
                    className="bg-sand text-fg-soft inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium"
                  >
                    {sector}
                  </li>
                ))}
              </ul>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── BÉNÉFICES (ancienne image HOME-03 recréée en code) ─────────────
          Layout fidèle à la bannière : logo gauche / bénéfices droite / tagline bas. */}
      <section className="bg-paper py-16 sm:py-20">
        <Container>
          <FadeInOnView>
            <div className="border-border mx-auto max-w-5xl overflow-hidden rounded-3xl border">
              {/* Corps 2 colonnes */}
              <div className="grid lg:grid-cols-[1fr_2px_1.6fr]">
                {/* Colonne gauche : branding */}
                <div className="flex items-center justify-center px-10 py-16 lg:py-20">
                  <div className="text-center">
                    <p
                      className="text-fg text-[clamp(3rem,6vw,5rem)] leading-none font-bold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      Axion-<span className="text-terracotta">IA</span>
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <span className="bg-terracotta block h-px w-10" />
                      <p className="text-fg text-xl font-medium tracking-wide">.com</p>
                      <span className="bg-terracotta block h-px w-10" />
                    </div>
                  </div>
                </div>

                {/* Séparateur vertical */}
                <div className="bg-border hidden lg:block" />

                {/* Colonne droite : headline + 4 bénéfices */}
                <div className="px-10 py-10 lg:py-14">
                  <h2
                    className="text-fg text-[clamp(1.6rem,2.5vw,2.25rem)] leading-[1.15] font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Des <span className="text-terracotta italic">bénéfices</span> concrets,
                    <br />
                    mesurables, durables.
                  </h2>
                  <span className="bg-terracotta mt-4 mb-8 block h-0.5 w-10" />
                  <ul className="flex flex-col gap-6">
                    {[
                      {
                        Icon: TrendingUp,
                        title: isFr ? "GAIN DE TEMPS" : "TIME SAVINGS",
                        desc: isFr
                          ? "Automatisez les tâches répétitives et concentrez-vous sur l'essentiel."
                          : "Automate repetitive tasks and focus on what matters.",
                      },
                      {
                        Icon: Target,
                        title: isFr ? "MEILLEURE PRISE DE DÉCISION" : "BETTER DECISION-MAKING",
                        desc: isFr
                          ? "Exploitez la puissance des données pour des décisions plus éclairées."
                          : "Harness the power of data for more informed decisions.",
                      },
                      {
                        Icon: Lightbulb,
                        title: isFr ? "INNOVATION ACCÉLÉRÉE" : "ACCELERATED INNOVATION",
                        desc: isFr
                          ? "Libérez votre créativité et votre capacité d'innovation grâce à l'IA."
                          : "Unlock your creativity and innovation capacity through AI.",
                      },
                      {
                        Icon: Star,
                        title: isFr ? "PERFORMANCE DURABLE" : "LASTING PERFORMANCE",
                        desc: isFr
                          ? "Améliorez vos résultats tout en renforçant l'engagement et la satisfaction."
                          : "Improve results while strengthening engagement and satisfaction.",
                      },
                    ].map(({ Icon, title, desc }) => (
                      <li key={title} className="flex items-start gap-4">
                        <span className="border-terracotta text-terracotta flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-fg text-[11px] font-bold tracking-[0.15em] uppercase">
                            {title}
                          </p>
                          <p className="text-fg-soft mt-1 text-sm leading-relaxed">{desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Tagline bas */}
              <div className="border-border border-t py-5 text-center">
                <p className="text-fg-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
                  {isFr ? "Comprendre. Former. Transformer." : "Understand. Train. Transform."}
                </p>
              </div>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── COUVERTURE NATIONALE (SEO local) ─────────────
          Section « Disponibles partout en France » réutilisée des pages
          services (12 régions). Signal national fort sur la home — page
          la mieux positionnée du site. Service par défaut = audit
          (verticale phare, génère le plus de maillage régional). */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="Axion-IA"
        serviceLabelEn="Axion-IA"
        serviceSlug="audit"
        tone="sand"
      />

      {/* ─────────────── TESTIMONIALS — design premium étoiles + avatars ───────────────
          Cards avec rating 5 étoiles terracotta, avatar initiales, quote serif,
          identité auteur + entreprise. 6 témoignages en grid 3 col desktop. */}
      <section className="bg-paper py-24 sm:py-28 lg:py-36">
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("testimonialsEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("testimonialsTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("testimonialsTitleEm")}
                </span>
                {t("testimonialsTitlePart2")}
              </h2>
              {/* Rating moyen global */}
              <div className="mt-7 inline-flex flex-col items-center gap-2">
                <div className="flex items-center gap-1" aria-label="5 étoiles sur 5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      className="text-terracotta h-5 w-5 fill-current"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-fg-soft text-sm">
                  <span className="text-fg font-bold">4,9 / 5</span>
                  {isFr
                    ? " — basé sur les retours opérationnels"
                    : " — based on operational feedback"}
                </p>
              </div>
            </div>
          </FadeInOnView>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviewedCases.map((c, idx) => {
              const author = c[loc].testimonialAuthor;
              const initials = author
                .split(/\s+/)
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              // Gradients distincts par avatar pour effet « profils différents »
              const gradients = [
                "from-terracotta to-terracotta-deep",
                "from-sage to-sage/70",
                "from-primary to-primary/80",
                "from-mocha to-mocha-rich",
                "from-terracotta-soft to-terracotta",
              ] as const;
              const gradient = gradients[idx % gradients.length];
              return (
                <FadeInOnView key={c.slug} delay={idx * 80}>
                  <li className="bg-paper border-border shadow-subtle hover:shadow-card flex h-full flex-col gap-5 rounded-2xl border p-6 transition sm:p-7">
                    {/* Header : étoiles + badge vérifié */}
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-0.5"
                        aria-label={isFr ? "Note 5 étoiles sur 5" : "5-star rating"}
                      >
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Star
                            key={i}
                            className="text-terracotta h-4 w-4 fill-current"
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-tight uppercase">
                        <Shield className="h-3 w-3" aria-hidden="true" />
                        {isFr ? "Vérifié" : "Verified"}
                      </span>
                    </div>
                    {/* Métrique chiffrée en badge */}
                    <span className="bg-bg text-fg border-border inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold">
                      {c.metric}
                    </span>
                    {/* Quote */}
                    <blockquote
                      className="text-fg flex-1 text-base leading-[1.5] sm:text-lg"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      <span
                        className="text-terracotta mr-1 text-2xl leading-none"
                        aria-hidden="true"
                      >
                        &ldquo;
                      </span>
                      {c[loc].testimonialQuote}
                      <span
                        className="text-terracotta ml-0.5 text-2xl leading-none"
                        aria-hidden="true"
                      >
                        &rdquo;
                      </span>
                    </blockquote>
                    {/* Auteur : avatar gradient + nom + rôle + secteur */}
                    <footer className="border-border mt-2 flex items-center gap-3 border-t pt-4">
                      <span
                        className={cn(
                          "text-paper ring-paper relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-sm ring-2",
                          gradient,
                        )}
                        aria-hidden="true"
                      >
                        <span
                          className="text-base font-bold tracking-tight"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {initials}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-fg truncate text-sm font-bold">{author}</p>
                        <p className="text-fg-muted truncate text-xs">{c[loc].testimonialRole}</p>
                        <p className="text-terracotta truncate text-[11px] font-semibold">
                          {isFr ? c.industry : c.industryEn}
                        </p>
                      </div>
                    </footer>
                  </li>
                </FadeInOnView>
              );
            })}
          </ul>
          <p className="text-fg-muted mt-10 text-center text-xs leading-relaxed">
            {isFr
              ? "Témoignages collectés auprès de clients réels — noms et rôles publiés avec accord écrit. Photos en cours d'ajout."
              : "Testimonials collected from real clients — names and roles published with written consent. Photos being added."}
          </p>
        </Container>
      </section>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="bg-bg py-24 sm:py-28 lg:py-36">
        <Container className="max-w-3xl">
          <FadeInOnView>
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              FAQ
            </p>
            <h2 className="text-fg text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-semibold tracking-tight">
              {t("faqTitle")}
            </h2>
            <p className="text-fg-soft mt-4 text-base leading-relaxed">{t("faqDescription")}</p>
            <div className="mt-12">
              <Accordion type="single" collapsible>
                {faqs.map((f) => (
                  <AccordionItem key={f.id} value={f.id}>
                    <AccordionTrigger>{f.question}</AccordionTrigger>
                    <AccordionContent>{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CTA FINAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="bg-mocha-rich text-mocha-fg relative overflow-hidden py-24 sm:py-28 lg:py-36">
        <Container>
          <div className="max-w-3xl">
            <p className="text-mocha-fg/70 mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              {t("ctaBlockEyebrow")}
            </p>
            <h2 className="text-mocha-fg text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] font-semibold tracking-tight">
              {t("ctaBlockTitlePart1")}{" "}
              <span
                className="text-terracotta-soft italic"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                {t("ctaBlockTitleEm")}
              </span>
              {t("ctaBlockTitlePart2")}
            </h2>
            <p className="text-mocha-fg/85 mt-6 max-w-2xl text-lg leading-relaxed">
              {t("ctaBlockDescription")}
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/interventions/essentielle"
                className="bg-paper text-fg cta-lift focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex h-14 items-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {t("ctaBlockPrimary")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="text-mocha-fg border-border-on-mocha cta-lift focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex h-14 items-center gap-2 rounded-full border px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {t("ctaBlockSecondary")}
              </Link>
            </div>
            {/* Micro-proofs sous le CTA final — Blueprint §16. 3 promesses
                courtes séparées par points médians. Rassurance ultime. */}
            <p className="text-mocha-fg/70 mt-8 text-sm leading-relaxed">
              {t("ctaBlockMicroProofs")}
            </p>
          </div>
        </Container>
      </section>

      <JsonLd data={faqJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={servicesJsonLd} />
      <JsonLd data={aggregateRatingJsonLd} />
      {reviewsJsonLd.length > 0 ? <JsonLd data={reviewsJsonLd} /> : null}
      {videosJsonLd.length > 0 ? <JsonLd data={videosJsonLd} /> : null}

      {/* ───────────── STICKY MOBILE CTA (Blueprint §19) ─────────────
          Bouton fixé bas d'écran sur mobile, apparaît après scroll > 600 px.
          Disparaît à 320 px du bottom (laisse place au CTA final natif).
          rAF dedup pour INP < 100 ms (cf. perf budget). */}
      <StickyMobileCta
        href="/interventions/essentielle"
        label={t("heroCtaPrimary", { price: interventionEntryPrice })}
        track="home-sticky-mobile"
        threshold={600}
      />
    </>
  );
}
