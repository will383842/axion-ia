// Configurateur public du widget « Offres d'emploi » — `/[locale]/carrieres/widget-builder`.
//
// Page outil (noindex) : choisir variant / nombre / thème, prévisualiser en
// direct, copier le code (iframe ou script auto-resize). Le rendu du widget vit
// dans la route d'embed `/[locale]/carrieres/widget` (framable, cf. csp.ts).

import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Cta } from "@/components/marketing/Cta";
import { SITE_URL } from "@/lib/seo";
import { CAREER_WIDGET_CITIES } from "@/lib/careers/city-widget";
import { WidgetBuilder } from "@/components/careers/WidgetBuilder";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return {
    title: isFr
      ? "Intégrer nos offres d'emploi · widget Axion-IA"
      : "Embed our job openings · Axion-IA widget",
    description: isFr
      ? "Générez le code d'intégration des offres d'emploi Axion-IA pour votre site : iframe ou script auto-redimensionné, aux couleurs du site."
      : "Generate the embed code for Axion-IA job openings on your site: iframe or auto-resizing script.",
    // Outil interne (pas de valeur SEO, contenu dynamique) → noindex.
    robots: { index: false, follow: true },
  };
}

export default async function WidgetBuilderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const steps = isFr
    ? [
        {
          n: "1",
          t: "Réglez l'affichage",
          d: "Cartes ou liste, thème clair ou sombre, nombre d'offres.",
        },
        {
          n: "2",
          t: "Copiez le code",
          d: "Format iframe (simple) ou script (auto-redimensionné).",
        },
        {
          n: "3",
          t: "Collez-le sur votre site",
          d: "Les offres se mettent à jour automatiquement.",
        },
      ]
    : [
        { n: "1", t: "Set the layout", d: "Cards or list, light or dark theme, number of roles." },
        { n: "2", t: "Copy the code", d: "iframe format (simple) or script (auto-resizing)." },
        { n: "3", t: "Paste it on your site", d: "Roles update automatically." },
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            { href: "/carrieres", label: isFr ? "Carrières" : "Careers" },
            {
              href: "/carrieres/widget-builder",
              label: isFr ? "Intégrer nos offres" : "Embed our roles",
            },
          ]}
        />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "Widget embarquable" : "Embeddable widget"}
        title={isFr ? "Intègre nos offres" : "Embed our"}
        titleEm={isFr ? "où tu veux" : "job openings"}
        description={
          isFr
            ? "Affichez les offres d'emploi Axion-IA.com sur votre site, votre intranet ou un job board partenaire — aux couleurs du site, mises à jour automatiquement. Choisissez le style, copiez le code, c'est en ligne."
            : "Show Axion-IA.com job openings on your website, intranet or a partner job board — on brand, auto-updated. Pick a style, copy the code, you're live."
        }
      >
        <div className="flex flex-wrap gap-4">
          <Cta href="#builder" track="widget-builder-start">
            {isFr ? "Générer mon code" : "Generate my code"}
          </Cta>
          <Cta href="/carrieres" variant="outline" track="widget-builder-see-careers">
            {isFr ? "Voir la page carrières" : "See the careers page"}
          </Cta>
        </div>
      </Section>

      {/* Comment ça marche */}
      <Section tone="paper">
        <Container>
          <ul className="grid gap-5 sm:grid-cols-3" role="list">
            {steps.map((s) => (
              <li key={s.n} className="border-border bg-bg shadow-subtle rounded-2xl border p-6">
                <span
                  className="bg-terracotta/10 text-terracotta flex h-10 w-10 items-center justify-center rounded-xl font-serif text-lg font-semibold"
                  aria-hidden
                >
                  {s.n}
                </span>
                <h2 className="mt-4 font-serif text-lg font-semibold">{s.t}</h2>
                <p className="text-fg-muted mt-2 text-sm">{s.d}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Configurateur */}
      <Section id="builder">
        <Container>
          <WidgetBuilder locale={loc} baseUrl={SITE_URL} cities={CAREER_WIDGET_CITIES} />
        </Container>
      </Section>
    </>
  );
}
