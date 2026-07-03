import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Target, TrendingUp, ShieldCheck, Quote, Clock, Sparkles } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { SectorHeroMedia, SERVICE_ICON } from "@/components/secteurs/SectorVisuals";
import { CLIENT_SECTORS, getClientSector, type ClientSectorSlug } from "@/content/sectors";
import { SECTOR_PHOTO_CREDITS } from "@/content/secteurs/sector-photos";
import { SERVICE_DEFS } from "@/content/knowledge/services";
import { getPageImages } from "@/lib/seo/page-images";
import { FOUNDER } from "@/lib/brand";
import {
  getSectorPainContext,
  type Secteur,
  type Verticale,
} from "@/server/content-gen/kb/sector-pain-matrix";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildPageImageGraphJsonLd,
  SITE_URL,
} from "@/lib/seo";

// ============================================================================
// Pilier /secteurs/[secteur] — refonte visuelle (2026-07-03). Déroule les 5
// activités Axion-IA pour CE secteur, chacune contextualisée par la pain-matrix
// (douleur, bénéfice chiffré, avant/après, lexique métier). Contenu UNIQUE par
// combo secteur×activité (hand-authored 50/50) → anti-doorway HCU.
//
// Densité visuelle (Server Components purs, zéro JS client → Web Vitals 2026) :
//   héro emblème sectoriel → bande approche → 5 solutions (cartes icônes +
//   bénéfice chiffré) → transformation avant/après + chips lexique → bandeau
//   fondateur (photo) → objections → CTA. Emblèmes = icônes lucide (déjà bundle),
//   photo = portrait fondateur réutilisé (crawlable). Photos métier dédiées =
//   drop-in ultérieur (cf. TODO(secteurs-photos) dans `page-images.ts`).
// ============================================================================

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string; secteur: string }>;
}

