/**
 * Route publique pages détail Stack IA — `/stack-ia/[tool]` (FR) ·
 * `/ai-stack/[tool]` (EN).
 *
 * Sprint S+4-B (2026-05-18) — audit `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/
 * 20-TYPE-9-STACK-IA.md` gap P1-17 : le hub `/stack-ia` ranke déjà sur
 * « stack IA cabinet conseil » mais zéro page détail outil → aucune capture
 * AEO sur queries « pricing claude 2026 », « notre avis sur cursor »,
 * « comparatif n8n vs make ». Cible : +11 URLs Product JSON-LD indexables.
 *
 * Doctrine :
 * - 11 slugs statiques générés par `getAllStackToolSlugs()` (cf. STACK_TOOLS).
 * - ISR `revalidate=3600` (les fiches outils bougent peu).
 * - Bilingue FR canonique + EN miroir.
 * - JSON-LD : Product (offers via pricingTier) + BreadcrumbList +
 *   FAQ Speakable (questions canoniques dérivées de l'usage Axion-IA).
 * - Anti-doorway HCU 2024 : wordCount serveur ≥ 200 mots min → si seuil non
 *   atteint, page noindex (la donnée est riche par construction mais on
 *   garde le filet de sécurité côté code).
 * - Mesh interne : 2-3 outils comparables + lien vers `/comparaisons` +
 *   retour hub `/stack-ia`.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Info, MinusCircle, ShieldCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ToolLogo } from "@/components/sections/ToolLogo";
import { Badge } from "@/components/ui/badge";
import {
  buildProductMetadata,
  buildProductJsonLd,
  buildFaqSpeakableJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { STACK_CATEGORIES, type StackTool } from "@/content/stack-ia";
import {
  getAllStackToolSlugs,
  getStackToolByDetailSlug,
  getComparableStackTools,
  type StackToolDetail,
  type StackPricingTier,
  type StackHostingRegion,
} from "@/content/stack-ia-details";

// ISR pure — `revalidate=3600`. Les fiches outils bougent peu (1-2 fois /
// trimestre quand un éditeur sort une grosse maj). `dynamicParams=false`
// car la liste des outils est statique (cf. `generateStaticParams`).
export const revalidate = 3600;
export const dynamicParams = false;

interface Props {
  params: Promise<{ locale: string; tool: string }>;
}

// generateStaticParams — émet ~22 entries (11 outils × 2 locales).
export async function generateStaticParams(): Promise<Array<{ locale: string; tool: string }>> {
  const slugs = getAllStackToolSlugs();
  const out: Array<{ locale: string; tool: string }> = [];
  for (const locale of routing.locales) {
    for (const tool of slugs) {
      out.push({ locale, tool });
    }
  }
  return out;
}

const TIGHT_X = "lg:px-6 xl:px-10";

// Labels FR/EN pricing tier — affichage public sans engager de montant exact.
const pricingTierLabel: Record<StackPricingTier, { fr: string; en: string }> = {
  free: { fr: "Gratuit", en: "Free" },
  freemium: { fr: "Freemium", en: "Freemium" },
  paid: { fr: "Payant", en: "Paid" },
  enterprise: { fr: "Enterprise", en: "Enterprise" },
};

// Régions d'hébergement — label affiché tel quel (acronymes universels).
const hostingRegionLabel: Record<StackHostingRegion, string> = {
  US: "US",
  EU: "EU",
  France: "France",
  "On-prem": "On-prem",
};

/**
 * Pour compter les mots du contenu serveur d'une fiche outil dans une
 * locale donnée — anti-doorway HCU. Aggrège summary + pros + cons +
 * useCases + axionVerdict + tagline + useCase hub.
 */
