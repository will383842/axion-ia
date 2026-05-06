import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { CASE_STUDIES } from "@/content/case-studies";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ industry?: string; size?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/cas-concrets",
    title:
      locale === "fr"
        ? "Cas concrets · résultats clients chiffrés · AxionIA"
        : "Case studies · client results, in numbers · AxionIA",
    description:
      locale === "fr"
        ? "Études de cas IA opérationnelle : industrie, juridique, retail, banque, artisanat. Résultats chiffrés, témoignages, contexte."
        : "Operational AI case studies: industry, legal, retail, banking, trades. Numerical results, testimonials, context.",
    alternates: { fr: "/cas-concrets", en: "/case-studies" },
  });
}

export default async function CaseStudiesListing({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const sp = await searchParams;

  // URL-driven filters — no client state.
  const filterIndustry = sp.industry?.toLowerCase();
  const filterSize = sp.size?.toLowerCase();

  const filtered = CASE_STUDIES.filter((c) => {
    if (
      filterIndustry &&
      c.industry.toLowerCase() !== filterIndustry &&
      c.industryEn.toLowerCase() !== filterIndustry
    )
      return false;
    if (filterSize && c.size !== filterSize) return false;
    return true;
  });

  const allIndustries = Array.from(
    new Set(CASE_STUDIES.map((c) => (isFr ? c.industry : c.industryEn))),
  );
  const allSizes: ReadonlyArray<{ key: string; label: string }> = [
    { key: "tpe", label: isFr ? "TPE" : "Small" },
    { key: "pme", label: "PME" },
    { key: "mid", label: isFr ? "Moyenne" : "Mid" },
    { key: "enterprise", label: isFr ? "Grande" : "Enterprise" },
  ];

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Cas concrets" : "Case studies", href: "/cas-concrets" },
    ],
  });

  return (
    <>
      <Section
        eyebrow={isFr ? "Preuves sociales · accent green" : "Social proof · green accent"}
        title={isFr ? "Cas concrets" : "Case studies"}
        description={
          isFr
            ? "Résultats clients chiffrés, contexte et témoignages. Filtrez par industrie ou taille d'entreprise."
            : "Client results in numbers, context and testimonials. Filter by industry or company size."
        }
      />

      <Section eyebrow={isFr ? "Filtres" : "Filters"}>
        <Container className="space-y-4">
          <div>
            <p className="text-fg mb-2 text-xs font-semibold tracking-wide uppercase">
              {isFr ? "Industrie" : "Industry"}
            </p>
            <ul className="flex flex-wrap gap-2">
              <li>
                <a
                  href={`/${loc}/cas-concrets`}
                  className={`rounded-sm border px-3 py-1.5 text-sm ${
                    !filterIndustry
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border text-fg hover:border-border-hover"
                  }`}
                >
                  {isFr ? "Toutes" : "All"}
                </a>
              </li>
              {allIndustries.map((ind) => (
                <li key={ind}>
                  <a
                    href={`/${loc}/cas-concrets?industry=${encodeURIComponent(ind.toLowerCase())}`}
                    className={`rounded-sm border px-3 py-1.5 text-sm ${
                      filterIndustry === ind.toLowerCase()
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border text-fg hover:border-border-hover"
                    }`}
                  >
                    {ind}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-fg mb-2 text-xs font-semibold tracking-wide uppercase">
              {isFr ? "Taille" : "Size"}
            </p>
            <ul className="flex flex-wrap gap-2">
              <li>
                <a
                  href={`/${loc}/cas-concrets`}
                  className={`rounded-sm border px-3 py-1.5 text-sm ${
                    !filterSize
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border text-fg hover:border-border-hover"
                  }`}
                >
                  {isFr ? "Toutes" : "All"}
                </a>
              </li>
              {allSizes.map((s) => (
                <li key={s.key}>
                  <a
                    href={`/${loc}/cas-concrets?size=${s.key}`}
                    className={`rounded-sm border px-3 py-1.5 text-sm ${
                      filterSize === s.key
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border text-fg hover:border-border-hover"
                    }`}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <Section
        eyebrow={
          filtered.length === CASE_STUDIES.length
            ? isFr
              ? "Tous les cas"
              : "All cases"
            : isFr
              ? `${filtered.length} cas`
              : `${filtered.length} case(s)`
        }
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <li className="col-span-full text-center text-gray-700">
              {isFr ? "Aucun cas ne correspond à ces filtres." : "No case matches these filters."}
            </li>
          ) : (
            filtered.map((c) => {
              const copy = c[loc];
              return (
                <li key={c.slug}>
                  <CaseStudyCard
                    href={`/cas-concrets/${c.slug}`}
                    title={copy.title}
                    excerpt={copy.excerpt}
                    industry={isFr ? c.industry : c.industryEn}
                    metric={c.metric}
                  />
                </li>
              );
            })
          )}
        </ul>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? "Devenez le prochain cas concret" : "Become the next case study"}
        description={
          isFr
            ? "Démarrez par une intervention Essentielle 490 € pour identifier vos quick-wins."
            : "Start with an Essential session €490 to identify your quick-wins."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle" : "See the Essential"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