export function generateStaticParams(): Array<{ secteur: string }> {
  return CLIENT_SECTORS.map((s) => ({ secteur: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, secteur } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const sector = getClientSector(secteur);
  if (!sector) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? `IA pour ${sector.labelFr} · cas d'usage & ROI · Axion-IA`
    : `AI for ${sector.labelFr} · use cases & ROI · Axion-IA`;
  return {
    ...buildProductMetadata({
      locale,
      path: `/secteurs/${sector.slug}`,
      title,
      description: isFr
        ? `Intelligence artificielle pour ${sector.fullFr} : audit, formation, implémentation, accompagnement 1-to-1 et sites web augmentés. Cas d'usage concrets, bénéfices chiffrés et feuille de route adaptée au secteur.`
        : `Artificial intelligence for ${sector.fullFr}: audit, training, implementation, 1-to-1 support and AI-augmented websites. Concrete use cases, quantified benefits and a sector roadmap.`,
    }),
    title: { absolute: title },
  };
}

export default async function SecteurPilier({ params }: Props) {
  const { locale, secteur } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const sector = getClientSector(secteur);
  if (!sector) notFound();
  const slug = sector.slug as ClientSectorSlug;

  // Les 5 activités contextualisées par la pain-matrix pour ce secteur.
  const activities = SERVICE_DEFS.map((svc) => {
    const verticale = svc.verticales[0] as Verticale;
    const pain = getSectorPainContext(sector.slug as Secteur, verticale);
    return { svc, verticale, pain };
  }).filter((a) => a.pain !== undefined);

  // Lexique métier agrégé (chips) + activité phare (bloc avant/après).
  const lexicon = Array.from(new Set(activities.flatMap((a) => a.pain!.sectorLexicon)));
  const flagship = activities[0];

  // Images de la page (cf. page-images.ts) : photo héro sectorielle + portrait fondateur.
  const sectorImages = getPageImages(`/secteurs/${sector.slug}`);
  const heroImage = sectorImages.find((img) => img.slot === "hero");
  const founderImage = sectorImages.find((img) => img.slot === "portrait");
  const photoCredit = SECTOR_PHOTO_CREDITS[slug];

  const breadcrumbItems = [
    { href: "/secteurs", label: isFr ? "Secteurs" : "Sectors" },
    { href: `/secteurs/${sector.slug}`, label: sector.labelFr },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Secteurs" : "Sectors", href: "/secteurs" },
      { name: sector.labelFr, href: `/secteurs/${sector.slug}` },
    ],
  });

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: `/secteurs/${sector.slug}`,
    name: isFr
      ? `Intelligence artificielle pour ${sector.labelFr}`
      : `Artificial intelligence for ${sector.labelFr}`,
    description: isFr
      ? `Solutions IA pour ${sector.fullFr} : audit, formation, implémentation, 1-to-1, sites web augmentés.`
      : `AI solutions for ${sector.fullFr}: audit, training, implementation, 1-to-1, AI-augmented websites.`,
    serviceType: `AI consulting for ${sector.labelFr}`,
  });

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: `/secteurs/${sector.slug}`,
    name: isFr ? `Solutions IA pour ${sector.labelFr}` : `AI solutions for ${sector.labelFr}`,
    items: activities.map((a, idx) => ({
      position: idx + 1,
      name: `${a.svc.labelFr} · ${sector.labelFr}`,
      url: `${SITE_URL}/${loc}/secteurs/${sector.slug}/${a.svc.slug}`,
      description: a.pain!.benefitMeasured,
    })),
  });

  const faqItems = activities.map((a) => ({
    question: a.pain!.objection,
    answer: a.pain!.objectionReply,
  }));
  const faqJsonLd = buildFaqJsonLd({ items: faqItems });

  const sectorImagesJsonLd = buildPageImageGraphJsonLd({
    locale: loc,
    path: `/secteurs/${sector.slug}`,
  });

  // Bande « notre approche » — 3 promesses vérifiables (pas de chiffre inventé).
  const approach = [
    {
      Icon: Target,
      title: isFr ? "On part de vos cas d'usage réels" : "We start from your real use cases",
      desc: isFr
        ? "Pas de discours générique : vos contraintes, vos flux, votre quotidien métier."
        : "No generic pitch: your constraints, your flows, your day-to-day trade.",
    },
    {
      Icon: TrendingUp,
      title: isFr ? "Un gain concret et chiffré" : "A concrete, quantified gain",
      desc: isFr
        ? "Chaque solution est reliée à un bénéfice mesurable — temps, argent ou erreurs évitées."
        : "Every solution maps to a measurable benefit — time, money or errors avoided.",
    },
    {
      Icon: ShieldCheck,
      title: isFr ? "Votre vocabulaire, zéro jargon" : "Your vocabulary, zero jargon",
      desc: isFr
        ? "On parle le langage de votre métier, pas celui de la tech."
        : "We speak the language of your trade, not tech-speak.",
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HÉRO illustré — emblème sectoriel à droite du h1 */}
      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow={`${sector.emoji} ${isFr ? "Secteur" : "Sector"} · ${sector.labelFr}`}
        title={
          isFr
            ? `L'IA pour ${sector.labelFr}, sans jargon ni promesses creuses.`
            : `AI for ${sector.labelFr}, without jargon or empty promises.`
        }
        description={
          isFr
            ? `Pour ${sector.fullFr}, on part de vos contraintes réelles et de votre vocabulaire métier. Voici les 5 façons dont Axion-IA vous fait gagner du temps et de l'argent — chacune avec un gain concret et chiffré.`
            : `For ${sector.fullFr}, we start from your real constraints and trade vocabulary. Here are the 5 ways Axion-IA saves you time and money — each with a concrete, quantified gain.`
        }
        media={
          heroImage ? (
            <SectorHeroMedia
              slug={slug}
              src={heroImage.src}
              alt={isFr ? heroImage.altFr : heroImage.altEn}
              width={heroImage.width}
              height={heroImage.height}
              credit={photoCredit}
            />
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${loc}/appel`}
            className="bg-terracotta rounded-full px-5 py-2.5 font-semibold text-white hover:opacity-90"
          >
            {isFr ? "Réserver un appel" : "Book a call"}
          </Link>
          <Link
            href="#solutions"
            className="border-border hover:bg-paper rounded-full border px-5 py-2.5 font-semibold"
          >
            {isFr ? "Voir les 5 solutions ↓" : "See the 5 solutions ↓"}
          </Link>
        </div>
      </Section>

      {/* BANDE APPROCHE — 3 promesses (icônes) */}
      <section className="bg-paper border-border border-y">
        <Container className="py-14">
          <ul className="grid gap-8 sm:grid-cols-3" role="list">
            {approach.map(({ Icon, title, desc }) => (
              <li key={title} className="flex flex-col gap-3">
                <span className="bg-sand flex h-12 w-12 items-center justify-center rounded-xl">
                  <Icon className="text-terracotta h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <p className="text-fg font-semibold">{title}</p>
                <p className="text-fg-soft text-sm leading-relaxed">{desc}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 5 SOLUTIONS — cartes icône + bénéfice chiffré */}
      <Section
        id="solutions"
        tone="canvas"
        titleAs="h2"
        title={
          isFr ? `5 solutions IA pour ${sector.labelFr}` : `5 AI solutions for ${sector.labelFr}`
        }
        description={
          isFr
            ? "Chaque brique répond à une douleur précise de votre métier, avec un gain mesurable."
            : "Each building block answers a precise pain of your trade, with a measurable gain."
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {activities.map(({ svc, pain }) => {
            const Icon = SERVICE_ICON[svc.slug] ?? Sparkles;
            return (
              <article
                key={svc.slug}
                className="border-border hover:border-border-strong hover:shadow-card group flex flex-col gap-4 rounded-2xl border p-6 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-halo-warm flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="text-terracotta h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <h3 className="text-fg text-lg font-semibold">{svc.labelFr}</h3>
                </div>
                <p className="text-fg-soft text-sm leading-relaxed" data-answer>
                  {pain!.painStatement}
                </p>
                <div className="bg-sand mt-auto flex items-start gap-2 rounded-xl p-3">
                  <TrendingUp
                    className="text-terracotta mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p className="text-fg text-sm font-medium">{pain!.benefitMeasured}</p>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    href={`/${loc}/secteurs/${sector.slug}/${svc.slug}`}
                    className="text-terracotta text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    {isFr ? "Voir le cas d'usage →" : "See the use case →"}
                  </Link>
                  <Link
                    href={`/${loc}${svc.pageHref}`}
                    className="text-fg-soft text-sm underline-offset-4 hover:underline"
                  >
                    {svc.labelFr}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* TRANSFORMATION — avant/après (activité phare) + chips lexique */}
      {flagship ? (
        <Section
          tone="sand"
          titleAs="h2"
          title={isFr ? "Ce qui change concrètement" : "What concretely changes"}
          description={
            isFr
              ? `Exemple sur « ${flagship.svc.labelFr} » — le quotidien avant, puis avec l'IA.`
              : `Example on “${flagship.svc.labelFr}” — the day-to-day before, then with AI.`
          }
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="border-border bg-paper rounded-2xl border p-6">
              <p className="text-fg-muted mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {isFr ? "Aujourd'hui" : "Today"}
              </p>
              <p className="text-fg-soft leading-relaxed">{flagship.pain!.beforeScenario}</p>
            </div>
            <div className="border-terracotta/30 bg-halo-warm rounded-2xl border p-6">
              <p className="text-terracotta mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isFr ? "Avec Axion-IA" : "With Axion-IA"}
              </p>
              <p className="text-fg leading-relaxed">{flagship.pain!.afterScenario}</p>
            </div>
          </div>

          {lexicon.length > 0 ? (
            <div className="mt-8">
              <p className="text-fg-muted mb-3 text-sm">
                {isFr ? "On parle votre langue :" : "We speak your language:"}
              </p>
              <ul className="flex flex-wrap gap-2" role="list">
                {lexicon.map((w) => (
                  <li
                    key={w}
                    className="border-border bg-paper text-fg-soft rounded-full border px-3 py-1 text-sm"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* BANDEAU FONDATEUR — photo + interlocuteur direct (équipe) */}
      <section className="bg-paper border-border border-y py-20 sm:py-24">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Qui vous accompagne" : "Who you work with"}
              </p>
              <h2
                className="text-fg text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? (
                  <>
                    Une équipe qui connaît{" "}
                    <span className="text-terracotta italic">{sector.labelFr}</span>.
                  </>
                ) : (
                  <>
                    A team who knows{" "}
                    <span className="text-terracotta italic">{sector.labelFr}</span>.
                  </>
                )}
              </h2>
              <p className="text-fg-soft mt-6 text-lg leading-relaxed">
                {isFr
                  ? `Avec Williams et son équipe, vous échangez en direct — pas d'intermédiaire, pas de jargon. On adapte chaque solution IA aux réalités de ${sector.fullFr}, et on vous dit honnêtement par quoi commencer.`
                  : `With Williams and his team, you talk directly — no middleman, no jargon. We tailor every AI solution to the realities of ${sector.fullFr}, and honestly tell you where to start.`}
              </p>
              <p className="mt-6">
                <Link
                  href={`/${loc}/appel`}
                  className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {isFr ? "Réserver un appel de cadrage" : "Book a scoping call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </p>
            </div>

            {founderImage ? (
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-xs">
                  <figure className="shadow-card m-0 overflow-hidden rounded-2xl">
                    <Image
                      src={founderImage.src}
                      alt={isFr ? founderImage.altFr : founderImage.altEn}
                      width={founderImage.width}
                      height={founderImage.height}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 1024px) 80vw, 320px"
                      className="aspect-[4/5] h-auto w-full object-cover"
                    />
                  </figure>
                  <div className="mt-4 text-center">
                    <p className="text-fg text-lg font-semibold">{FOUNDER.displayName}</p>
                    <p className="text-fg-muted text-sm">
                      {isFr ? FOUNDER.roleLineFr : FOUNDER.roleLineEn}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {/* OBJECTIONS — FAQ sectorielle (Speakable via data-faq-q/a) */}
      <Section
        tone="canvas"
        titleAs="h2"
        title={isFr ? "Vos objections, nos réponses" : "Your objections, our answers"}
      >
        <dl className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {faqItems.map((f, i) => (
            <div key={i} className="border-border rounded-2xl border p-6">
              <dt className="text-fg flex items-start gap-2 font-semibold" data-faq-q>
                <Quote className="text-terracotta mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                {f.question}
              </dt>
              <dd className="text-fg-soft mt-2 text-sm leading-relaxed" data-faq-a data-answer>
                {f.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* CTA FINAL — mocha */}
      <Section
        tone="mocha"
        titleAs="h2"
        title={isFr ? "Par où commencer ?" : "Where to start?"}
        description={
          isFr
            ? "Le plus simple : un appel de cadrage. On regarde votre contexte, on identifie le gisement de temps le plus rapide à récupérer, et on vous dit honnêtement par quelle activité commencer."
            : "The simplest: a scoping call. We look at your context, identify the fastest time saving, and honestly tell you which activity to start with."
        }
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${loc}/appel`}
            className="bg-terracotta rounded-full px-5 py-2.5 font-semibold text-white hover:opacity-90"
          >
            {isFr ? "Réserver un appel" : "Book a call"}
          </Link>
          <Link
            href={`/${loc}/secteurs`}
            className="border-mocha-fg/30 text-mocha-fg hover:bg-mocha-fg/10 rounded-full border px-5 py-2.5 font-semibold"
          >
            {isFr ? "← Tous les secteurs" : "← All sectors"}
          </Link>
        </div>
      </Section>

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track={`secteur-${sector.slug}-sticky-call`}
        threshold={500}
      />

      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={serviceJsonLd} />
      {sectorImagesJsonLd ? <JsonLd data={sectorImagesJsonLd} /> : null}
      <JsonLd data={itemListJsonLd} strategy="afterInteractive" scriptId="jsonld-secteur-itemlist" />
      <JsonLd data={faqJsonLd} strategy="afterInteractive" scriptId="jsonld-secteur-faq" />
    </>
  );
}
