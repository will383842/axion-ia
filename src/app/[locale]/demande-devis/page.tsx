// Page publique parcours B (Sprint X.5bis — Booking V1).
//
// /fr/demande-devis (FR) + /en/request-quote (EN) — formulaire qualifié pour
// les formats > 5 000 € HT / IA Custom / packs annuels. Pas de slot calendrier.
//
// Cf. 04-PLAN-EXECUTION Sprint X.5bis + UX-E2E-VERIFICATION.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { QuoteRequestForm, type QuoteRequestFormLabels } from "@/components/forms/QuoteRequestForm";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ intervention?: string }>;
}

const COPY = {
  fr: {
    title: "Demande de devis qualifiée",
    titleEm: "pour projets sur-mesure",
    description:
      "Pour les formats > 5 000 € HT, IA Custom, packs annuels ou transformations multi-services : remplissez ce formulaire qualifié. William vous recontactera sous 24-48 h ouvrées pour un appel de cadrage personnalisé.",
    breadcrumb: "Demande de devis",
    formLabels: {
      sectionCompany: "Votre entreprise",
      sectionContact: "Vos coordonnées",
      sectionProject: "Votre projet",
      sectionConsents: "Consentements",
      companyName: "Raison sociale",
      companySize: "Taille (INSEE)",
      companySizeOptions: {
        tpe: "TPE — 1 à 19 salariés",
        pme: "PME — 20 à 250 salariés",
        eti: "ETI — 250 à 5 000 salariés",
        grande_entreprise: "Grande entreprise — 5 000+ salariés",
      },
      companySector: "Secteur d'activité",
      companySectorPlaceholder: "Ex : Tech / SaaS, Industrie, Distribution, Santé…",
      contactName: "Nom & prénom",
      contactEmail: "Email professionnel",
      contactPhone: "Téléphone direct",
      contextBusiness: "Contexte business & besoin",
      contextBusinessHint:
        "Minimum 200 caractères. Décrivez votre situation actuelle, ce que vous attendez de l'IA, vos contraintes éventuelles. Plus c'est précis, plus le cadrage est efficace.",
      budgetIndicative: "Budget pressenti (optionnel)",
      budgetIndicativePlaceholder: "Ex : 10-20 k€, 50 k€+, à définir",
      timingWeeks: "Timing souhaité",
      timingWeeksOptions: {
        "0-4": "0-4 semaines",
        "4-8": "4-8 semaines",
        "8-12": "8-12 semaines",
        "12+": "12+ semaines",
      },
      city: "Ville (siège ou intervention)",
      willingToTravel: "Vous acceptez les déplacements sur site",
      participantsEstimate: "Effectif estimé (optionnel)",
      consentTerms:
        "J'ai pris connaissance des Conditions Générales de Vente et de la politique de confidentialité.",
      consentGdpr:
        "J'accepte le traitement de mes données pour répondre à cette demande (RGPD art. 6.1.b).",
      submit: "Envoyer la demande",
      sending: "Envoi…",
      failure: "Une erreur est survenue, réessayez ou contactez-nous directement.",
    } satisfies QuoteRequestFormLabels,
  },
  en: {
    title: "Qualified quote request",
    titleEm: "for custom projects",
    description:
      "For formats > €5,000 (excl. VAT), custom AI, annual packs, or multi-department transformations: fill in this qualified form. William will get back to you within 24-48 business hours for a personalized scoping call.",
    breadcrumb: "Quote request",
    formLabels: {
      sectionCompany: "Your company",
      sectionContact: "Your contact details",
      sectionProject: "Your project",
      sectionConsents: "Consents",
      companyName: "Company name",
      companySize: "Size (INSEE)",
      companySizeOptions: {
        tpe: "Small — 1 to 19 staff",
        pme: "SME — 20 to 250 staff",
        eti: "Mid-cap — 250 to 5,000 staff",
        grande_entreprise: "Enterprise — 5,000+ staff",
      },
      companySector: "Sector",
      companySectorPlaceholder: "e.g. Tech / SaaS, Industry, Retail, Healthcare…",
      contactName: "Full name",
      contactEmail: "Work email",
      contactPhone: "Direct phone",
      contextBusiness: "Business context & needs",
      contextBusinessHint:
        "Minimum 200 characters. Describe your current situation, what you expect from AI, any constraints. The more specific, the more effective the scoping.",
      budgetIndicative: "Indicative budget (optional)",
      budgetIndicativePlaceholder: "e.g. 10-20 k€, 50 k€+, to be defined",
      timingWeeks: "Desired timing",
      timingWeeksOptions: {
        "0-4": "0-4 weeks",
        "4-8": "4-8 weeks",
        "8-12": "8-12 weeks",
        "12+": "12+ weeks",
      },
      city: "City (HQ or session location)",
      willingToTravel: "You accept on-site travel",
      participantsEstimate: "Estimated headcount (optional)",
      consentTerms: "I've read the Terms of Service and Privacy Policy.",
      consentGdpr:
        "I consent to the processing of my data to handle this request (GDPR art. 6.1.b).",
      submit: "Send request",
      sending: "Sending…",
      failure: "An error occurred, please try again or contact us directly.",
    } satisfies QuoteRequestFormLabels,
  },
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const path = isFr ? "/demande-devis" : "/request-quote";
  return buildProductMetadata({
    locale,
    path,
    title: isFr
      ? "Demande de devis · projets IA sur-mesure · Axion-IA"
      : "AI project quote request · Axion-IA",
    description: isFr
      ? "Formulaire pour formats > 5 000 € HT, IA Custom, packs annuels. Réponse sous 24-48 h ouvrées."
      : "Form for formats > €5,000, custom AI, annual packs. Reply within 24-48 business hours.",
    alternates: { fr: "/demande-devis", en: "/request-quote" },
  });
}

export default async function DemandeDevisPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const t = COPY[locale === "fr" ? "fr" : "en"];
  const sp = await searchParams;
  const defaultIntervention = sp.intervention?.trim() || undefined;

  const breadcrumbItems = [{ href: "/demande-devis", label: t.breadcrumb }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <section className="bg-halo-warm relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Container className="relative">
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Parcours sur-mesure" : "Custom path"}
            </p>
            <h1 className="display-editorial text-fg mt-5">
              {t.title}{" "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {t.titleEm}
              </span>
            </h1>
            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {t.description}
            </p>
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container className="max-w-2xl">
          <QuoteRequestForm
            labels={t.formLabels}
            {...(defaultIntervention ? { defaultInterventionSlug: defaultIntervention } : {})}
          />
        </Container>
      </section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "OrderAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/${locale}/demande-devis`,
            actionPlatform: [
              "http://schema.org/DesktopWebPlatform",
              "http://schema.org/MobileWebPlatform",
            ],
          },
          result: {
            "@type": "Order",
            orderStatus: "http://schema.org/OrderProcessing",
            name: isFr
              ? "Demande de devis personnalisé · Axion-IA"
              : "Custom quote request · Axion-IA",
          },
        }}
        strategy="afterInteractive"
        scriptId="jsonld-order-action"
      />
    </>
  );
}
