// Page de confirmation parcours B (Sprint X.5bis — Booking V1).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { buildProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const base = buildProductMetadata({
    locale,
    path: isFr ? "/demande-devis/confirmation" : "/request-quote/confirmation",
    title: isFr ? "Demande envoyée · Axion-IA" : "Request sent · Axion-IA",
    description: isFr
      ? "Votre demande de devis a bien été reçue. William vous recontactera sous 24-48 h ouvrées."
      : "Your quote request has been received. William will get back to you within 24-48 business hours.",
    alternates: {
      fr: "/demande-devis/confirmation",
      en: "/request-quote/confirmation",
    },
  });
  // Page de confirmation = ne pas indexer (pas de valeur SEO, contenu post-action).
  // buildProductMetadata hardcode index:true; on override ici.
  return { ...base, robots: { index: false, follow: true } };
}

export default async function ConfirmationPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  return (
    <section className="bg-halo-warm relative overflow-hidden py-16 sm:py-20 lg:py-24">
      <Container className="relative">
        <div className="bg-paper shadow-card border-sage/40 mx-auto max-w-2xl rounded-3xl border-2 p-8 text-center sm:p-10 lg:p-12">
          <CheckCircle2 aria-hidden="true" className="text-sage mx-auto h-14 w-14" />
          <h1 className="display-editorial text-fg mt-6">
            {isFr ? "Demande bien reçue" : "Request received"}
          </h1>
          <p className="text-fg-soft mt-5 text-lg leading-relaxed">
            {isFr
              ? "Merci, votre demande de devis qualifiée est entre nos mains. William vous recontactera sous 24 à 48 heures ouvrées pour un appel de cadrage personnalisé."
              : "Thank you, your qualified quote request is in our hands. William will get back to you within 24 to 48 business hours for a personalized scoping call."}
          </p>
          <p className="text-fg-muted mt-4 text-sm">
            {isFr
              ? "Vous recevrez un email de confirmation à l'adresse fournie dans les prochaines minutes."
              : "You will receive a confirmation email at the address provided in the next few minutes."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Cta href="/interventions" size="lg">
              {isFr ? "Voir les formats standards" : "See standard formats"}
            </Cta>
            <Cta href="/" variant="outline" size="lg">
              {isFr ? "Retour à l'accueil" : "Back to home"}
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