function countDetailWords(tool: StackTool, detail: StackToolDetail, locale: Locale): number {
  const copyHub = tool[locale];
  const copyDetail = detail[locale];
  const all = [
    copyHub.tagline,
    copyHub.useCase,
    copyHub.combo,
    ...copyHub.whenToUse,
    ...copyHub.whenToAvoid,
    copyDetail.summary,
    ...copyDetail.pros,
    ...copyDetail.cons,
    ...copyDetail.useCases,
    copyDetail.axionVerdict,
  ].join(" ");
  return all
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tool: toolSlug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const resolved = getStackToolByDetailSlug(toolSlug);
  if (!resolved) return {};

  const { tool, detail } = resolved;
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const title = isFr
    ? `${tool.name} (${tool.vendor}) — fiche outil IA · cabinet Axion-IA`
    : `${tool.name} (${tool.vendor}) — AI tool sheet · Axion-IA consultancy`;
  const description = detail[loc].summary.slice(0, 158);

  const meta = buildProductMetadata({
    locale,
    path: `/stack-ia/${toolSlug}`,
    title,
    description,
    alternates: {
      fr: `/stack-ia/${toolSlug}`,
      en: `/ai-stack/${toolSlug}`,
    },
  });

  // Anti-doorway HCU 2024 : si la fiche tombe sous 200 mots (improbable
  // par construction mais filet de sécurité), on noindex pour ne pas
  // dégrader le profil de qualité du hub.
  const wordCount = countDetailWords(tool, detail, loc);
  if (wordCount < 200) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function StackToolPage({ params }: Props) {
  const { locale, tool: toolSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const resolved = getStackToolByDetailSlug(toolSlug);
  if (!resolved) notFound();
  setRequestLocale(locale);

  const { tool, detail } = resolved;
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const category = STACK_CATEGORIES.find((c) => c.id === tool.category);
  const comparables = getComparableStackTools(detail);

  // Breadcrumb : Accueil (auto) → Stack IA → Outil
  const breadcrumbItems = [
    {
      href: isFr ? "/stack-ia" : "/ai-stack",
      label: isFr ? "Stack IA 2026" : "AI Stack 2026",
    },
    {
      href: isFr ? `/stack-ia/${toolSlug}` : `/ai-stack/${toolSlug}`,
      label: tool.name,
    },
  ];

  // ----- JSON-LD Product -----
  const productJsonLd = buildProductJsonLd({
    locale: loc,
    path: isFr ? `/stack-ia/${toolSlug}` : `/ai-stack/${toolSlug}`,
    name: tool.name,
    description: detail[loc].summary,
    brand: tool.vendor,
    category: category ? category[loc].title : isFr ? "Outil IA" : "AI tool",
    offer: {
      availability: "InStock",
      url: tool.url,
    },
  });

  // Enrich avec `additionalProperty` (Type SaaS + Hébergement) + `subjectOf`
  // (lie l'item au WebPage parent pour AEO 2026) — étend l'objet retourné
  // par la factory sans modifier la factory (qui sert d'autres pages).
  const productJsonLdEnriched: Record<string, unknown> = {
    ...productJsonLd,
    subjectOf: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/${loc}${isFr ? "/stack-ia" : "/ai-stack"}/${toolSlug}#webpage`,
      url: `${SITE_URL}/${loc}${isFr ? "/stack-ia" : "/ai-stack"}/${toolSlug}`,
      name: `${tool.name} — fiche Axion-IA`,
      inLanguage: loc,
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: isFr ? "Type" : "Type",
        value: "SaaS",
      },
      {
        "@type": "PropertyValue",
        name: isFr ? "Tier pricing" : "Pricing tier",
        value: pricingTierLabel[detail.pricingTier][loc],
      },
      {
        "@type": "PropertyValue",
        name: isFr ? "Hébergement" : "Hosting",
        value: detail.hostingRegions.map((r) => hostingRegionLabel[r]).join(", "),
      },
      {
        "@type": "PropertyValue",
        name: isFr ? "Maturité d'adoption" : "Adoption maturity",
        value: tool.maturity,
      },
    ],
  };

  // ----- JSON-LD FAQ Speakable -----
  // Questions canoniques dérivées de l'usage Axion-IA — 4 Q/R par outil.
  const faqItems = isFr
    ? [
        {
          question: `Pour quoi Axion-IA utilise-t-il ${tool.name} concrètement ?`,
          answer: `${tool[loc].useCase} ${detail[loc].axionVerdict}`,
        },
        {
          question: `${tool.name} est-il indispensable ou optionnel dans une stack IA 2026 ?`,
          answer: detail[loc].summary,
        },
        {
          question: `Quels sont les points forts et limites de ${tool.name} selon Axion-IA ?`,
          answer: `Points forts : ${detail[loc].pros.join(" ; ")}. Limites : ${detail[loc].cons.join(" ; ")}.`,
        },
        {
          question: `Quels outils sont comparables à ${tool.name} ?`,
          answer:
            comparables.length > 0
              ? `${comparables.map((c) => c.tool.name).join(", ")} — voir la matrice complète sur /stack-ia ou la page /comparaisons.`
              : `Voir la stack complète sur /stack-ia ou la page /comparaisons pour le comparatif détaillé.`,
        },
      ]
    : [
        {
          question: `What does Axion-IA actually use ${tool.name} for?`,
          answer: `${tool[loc].useCase} ${detail[loc].axionVerdict}`,
        },
        {
          question: `Is ${tool.name} essential or optional in a 2026 AI stack?`,
          answer: detail[loc].summary,
        },
        {
          question: `What are the strengths and limits of ${tool.name} per Axion-IA?`,
          answer: `Strengths: ${detail[loc].pros.join("; ")}. Limits: ${detail[loc].cons.join("; ")}.`,
        },
        {
          question: `Which tools are comparable to ${tool.name}?`,
          answer:
            comparables.length > 0
              ? `${comparables.map((c) => c.tool.name).join(", ")} — see the full matrix on /ai-stack or the /comparisons page.`
              : `See the full stack on /ai-stack or the /comparisons page for the detailed comparison.`,
        },
      ];

  const faqJsonLd = buildFaqSpeakableJsonLd({
    items: faqItems,
    speakableSelector: "[data-aeo='stack-tool-summary']",
  });

  return (
    <>
      {/* V-04 P1 (Sprint Correctif suite 2026-05-22) — Product inline (SEO
          critique), FAQ déféré afterInteractive (-100 à -180 ms TBT). */}
      <JsonLd data={productJsonLdEnriched} />
      <JsonLd data={faqJsonLd} strategy="afterInteractive" scriptId="jsonld-stack-ia-tool-faq" />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO — logo + nom + tagline + meta + CTAs */}
      <section className="bg-halo-warm text-fg relative overflow-hidden pt-12 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
            <div>
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="bg-terracotta text-mocha-fg shadow-subtle flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
                >
                  <ToolLogo id={tool.id} className="h-8 w-8" />
                </span>
                <div>
                  <p className="text-fg-muted text-[12px] font-medium tracking-[0.16em] uppercase">
                    {isFr ? "Fiche outil" : "Tool sheet"} · {category ? category[loc].title : ""}
                  </p>
                  <h1 className="text-fg mt-1 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                    {tool.name}
                  </h1>
                  <p className="text-fg-muted mt-1 text-sm">
                    {isFr ? "Éditeur" : "Vendor"} : {tool.vendor}
                  </p>
                </div>
              </div>

              <p
                className="text-terracotta-deep mt-6 text-xl leading-snug italic"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                « {tool[loc].tagline} »
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="neutral">
                  {isFr ? "Tier" : "Tier"} : {pricingTierLabel[detail.pricingTier][loc]}
                </Badge>
                <Badge variant="neutral">
                  {isFr ? "Hébergement" : "Hosting"} :{" "}
                  {detail.hostingRegions.map((r) => hostingRegionLabel[r]).join(" · ")}
                </Badge>
                <Badge variant="neutral">
                  {isFr ? "Maturité" : "Maturity"} : {tool.maturity}
                </Badge>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href={isFr ? "/comparaisons" : "/comparisons"}
                  size="lg"
                  className="bg-primary text-primary-fg hover:bg-primary-hover"
                >
                  {isFr ? "Voir comparatif outils IA" : "See AI tool comparisons"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="text-fg inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:no-underline"
                >
                  {isFr ? "Site officiel" : "Official site"}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* AnswerCard TL;DR — speakable cssSelector cible cette zone */}
            <div data-aeo="stack-tool-summary">
              <AnswerCard
                locale={loc}
                question={
                  isFr
                    ? `Qu'est-ce que ${tool.name} et comment Axion-IA s'en sert ?`
                    : `What is ${tool.name} and how does Axion-IA use it?`
                }
                sourceLabel={
                  isFr ? "Doctrine Axion-IA — Stack 2026" : "Axion-IA doctrine — 2026 stack"
                }
                sourceUrl={isFr ? "/stack-ia" : "/ai-stack"}
              >
                {detail[loc].summary}
              </AnswerCard>
            </div>
          </div>
        </Container>
      </section>

      {/* À QUOI ÇA SERT */}
      <Section
        tone="paper"
        eyebrow={isFr ? "À quoi ça sert ?" : "What is it for?"}
        title={isFr ? "Le rôle de" : "The role of"}
        titleEm={tool.name}
        titleTail={isFr ? " dans une stack IA" : " in an AI stack"}
        contentClassName={TIGHT_X}
      >
        <Container className="max-w-3xl">
          <p className="text-fg text-lg leading-relaxed">{tool[loc].useCase}</p>
        </Container>
      </Section>

      {/* POINTS FORTS / LIMITES */}
      <Section
        tone="canvas"
        eyebrow={isFr ? "Points forts · limites" : "Strengths · limits"}
        title={isFr ? "Ce qu'on" : "What we"}
        titleEm={isFr ? "aime — et pas" : "love — and don't"}
        description={
          isFr
            ? "Une fiche honnête nomme aussi les zones d'ombre. Voici notre lecture après usage terrain."
            : "An honest sheet also names the blind spots. Here's our read after field use."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <article className="border-border bg-paper rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck aria-hidden="true" className="text-sage h-5 w-5" />
              {isFr ? "Points forts" : "Strengths"}
            </h3>
            <ul className="mt-4 space-y-3">
              {detail[loc].pros.map((p, i) => (
                <li key={i} className="text-fg flex items-start gap-3 text-[15.5px]">
                  <span className="bg-sage-soft text-sage mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="border-border bg-paper rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg flex items-center gap-2 text-lg font-semibold">
              <MinusCircle aria-hidden="true" className="text-fg-muted h-5 w-5" />
              {isFr ? "Limites assumées" : "Acknowledged limits"}
            </h3>
            <ul className="mt-4 space-y-3">
              {detail[loc].cons.map((c, i) => (
                <li
                  key={i}
                  className="text-fg-soft flex items-start gap-3 text-[15px] leading-relaxed"
                >
                  <span
                    aria-hidden="true"
                    className="bg-fg-muted/15 text-fg-muted mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  >
                    <span className="block h-0.5 w-2.5 rounded-full bg-current" />
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Section>

      {/* CAS D'USAGE CLIENTS */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Cas d'usage" : "Use cases"}
        title={isFr ? "Là où on" : "Where we"}
        titleEm={isFr ? "le sort chez nos clients" : "reach for it at clients"}
        description={
          isFr
            ? "Sélection de scénarios concrets observés en mission. Les verbatims clients (à venir) compléteront chaque cas."
            : "A selection of concrete scenarios observed in missions. Client verbatims (coming soon) will round out each case."
        }
        contentClassName={TIGHT_X}
      >
        <Container className="max-w-3xl">
          <ul className="space-y-3">
            {detail[loc].useCases.map((u, i) => (
              <li
                key={i}
                className="border-border bg-paper flex items-start gap-3 rounded-2xl border p-5"
              >
                <span className="bg-terracotta-soft text-terracotta-deep mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                  {i + 1}
                </span>
                <span className="text-fg text-[15.5px] leading-relaxed">{u}</span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* OUTILS COMPARABLES — mesh interne */}
      {comparables.length > 0 ? (
        <Section
          tone="paper"
          eyebrow={isFr ? "Comparables" : "Comparable"}
          title={isFr ? "Outils proches" : "Close alternatives"}
          titleEm={isFr ? "qu'on a aussi évalués" : "we've also evaluated"}
          contentClassName={TIGHT_X}
        >
          <div
            className={cn(
              "grid gap-5",
              comparables.length === 2 && "sm:grid-cols-2",
              comparables.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {comparables.map(({ tool: cmpTool, detail: cmpDetail }) => (
              <Link
                key={cmpTool.id}
                href={(isFr ? `/stack-ia/${cmpTool.id}` : `/ai-stack/${cmpTool.id}`) as never}
                className={cn(
                  "shadow-subtle bg-paper hover:shadow-card border-border hover:border-terracotta block rounded-2xl border p-5 transition-shadow",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-mocha text-mocha-fg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  >
                    <ToolLogo id={cmpTool.id} className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-fg text-base font-semibold">{cmpTool.name}</h3>
                    <p className="text-fg-muted text-xs">{cmpTool.vendor}</p>
                  </div>
                </div>
                <p className="text-fg-soft mt-3 text-[14.5px] leading-relaxed">
                  {cmpDetail[loc].summary.slice(0, 120)}…
                </p>
                <p className="text-terracotta-deep mt-3 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4">
                  {isFr ? "Voir la fiche" : "See the sheet"}
                  <ArrowRight aria-hidden="true" className="h-3 w-3" />
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href={(isFr ? "/comparaisons" : "/comparisons") as never}
              className="text-terracotta-deep inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:no-underline"
            >
              {isFr ? "Voir toutes les comparaisons d'outils IA" : "See all AI tool comparisons"}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Section>
      ) : null}

      {/* NOTRE AVIS AXION-IA */}
      <Section
        tone="halo-cool"
        eyebrow={isFr ? "Notre avis" : "Our take"}
        title={isFr ? "Verdict opérationnel" : "Operational verdict"}
        titleEm={isFr ? "cabinet Axion-IA" : "Axion-IA consultancy"}
        contentClassName={TIGHT_X}
      >
        <Container className="max-w-3xl">
          <p className="text-fg text-lg leading-relaxed">
            <Info aria-hidden="true" className="text-terracotta mr-2 inline-block h-5 w-5" />
            {detail[loc].axionVerdict}
          </p>
          <p className="text-fg-muted mt-4 text-sm">
            {isFr
              ? "Ce verdict reflète l'usage terrain du cabinet. Aucun partenariat commercial ni rémunération avec l'éditeur cité."
              : "This verdict reflects the consultancy's field usage. No commercial partnership or compensation with the listed vendor."}
          </p>
        </Container>
      </Section>

      {/* CTA FINAL */}
      <CtaBlock
        eyebrow={isFr ? "Mettre la stack en mouvement" : "Put the stack in motion"}
        title={isFr ? `Besoin d'évaluer` : "Need to evaluate"}
        titleEm={isFr ? ` ${tool.name} dans votre contexte ?` : ` ${tool.name} in your context?`}
        description={
          isFr
            ? "30 minutes en visio, gratuit. On regarde ensemble si l'outil mérite sa place dans votre stack — et avec quoi on le pairerait."
            : "30 minutes on video, free. Together we look at whether the tool earns its slot in your stack — and what we'd pair it with."
        }
        cta={
          <>
            <Cta href="/audit/tpe-1-jour" size="lg">
              {isFr ? "Réserver l'audit flash" : "Book the flash audit"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Link
              href={(isFr ? "/stack-ia" : "/ai-stack") as never}
              className="text-mocha-fg/85 hover:text-mocha-fg inline-flex items-center gap-1 text-base font-medium underline underline-offset-4"
            >
              {isFr ? "Retour à la stack complète" : "Back to the full stack"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </>
        }
        tone="dark"
      />
    </>
  );
}

// Re-export pour permettre aux tests d'importer la fonction de comptage
// sans recopier la logique. Pas exporté par default donc safe côté bundle.
export const __testing = { countDetailWords };
