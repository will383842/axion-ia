import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { CookieConsentControl } from "@/components/analytics/CookieConsentControl";
import { buildProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/preferences-cookies",
    title: locale === "fr" ? "Préférences cookies · Axion-IA" : "Cookie preferences · Axion-IA",
    description:
      locale === "fr"
        ? "Gérer votre consentement cookies Axion-IA."
        : "Manage your Axion-IA cookie consent.",
    alternates: { fr: "/preferences-cookies", en: "/cookie-preferences" },
  });
}

export default async function CookiePreferencesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: isFr ? "/preferences-cookies" : "/cookie-preferences",
      label: isFr ? "Préférences cookies" : "Cookie preferences",
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow="RGPD"
        title={isFr ? "Préférences" : "Cookie"}
        titleEm={isFr ? "cookies" : "preferences"}
        description={
          isFr
            ? "Granularité fine sur les cookies déposés. Modifiable à tout moment."
            : "Fine-grained control over deposited cookies. Editable any time."
        }
      />
      <Section>
        <Container className="text-fg-soft max-w-2xl space-y-6 text-base leading-relaxed">
          <p>
            {isFr
              ? "Axion-IA n'utilise par défaut aucun cookie de tracking tiers. Le site fonctionne sans publicitaire, sans Google Analytics, sans Facebook Pixel. Seuls des cookies fonctionnels strictement nécessaires (langue, session admin) sont déposés."
              : "Axion-IA doesn't use any third-party tracking cookies by default. The site runs without ads, without Google Analytics, without Facebook Pixel. Only strictly necessary functional cookies (language, admin session) are deposited."}
          </p>
          <p>
            {isFr
              ? "Notre analytics auto-hébergé Plausible est toujours actif : aucune donnée personnelle n'est collectée et aucun cookie n'est utilisé — anonymisation IP côté serveur. Il ne requiert donc pas votre consentement."
              : "Our self-hosted Plausible analytics is always active: no personal data is collected and no cookies are used — server-side IP anonymisation. It therefore requires no consent."}
          </p>
          <p>
            {isFr
              ? "Deux outils sont soumis à votre consentement. Microsoft Clarity (heatmaps et session replay anonymisé, transfert UE → US encadré par des clauses contractuelles types) dépose les cookies _clck et _clsk et n'est chargé qu'après votre accord explicite via le bandeau ; votre choix est conservé 13 mois et révocable ci-dessous. Le calendrier de réservation Calendly, sur la page /appel, n'est chargé qu'après un clic sur « Afficher le calendrier » ; ce choix n'est volontairement PAS conservé — il vous est redemandé à chaque visite, et ne pas cliquer suffit à le retirer."
              : "Two tools are subject to your consent. Microsoft Clarity (anonymised heatmaps and session replay, EU → US transfer under standard contractual clauses) sets the _clck and _clsk cookies and only loads after your explicit agreement via the banner; your choice is kept for 13 months and can be withdrawn below. The Calendly booking calendar, on the /appel page, only loads after you click “Show the calendar”; that choice is deliberately NOT stored — it is asked again on every visit, and simply not clicking is enough to withdraw it."}
          </p>
          <CookieConsentControl />
          <p>
            {isFr
              ? "Pour exercer vos droits RGPD ou demander un journal complet des cookies déposés, écrivez à"
              : "To exercise your GDPR rights or request a complete log of deposited cookies, email"}{" "}
            <a className="text-primary hover:underline" href="mailto:contact@axion-ia.com">
              contact@axion-ia.com
            </a>
            .
          </p>
          <Cta href="/cookies" variant="outline">
            {isFr ? "Voir la politique cookies complète" : "See full cookie policy"} →
          </Cta>
        </Container>
      </Section>
    </>
  );
}
