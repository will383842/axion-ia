import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import { STUDY_REGIONS } from "@/content/observatoire/study";
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
    </>
  );
}
