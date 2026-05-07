import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

// Unsubscribe landing — RFC 8058 (List-Unsubscribe) + RGPD compliance.
// Public, no-index — accessed via signed token in email footers.
// Sprint 17 wires the actual server action that consumes the token.

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = buildProductMetadata({
    locale,
    path: "/desabonnement",
    title: locale === "fr" ? "Désabonnement · AxionIA" : "Unsubscribe · AxionIA",
    description:
      locale === "fr"
        ? "Confirmer votre désabonnement de la newsletter ou des emails AxionIA."
        : "Confirm unsubscription from the AxionIA newsletter or emails.",
    alternates: { fr: "/desabonnement", en: "/unsubscribe" },
  });
  // Don't index unsubscribe pages.
  return { ...meta, robots: { index: false, follow: false } };
}

export default async function DesabonnementPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      {
        name: isFr ? "Désabonnement" : "Unsubscribe",
        href: "/desabonnement",
      },
    ],
  });

  const hasToken = typeof token === "string" && token.length > 0;

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "RGPD · RFC 8058" : "GDPR · RFC 8058"}
        title={isFr ? "Confirmer le" : "Confirm"}
        titleEm={isFr ? "désabonnement" : "unsubscribe"}
        description={
          isFr
            ? "Conformément au RGPD et à la RFC 8058 (List-Unsubscribe en un clic), vous pouvez retirer votre consentement à tout moment."
            : "In accordance with GDPR and RFC 8058 (One-Click List-Unsubscribe), you can withdraw your consent at any time."
        }
      />

      <Section>
        <Container className="max-w-2xl space-y-6 text-base leading-relaxed text-gray-700">
          {hasToken ? (
            <>
              <p>
                {isFr
                  ? "Cliquez sur le bouton ci-dessous pour confirmer votre désabonnement. Le traitement est instantané et définitif pour la liste concernée."
                  : "Click the button below to confirm your unsubscription. Processing is instant and final for the relevant list."}
              </p>
              <form
                action="/api/unsubscribe"
                method="POST"
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="bg-primary text-primary-fg cta-translate inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
                >
                  {isFr ? "Confirmer le désabonnement" : "Confirm unsubscribe"} →
                </button>
                <Cta href="/" variant="outline">
                  {isFr ? "Annuler" : "Cancel"}
                </Cta>
              </form>
              <p className="text-xs text-gray-600">
                {isFr
                  ? "Vous pouvez toujours nous écrire à contact@axion-ia.com pour exercer vos droits RGPD (accès, rectification, effacement, portabilité, opposition)."
                  : "You can always email contact@axion-ia.com to exercise your GDPR rights (access, rectification, erasure, portability, objection)."}
              </p>
            </>
          ) : (
            <>
              <p>
                {isFr
                  ? "Cette page nécessite un lien de désabonnement présent dans nos emails. Sans ce lien, nous ne pouvons pas identifier votre adresse."
                  : "This page requires the unsubscribe link from our emails. Without it, we can't identify your address."}
              </p>
              <p>
                {isFr
                  ? "Pour exercer vos droits RGPD ou demander un retrait manuel, écrivez-nous à"
                  : "To exercise your GDPR rights or request a manual removal, email us at"}{" "}
                <a className="text-primary hover:underline" href="mailto:contact@axion-ia.com">
                  contact@axion-ia.com
                </a>
                .
              </p>
              <Cta href="/" size="lg">
                {isFr ? "Retour à l'accueil" : "Back to home"} →
              </Cta>
            </>
          )}
        </Container>
      </Section>

      <JsonLd data={breadcrumb} />
    </>
  );
}
