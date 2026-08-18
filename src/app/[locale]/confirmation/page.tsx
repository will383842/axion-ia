import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: "/confirmation",
    title: locale === "fr" ? "Confirmation · Axion-IA" : "Confirmation · Axion-IA",
    description:
      locale === "fr"
        ? "Votre demande a bien été reçue par Axion-IA."
        : "Your request was received by Axion-IA.",
  });
  return { ...meta, robots: { index: false, follow: false } };
}

const TYPE_LABELS = {
  audit: { fr: "demande d'audit IA", en: "AI audit request" },
  intervention: { fr: "réservation d'intervention", en: "session booking" },
  implementation: { fr: "demande d'implémentation IA", en: "AI implementation request" },
  contact: { fr: "message", en: "message" },
  newsletter: { fr: "inscription newsletter", en: "newsletter signup" },
} as const;

type ConfirmationType = keyof typeof TYPE_LABELS;

export default async function ConfirmationPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { type } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const safeType: ConfirmationType =
    type && type in TYPE_LABELS ? (type as ConfirmationType) : "contact";
  const label = TYPE_LABELS[safeType][loc];

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/confirmation", label: isFr ? "Confirmation" : "Confirmation" },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow="✓"
        title={isFr ? "Demande" : "Request"}
        titleEm={isFr ? "reçue" : "received"}
      />
      <Section>
        <Container className="max-w-2xl space-y-6">
          <Alert variant="success" role="status">
            <AlertTitle>
              {isFr ? `Votre ${label} a été enregistrée` : `Your ${label} was recorded`}
            </AlertTitle>
            <AlertDescription>
              {isFr
                ? "Nous revenons vers vous sous 48 h ouvrées avec une réponse personnalisée."
                : "We get back to you within 48 business hours with a personalised reply."}
            </AlertDescription>
          </Alert>

          <p className="text-fg-soft text-base leading-relaxed">
            {isFr
              ? "En attendant, voici quelques ressources qui pourront vous être utiles :"
              : "In the meantime, here are some resources you may find useful:"}
          </p>

          <ul className="space-y-2 text-base">
            <li>
              <a className="text-primary hover:underline" href={`/${locale}/cas-concrets`}>
                → {isFr ? "Cas concrets" : "Case studies"}
              </a>
            </li>
            <li>
              <a className="text-primary hover:underline" href={`/${locale}/blog`}>
                → Blog
              </a>
            </li>
            <li>
              <a className="text-primary hover:underline" href={`/${locale}/faq`}>
                → FAQ
              </a>
            </li>
          </ul>

          <Cta href="/" size="lg">
            {isFr ? "Retour à l'accueil" : "Back to home"} →
          </Cta>
        </Container>
      </Section>
      <JsonLd
        data={
          safeType === "intervention"
            ? {
                "@context": "https://schema.org",
                "@type": "Reservation",
                reservationStatus: "http://schema.org/ReservationConfirmed",
                name: isFr ? "Réservation confirmée · Axion-IA" : "Booking confirmed · Axion-IA",
              }
            : {
                "@context": "https://schema.org",
                "@type": "Order",
                orderStatus: "http://schema.org/OrderProcessing",
                name: isFr ? "Demande reçue · Axion-IA" : "Request received · Axion-IA",
              }
        }
        strategy="afterInteractive"
        scriptId="jsonld-confirmation"
      />
    </>
  );
}
