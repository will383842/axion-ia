/**
 * Page /podcast — offre de tournage de podcast avec le dirigeant, gratuite et
 * sans contrepartie. Axion-IA se déplace dans les locaux du client.
 *
 * Cible du flyer papier imprimé + du QR dynamique `/qr/podcast` (créé côté
 * console admin QR). Décision Will 2026-07-21 : aucune mention de rareté ni de
 * durée limitée, et aucun lien éditorial avec les formations.
 *
 * Full server component : seul le formulaire (`PodcastRequestForm`) est client
 * (consentement + Turnstile + soumission). JSON-LD : WebPage.
 */

import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { CalendarCheck, ClipboardList, Video } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { PodcastRequestForm } from "@/components/forms/PodcastRequestForm";
import { buildProductMetadata, buildWebPageJsonLd, SITE_EDITORIAL_DATE } from "@/lib/seo";

const PAGE_PATH = "/podcast";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "podcast" });
  return buildProductMetadata({
    locale: locale as Locale,
    path: PAGE_PATH,
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { fr: PAGE_PATH, en: PAGE_PATH },
  });
}

export default async function PodcastPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "podcast" });

  const webPageJsonLd = buildWebPageJsonLd({
    locale,
    path: PAGE_PATH,
    name: t("meta.title"),
    description: t("meta.description"),
    dateModified: SITE_EDITORIAL_DATE,
    speakable: true,
  });

  const steps = [
    { icon: ClipboardList, title: t("how.step1Title"), body: t("how.step1Body") },
    { icon: CalendarCheck, title: t("how.step2Title"), body: t("how.step2Body") },
    { icon: Video, title: t("how.step3Title"), body: t("how.step3Body") },
  ];

  const included = [
    t("included.item1"),
    t("included.item2"),
    t("included.item3"),
    t("included.item4"),
  ];

  return (
    <>
      <JsonLd data={webPageJsonLd} />
      <Section
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        titleEm={t("hero.titleEm")}
        titleAs="h1"
        tone="halo-warm"
        description={t("hero.description")}
      >
        <Breadcrumbs items={[{ href: PAGE_PATH, label: t("breadcrumb") }]} />
      </Section>

      <Section tone="canvas">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
          <aside className="space-y-8">
            <div className="space-y-3">
              <h2 className="font-serif text-2xl font-semibold">{t("intro.title")}</h2>
              <p className="text-fg-soft text-sm">{t("intro.body")}</p>
            </div>

            <div className="space-y-5">
              <h2 className="font-serif text-2xl font-semibold">{t("how.title")}</h2>
              <ol className="space-y-5">
                {steps.map((s) => (
                  <li key={s.title} className="flex gap-3">
                    <s.icon
                      aria-hidden="true"
                      className="text-terracotta mt-0.5 h-6 w-6 flex-shrink-0"
                      strokeWidth={1.75}
                    />
                    <div>
                      <p className="text-fg font-medium">{s.title}</p>
                      <p className="text-fg-soft text-sm">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-3">
              <h2 className="font-serif text-2xl font-semibold">{t("included.title")}</h2>
              <ul className="text-fg-soft space-y-2 text-sm">
                {included.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-terracotta">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div>
            <h2 className="font-serif text-2xl font-semibold">{t("form.title")}</h2>
            <p className="text-fg-soft mt-2 mb-6 text-sm">{t("form.intro")}</p>
            <PodcastRequestForm />
          </div>
        </div>
      </Section>
    </>
  );
}
