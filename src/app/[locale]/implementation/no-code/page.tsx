import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getImplementation } from "@/content/implementation";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildImageGraphJsonLd,
} from "@/lib/seo";
import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "no-code" as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const a = getImplementation(SLUG);
  const c = a[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? a.pathFr : a.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: a.pathFr, en: a.pathEn },
  });
}

export default async function NoCodePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const a = getImplementation(SLUG);
  const copy = a[loc];
  const path = loc === "fr" ? a.pathFr : a.pathEn;
  const isFr = loc === "fr";
  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « automatisation no-code IA », « n8n Make Zapier IA TPE PME ».
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — automatisations no-code IA pour entreprises"
          : "Axion-IA team — no-code AI automations for companies",
        alt: isFr
          ? "Équipe Axion-IA déploie des automatisations no-code IA pour TPE et PME — workflows n8n, Make, Zapier avec briques IA (résumé, classification, génération), maintenance simplifiée par les équipes métier."
          : "Axion-IA team deploys no-code AI automations for small businesses and SMEs — n8n, Make, Zapier workflows with AI bricks (summarization, classification, generation), easy maintenance by business teams.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, expert no-code IA"
          : "William — Axion-IA founder, no-code AI expert",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Pilote personnellement les projets d'automatisation no-code IA pour dirigeants TPE et PME — sélection plateforme, design des flows, transfert d'autonomie aux équipes."
          : "Portrait of William, Axion-IA founder. Personally drives no-code AI automation projects for small business and SME executives — platform selection, flow design, autonomy transfer to teams.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "AI implementation · no-code",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    imagesJsonLd,
  ];
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/implementation", label: isFr ? "Implémentation IA" : "AI implementation" },
    { href: `/implementation/${SLUG}`, label: copy.title },
  ];
  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <ProductPageTemplate
        isFr={isFr}
        accent="purple"
        copy={copy}
        ctaPrimaryHref="/contact?type=implementation&subType=no-code"
        ctaSecondaryHref="/cas-concrets"
        jsonLd={jsonLd}
      />
      {/* Maillage interne — sous-services liés */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Services liés" : "Related services"}
        title={isFr ? "Voir aussi" : "See also"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              href: "/implementation/integrations",
              label: isFr ? "Intégrations API" : "API Integrations",
              description: isFr
                ? "Connexions API et workflows IA"
                : "API connections and AI workflows",
            },
            {
              href: "/implementation/agents",
              label: isFr ? "Agents IA" : "AI Agents",
              description: isFr ? "Agents autonomes end-to-end" : "Autonomous end-to-end agents",
            },
          ].map((s) => (
            <Link
              key={s.href}
              href={s.href as never}
              className="border-border bg-paper hover:border-terracotta block rounded-2xl border p-5 transition"
            >
              <p className="text-fg text-base font-semibold">{s.label}</p>
              <p className="text-fg-soft mt-1 text-sm">{s.description}</p>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
