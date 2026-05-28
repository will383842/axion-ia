import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { UnifiedContactForm } from "@/components/forms/UnifiedContactForm";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

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
        ? "Contact · Axion-IA · réponse sous 48 h ouvrées"
        : "Contact · Axion-IA · 48 business-hour reply",
    description:
      locale === "fr"
        ? "Contactez Axion-IA — un formulaire unique pour devis, audit, implémentation, formation, 1-à-1, partenariat. Réponse sous 24 h."
        : "Contact Axion-IA — a single form for quote, audit, implementation, training, 1-on-1, partnership. Reply within 24 hours.",
  });
}

// Page volontairement épurée : header global + titre + formulaire + (footer
// global masqué via `<style>`). Toutes les sections d'autorité (3 portes,
// FAQ, posture, CTA) ont été déplacées hors-page pour réduire le time-to-form
// au strict minimum — décision Will 2026-05-26. Le formulaire est unifié et
// couvre 7 cas (autre + devis + audit + implementation + formation + 1-à-1 +
// partenariat) ; le formulaire sert à tout via `autre` par défaut.
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
    name: isFr ? "Contact Axion-IA" : "Contact Axion-IA",
    description: isFr
      ? "Formulaire de contact Axion-IA — réponse sous 48 h ouvrées, sans engagement, données stockées en UE."
      : "Axion-IA contact form — reply within 48 business hours, no commitment, data stored in the EU.",
    publisher: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
    mainEntity: {
      "@type": "ContactPoint",
      contactType: isFr ? "Service client" : "Customer service",
      email: "contact@axion-ia.com",
      availableLanguage: ["French", "English"],
      areaServed: ["FR", "EU"],
      hoursAvailable: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    },
  } as const;

  // Masque le Footer global (rendu dans [locale]/layout.tsx) uniquement sur
  // /contact, via le pattern `:has()` du shell admin (cf. layout admin).
  // bg-mocha-rich = classe racine unique du Footer public.
  const hideFooterCss = `
    body:has(.contact-minimal) footer.bg-mocha-rich { display: none !important; }
  `.trim();

  return (
    <div className="contact-minimal bg-halo-warm">
      <style dangerouslySetInnerHTML={{ __html: hideFooterCss }} />

      <section className="py-14 sm:py-20 lg:py-24">
        <Container className="max-w-2xl">
          <header className="mb-10 text-center sm:mb-12">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              Contact
            </p>
            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Contactez-" : "Contact "}
              <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "nous" : "us"}
              </span>
            </h1>
            <p className="text-fg-soft mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Un formulaire unique pour toute demande. Réponse sous 24 h, sans engagement."
                : "A single form for every request. Reply within 24 hours, no commitment."}
            </p>
          </header>

          <div className="bg-paper border-border shadow-card rounded-3xl border p-6 sm:p-8 lg:p-10">
            <UnifiedContactForm defaultType="autre" source="/contact" />
          </div>
        </Container>
      </section>

      <JsonLd data={contactJsonLd} />
    </div>
  );
}
