import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/contact",
    title:
      locale === "fr"
        ? "Contact · AxionIA · réponse sous 48 h ouvrées"
        : "Contact · AxionIA · 48 business-hour reply",
    description:
      locale === "fr"
        ? "Demandez un devis ou réservez une intervention. Réponse sous 48 h ouvrées. AxionIA OÜ — cabinet IA opérationnel."
        : "Request a quote or book a session. Reply within 48 business hours. AxionIA OÜ — operational AI consultancy.",
  });
}

export default async function Contact({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: `${SITE_URL}/${loc}/contact`,
    inLanguage: loc,
    publisher: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: "Contact", href: "/contact" },
    ],
  });

  return (
    <>
      <Section
        eyebrow="Contact"
        title={isFr ? "Démarrer un échange" : "Start a conversation"}
        description={
          isFr
            ? "Réponse sous 48 h ouvrées. Le formulaire complet (5 étapes) sera mis en ligne au Sprint 13."
            : "Reply within 48 business hours. The full 5-step form will go live in Sprint 13."
        }
      />

      <Section eyebrow={isFr ? "Trois façons de nous joindre" : "Three ways to reach us"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{isFr ? "Réserver une intervention" : "Book a session"}</CardTitle>
              <CardDescription>
                {isFr
                  ? "Le calendrier maison affiche les créneaux disponibles en temps réel."
                  : "Live availability via the on-site calendar."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Cta href="/interventions/essentielle" variant="primary">
                {isFr ? "Réserver" : "Book"} →
              </Cta>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{isFr ? "Demander un audit" : "Request an audit"}</CardTitle>
              <CardDescription>
                {isFr
                  ? "4 tailles × 2 modalités. Formulaire 5 étapes (Sprint 13)."
                  : "4 sizes × 2 modalities. 5-step form (Sprint 13)."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Cta href="/audit" variant="outline">
                {isFr ? "Voir les audits" : "See audits"} →
              </Cta>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{isFr ? "Implémentation IA" : "AI implementation"}</CardTitle>
              <CardDescription>
                {isFr
                  ? "9 prestations dont l'IA Custom premium."
                  : "9 services including premium Custom AI."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Cta href="/implementation" variant="outline">
                {isFr ? "Voir les prestations" : "See services"} →
              </Cta>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section eyebrow={isFr ? "Coordonnées" : "Details"}>
        <Container className="text-fg max-w-2xl space-y-2 text-base leading-relaxed">
          <p>
            <strong>{isFr ? "Société" : "Company"} :</strong> AxionIA OÜ
          </p>
          <p>
            <strong>{isFr ? "Juridiction" : "Jurisdiction"} :</strong>{" "}
            {isFr ? "Estonie · Tallinn" : "Estonia · Tallinn"}
          </p>
          <p>
            <strong>Email :</strong>{" "}
            <a href="mailto:contact@axion-ia.com" className="text-primary hover:underline">
              contact@axion-ia.com
            </a>
          </p>
          <p className="text-sm text-gray-700">
            {isFr
              ? "Numéro d'enregistrement et coordonnées complètes : voir mentions légales."
              : "Registration number and full details: see legal notice."}
          </p>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Prête à démarrer ?" : "Ready to start?"}
        description={
          isFr
            ? "Réservez une intervention ou demandez un devis — réponse sous 48 h ouvrées."
            : "Book a session or request a quote — reply within 48 business hours."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle 490 €" : "See the Essential €490"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={contactJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
