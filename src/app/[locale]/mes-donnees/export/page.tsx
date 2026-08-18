import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { GdprExportClient } from "./GdprExportClient";

// Audit E2E 2026-05-11 P0-CONF-03 — page créée.
// Avant ce patch : l'email envoyé par `/api/gdpr-export/request` contenait
// un lien vers `/mes-donnees/export` qui répondait 404. Le flow self-service
// GDPR (Article 20 RGPD — portabilité) était cassé bout-en-bout.

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: "/mes-donnees/export",
    title:
      locale === "fr"
        ? "Télécharger mes données RGPD · Axion-IA"
        : "Download my GDPR data · Axion-IA",
    description:
      locale === "fr"
        ? "Téléchargement self-service de vos données traitées par Axion-IA (RGPD Art. 20)."
        : "Self-service download of your data processed by Axion-IA (GDPR Art. 20).",
    alternates: { fr: "/mes-donnees/export", en: "/my-data/export" },
  });
  // Page noindex follow — flow privé authentifié par token signé.
  return { ...meta, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic"; // dépend de query params token + email

export default async function MyDataExportPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    { href: "/mes-donnees", label: isFr ? "Mes données" : "My data" },
    { href: "/mes-donnees/export", label: isFr ? "Télécharger" : "Download" },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "RGPD · Article 20" : "GDPR · Article 20"}
        title={isFr ? "Télécharger" : "Download"}
        titleEm={isFr ? "mes données" : "my data"}
        description={
          isFr
            ? "Le lien que vous avez reçu par email vous donne accès à un export complet de toutes les données qu'Axion-IA détient à votre sujet. Le téléchargement se fait au format JSON, structuré et lisible machine."
            : "The link you received by email grants you access to a complete export of all data Axion-IA holds about you. Download is in structured machine-readable JSON format."
        }
      />
      <Section>
        <Container className="max-w-2xl">
          <GdprExportClient locale={loc} />
        </Container>
      </Section>
    </>
  );
}
