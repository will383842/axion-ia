import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Download, FileJson } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { DistributionChart, type ChartRow } from "@/components/observatoire/DistributionChart";
import { ObservatoireFilters } from "@/components/observatoire/ObservatoireFilters";
import { SegmentHeatmap, type HeatmapColumn } from "@/components/observatoire/SegmentHeatmap";
import { TrendChart, type TrendSeries } from "@/components/observatoire/TrendChart";
import {
  buildProductMetadata,
  buildFaqSpeakableJsonLd,
  buildWebPageJsonLd,
  SITE_URL,
  SITE_EDITORIAL_DATE,
} from "@/lib/seo";
import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import {
  BAROMETER_QUESTIONS,
  COMPANY_SIZE_VALUES,
  SECTOR_SLUGS,
  REGION_SLUGS,
} from "@/content/observatoire/questions";
import {
  STUDY_NAME_FR,
  STUDY_NAME_EN,
  STUDY_REGIONS,
  STUDY_REGION_COUNT,
  STUDY_SECTOR_COUNT,
  STUDY_COMPANY_SIZE_COUNT,
  STUDY_PERIOD_START,
  STUDY_PERIOD_END,
  STUDY_TEMPORAL_COVERAGE,
  STUDY_LICENSE_URL,
  STUDY_LICENSE_LABEL,
  STUDY_ATTRIBUTION,
  STUDY_VARIABLES_MEASURED,
  STUDY_MEASUREMENT_TECHNIQUE,
  BAROMETER_INSIGHT_KEYS,
} from "@/content/observatoire/study";
import {
  readLatestSnapshot,
  readSnapshotHistory,
  aggregateBarometer,
  emptySnapshotPayload,
  type BarometerSnapshotPayload,
} from "@/server/observatoire/snapshot";
import { readLatestAnalysis } from "@/server/observatoire/analysis";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_PATH = "/observatoire-ia";
const CSV_URL = `${SITE_URL}/api/observatoire/export-csv`;
const JSON_URL = `${SITE_URL}/api/observatoire/export-json`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "observatoire" });
  return buildProductMetadata({
    locale: locale as Locale,
    path: PAGE_PATH,
    title: t("meta.resultsTitle"),
    description: t("meta.resultsDescription"),
    alternates: { fr: PAGE_PATH, en: PAGE_PATH },
    // Brand-fix 2026-06-20 — défaut terracotta (était "primary"/bleu off-brand).
  });
}

function single(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : null;
}

const isBuildStub = process.env.DATABASE_URL?.includes("stub.invalid") === true;

