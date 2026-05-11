import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Clock, ShieldCheck, HeartHandshake, BookOpenCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ContactForm } from "@/components/forms/ContactForm";
import { JsonLd } from "@/components/marketing/JsonLd";
import { INTERVENTION_FORMATS } from "@/content/interventions-taxonomy";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

// ============================================================================
// Sprint 14.10.7 (Will 2026-05-11) — page dédiée formulaire interventions.
// Pattern miroir de /audit/demande : page indexable, formulaire en hero, pas
// de scroll anchor. Préfill du message via `?objet=<slug>` qui matche un
// `InterventionFormatEntry.slug` (ou un objet libre type "cadrage-formation").
// ============================================================================

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ objet?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/interventions/demande",
    title:
      locale === "fr"
        ? "Demander une intervention IA · cadrage 48 h · Axion-IA"
        : "Request an AI session · 48 h framing · Axion-IA",
    description:
      locale === "fr"
        ? "Formulaire dédié pour cadrer votre intervention IA (formation équipe, coaching individuel, journée dirigeant ou conférence). Réponse personnalisée sous 48 h ouvrées. Sans engagement."
        : "Dedicated form to frame your AI session (team training, individual coaching, executive day or talk). Personalised reply within 48 business hours. No commitment.",
    alternates: { fr: "/interventions/demande", en: "/interventions/request" },
  });
}

// Construit un message pré-rempli basé sur le slug `?objet=`. Si le slug
// matche un format de la taxonomie, on utilise son label. Sinon (objets
// génériques type « cadrage-formation-equipe »), on génère une intro neutre.
function buildDefaultMessage(objet: string | undefined, isFr: boolean): string {
  if (!objet) {
    return isFr
      ? "Bonjour,\n\nJe souhaite cadrer une intervention IA. Voici mon contexte :\n\n"
      : "Hello,\n\nI'd like to frame an AI session. Here's my context:\n\n";
  }
  const entry = INTERVENTION_FORMATS.find((f) => f.slug === objet);
  if (entry) {
    const label = isFr ? entry.labelFr : entry.labelEn;
    return isFr
      ? `Bonjour,\n\nJe souhaite plus d'informations sur l'intervention « ${label} ».\n\nMon contexte (taille d'équipe, secteur, niveau IA actuel, dates envisagées) :\n\n`
      : `Hello,\n\nI'd like more info on the « ${label} » session.\n\nMy context (team size, sector, current AI level, target dates):\n\n`;
  }
  // Objets génériques (cadrage-formation-equipe, cadrage-1-jour, etc.)
  const objetLabel = objet.replace(/-/g, " ");
  return isFr
    ? `Bonjour,\n\nJe souhaite un cadrage pour : ${objetLabel}.\n\nMon contexte :\n\n`
    : `Hello,\n\nI'd like a framing call for: ${objetLabel}.\n\nMy context:\n\n`;
}

export default async function InterventionsDemande({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const { objet } = await searchParams;
  const defaultMessage = buildDefaultMessage(objet, isFr);

  const breadcrumbItems = [
    { href: "/interventions", label: isFr ? "Interventions" : "Sessions" },
    { href: "/interventions/demande", label: isFr ? "Demande" : "Request" },
  ];

  const pills = isFr
    ? [
        { icon: Clock, label: "Réponse 48 h ouvrées" },
        { icon: HeartHandshake, label: "Sans engagement" },
        { icon: ShieldCheck, label: "RGPD · UE" },
        { icon: BookOpenCheck, label: "Méthode documentée" },
      ]
    : [
        { icon: Clock, label: "Reply within 48 business hours" },
        { icon: HeartHandshake, label: "No commitment" },
        { icon: ShieldCheck, label: "GDPR · EU" },
        { icon: BookOpenCheck, label: "Documented method" },
      ];

  const labels = isFr
    ? {
        name: "Nom & prénom",
        email: "Email professionnel",
        company: "Entreprise (optionnel)",
        message: "Décrivez votre besoin",
        consent:
          "J'accepte que mes données soient utilisées pour traiter cette demande conformément à la politique de confidentialité.",
        submit: "Envoyer ma demande",
        sending: "Envoi…",
        success: "Demande reçue. Nous revenons vers vous sous 48 h ouvrées.",
        failure: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",
      }
    : {
        name: "Full name",
        email: "Professional email",
        company: "Company (optional)",
        message: "Describe your need",
        consent:
          "I agree to my data being used to process this request in accordance with the privacy policy.",
        submit: "Send my request",
        sending: "Sending…",
        success: "Request received. We will get back to you within 48 business hours.",
        failure: "An error occurred. Try again or email contact@axion-ia.com.",
      };

  // ContactPage JSON-LD pour SEO + AEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: isFr ? "Demander une intervention IA · Axion-IA" : "Request an AI session · Axion-IA",
    url: `${SITE_URL}/${locale}/interventions/demande`,
    inLanguage: locale,
    isPartOf: { "@type": "WebSite", url: SITE_URL, name: "Axion-IA" },
  } as const;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO court — formulaire visible immédiatement (mt-8 sous le hero) */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-12 sm:py-14 lg:py-16">
        <Container className="lg:px-6 xl:px-10">
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Demande d'intervention IA" : "AI session request"}
            </p>

            <h1 className="display-editorial text-fg mt-4">
              {isFr ? "Cadrons votre intervention " : "Let's frame your session "}
              <span
                className="text-terracotta mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "ensemble" : "together"}
              </span>
            </h1>

            <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed">
              {isFr
                ? "Décrivez votre besoin (format souhaité, taille d'équipe, contexte). Nous revenons vers vous sous 48 h ouvrées avec un cadrage personnalisé."
                : "Describe your need (preferred format, team size, context). We get back to you within 48 business hours with a personalised framing."}
            </p>

            {/* Trust pills */}
            <ul className="mt-5 flex flex-wrap gap-2">
              {pills.map((p) => {
                const Icon = p.icon;
                return (
                  <li
                    key={p.label}
                    className="bg-paper border-border text-fg inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
                  >
                    <Icon aria-hidden="true" className="text-terracotta-deep h-3.5 w-3.5" />
                    {p.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </Container>
      </section>

      {/* FORMULAIRE — directement sous le hero, pas de scroll */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Formulaire" : "Form"}
        title={isFr ? "Votre demande" : "Your request"}
        titleEm={isFr ? "personnalisée" : "personalised"}
        description={
          isFr
            ? "Plus le contexte est précis, plus notre réponse sera ciblée. Nous traitons chaque demande individuellement — pas de pipeline automatique."
            : "The more precise the context, the more targeted our reply. We handle each request individually — no automated pipeline."
        }
      >
        <Container className="max-w-2xl">
          <ContactForm labels={labels} defaultMessage={defaultMessage} />
        </Container>
      </Section>

      <JsonLd data={jsonLd} />
    </>
  );
}
