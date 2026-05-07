import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { ComparisonsHeroSchema } from "@/components/sections/ComparisonsHeroSchema";
import { COMPARISONS } from "@/content/comparaisons";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

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
        ? "Comparaisons IA · cabinet vs alternatives · AxionIA"
        : "AI comparisons · consultancy vs alternatives · AxionIA",
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

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: isFr ? "Comparaisons AxionIA" : "AxionIA comparisons",
    url: `${SITE_URL}/${locale}/comparaisons`,
    inLanguage: locale,
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Comparaisons" : "Comparisons", href: "/comparaisons" },
    ],
  });

  return (
    <>
      {/* HERO 2-col — texte à gauche, ComparisonsHeroSchema à droite */}
      <section className="bg-halo-warm text-fg relative py-20 sm:py-24 lg:py-28">
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Décision" : "Decision"}
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Comparaisons IA " : "Honest AI "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "honnêtes" : "comparisons"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Tableaux de décision factuels — pas de FUD, pas de complaisance vendeur. Cabinet IA, SaaS, internalisation : ce qui colle vraiment à votre contexte."
                  : "Factual decision tables — no FUD, no vendor complacency. AI consultancy, SaaS, in-house: what actually fits your context."}
              </p>
            </div>
            <ComparisonsHeroSchema
              isFr={isFr}
              className="relative mx-auto w-full max-w-xl lg:mx-0"
              ariaLabel={
                isFr
                  ? "Schéma comparatif : AxionIA cabinet IA opérationnel au centre, encadré par 2 alternatives (SaaS générique, internalisation) — comparaison factuelle sans FUD."
                  : "Comparison diagram: AxionIA operational AI consultancy at the centre, flanked by 2 alternatives (generic SaaS, in-house team) — factual comparison without FUD."
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
                  ? "Illustration éditoriale d'une matrice 2D représentant les axes de décision d'un comparatif IA chez AxionIA."
                  : "Editorial illustration of a 2D matrix representing decision axes for an AI comparison at AxionIA."
              }
            />
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            ? "Réservez l'Essentielle 490 € : on cartographie votre situation et on tranche sur vos données, pas sur des slides."
            : "Book the Essential €490: we map your situation and decide on your data, not on slides."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle 490 €" : "See the Essential €490"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
