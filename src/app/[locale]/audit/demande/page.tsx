import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AuditForm } from "@/components/forms/AuditForm";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/audit/demande",
    title:
      locale === "fr"
        ? "Demander un audit IA · 5 étapes · AxionIA"
        : "Request an AI audit · 5 steps · AxionIA",
    description:
      locale === "fr"
        ? "Formulaire 5 étapes pour demander un audit IA AxionIA — réponse sous 48 h ouvrées."
        : "5-step form to request an AxionIA AI audit — reply within 48 business hours.",
    alternates: { fr: "/audit/demande", en: "/audit/request" },
  });
}

export default async function AuditRequest({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Audit & optimisation" : "Audit & optimization", href: "/audit" },
      { name: isFr ? "Demande" : "Request", href: "/audit/demande" },
    ],
  });

  const labels = isFr
    ? {
        stepLabels: ["Taille", "Modalité", "Contexte", "Coordonnées", "Consentement"] as const,
        next: "Suivant",
        previous: "Précédent",
        submit: "Envoyer la demande",
        sending: "Envoi…",
        success: "Demande reçue. Nous vous répondons sous 48 h ouvrées.",
        failure: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",
        sizeQuestion: "Quelle est la taille de votre entreprise ?",
        sizes: [
          { key: "tpe" as const, label: "TPE / Artisan (1-9)" },
          { key: "pme" as const, label: "PME (10-49)" },
          { key: "mid" as const, label: "Moyenne (50-249)" },
          { key: "enterprise" as const, label: "Grande (250+)" },
        ],
        modalityQuestion: "Modalité souhaitée ?",
        modalityRemote: "À distance",
        modalityOnsite: "Sur site",
        industryQuestion: "Industrie",
        industryPlaceholder: "Ex : industrie, juridique, retail…",
        goalsQuestion: "Objectifs de l'audit",
        goalsPlaceholder: "Décrivez en quelques lignes ce que vous attendez de l'audit.",
        contactName: "Nom & prénom",
        contactEmail: "Email professionnel",
        contactPhone: "Téléphone (optionnel)",
        consentLabel:
          "J'accepte que mes données soient utilisées pour traiter cette demande conformément à la politique de confidentialité.",
      }
    : {
        stepLabels: ["Size", "Modality", "Context", "Contact", "Consent"] as const,
        next: "Next",
        previous: "Previous",
        submit: "Send request",
        sending: "Sending…",
        success: "Request received. We will reply within 48 business hours.",
        failure: "An error occurred. Try again or email contact@axion-ia.com.",
        sizeQuestion: "What is your company size?",
        sizes: [
          { key: "tpe" as const, label: "Small / Trades (1-9)" },
          { key: "pme" as const, label: "PME (10-49)" },
          { key: "mid" as const, label: "Mid (50-249)" },
          { key: "enterprise" as const, label: "Enterprise (250+)" },
        ],
        modalityQuestion: "Preferred modality?",
        modalityRemote: "Remote",
        modalityOnsite: "On site",
        industryQuestion: "Industry",
        industryPlaceholder: "e.g. industry, legal, retail…",
        goalsQuestion: "Audit goals",
        goalsPlaceholder: "Describe in a few lines what you expect from the audit.",
        contactName: "Full name",
        contactEmail: "Professional email",
        contactPhone: "Phone (optional)",
        consentLabel:
          "I agree to my data being used to process this request in accordance with the privacy policy.",
      };

  return (
    <>
      <Section
        eyebrow={isFr ? "Audit · 5 étapes" : "Audit · 5 steps"}
        title={isFr ? "Demander un audit IA" : "Request an AI audit"}
        description={
          isFr
            ? "Réponse sous 48 h ouvrées avec devis personnalisé selon votre taille et modalité."
            : "Reply within 48 business hours with a customized quote based on size and modality."
        }
      />

      <Section>
        <Container className="max-w-3xl">
          <AuditForm labels={labels} />
        </Container>
      </Section>

      <JsonLd data={breadcrumb} />
    </>
  );
}
