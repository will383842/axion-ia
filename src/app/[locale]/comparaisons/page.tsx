import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Scale,
  ShieldCheck,
  Wallet,
  RefreshCw,
  Sprout,
  Boxes,
  Building2,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Cta } from "@/components/marketing/Cta";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { ComparisonsHeroSchema } from "@/components/sections/ComparisonsHeroSchema";
import { COMPARISONS } from "@/content/comparaisons";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL, buildCollectionPageJsonLd } from "@/lib/seo";
import {
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  formatAmount,
  formatAmountRange,
  getTierById,
} from "@/content/pricing";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/comparaisons",
    title:
      locale === "fr"
        ? "Comparaisons IA · cabinet vs alternatives · Axion-IA"
        : "AI comparisons · consultancy vs alternatives · Axion-IA",
    description:
      locale === "fr"
        ? "Comparaisons honnêtes : cabinet IA vs SaaS générique, fine-tuning vs RAG, internalisation vs externalisation."
        : "Honest comparisons: AI consultancy vs generic SaaS, fine-tuning vs RAG, in-house vs outsourcing.",
    alternates: { fr: "/comparaisons", en: "/comparisons" },
  });
}

export default async function ComparisonsListPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/comparaisons",
    name: isFr ? "Comparaisons Axion-IA" : "Axion-IA comparisons",
    isPartOf: { "@type": "WebSite", name: "Axion-IA", url: SITE_URL },
    speakable: { selectors: ["[data-aeo='comparaisons-intro']"] },
    hasPart: COMPARISONS.map((c) => ({
      "@type": "Article",
      headline: c[loc].title,
      description: c[loc].excerpt,
      url: `${SITE_URL}/${locale}/comparaisons/${c.slug}`,
    })),
  });

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/comparaisons", label: isFr ? "Comparaisons" : "Comparisons" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO 2-col — texte à gauche, ComparisonsHeroSchema à droite */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          {/* Eyebrow → pastille centrée sur la page, au-dessus de la grille. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {isFr ? "Décision" : "Decision"}
          </HeroBadge>
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <h1 className="display-editorial text-fg">
                {isFr ? "Comparaisons IA " : "Honest AI "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "honnêtes" : "comparisons"}
                </span>
              </h1>
              <p
                data-aeo="comparaisons-intro"
                className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
              >
                {isFr
                  ? "Tableaux de décision factuels — pas de FUD, pas de complaisance vendeur. Cabinet IA, SaaS, internalisation : ce qui colle vraiment à votre contexte."
                  : "Factual decision tables — no FUD, no vendor complacency. AI consultancy, SaaS, in-house: what actually fits your context."}
              </p>
              {/* Pills réassurance */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  {
                    icon: Scale,
                    label: isFr
                      ? `${COMPARISONS.length} comparaisons`
                      : `${COMPARISONS.length} comparisons`,
                  },
                  {
                    icon: ShieldCheck,
                    label: isFr ? "Neutralité éditoriale" : "Editorial neutrality",
                  },
                  { icon: Wallet, label: isFr ? "Critères ROI" : "ROI criteria" },
                  { icon: RefreshCw, label: isFr ? "MAJ trimestrielle" : "Quarterly updates" },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
              {/* CTAs hero */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="#comparaisons" size="lg">
                  {isFr ? "Parcourir les comparaisons" : "Browse comparisons"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/audit" variant="outline" size="lg">
                  {isFr ? "Demander un audit" : "Request an audit"}
                </Cta>
              </div>
            </div>
            <ComparisonsHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Schéma comparatif : Axion-IA cabinet IA opérationnel au centre, encadré par 2 alternatives (SaaS générique, internalisation) — comparaison factuelle sans FUD."
                  : "Comparison diagram: Axion-IA operational AI consultancy at the centre, flanked by 2 alternatives (generic SaaS, in-house team) — factual comparison without FUD."
              }
            />
          </div>
        </Container>
      </section>

      {/* MID-SECTION — placeholder illustration matrix de décision */}
      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <Illustration
              slot="COMP-02-matrix"
              aspectRatio="1:1"
              filenameTarget="public/illustrations/comparaisons-mid-1.avif"
              caption={
                isFr
                  ? "Matrice de décision éditoriale — axes ROI / complexité"
                  : "Editorial decision matrix — ROI / complexity axes"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'une matrice 2D représentant les axes de décision d'un comparatif IA chez Axion-IA."
                  : "Editorial illustration of a 2D matrix representing decision axes for an AI comparison at Axion-IA."
              }
            />
          </div>
        </Container>
      </Section>

      {/* Anti-fear 3 niveaux décision — guide arbitrage par maturité */}
      <Section eyebrow={isFr ? "Niveau de maturité" : "Maturity level"} tone="sand">
        <Container>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sprout className="text-terracotta h-5 w-5" aria-hidden="true" />
                  {isFr ? "1. Découverte" : "1. Discovery"}
                </CardTitle>
                <CardDescription>
                  {isFr
                    ? "Premier essai IA, MVP, pilote — minimiser risque et coût initial."
                    : "First AI try, MVP, pilot — minimise risk and initial cost."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-fg-soft text-sm leading-snug">
                  {isFr
                    ? `Recommandation par défaut : SaaS générique ou cabinet en mission courte (formation collective ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}). Pas d'investissement custom à ce stade.`
                    : `Default recommendation: generic SaaS or short consultancy mission (group training ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}). No custom investment at this stage.`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="text-terracotta h-5 w-5" aria-hidden="true" />
                  {isFr ? "2. Déploiement" : "2. Deployment"}
                </CardTitle>
                <CardDescription>
                  {isFr
                    ? "Production cadrée, équipe formée — viser maintenabilité et ROI."
                    : "Scoped production, trained team — aim for maintainability and ROI."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-fg-soft text-sm leading-snug">
                  {isFr
                    ? "Recommandation par défaut : cabinet IA opérationnel pour cadrage + implémentation packagée. Hybride avec SaaS ciblé sur les fonctions stables."
                    : "Default recommendation: operational AI consultancy for scoping + packaged implementation. Hybrid with SaaS targeted on stable functions."}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="text-terracotta h-5 w-5" aria-hidden="true" />
                  {isFr ? "3. Industrialisation" : "3. Industrialisation"}
                </CardTitle>
                <CardDescription>
                  {isFr
                    ? "Scale, gouvernance, modèles propriétaires — viser indépendance long terme."
                    : "Scale, governance, proprietary models — aim for long-term independence."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-fg-soft text-sm leading-snug">
                  {isFr
                    ? `Recommandation par défaut : équipe interne renforcée par cabinet IA en architecture + IA Custom (${formatAmountRange(getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMin!, getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMax!, "fr", { compact: true })}). Désengagement progressif des SaaS.`
                    : `Default recommendation: in-house team augmented by AI consultancy on architecture + Custom AI (${formatAmountRange(getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMin!, getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMax!, "en", { compact: true })}). Progressive SaaS disengagement.`}
                </p>
              </CardContent>
            </Card>
          </div>
        </Container>
      </Section>

      <Section id="comparaisons" eyebrow={isFr ? "Comparaisons" : "Comparisons"}>
        <Container>
          <ul className="xs:grid-cols-2 grid grid-cols-1 gap-6 md:grid-cols-3">
            {COMPARISONS.map((c) => (
              <li key={c.slug}>
                <ArticleCard
                  href={`/comparaisons/${c.slug}`}
                  title={c[loc].title}
                  excerpt={c[loc].excerpt}
                />
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* CtaBlock final — manquait sur cette page (gap audit Visual Rhythm 2026) */}
      <CtaBlock
        title={isFr ? "Une décision IA à prendre ?" : "An AI decision to make?"}
        description={
          isFr
            ? `Réservez notre formation en groupe ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} : on cartographie votre situation et on tranche sur vos données, pas sur des slides.`
            : `Book our group training ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}: we map your situation and decide on your data, not on slides.`
        }
        cta={
          <Cta href="/formations" size="lg">
            {isFr ? "Voir nos formations" : "See our trainings"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={collectionJsonLd} />
    </>
  );
}
