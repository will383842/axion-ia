import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Map as MapIcon, BarChart3, ClipboardCheck } from "lucide-react";
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

const SLUG = "flash" as const;

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

export default async function AuditFlashPage({ params }: Props) {
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
      serviceType: "AI flash diagnosis",
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
        jsonLd={jsonLd}
        heroSchema={
          <DetailHeroSchema
            eyebrow={isFr ? "Vos 3 livrables" : "Your 3 deliverables"}
            title={
              isFr
                ? "Audit flash · ce que vous repartez avec"
                : "Flash audit · what you walk away with"
            }
            accent="orange"
            ariaLabel={
              isFr
                ? "Schéma : 3 livrables d'un audit flash AxionIA — cartographie des process, scoring ROI/complexité, plan d'action 30/60/90 jours."
                : "Diagram: 3 deliverables of an AxionIA flash audit — process mapping, ROI/complexity scoring, 30/60/90-day action plan."
            }
            blocks={[
              {
                icon: MapIcon,
                prefix: isFr ? "Livrable 1" : "Deliverable 1",
                label: isFr ? "Cartographie" : "Process map",
                detail: isFr
                  ? "Vos process actuels mappés, points de friction identifiés."
                  : "Your current processes mapped, friction points identified.",
              },
              {
                icon: BarChart3,
                prefix: isFr ? "Livrable 2" : "Deliverable 2",
                label: isFr ? "Scoring ROI" : "ROI scoring",
                detail: isFr
                  ? "Opportunités IA classées par ROI estimé et complexité."
                  : "AI opportunities ranked by estimated ROI and complexity.",
              },
              {
                icon: ClipboardCheck,
                prefix: isFr ? "Livrable 3" : "Deliverable 3",
                label: isFr ? "Plan 30/60/90 jours" : "30/60/90-day plan",
                detail: isFr
                  ? "Feuille de route actionnable, priorités séquencées."
                  : "Actionable roadmap, sequenced priorities.",
              },
            ]}
          />
        }
      />
    </>
  );
}
