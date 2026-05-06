import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { IMPLEMENTATIONS } from "@/content/implementation";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/implementation",
    title:
      locale === "fr"
        ? "Implémentation IA · 9 prestations · AxionIA"
        : "AI implementation · 9 services · AxionIA",
    description:
      locale === "fr"
        ? "9 prestations d'implémentation IA pour entreprises : chatbot, automatisation, structuration, CRM/ERP, documents, agents, intégrations, no-code, IA Custom premium."
        : "9 AI implementation services for companies: chatbot, automation, structuring, CRM/ERP, documents, agents, integrations, no-code, premium custom AI.",
  });
}

export default async function ImplementationListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Implémentation IA" : "AI implementation", href: "/implementation" },
    ],
  });

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Module 3 · accent purple" : "Module 3 · purple accent"}
        title={isFr ? "Implémentation IA" : "AI implementation"}
        description={
          isFr
            ? "9 prestations IA pour industrialiser un usage. De l'automatisation simple (à partir de 990 €) à l'IA Custom (jusqu'à 50 000 €)."
            : "9 AI services to industrialize a use case. From simple automation (from €990) to Custom AI (up to €50k)."
        }
      />

      <Section eyebrow={isFr ? "Choisir une prestation" : "Pick a service"}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IMPLEMENTATIONS.map((item) => {
            const c = item[loc];
            return (
              <li key={item.slug}>
                <CaseStudyCard
                  href={`/implementation/${item.slug}`}
                  title={c.title}
                  excerpt={c.answer.slice(0, 160) + "…"}
                  industry={c.eyebrow}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Premium" : "Premium"}
        title={isFr ? "IA Custom · grands comptes" : "Custom AI · large accounts"}
        description={
          isFr
            ? "Pour les implémentations sur mesure 8 000 € - 50 000 € HT. Équipe dédiée, modèles fine-tuned sur vos données."
            : "For tailor-made implementations €8k - €50k (excl. VAT). Dedicated team, models fine-tuned on your data."
        }
        cta={
          <Cta href="/implementation/ia-custom" size="lg">
            {isFr ? "Découvrir IA Custom" : "Discover Custom AI"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
