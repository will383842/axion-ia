import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ShieldCheck, Clock, ListChecks, ArrowRight } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildWebPageJsonLd, SITE_URL } from "@/lib/seo";
import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import {
  STUDY_REGIONS,
  STUDY_NAME_FR,
  STUDY_NAME_EN,
  STUDY_QUESTION_COUNT,
  STUDY_LICENSE_URL,
  STUDY_LICENSE_LABEL,
} from "@/content/observatoire/study";
import { BAROMETER_QUESTIONS, MATURITY_GE_POC } from "@/content/observatoire/questions";
import { BarometerForm, type FormQuestion } from "@/components/observatoire/BarometerForm";

const PAGE_PATH = "/observatoire-ia/participer";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "observatoire" });
  return buildProductMetadata({
    locale: locale as Locale,
    path: PAGE_PATH,
    title: t("meta.participateTitle"),
    description: t("meta.participateDescription"),
    alternates: { fr: PAGE_PATH, en: PAGE_PATH },
    // Brand-fix 2026-06-20 — défaut terracotta (était "primary"/bleu off-brand).
  });
}

export default async function ParticiperPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const t = await getTranslations({ locale: loc, namespace: "observatoire" });

  // Résolution serveur de tous les libellés (i18n + SSOT) → composant client « bête ».
  const questions: FormQuestion[] = BAROMETER_QUESTIONS.map((q) => {
    let options;
    if (q.source === "sector") {
      options = KB_SECTOR_TAGS.map((s) => ({ value: s.slug, label: isFr ? s.labelFr : s.labelEn }));
    } else if (q.source === "region") {
      options = STUDY_REGIONS.map((r) => ({ value: r.slug, label: isFr ? r.nameFr : r.nameEn }));
    } else {
      options = (q.options ?? []).map((v) => ({
        value: v,
        label: t(`questions.${q.id}.options.${v}`),
      }));
    }
    const hint =
      q.type === "multi"
        ? q.maxSelections
          ? `${t("form.multiHint")} · ${t("form.maxHint", { max: q.maxSelections })}`
          : t("form.multiHint")
        : undefined;
    return {
      id: q.id,
      type: q.type,
      label: t(`questions.${q.id}.label`),
      hint,
      options,
      maxSelections: q.maxSelections,
      conditionalOnMaturityPoc: q.conditionalOnMaturityPoc,
    };
  });

  const breadcrumbItems = [
    { href: "/observatoire-ia", label: isFr ? "Observatoire IA 2026" : "AI Observatory 2026" },
    { href: PAGE_PATH, label: isFr ? "Participer" : "Take part" },
  ];

  const studyName = isFr ? STUDY_NAME_FR : STUDY_NAME_EN;
  const pageUrl = `${SITE_URL}/${loc}${PAGE_PATH}`;

  // Réassurance (answer-first, citables) — anonymat, durée, nombre de questions.
  const reassurance = [
    {
      icon: ShieldCheck,
      title: isFr ? "100 % anonyme" : "100% anonymous",
      body: isFr
        ? "Aucune donnée personnelle collectée. Réponses agrégées, conformes RGPD."
        : "No personal data collected. Aggregated, GDPR-compliant responses.",
    },
    {
      icon: Clock,
      title: isFr ? "2 à 3 minutes" : "2 to 3 minutes",
      body: isFr
        ? "Un questionnaire court, en ligne, que vous remplissez vous-même."
        : "A short, self-administered online questionnaire.",
    },
    {
      icon: ListChecks,
      title: isFr ? `${STUDY_QUESTION_COUNT} questions` : `${STUDY_QUESTION_COUNT} questions`,
      body: isFr
        ? "Maturité, usages, budget, freins, formation, RGPD, investissement."
        : "Maturity, use cases, budget, barriers, training, GDPR, investment.",
    },
  ];

  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: PAGE_PATH,
    id: pageUrl,
    name: t("meta.participateTitle"),
    description: t("meta.participateDescription"),
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    speakable: { selectors: ["h1", ".direct-answer", "[data-answer]"] },
    about: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
    },
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={t("hero.eyebrow")}
        title={t("form.hook")}
        description={t("form.subhook")}
      >
        {/* Réassurance answer-first */}
        <ul className="mb-8 grid list-none gap-4 sm:grid-cols-3">
          {reassurance.map((r) => (
            <li key={r.title} className="border-border bg-canvas rounded-lg border p-5">
              <r.icon className="text-terracotta h-5 w-5" aria-hidden="true" />
              <p className="text-fg mt-3 font-semibold" data-answer="">
                {r.title}
              </p>
              <p className="text-fg-soft mt-1 text-sm leading-relaxed">{r.body}</p>
            </li>
          ))}
        </ul>

        <BarometerForm
          questions={questions}
          locale={loc}
          maturityGePoc={[...MATURITY_GE_POC]}
          labels={{
            stepOf: t.raw("form.stepOf") as string,
            next: t("form.next"),
            previous: t("form.previous"),
            submit: t("form.submit"),
            submitting: t("form.submitting"),
            required: t("form.required"),
            thanksTitle: t("form.thanksTitle"),
            thanksBody: t("form.thanksBody"),
            seeResults: t("form.seeResults"),
            error: t("form.error"),
          }}
        />
      </Section>

      {/* POURQUOI PARTICIPER — contenu éditorial (anti-thin, SEO/AEO) */}
      <Section
        tone="paper"
        titleAs="h2"
        title={isFr ? "Pourquoi participer ?" : "Why take part?"}
      >
        <div className="max-w-3xl space-y-4">
          <p className="text-fg-soft text-lg leading-relaxed" data-answer="">
            {isFr
              ? `En répondant à « ${studyName} », vous contribuez au premier panorama indépendant et ouvert de l'adoption de l'IA par les entreprises françaises. Vos réponses, strictement anonymes, nourrissent des statistiques publiques par secteur, région et taille d'entreprise.`
              : `By answering "${studyName}", you contribute to the first independent, open snapshot of AI adoption among French companies. Your strictly anonymous answers feed public statistics by sector, region and company size.`}
          </p>
          <p className="text-fg-soft leading-relaxed">
            {isFr
              ? "En retour, vous accédez immédiatement aux résultats agrégés et pouvez vous comparer à votre secteur et à votre région. Les données sont publiées en open data."
              : "In return, you get immediate access to the aggregated results and can benchmark against your sector and region. The data is published as open data."}{" "}
            <a
              href={STUDY_LICENSE_URL}
              target="_blank"
              rel="license noopener"
              className="text-terracotta underline"
            >
              {STUDY_LICENSE_LABEL}
            </a>
            .
          </p>
          <div className="pt-2">
            <Button asChild shape="pill" variant="outline">
              <Link href="/observatoire-ia">
                {isFr ? "Voir les résultats" : "See the results"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <JsonLd data={webPageJsonLd} scriptId="participer-webpage" />
    </>
  );
}