export default async function ObservatoirePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const t = await getTranslations({ locale: loc, namespace: "observatoire" });

  // Filtres validés contre les SSOT (défense en profondeur).
  const sp = await searchParams;
  const rawSize = single(sp.size);
  const rawSector = single(sp.sector);
  const rawRegion = single(sp.region);
  const fSize =
    rawSize && (COMPANY_SIZE_VALUES as readonly string[]).includes(rawSize) ? rawSize : null;
  const fSector = rawSector && SECTOR_SLUGS.includes(rawSector) ? rawSector : null;
  const fRegion = rawRegion && REGION_SLUGS.includes(rawRegion) ? rawRegion : null;
  const hasFilter = Boolean(fSize || fSector || fRegion);

  // Source des données :
  //  - vue par défaut → snapshot pré-calculé (rapide, sûr au build/stub) ;
  //  - vue filtrée (runtime, hors stub) → agrégation live ;
  //  - build/stub ou snapshot absent → payload vide → état « enquête en cours »
  //    (JAMAIS de chiffre fabriqué).
  let payload: BarometerSnapshotPayload | null;
  if (hasFilter && !isBuildStub) {
    payload = await aggregateBarometer({
      companySize: fSize,
      sector: fSector,
      region: fRegion,
    });
  } else {
    payload = (await readLatestSnapshot()) ?? (isBuildStub ? emptySnapshotPayload() : null);
  }
  const total = payload?.totalResponses ?? 0;
  const hasData = total > 0;

  // Vues GLOBALES (uniquement hors filtre) : breakdowns par segment + synthèse
  // LLM + historique d'évolution. En vue filtrée, l'utilisateur « creuse » par
  // question → on masque le dashboard global pour rester lisible.
  const showGlobal = !hasFilter;
  const segments = showGlobal ? payload?.segments : undefined;
  const analysis = showGlobal && !isBuildStub ? await readLatestAnalysis() : null;
  const history = showGlobal && !isBuildStub ? await readSnapshotHistory(60).catch(() => []) : [];

  // Résolution des libellés d'options (SSOT pour secteur/région, i18n sinon).
  const sectorLabel = (slug: string) => {
    const tag = KB_SECTOR_TAGS.find((s) => s.slug === slug);
    return tag ? (isFr ? tag.labelFr : tag.labelEn) : slug;
  };
  const regionLabel = (slug: string) => {
    const r = STUDY_REGIONS.find((x) => x.slug === slug);
    return r ? (isFr ? r.nameFr : r.nameEn) : slug;
  };
  const sizeLabel = (v: string) => t(`questions.companySize.options.${v}`);
  const optionLabel = (questionId: string, source: string, value: string): string => {
    if (source === "sector") return sectorLabel(value);
    if (source === "region") return regionLabel(value);
    return t(`questions.${questionId}.options.${value}`);
  };

  const toRows = (questionId: string, source: string): ChartRow[] => {
    const dist = payload?.distributions?.[questionId] ?? [];
    return dist.map((d) => ({
      value: d.value,
      label: optionLabel(questionId, source, d.value),
      count: d.count,
      pct: d.pct,
    }));
  };

  // Constats phares answer-first (uniquement si données réelles).
  const findings = hasData
    ? BAROMETER_INSIGHT_KEYS.map((key) => ({
        key,
        value: payload?.insights?.[key] ?? 0,
      })).filter((f) => f.value > 0)
    : [];

  // Colonnes de heatmap (segment × métrique 0-100) + séries de courbe.
  const heatmapColumns: HeatmapColumn[] = [
    { key: "maturityScore", label: isFr ? "Maturité" : "Maturity", get: (s) => s.maturityScore },
    {
      key: "competitors_use_ai",
      label: isFr ? "Concurrents IA" : "Competitors w/ AI",
      get: (s) => s.insights.competitors_use_ai ?? 0,
    },
    {
      key: "no_formal_strategy",
      label: isFr ? "Sans stratégie" : "No strategy",
      get: (s) => s.insights.no_formal_strategy ?? 0,
    },
    { key: "rgpd_concern", label: "RGPD", get: (s) => s.insights.rgpd_concern ?? 0 },
    {
      key: "investment_intent",
      label: isFr ? "Investir" : "Investing",
      get: (s) => s.insights.investment_intent ?? 0,
    },
  ];
  const trendSeries: TrendSeries[] = [
    {
      key: "competitors_use_ai",
      label: isFr ? "Concurrents IA" : "Competitors w/ AI",
      color: "#1a4dd9", // hex-ok: palette dataviz courbes observatoire
    },
    {
      key: "no_formal_strategy",
      label: isFr ? "Sans stratégie" : "No strategy",
      color: "#c24a1b", // hex-ok: palette dataviz courbes observatoire
    },
    { key: "rgpd_concern", label: "RGPD", color: "#0f766e" }, // hex-ok: palette dataviz courbes observatoire
    {
      key: "investment_intent",
      label: isFr ? "Investir" : "Investing",
      color: "#b45309", // hex-ok: palette dataviz courbes observatoire
    },
  ];
  const heatmapLabels = { segment: isFr ? "Segment" : "Segment", sample: "n" };

  // Sommaire (TOC) — ancres vers les sections réellement présentes, dans l'ordre.
  const tocItems: Array<{ href: string; label: string }> = [];
  if (analysis) tocItems.push({ href: "#decryptage", label: isFr ? "Décryptage" : "Analysis" });
  if (segments && hasData)
    tocItems.push({ href: "#segments", label: isFr ? "Par segment" : "By segment" });
  if (history.length >= 2)
    tocItems.push({ href: "#evolution", label: isFr ? "Évolution" : "Evolution" });
  tocItems.push({ href: "#methodologie", label: isFr ? "Méthodologie" : "Methodology" });
  tocItems.push({ href: "#details", label: isFr ? "Détail par question" : "By question" });
  tocItems.push({ href: "#faq", label: "FAQ" });

  // FAQ (AEO).
  const faqItems = (["q1", "q2", "q3", "q4"] as const).map((k) => ({
    question: t(`faq.${k}.question`),
    answer: t(`faq.${k}.answer`),
  }));

  const pageUrl = `${SITE_URL}/${loc}${PAGE_PATH}`;
  const studyName = isFr ? STUDY_NAME_FR : STUDY_NAME_EN;
  const breadcrumbItems = [
    { href: PAGE_PATH, label: isFr ? "Observatoire IA 2026" : "AI Observatory 2026" },
  ];

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${pageUrl}#dataset`,
    name: studyName,
    description: t("meta.resultsDescription"),
    url: pageUrl,
    identifier: pageUrl,
    inLanguage: loc,
    isAccessibleForFree: true,
    license: STUDY_LICENSE_URL,
    creativeWorkStatus: "Published",
    temporalCoverage: STUDY_TEMPORAL_COVERAGE,
    spatialCoverage: "France",
    variableMeasured: [...STUDY_VARIABLES_MEASURED],
    measurementTechnique: STUDY_MEASUREMENT_TECHNIQUE,
    dateModified: SITE_EDITORIAL_DATE,
    creator: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
    },
    ...(hasData ? { numberOfItems: total } : {}),
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: CSV_URL,
        name: `${studyName} — CSV`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: JSON_URL,
        name: `${studyName} — JSON`,
      },
    ],
  };

  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: PAGE_PATH,
    id: pageUrl,
    name: t("meta.resultsTitle"),
    description: t("meta.resultsDescription"),
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    speakable: { selectors: ["h1", ".direct-answer", "[data-answer]"] },
    about: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
    },
  });

  const faqJsonLd = buildFaqSpeakableJsonLd({ items: faqItems });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO — H1 = nom officiel de l'étude */}
      <Section
        titleAs="h1"
        eyebrow={t("hero.eyebrow")}
        title={studyName}
        description={t("hero.subtitle")}
      >
        {hasData ? (
          <p className="mb-8 flex items-baseline gap-3" data-answer="">
            <span className="text-terracotta text-5xl leading-none font-bold tabular-nums sm:text-6xl">
              {total.toLocaleString("fr-FR")}
            </span>
            <span className="text-fg-soft text-lg font-medium">
              {isFr ? "réponses complètes" : "complete responses"}
            </span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-4">
          <Button asChild size="lg" shape="pill">
            <Link href="/observatoire-ia/participer">
              {t("results.participateCta")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" shape="pill" variant="outline">
            <a href={CSV_URL}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("results.downloadCsv")}
            </a>
          </Button>
          <Button asChild size="lg" shape="pill" variant="outline">
            <a href={JSON_URL}>
              <FileJson className="h-4 w-4" aria-hidden="true" />
              {isFr ? "Données JSON" : "JSON data"}
            </a>
          </Button>
        </div>
      </Section>

      {/* EN BREF — un H2 par constat, phrase autoportante answer-first (.direct-answer) */}
      <Section tone="paper" eyebrow={t("results.inBrief")}>
        {hasData ? (
          <ul className="grid list-none gap-6 sm:grid-cols-2">
            {findings.map((f) => (
              <li key={f.key} className="border-border bg-canvas rounded-lg border p-6">
                <h2
                  className="direct-answer text-fg text-xl leading-snug font-semibold"
                  data-answer=""
                >
                  {t(`insights.${f.key}`, { value: f.value })}
                </h2>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-soft max-w-2xl text-lg leading-relaxed">{t("results.pending")}</p>
        )}
      </Section>

      {/* SOMMAIRE — navigation interne (jump-links) vers les sections présentes */}
      {hasData ? (
        <Container className="py-4">
          <nav aria-label={isFr ? "Sommaire" : "Table of contents"}>
            <p className="text-fg-muted mb-3 text-xs font-semibold tracking-wide uppercase">
              {isFr ? "Sommaire" : "Contents"}
            </p>
            <ul className="flex flex-wrap gap-2">
              {tocItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="border-border bg-canvas text-fg-soft hover:border-terracotta hover:text-terracotta inline-flex rounded-full border px-3 py-1.5 text-sm transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      ) : null}

      {/* DÉCRYPTAGE — synthèse rédigée par IA, ancrée sur les chiffres vérifiés */}
      {analysis ? (
        <Section
          id="decryptage"
          tone="canvas"
          titleAs="h2"
          eyebrow={isFr ? "Décryptage" : "Analysis"}
          title={isFr ? "Ce que révèlent les chiffres" : "What the figures reveal"}
        >
          <div className="max-w-3xl space-y-7">
            <p className="text-fg text-lg leading-relaxed" data-answer="">
              {analysis.payload.overview}
            </p>

            {analysis.payload.takeaways.length > 0 ? (
              <div>
                <h3 className="text-fg mb-3 text-base font-semibold">
                  {isFr ? "Points clés" : "Key takeaways"}
                </h3>
                <ul className="text-fg-soft list-disc space-y-2 pl-5 leading-relaxed">
                  {analysis.payload.takeaways.map((tk, i) => (
                    <li key={i}>{tk}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {analysis.payload.recommendations.length > 0 ? (
              <div>
                <h3 className="text-fg mb-3 text-base font-semibold">
                  {isFr ? "Recommandations" : "Recommendations"}
                </h3>
                <ul className="text-fg-soft list-disc space-y-2 pl-5 leading-relaxed">
                  {analysis.payload.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-fg-muted text-xs leading-relaxed">
              {isFr
                ? "Synthèse générée par IA à partir des seules données vérifiées de l'observatoire (aucun chiffre n'est inventé). Mise à jour automatique au fil des réponses."
                : "AI-generated summary based solely on the observatory's verified data (no figure is fabricated). Updated automatically as responses come in."}
            </p>
          </div>
        </Section>
      ) : null}

      {/* RÉSULTATS PAR SEGMENT — heatmaps taille / secteur / région */}
      {segments && hasData ? (
        <Section
          id="segments"
          tone="paper"
          titleAs="h2"
          title={isFr ? "Résultats par segment" : "Results by segment"}
          description={
            isFr
              ? "Maturité IA et constats clés croisés par taille d'entreprise, secteur d'activité et région. Plus la cellule est foncée, plus la valeur est élevée."
              : "AI maturity and key findings broken down by company size, sector and region. Darker cells mean higher values."
          }
        >
          <div className="space-y-8">
            {segments.companySize && segments.companySize.length > 0 ? (
              <SegmentHeatmap
                id="seg-size"
                title={isFr ? "Par taille d'entreprise" : "By company size"}
                rows={segments.companySize}
                labelFor={sizeLabel}
                columns={heatmapColumns}
                labels={heatmapLabels}
              />
            ) : null}
            {segments.sector && segments.sector.length > 0 ? (
              <SegmentHeatmap
                id="seg-sector"
                title={isFr ? "Par secteur d'activité" : "By sector"}
                rows={segments.sector}
                labelFor={sectorLabel}
                columns={heatmapColumns}
                labels={heatmapLabels}
              />
            ) : null}
            {segments.region && segments.region.length > 0 ? (
              <SegmentHeatmap
                id="seg-region"
                title={isFr ? "Par région" : "By region"}
                rows={segments.region}
                labelFor={regionLabel}
                columns={heatmapColumns}
                labels={heatmapLabels}
              />
            ) : null}
            <p className="text-fg-muted text-xs">
              {isFr
                ? "Seuls les segments comptant au moins 5 réponses sont affichés (anti-bruit)."
                : "Only segments with at least 5 responses are shown (noise reduction)."}
            </p>
          </div>
        </Section>
      ) : null}

      {/* ÉVOLUTION DANS LE TEMPS — courbe des constats phares */}
      {history.length >= 2 ? (
        <Section
          id="evolution"
          tone="sand"
          titleAs="h2"
          title={isFr ? "Évolution dans le temps" : "Evolution over time"}
          description={
            isFr
              ? "Évolution des constats phares au fil de l'accumulation des réponses."
              : "How the key findings evolve as responses accumulate."
          }
        >
          <TrendChart
            id="trend"
            title={isFr ? "Constats phares (%)" : "Key findings (%)"}
            points={history}
            series={trendSeries}
            labels={{
              date: isFr ? "Date" : "Date",
              sample: isFr ? "Répondants" : "Respondents",
            }}
          />
        </Section>
      ) : null}

      {/* MÉTHODOLOGIE */}
      <Section id="methodologie" tone="sand" titleAs="h2" title={t("methodo.title")}>
        <dl className="grid max-w-3xl gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted text-sm font-medium">{t("methodo.sample")}</dt>
            <dd className="text-fg text-base">{t("methodo.sampleValue", { count: total })}</dd>
          </div>
          <div>
            <dt className="text-fg-muted text-sm font-medium">{t("methodo.period")}</dt>
            <dd className="text-fg text-base">
              <time dateTime={STUDY_PERIOD_START}>{isFr ? "6 janvier" : "6 January"}</time>
              {" – "}
              <time dateTime={STUDY_PERIOD_END}>
                {isFr ? "28 février 2026" : "28 February 2026"}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted text-sm font-medium">{t("methodo.method")}</dt>
            <dd className="text-fg text-base">{t("methodo.methodValue")}</dd>
          </div>
          <div>
            <dt className="text-fg-muted text-sm font-medium">{t("methodo.coverage")}</dt>
            <dd className="text-fg text-base">
              {t("methodo.coverageValue", {
                regions: STUDY_REGION_COUNT,
                sectors: STUDY_SECTOR_COUNT,
                sizes: STUDY_COMPANY_SIZE_COUNT,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted text-sm font-medium">{t("methodo.license")}</dt>
            <dd className="text-fg text-base">
              <a
                href={STUDY_LICENSE_URL}
                target="_blank"
                rel="license noopener"
                className="text-terracotta underline"
              >
                {STUDY_LICENSE_LABEL}
              </a>
            </dd>
          </div>
        </dl>
      </Section>

      {/* RÉSULTATS DÉTAILLÉS — filtres SSR + graphiques */}
      <Section
        id="details"
        titleAs="h2"
        title={isFr ? "Résultats détaillés par question" : "Detailed results by question"}
      >
        <div className="space-y-8">
          <ObservatoireFilters
            action={`/${loc}${PAGE_PATH}`}
            current={{ size: fSize, sector: fSector, region: fRegion }}
            sizeOptions={COMPANY_SIZE_VALUES.map((v) => ({
              value: v,
              label: t(`questions.companySize.options.${v}`),
            }))}
            sectorOptions={KB_SECTOR_TAGS.map((s) => ({
              value: s.slug,
              label: isFr ? s.labelFr : s.labelEn,
            }))}
            regionOptions={STUDY_REGIONS.map((r) => ({
              value: r.slug,
              label: isFr ? r.nameFr : r.nameEn,
            }))}
            labels={{
              title: t("results.filtersTitle"),
              size: t("results.filterSize"),
              sector: t("results.filterSector"),
              region: t("results.filterRegion"),
              all: t("results.filterAll"),
              apply: t("results.filterApply"),
              reset: t("results.filterReset"),
            }}
          />

          <p className="text-fg-muted text-sm">{t("results.basedOn", { count: total })}</p>

          {hasData ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {BAROMETER_QUESTIONS.map((q) => {
                const rows = toRows(q.id, q.source);
                if (rows.length === 0) return null;
                return (
                  <DistributionChart
                    key={q.id}
                    id={q.id}
                    title={t(`questions.${q.id}.label`)}
                    rows={rows}
                    labels={{
                      share: isFr ? "Part" : "Share",
                      responses: isFr ? "Réponses" : "Responses",
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-fg-soft text-base">{t("results.pending")}</p>
          )}
        </div>
      </Section>

      {/* COMMENT CITER */}
      <Section
        tone="paper"
        titleAs="h2"
        title={t("results.citeTitle")}
        description={t("results.citeBody")}
      >
        <div className="border-border bg-canvas max-w-2xl rounded-lg border p-6">
          <p className="text-fg font-mono text-sm" data-answer="">
            {STUDY_ATTRIBUTION}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild shape="pill" variant="outline">
              <a href={CSV_URL}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("results.downloadCsv")}
              </a>
            </Button>
            <Button asChild shape="pill" variant="outline">
              <a href={JSON_URL}>
                <FileJson className="h-4 w-4" aria-hidden="true" />
                {isFr ? "Données JSON" : "JSON data"}
              </a>
            </Button>
          </div>
        </div>
      </Section>

      {/* FAQ (AEO) */}
      <Section id="faq" tone="canvas" titleAs="h2" title="FAQ">
        <dl className="mx-auto max-w-3xl space-y-6">
          {faqItems.map((f, i) => (
            <div key={i} className="border-border border-b pb-6">
              <dt className="text-fg text-lg font-semibold" data-faq-q="">
                {f.question}
              </dt>
              <dd className="text-fg-soft mt-2 leading-relaxed" data-faq-a="">
                {f.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* CTA participer */}
      <Section tone="mocha" titleAs="h2" title={t("form.hook")} description={t("form.subhook")}>
        <Button asChild size="lg" shape="pill">
          <Link href="/observatoire-ia/participer">
            {t("results.participateCta")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </Section>

      <JsonLd data={datasetJsonLd} scriptId="observatoire-dataset" />
      <JsonLd data={webPageJsonLd} scriptId="observatoire-webpage" />
      <JsonLd data={faqJsonLd} scriptId="observatoire-faq" />
    </>
  );
}
