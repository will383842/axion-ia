import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  TrendingUp,
  Target,
  Star,
  User,
  Users,
  Layers,
  MapPin,
  BadgeCheck,
  Search,
  GraduationCap,
  Cog,
  Brain,
  Rocket,
  Shield,
  Clock,
  Plus,
  Sparkles,
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
import { ImageLightbox } from "@/components/ui/ImageLightbox";
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
      ? `Cabinet IA 100 % seniors, zéro intermédiaire. Formations, audits chiffrés, coaching 1-to-1 et implémentations pour TPE, PME et ETI. Résultats mesurables, hébergement UE, à partir de ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "fr", { compact: true })}.`
      : `Senior-only AI consultancy, zero middlemen. Training, costed audits, 1-to-1 coaching and implementation for SMBs and mid-market firms. Measurable results, EU hosting, from ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "en", { compact: true })}.`,
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
  const auditEntryPrice = formatAmount(getEntryPriceEur(AUDIT_TIERS) ?? 0, loc, {
    compact: true,
  });
  const unAUnEntryPrice = formatAmount(getEntryPriceEur(UN_A_UN_TIERS) ?? 0, loc, {
    compact: true,
  });
  // Plateforme web augmentée IA : pas de TIERS dédié dans pricing.ts SSOT
  // → on s'aligne sur le prix d'entrée implémentation (porte d'entrée la
  // plus proche en coût/durée). Will pourra ajouter un WEB_TIERS dédié plus tard.
  const webEntryPrice = implEntryPrice;

  // 5 services — Blueprint 2026 (Section 4) : Formations / 1-to-1 / Audits /
  // Implémentations / Plateforme web & SaaS.
  // Refonte cartes 2026-05-24 (Will) : charte brand stricte (terracotta dominant,
  // bleu uniquement pointes), titres XL serif impactants, offre claire.
  // Plus de rotation accents — brand-coherence avant tout (ces 5 cartes = CA).
  const valuePropositions = [
    {
      id: "intervene",
      emoji: "🎓",
      shortName: isFr ? "Formations" : "Training",
      tagline: isFr ? "IA en entreprise" : "AI for companies",
      headline: t("value1Headline"),
      priceLabel: isFr
        ? `À partir de ${interventionEntryPrice} HT`
        : `From ${interventionEntryPrice} excl. tax`,
      gain: t("value1Gain"),
      href: "/interventions" as const,
    },
    {
      id: "coach",
      emoji: "🧑‍💼",
      shortName: isFr ? "1-to-1" : "1-to-1",
      tagline: isFr ? "Coaching individuel" : "Personal coaching",
      headline: t("value4Headline"),
      priceLabel: isFr
        ? `À partir de ${unAUnEntryPrice} HT`
        : `From ${unAUnEntryPrice} excl. tax`,
      gain: t("value4Gain"),
      href: "/un-a-un" as const,
    },
    {
      id: "audit",
      emoji: "🔍",
      shortName: isFr ? "Audits" : "Audits",
      tagline: isFr ? "Diagnostic & roadmap" : "Diagnosis & roadmap",
      headline: t("value2Headline"),
      priceLabel: isFr
        ? `À partir de ${auditEntryPrice} HT`
        : `From ${auditEntryPrice} excl. tax`,
      gain: t("value2Gain"),
      href: "/audit" as const,
    },
    {
      id: "implement",
      emoji: "⚙️",
      shortName: isFr ? "Implémentations" : "Implementation",
      tagline: isFr ? "Automatisations sur mesure" : "Custom automation",
      headline: t("value3Headline"),
      priceLabel: isFr
        ? `À partir de ${implEntryPrice} HT`
        : `From ${implEntryPrice} excl. tax`,
      gain: t("value3Gain"),
      href: "/implementation" as const,
    },
    {
      id: "web",
      emoji: "🌐",
      shortName: isFr ? "Plateforme web & SaaS" : "Web platform & SaaS",
      tagline: isFr ? "Sites & apps augmentés IA" : "AI-augmented sites & apps",
      headline: t("value5Headline"),
      priceLabel: isFr
        ? `À partir de ${webEntryPrice} HT`
        : `From ${webEntryPrice} excl. tax`,
      gain: t("value5Gain"),
      href: "/sites-web-augmentes" as const,
    },
  ];

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

  // ─── FAQ — sélection home (12 questions essentielles + 4 géo) ───
  // FAQ_GLOBAL contient ~30+ questions exhaustives. Sur la home, on affiche
  // un sous-ensemble pertinent pour ne pas surcharger la page :
  // 4 géo (couverture France/international) + 8 essentielles (définition,
  // démarrage, coût, ROI, sécurité, délai, IA vs équipes, AI Act).
  // Le reste est accessible via /faq (page dédiée).
  const HOME_FAQ_IDS = [
    "geo-france",
    "geo-metropoles",
    "geo-tpe-rural",
    "geo-distance-international",
    "definition",
    "comment-commencer",
    "delai-implementation",
    "cout-projet-ia-pme",
    "ia-remplace-salaries",
    "confidentialite-projet-ia",
    "roi-mesurer",
    "ai-act-2026",
  ] as const;
  const faqs = HOME_FAQ_IDS.map((id) => FAQ_GLOBAL.find((f) => f.id === id))
    .filter((f): f is (typeof FAQ_GLOBAL)[number] => f !== undefined)
    .map((f) => ({
      id: f.id,
      question: f[loc].question,
      answer: f[loc].answer,
    }));

  // JSON-LD homepage. Organization déjà émis layout-level via
  // `buildOrganizationJsonLd` (riche : sameAs + contactPoint + areaServed +
  // foundingLocation + knowsLanguage). Pas de re-émission ici (signal Google
  // "double Organization" ambigu). Le FAQ utilise `buildFaqSpeakableJsonLd`
  // pour activer la voix (Google Assistant + Alexa + Bixby — AEO 2026).
  // `additionalSelectors` étend la couverture Speakable au hero (h1 + intro)
  // pour que voice search lise le brand statement avant les Q+R (cf. audit P1-1
  // 2026-05-24 : sans ça, Google Assistant ne lit que la FAQ, jamais le hero).
  const faqJsonLd = buildFaqSpeakableJsonLd({
    items: faqs,
    additionalSelectors: ["[data-speakable-hero]"],
  });

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
  // Service x5 — provider référence l'Organization émise layout-level via @id
  // (knowledge graph LLM-friendly : Organization → Service → Offer cohérent vs
  // chaque Service îlot avec provider string dupliqué). Cf. audit AEO 2026-05-24.
  // name : combine shortName + tagline pour signal AEO clair ("Formations · IA en entreprise")
  const servicesJsonLd = valuePropositions.map((v) => ({
    "@context": "https://schema.org",
    "@type": "Service" as const,
    name: `${v.shortName} · ${v.tagline}`,
    description: v.gain,
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: "FR",
    serviceType: v.shortName,
    url: `${SITE_URL}${SERVICE_PATHS[v.id] ?? "/"}`,
  }));

  // 2) Reviewed cases — utilisés pour le rendu visuel des testimonials.
  // AggregateRating + Review[] JSON-LD RETIRÉS (audit perfection mai 2026) :
  // - Google exige n ≥ 5 avis vérifiables avec datePublished
  // - Photos clients pas encore disponibles (autorisations en cours)
  // → Risque "trompeur" si on émet un JSON-LD avec données factices.
  // Ré-activer quand Will aura collecté ≥ 5 vrais avis avec accord écrit + dates.
  const reviewedCases = CASE_STUDIES.filter((c) => c[loc].testimonialQuote);

  // BreadcrumbList JSON-LD : ABSENT volontairement sur la home (convention 2026 :
  // la home EST la racine hiérarchique → un BL self-referencing 1-item est un
  // anti-pattern Google. Les pages enfants émettent leur BL via buildBreadcrumbJsonLd).
  // Cf. audit perfection A4 2026-05-24.

  // 3) VideoObject[] — un schema par vidéo témoignage. Vide si pas de vidéos
  //    (section masquée côté JSX → schema absent aussi, cohérent).
  //    `datePublished` requis sur VideoTestimonial pour signal fraîcheur honnête.
  const videosJsonLd = VIDEO_TESTIMONIALS.map((v) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject" as const,
    name: v.title,
    description: `« ${v.quote} » — ${v.author}, ${v.role}, ${v.company}`,
    thumbnailUrl: v.thumbnail ?? `https://i.ytimg.com/vi/${v.youtubeId}/maxresdefault.jpg`,
    uploadDate: v.datePublished,
    ...(v.duration ? { duration: v.duration } : {}),
    contentUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.youtubeId}`,
  }));

  return (
    <>
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32"
      >
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche : copy (titre garde sa taille géante) */}
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-8 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("heroEyebrow")}
              </p>
              <h1 id="hero-heading" className="display-editorial text-fg" data-speakable-hero>
                {t("heroTitlePart1")}{" "}
                <em className="italic-editorial text-terracotta not-italic">
                  <span className="italic">{t("heroTitleEm")}</span>
                </em>
                {t("heroTitlePart2")}
              </h1>
              <p
                className="text-fg-soft mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl"
                data-speakable-hero
              >
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
                src="/illustrations/home-hero-equipe.avif"
                aspectRatio="1:1"
                filenameTarget="public/illustrations/home-hero-equipe.avif"
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
      <section
        id="services"
        aria-labelledby="services-heading"
        className="bg-paper relative py-20 sm:py-24 lg:py-28"
      >
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-14 max-w-5xl text-center">
              <p className="text-terracotta mb-5 text-sm font-bold tracking-[0.2em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-2 w-2 rounded-full align-middle" />
                {t("valueEyebrow")}
              </p>
              <h2
                id="services-heading"
                className="text-fg text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.98] font-semibold tracking-tight"
              >
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

          {/* 5 cartes services — refonte 2026-05-24 (Will feedback) :
              - charte brand stricte : bg-paper (ivoire), accent terracotta UNIFIÉ
                (vs ancien rainbow terracotta/primary/sage)
              - TITRES service forts en serif XL (Formations / 1-to-1 / Audits /
                Implémentations / Plateforme web & SaaS) — domination visuelle
              - prix d entrée mis en avant (signal CA direct)
              - icône emoji dans cercle terracotta-soft (subtil)
              - "Découvrir le service →" terracotta hover-deep
              - hover : card lift + shadow + border terracotta */}
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-5">
            {valuePropositions.map((v, idx) => (
              <FadeInOnView key={v.id} delay={idx * 80}>
                <li className="h-full">
                  <Link
                    href={v.href}
                    className="group bg-paper border-border hover:border-terracotta hover:shadow-elevated relative flex h-full flex-col overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:outline-none md:p-7"
                  >
                    {/* Stripe terracotta top — accent brand uniforme */}
                    <span
                      aria-hidden="true"
                      className="bg-terracotta absolute inset-x-0 top-0 h-1.5 origin-left transition-transform duration-300 group-hover:scale-x-[1.0]"
                    />

                    {/* Icône emoji dans cercle terracotta-soft */}
                    <span
                      className="bg-terracotta-soft mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full text-3xl transition-transform duration-300 group-hover:scale-110"
                      aria-hidden="true"
                    >
                      {v.emoji}
                    </span>

                    {/* TITRE service XL — la chose la plus visible de la card */}
                    <h3
                      className="text-fg text-[clamp(1.75rem,2.5vw,2.5rem)] leading-[1.02] font-semibold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {v.shortName}
                    </h3>
                    <p className="text-terracotta mt-1 text-sm font-semibold tracking-tight">
                      {v.tagline}
                    </p>

                    {/* Description courte */}
                    <p className="text-fg-soft mt-4 text-sm leading-relaxed">
                      {v.headline}
                    </p>

                    {/* Prix d entrée — signal CA direct */}
                    <p
                      className="text-fg mt-5 text-base font-bold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {v.priceLabel}
                    </p>

                    {/* Spacer flex */}
                    <div className="flex-1" />

                    {/* CTA Découvrir terracotta */}
                    <span className="border-border text-terracotta group-hover:border-terracotta group-hover:text-terracotta-deep mt-6 inline-flex items-center gap-2 border-t pt-4 text-sm font-semibold transition-colors">
                      {t("valueCardCta")}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              </FadeInOnView>
            ))}
          </ul>
        </Container>
      </section>

      {/* ───────────── LOGOS CLIENTS — header retiré (polish v8 Will) ─────────────
          Juste les 17 logos, pas de eyebrow/title/caption. Box normalisée
          dans LogosMarquee pour que tous les logos paraissent à la même
          taille visuelle (object-contain dans container fixe). */}
      <section id="clients" aria-label={isFr ? "Nos clients" : "Our clients"} className="bg-bg border-border border-t border-b py-12 sm:py-16">
        <Container>
          <LogosMarquee logos={CLIENT_LOGOS} />
        </Container>
      </section>

      {/* ───────────── BANDEAU ÉQUIPE 4 PHOTOS — full-bleed ─────────────
          Hors Container pour aller bord-à-bord sans cadre blanc latéral. */}
      <section className="bg-bg">
        <Image
          src="/illustrations/home-bandeau-team.avif"
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
          Photo placeholder : drop `public/illustrations/home-founder-william.avif`. */}
      <section
        id="founder"
        aria-labelledby="founder-heading"
        className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28"
      >
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
                  id="founder-heading"
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
                {/* Lien contextuel /a-propos (audit P0-4 internal linking 2026-05-24) */}
                <p className="mt-6">
                  <Link
                    href="/a-propos"
                    className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {isFr ? "Découvrir notre approche complète" : "Discover our full approach"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </p>
              </div>

              {/* Colonne droite : carte fondateur */}
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-xs">
                  <Illustration
                    slot="HOME-04-founder"
                    src="/illustrations/home-founder-william.avif"
                    aspectRatio="4:5"
                    filenameTarget="public/illustrations/home-founder-william.avif"
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

      {/* ─────────────── GRILLE TARIFAIRE — TABLEAU SINGLE-BLOCK 5 SERVICES ───────────────
          Refonte (Will 2026-05-24 v2) : un seul bloc moderne avec les 5 services
          dans un tableau aligné. Plus dense, plus lisible, plus pro qu'un grid 3 cards.
          Prix dérivés du SSOT pricing.ts (interventionEntry/auditFlash/unAUn/impl/web).
          Mobile : cartes empilées. Desktop : table row + colonnes (SERVICE / CATÉGORIE / INCLUS / PRIX). */}
      <section
        id="pricing"
        aria-labelledby="pricing-heading"
        className="bg-paper py-24 sm:py-28 lg:py-32"
      >
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Tarifs transparents" : "Transparent pricing"}
              </p>
              <h2
                id="pricing-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
                {isFr ? "Un prix de départ " : "A starting price "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "pour chaque service." : "for every service."}
                </span>
              </h2>
              <p className="text-fg-soft mx-auto mt-5 max-w-2xl text-lg leading-relaxed">
                {isFr
                  ? "Chaque projet est unique — la complexité dépend de votre infrastructure, de vos process et de votre maturité IA. Voici les prix de départ par service. Le devis précis se construit ensemble, après diagnostic."
                  : "Every project is unique — complexity depends on your infrastructure, your processes and your AI maturity. Below are the starting prices per service. The precise quote is built together, after diagnosis."}
              </p>
            </div>
          </FadeInOnView>

          {/* ─── TABLEAU SINGLE-BLOCK — desktop ≥ md, cards stacked mobile ─── */}
          <FadeInOnView>
            <div className="mx-auto max-w-6xl">
              <div
                role="table"
                aria-label={isFr ? "Grille tarifaire des cinq services" : "Pricing grid of five services"}
                className="bg-paper border-border shadow-elevated overflow-hidden rounded-3xl border"
              >
                {/* En-tête colonnes (desktop seulement) */}
                <div
                  role="row"
                  className="bg-sand text-fg-muted hidden border-b border-border px-8 py-4 text-[11px] font-bold tracking-[0.18em] uppercase md:grid md:grid-cols-[2.2fr_1fr_2.4fr_1.3fr] md:items-center md:gap-6"
                >
                  <span role="columnheader">{isFr ? "Service" : "Service"}</span>
                  <span role="columnheader">{isFr ? "Catégorie" : "Category"}</span>
                  <span role="columnheader">{isFr ? "Inclus" : "Included"}</span>
                  <span role="columnheader" className="text-right">{isFr ? "Prix HT" : "Price excl. tax"}</span>
                </div>

                {/* 5 lignes services */}
                {(
                  [
                    {
                      id: "formation",
                      dotColor: "bg-terracotta",
                      badgeBg: "bg-terracotta-soft",
                      badgeFg: "text-terracotta-deep",
                      nameFr: "Formation IA",
                      nameEn: "AI Training",
                      subFr: "Présentiel · À partir d'une demi-journée",
                      subEn: "On-site · From a half-day",
                      categoryFr: "Formation",
                      categoryEn: "Training",
                      includesFr: "Ateliers métier · Sur site · Groupes 1–30 pers.",
                      includesEn: "Business workshops · On-site · Groups of 1–30",
                      price: interventionEntryPrice,
                      href: "/interventions" as const,
                    },
                    {
                      id: "audit",
                      dotColor: "bg-primary",
                      badgeBg: "bg-primary-soft",
                      badgeFg: "text-primary",
                      nameFr: "Audit IA",
                      nameEn: "AI Audit",
                      subFr: "Présentiel ou distanciel",
                      subEn: "On-site or remote",
                      categoryFr: "Audit",
                      categoryEn: "Audit",
                      includesFr: "Diagnostic process · Gains chiffrés · Roadmap 6–12 mois",
                      includesEn: "Process diagnosis · Quantified gains · 6–12 month roadmap",
                      price: auditEntryPrice,
                      href: "/audit" as const,
                    },
                    {
                      id: "coaching",
                      dotColor: "bg-sage",
                      badgeBg: "bg-sage-soft",
                      badgeFg: "text-sage",
                      nameFr: "Coaching 1-to-1",
                      nameEn: "1-to-1 Coaching",
                      subFr: "Par session · Dirigeant ou collaborateur",
                      subEn: "Per session · Executive or staff",
                      categoryFr: "Coaching",
                      categoryEn: "Coaching",
                      includesFr: "Sessions individuelles · Automatisations live · ROI J+1",
                      includesEn: "Individual sessions · Live automations · ROI day-one",
                      price: unAUnEntryPrice,
                      href: "/un-a-un" as const,
                    },
                    {
                      id: "implementation",
                      dotColor: "bg-terracotta-deep",
                      badgeBg: "bg-terracotta-soft",
                      badgeFg: "text-terracotta-deep",
                      nameFr: "Implémentation IA",
                      nameEn: "AI Implementation",
                      subFr: "Sur mesure · Projets clés en main",
                      subEn: "Custom · Turnkey projects",
                      categoryFr: "Implémentation",
                      categoryEn: "Implementation",
                      includesFr: "Automatisations · Intégration CRM/ERP · Support 90j",
                      includesEn: "Automations · CRM/ERP integration · 90-day support",
                      price: implEntryPrice,
                      href: "/implementation" as const,
                    },
                    {
                      id: "web",
                      dotColor: "bg-primary",
                      badgeBg: "bg-primary-soft",
                      badgeFg: "text-primary",
                      nameFr: "Plateforme web / SaaS IA",
                      nameEn: "AI Web Platform / SaaS",
                      subFr: "Sur devis · Plateformes IA dédiées",
                      subEn: "Quote · Dedicated AI platforms",
                      categoryFr: "Plateforme",
                      categoryEn: "Platform",
                      includesFr: "Web IA sur mesure · Reco & search natifs · RGPD Europe",
                      includesEn: "Custom AI web · Native reco & search · EU GDPR",
                      price: webEntryPrice,
                      href: "/sites-web-augmentes" as const,
                    },
                  ] as const
                ).map((s, idx) => (
                  <Link
                    key={s.id}
                    href={s.href}
                    role="row"
                    className={cn(
                      "group hover:bg-sand/50 focus-visible:bg-sand/70 focus-visible:outline-none relative grid items-center gap-4 px-6 py-6 transition-colors md:grid-cols-[2.2fr_1fr_2.4fr_1.3fr] md:gap-6 md:px-8 md:py-7",
                      idx > 0 && "border-border border-t",
                    )}
                  >
                    {/* Colonne 1 — Service (dot + nom + sub) */}
                    <div role="cell" className="flex items-start gap-3 md:items-center">
                      <span
                        className={cn(
                          "mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full md:mt-0",
                          s.dotColor,
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-fg text-base font-bold leading-tight sm:text-lg">
                          {isFr ? s.nameFr : s.nameEn}
                        </p>
                        <p className="text-fg-muted mt-1 text-xs leading-snug sm:text-sm">
                          {isFr ? s.subFr : s.subEn}
                        </p>
                      </div>
                    </div>

                    {/* Colonne 2 — Catégorie (badge pill) */}
                    <div role="cell" className="md:flex md:items-center">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                          s.badgeBg,
                          s.badgeFg,
                        )}
                      >
                        {isFr ? s.categoryFr : s.categoryEn}
                      </span>
                    </div>

                    {/* Colonne 3 — Inclus */}
                    <div role="cell" className="text-fg-soft text-sm leading-relaxed">
                      {isFr ? s.includesFr : s.includesEn}
                    </div>

                    {/* Colonne 4 — Prix HT + flèche */}
                    <div
                      role="cell"
                      className="flex items-center justify-between gap-3 md:justify-end"
                    >
                      <div className="text-right">
                        <p
                          className="text-fg text-xl font-bold tracking-tight sm:text-2xl"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {s.price}
                        </p>
                        <p className="text-fg-muted text-[11px] leading-snug">
                          {isFr ? "à partir de" : "starting at"}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="bg-paper border-border text-fg-soft group-hover:border-terracotta group-hover:bg-terracotta group-hover:text-paper inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all"
                      >
                        <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </FadeInOnView>
          <p className="text-fg-muted mt-10 text-center text-sm leading-relaxed">
            {isFr ? (
              <>
                Pas sûr du bon service pour vous ?{" "}
                <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                  Parlons-en
                </Link>{" "}
                — on prend le temps d'écouter, d'analyser votre contexte et de
                vous proposer la solution la plus adaptée. Sans engagement.
              </>
            ) : (
              <>
                Not sure which service fits?{" "}
                <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                  Let's discuss
                </Link>{" "}
                — we take the time to listen, analyse your context and propose
                the best-fit solution. No commitment.
              </>
            )}
          </p>
          {/* Lien contextuel /methodologie (audit P0-4 internal linking 2026-05-24) */}
          <p className="text-fg-muted mt-4 text-center text-sm leading-relaxed">
            <Link
              href="/methodologie"
              className="text-terracotta inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              {isFr ? "Voir notre méthode en 4 étapes" : "See our 4-step method"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </p>
        </Container>
      </section>

      {/* ─────────────── POURQUOI AXION-IA — design éditorial v2 ───────────────
          Refonte from-scratch (Will 2026-05-23) : hiérarchie claire en 4 blocs
          visuels distincts au lieu d'une infographie compacte surchargée.
          1. Header (eyebrow + h2 + lead)
          2. 6 différenciateurs en grid 3×2 éditoriale (numéros géants serif)
          3. Modularité — 6 capacités en bandeau horizontal (sans répétition)
          4. Trust signals + tagline finale */}
      <section
        id="why"
        aria-labelledby="why-heading"
        className="bg-halo-cool relative py-24 sm:py-28 lg:py-32"
      >
        <Container>
          {/* BLOC 1 — Header */}
          <FadeInOnView>
            <div className="mx-auto mb-20 max-w-3xl text-center sm:mb-24">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Ce qui nous distingue" : "What sets us apart"}
              </p>
              <h2
                id="why-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
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

          {/* BLOC 2 — 6 différenciateurs en grid 3×2 avec hero band coloré rotatif
              Design v3 : chaque carte a un en-tête couleur pleine avec icône
              proéminente + numéro géant serif, body blanc, hover lift + scale. */}
          <ul className="mb-24 grid gap-5 sm:mb-28 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {(
              [
                {
                  num: "01",
                  Icon: Users,
                  bandClass: "bg-terracotta",
                  bandText: "text-paper",
                  accentBg: "bg-terracotta-soft",
                  accentText: "text-terracotta-deep",
                  titleFr: "Zéro intermédiaire",
                  titleEn: "Zero middleman",
                  descFr: "Formateurs, développeurs, implémenteurs — tous seniors, tous en interne.",
                  descEn: "Trainers, developers, implementers — all senior, all in-house.",
                  accentFr: "De l'audit à la mise en prod.",
                  accentEn: "From audit to production.",
                },
                {
                  num: "02",
                  Icon: Layers,
                  bandClass: "bg-sage",
                  bandText: "text-paper",
                  accentBg: "bg-sage/15",
                  accentText: "text-sage",
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
                  bandClass: "bg-primary",
                  bandText: "text-paper",
                  accentBg: "bg-primary/15",
                  accentText: "text-primary",
                  titleFr: "Partout en France",
                  titleEn: "Across France",
                  descFr: "Présence dans toutes les villes — métropole et outre-mer.",
                  descEn: "Presence in every city — mainland and overseas.",
                  accentFr: "Présentiel ou à distance — selon ce qui est le plus efficace.",
                  accentEn: "On-site or remote — whichever is most effective.",
                },
                {
                  num: "04",
                  Icon: BadgeCheck,
                  bandClass: "bg-mocha-rich",
                  bandText: "text-paper",
                  accentBg: "bg-mocha-rich/10",
                  accentText: "text-mocha-rich",
                  titleFr: "Vous parlez au senior",
                  titleEn: "You talk to the senior",
                  descFr: "Pas à un commercial. Pas à un junior.",
                  descEn: "Not to sales. Not to a junior.",
                  accentFr: "Directement à celui qui fait le travail.",
                  accentEn: "Directly to the person doing the work.",
                },
                {
                  num: "05",
                  Icon: Target,
                  bandClass: "bg-terracotta",
                  bandText: "text-paper",
                  accentBg: "bg-terracotta-soft",
                  accentText: "text-terracotta-deep",
                  titleFr: "Vous êtes au centre",
                  titleEn: "You're at the center",
                  descFr: "Votre projet, votre rythme, votre contexte.",
                  descEn: "Your project, your pace, your context.",
                  accentFr: "On s'adapte à vous — jamais l'inverse.",
                  accentEn: "We adapt to you — never the reverse.",
                },
                {
                  num: "06",
                  Icon: Sparkles,
                  bandClass: "bg-sage",
                  bandText: "text-paper",
                  accentBg: "bg-sage/15",
                  accentText: "text-sage",
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
                <li className="bg-paper border-border shadow-subtle hover:shadow-card group flex h-full flex-col overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1">
                  {/* Hero band coloré : icône XL + numéro géant serif + SVG pattern décoratif */}
                  <div
                    className={cn(
                      "relative flex items-center justify-between overflow-hidden px-6 py-7 sm:px-7 sm:py-8",
                      card.bandClass,
                    )}
                  >
                    {/* SVG décoratif : 3 cercles concentriques en filigrane */}
                    <svg
                      aria-hidden="true"
                      className="text-paper/10 pointer-events-none absolute -right-8 -bottom-8 h-32 w-32 select-none sm:h-40 sm:w-40"
                      viewBox="0 0 100 100"
                      fill="none"
                    >
                      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1" />
                      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="1" />
                      <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="1" />
                    </svg>
                    {/* Icône dans cercle blanc proéminent */}
                    <span
                      className={cn(
                        "bg-paper relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16",
                        card.accentText,
                      )}
                      aria-hidden="true"
                    >
                      <card.Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
                    </span>
                    {/* Numéro géant serif */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative z-10 text-[4rem] leading-none font-bold tabular-nums sm:text-[5rem]",
                        card.bandText,
                        "opacity-90",
                      )}
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {card.num}
                    </span>
                  </div>
                  {/* Body : title + description + accent badge */}
                  <div className="flex flex-1 flex-col gap-4 p-6 sm:p-7">
                    <h3
                      className="text-fg text-[1.5rem] leading-tight font-semibold tracking-tight sm:text-[1.7rem]"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {isFr ? card.titleFr : card.titleEn}
                    </h3>
                    <p className="text-fg-soft text-base leading-relaxed">
                      {isFr ? card.descFr : card.descEn}
                    </p>
                    {/* Accent ribbon — pill colorée avec coche */}
                    <div
                      className={cn(
                        "mt-auto inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5",
                        card.accentBg,
                      )}
                    >
                      <span
                        className={cn("inline-block h-1 w-3 rounded-full", card.bandClass)}
                        aria-hidden="true"
                      />
                      <p className={cn("text-xs leading-snug font-semibold", card.accentText)}>
                        {isFr ? card.accentFr : card.accentEn}
                      </p>
                    </div>
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
                {/* Promu h3 → h2 (audit A4 2026-05-24 : pas de h3 orpheline sans h2 parent) */}
                <h2
                  className="text-fg text-[clamp(1.5rem,3vw,2.25rem)] leading-tight font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Six expertises. " : "Six expertises. "}
                  <span className="text-terracotta italic">
                    {isFr ? "Indépendantes ou combinées." : "Independent or combined."}
                  </span>
                </h2>
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
                <h2
                  id="videos-heading"
                  className="text-mocha-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
                >
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
      <section
        id="cases"
        aria-labelledby="cases-heading"
        className="bg-paper py-24 sm:py-28 lg:py-36"
      >
        <Container>
          <FadeInOnView>
            <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  {t("casesEyebrow")}
                </p>
                <h2
                  id="cases-heading"
                  className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
                >
                  {isFr ? "Des implémentations" : "Custom"}{" "}
                  <span
                    className="italic-editorial text-terracotta"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? "sur mesure" : "implementations"}
                  </span>
                </h2>
                <p className="text-fg-soft mt-4 text-lg leading-relaxed sm:text-xl">
                  {isFr
                    ? "Pensées pour vos besoins réels d'entreprise — pas des templates génériques."
                    : "Built around your real business needs — not generic templates."}
                </p>
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
          {/* 4 cas concrets visuels — 4 cards sur 1 ligne dès md (768px+),
              photos compactes via aspect-ratio 16/9 forcé + object-cover.
              (Will 2026-05-24 : "réduire grosseur images, toutes sur 1 ligne desktop") */}
          <ul className="mb-10 grid gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
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
                {
                  src: "/images/axion-ia-recrutement-ia-8-semaines-a-3-semaines-80-pourcent-automatise-banniere.avif",
                  industryFr: "Ressources humaines",
                  industryEn: "Human resources",
                  metric: "8 sem → 3 sem · 80% auto",
                  titleFr: "Recrutement IA · cycle divisé par 2,5",
                  titleEn: "AI recruitment · cycle divided by 2.5",
                  excerptFr:
                    "Publication multi-plateformes, collecte CVs, scoring et classement, fiche candidat auto, convocations, CR entretien, contrat rédigé. RH ne valide que la shortlist et conduit les entretiens.",
                  excerptEn:
                    "Multi-platform posting, CV collection, scoring and ranking, auto candidate sheet, invites, interview report, contract draft. HR only validates the shortlist and conducts interviews.",
                  altFr:
                    "Schéma 3 couloirs Axion-IA : système IA (publication, collecte CV, scoring, fiche, convocation, CR, contrat), RH (validation shortlist, entretiens, signature), candidat. 8 semaines → 3 semaines, 80% des tâches automatisées.",
                  altEn:
                    "Axion-IA 3-lane diagram: AI system (posting, CV collection, scoring, sheet, invitation, report, contract), HR (shortlist validation, interviews, signature), candidate. 8 weeks → 3 weeks, 80% of tasks automated.",
                },
                {
                  src: "/images/axion-ia-architecture-groupe-international-consolidation-financiere-rh-banniere.avif",
                  industryFr: "Groupe international",
                  industryEn: "International group",
                  metric: "3 sem → J+1 · 278 salariés",
                  titleFr: "Consolidation groupe 4 pays · IA continue",
                  titleEn: "4-country group consolidation · continuous AI",
                  excerptFr:
                    "France, Allemagne, Singapour, Brésil. Comptabilité, paie, supply chain, RH et compliance temps réel. Le cerveau IA agrège les 4 moteurs, détecte les anomalies cross-entités et génère le rapport consolidé J+1.",
                  excerptEn:
                    "France, Germany, Singapore, Brazil. Real-time accounting, payroll, supply chain, HR and compliance. AI brain aggregates the 4 engines, detects cross-entity anomalies and generates the consolidated report on D+1.",
                  altFr:
                    "Architecture groupe international Axion-IA : 4 entités (France siège, Allemagne production, Singapour Asie hub, Brésil commercial), tableau de bord groupe temps réel, cerveau IA central, consolidation financière 4 devises, compliance multi-juridictions, supply chain intelligente, RH groupe centralisé.",
                  altEn:
                    "Axion-IA international group architecture: 4 entities (France HQ, Germany production, Singapore Asia hub, Brazil commercial), real-time group dashboard, central AI brain, 4-currency financial consolidation, multi-jurisdiction compliance, intelligent supply chain, centralized group HR.",
                },
              ] as const
            ).map((demo, idx) => (
              <FadeInOnView key={idx} delay={idx * 60}>
                <li className="bg-bg border-border flex h-full flex-col overflow-hidden rounded-2xl border">
                  <ImageLightbox
                    src={demo.src}
                    alt={isFr ? demo.altFr : demo.altEn}
                    width={1600}
                    height={900}
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                    className="rounded-none rounded-t-2xl [&_figure]:aspect-[16/10] [&_figure]:overflow-hidden [&_figure>img]:!h-full [&_figure>img]:!w-full [&_figure>img]:!object-cover"
                  />
                  <div className="flex flex-col gap-2.5 p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="bg-sand text-fg-soft inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium">
                        {isFr ? demo.industryFr : demo.industryEn}
                      </span>
                      <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        {demo.metric}
                      </span>
                    </div>
                    <h3
                      className="text-fg text-sm leading-tight font-semibold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {isFr ? demo.titleFr : demo.titleEn}
                    </h3>
                    <p className="text-fg-soft line-clamp-3 text-xs leading-relaxed">
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
      <section
        id="audience"
        aria-labelledby="audience-heading"
        className="bg-bg py-24 sm:py-28 lg:py-32"
      >
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("audienceEyebrow")}
              </p>
              <h2
                id="audience-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
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
              {/* Promu h3 → h2 (audit A4 2026-05-24 : section autonome, pas
                  un sous-titre de la sub-section audience précédente) */}
              <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                {t("audienceSectorsTitle")}
              </h2>
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
      <section
        id="testimonials"
        aria-labelledby="testimonials-heading"
        className="bg-paper py-24 sm:py-28 lg:py-36"
      >
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("testimonialsEyebrow")}
              </p>
              <h2
                id="testimonials-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
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
              // Photos Unsplash (libres de droits — Unsplash License) sélectionnées
              // pour profils business diversifiés. Note : Review[] JSON-LD non émis
              // pour éviter risque "avis trompeurs" Google (audit perfection mai 2026).
              // À swapper par les vraies photos clients quand autorisations OK.
              const unsplashPhotos = [
                "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces&q=80",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces&q=80",
                "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=faces&q=80",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces&q=80",
                "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=faces&q=80",
              ] as const;
              const photoUrl = unsplashPhotos[idx % unsplashPhotos.length] ?? unsplashPhotos[0];
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
                      cite={`${SITE_URL}/${loc}/cas-concrets/${c.slug}`}
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
                    {/* Auteur : photo Unsplash + nom + rôle + secteur */}
                    <footer className="border-border mt-2 flex items-center gap-3 border-t pt-4">
                      <span className="ring-paper shadow-sm relative inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2">
                        <Image
                          src={photoUrl}
                          alt={`Portrait — ${author}`}
                          width={96}
                          height={96}
                          sizes="48px"
                          quality={85}
                          className="h-full w-full object-cover"
                        />
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
          {/* Lien contextuel /blog (audit P0-4 internal linking 2026-05-24) */}
          <p className="text-fg-muted mt-12 text-center text-sm">
            <Link
              href="/blog"
              className="text-terracotta inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              {isFr ? "Plus d'analyses et retours d'expérience sur le blog" : "More analysis & feedback on our blog"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </p>
        </Container>
      </section>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section
        id="faq"
        aria-labelledby="faq-heading"
        className="bg-bg py-24 sm:py-28 lg:py-36"
      >
        <Container className="max-w-3xl">
          <FadeInOnView>
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              FAQ
            </p>
            <h2
              id="faq-heading"
              className="text-fg text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-semibold tracking-tight"
            >
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
              <p className="text-fg-muted mt-8 text-center text-sm">
                {isFr ? (
                  <>
                    Vous avez d'autres questions ?{" "}
                    <Link href="/faq" className="text-terracotta font-semibold hover:underline">
                      Voir toute la FAQ
                    </Link>{" "}
                    (30+ questions) ou{" "}
                    <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                      nous contacter
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    More questions?{" "}
                    <Link href="/faq" className="text-terracotta font-semibold hover:underline">
                      See the full FAQ
                    </Link>{" "}
                    (30+ questions) or{" "}
                    <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                      contact us
                    </Link>
                    .
                  </>
                )}
              </p>
              {/* Lien contextuel /transparence (audit P0-4 internal linking 2026-05-24) */}
              <p className="text-fg-muted mt-3 text-center text-xs">
                {isFr ? (
                  <>
                    Voir aussi{" "}
                    <Link href="/transparence" className="text-fg-soft hover:text-terracotta underline-offset-4 hover:underline">
                      notre politique de transparence
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    See also{" "}
                    <Link href="/transparence" className="text-fg-soft hover:text-terracotta underline-offset-4 hover:underline">
                      our transparency policy
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* Section CTA FINAL "Choisissez votre point de départ" RETIRÉE (Will 2026-05-24) :
          - faisait doublon avec la grille tarifaire (5 services single-block)
          - "4 heures / 1 journée / 2 jours / 3 jours+ / 2-4 semaines" redondant
          - La FAQ + le StickyMobileCta + le CTA hero suffisent comme points de contact */}

      <JsonLd data={faqJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={servicesJsonLd} />
      {/* BreadcrumbList JSON-LD ABSENT : home = racine hiérarchique (cf. audit A4 2026-05-24) */}
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
