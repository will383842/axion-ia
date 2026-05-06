import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/centre-aide",
    title: locale === "fr" ? "Centre d'aide · AxionIA" : "Help center · AxionIA",
    description:
      locale === "fr"
        ? "Centre d'aide AxionIA : guides pratiques, tutoriels, support utilisateur."
        : "AxionIA help center: practical guides, tutorials, user support.",
    alternates: { fr: "/centre-aide", en: "/help" },
  });
}

export default async function HelpCenter({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Centre d'aide" : "Help center", href: "/centre-aide" },
    ],
  });

  const sections = [
    {
      key: "intervention",
      title: isFr ? "Avant l'intervention" : "Before the session",
      desc: isFr
        ? "Comment se préparer, quelles données fournir, qui inviter ?"
        : "How to prepare, what data to provide, who to invite?",
    },
    {
      key: "audit",
      title: isFr ? "Comprendre un audit IA" : "Understanding an AI audit",
      desc: isFr
        ? "Périmètre, livrables, durée, modalité à distance ou sur site."
        : "Scope, deliverables, duration, remote or on-site modality.",
    },
    {
      key: "implementation",
      title: isFr ? "Implémentation IA" : "AI implementation",
      desc: isFr
        ? "Phases d'un projet, choix techniques, gouvernance des données."
        : "Project phases, technical choices, data governance.",
    },
    {
      key: "billing",
      title: isFr ? "Facturation & TVA EE" : "Billing & EU VAT",
      desc: isFr
        ? "Société estonienne, virement, facturation TVA selon résidence."
        : "Estonian company, bank transfer, VAT billing per residence.",
    },
    {
      key: "data",
      title: isFr ? "Sécurité & données" : "Security & data",
      desc: isFr
        ? "Hébergement UE, RGPD, modèles open-source vs propriétaires."
        : "EU hosting, GDPR, open-source vs proprietary models.",
    },
    {
      key: "support",
      title: isFr ? "Support post-livraison" : "Post-delivery support",
      desc: isFr
        ? "30 jours inclus, escalade, maintenance corrective."
        : "30 days included, escalation, corrective maintenance.",
    },
  ];

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Centre d'aide" : "Help center"}
        title={isFr ? "Trouver une réponse rapide" : "Find a quick answer"}
        description={
          isFr
            ? "Articles d'aide groupés par thématique. Sprint 15 ajoute une recherche FTS sur tout le contenu."
            : "Help articles grouped by theme. Sprint 15 adds full-text search across the content."
        }
      />

      <Section eyebrow={isFr ? "Thématiques" : "Topics"}>
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <li key={section.key}>
                <Card>
                  <CardHeader>
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      {isFr
                        ? "Articles publiés au Sprint 15 (fixtures Prisma)."
                        : "Articles published in Sprint 15 (Prisma fixtures)."}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Question non couverte ?" : "Question not covered?"}
        description={
          isFr
            ? "Contactez-nous — réponse sous 48 h ouvrées."
            : "Contact us — reply within 48 business hours."
        }
        cta={
          <Cta href="/contact" size="lg">
            Contact →
          </Cta>
        }
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
