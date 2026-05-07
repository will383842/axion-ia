import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Map as MapIcon, TrendingUp, ClipboardCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getAudit } from "@/content/audit";
import { buildProductMetadata, buildServiceJsonLd, buildFaqJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "strategique-pme" as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const a = getAudit(SLUG);
  const c = a[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? a.pathFr : a.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: a.pathFr, en: a.pathEn },
  });
}

export default async function AuditStrategiquePmePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const a = getAudit(SLUG);
  const copy = a[loc];
  const path = loc === "fr" ? a.pathFr : a.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "Strategic AI audit SMB",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
  ];
  const isFr = loc === "fr";
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/audit", label: isFr ? "Audit & optimisation" : "Audit & optimization" },
    { href: `/audit/${SLUG}`, label: copy.title },
  ];
  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? "Vos livrables" : "Your deliverables"}
      title={isFr ? "Audit stratégique PME" : "Strategic SMB audit"}
      accent="orange"
      blocks={[
        {
          icon: MapIcon,
          prefix: isFr ? "Livrable A" : "Deliverable A",
          label: isFr ? "Cartographie complète" : "Full mapping",
          detail: isFr
            ? "Tous vos process audités, opportunités IA détaillées par service."
            : "All your processes audited, AI opportunities detailed per department.",
        },
        {
          icon: TrendingUp,
          prefix: isFr ? "Livrable B" : "Deliverable B",
          label: isFr ? "Scoring ROI / complexité" : "ROI / complexity scoring",
          detail: isFr
            ? "Chaque opportunité notée, classée, comparée — choix faciles à arbitrer."
            : "Each opportunity scored, ranked, compared — easy arbitration.",
        },
        {
          icon: ClipboardCheck,
          prefix: isFr ? "Livrable C" : "Deliverable C",
          label: isFr ? "Plan chiffré priorisé" : "Costed prioritised plan",
          detail: isFr
            ? "Roadmap d'implémentation, budget, ordre, dépendances. PDF 25-40 pages."
            : "Implementation roadmap, budget, order, dependencies. 25-40 page PDF.",
        },
      ]}
      ariaLabel={
        isFr
          ? "Schéma : 3 livrables de l'audit stratégique PME — cartographie complète, scoring ROI/complexité, plan chiffré priorisé."
          : "Diagram: 3 deliverables of the strategic SMB audit — full mapping, ROI/complexity scoring, costed prioritised plan."
      }
    />
  );

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <ProductPageTemplate
        isFr={isFr}
        accent="orange"
        copy={copy}
        ctaPrimaryHref={`/audit/demande?type=${SLUG}`}
        ctaSecondaryHref="/audit"
        heroSchema={heroSchema}
        jsonLd={jsonLd}
      />
    </>
  );
}
