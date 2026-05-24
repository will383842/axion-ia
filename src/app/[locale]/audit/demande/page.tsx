import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Globe2, Building2, Mail, Clock } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { UnifiedContactForm } from "@/components/forms/UnifiedContactForm";
import { buildProductMetadata } from "@/lib/seo";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/audit/demande",
    title: locale === "fr" ? "Demander un audit IA · Axion-IA" : "Request an AI audit · Axion-IA",
    description:
      locale === "fr"
        ? "Formulaire pour demander un audit IA Axion-IA — niveau (Flash / Ciblé / Stratégique PME / ETI), taille, secteur, lieu, périmètre. Devis personnalisé sous 48 h ouvrées."
        : "Form to request an Axion-IA AI audit — level (Flash / Targeted / Strategic SMB / mid-cap), size, sector, location, scope. Personalised quote within 48 business hours.",
    alternates: { fr: "/audit/demande", en: "/audit/request" },
  });
}

export default async function AuditRequest({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  void loc; // loc reserved for future locale-specific helpers
  const breadcrumbItems = [
    { href: "/audit", label: isFr ? "Audit & optimisation" : "Audit & optimization" },
    { href: "/audit/demande", label: isFr ? "Demande" : "Request" },
  ];

  // Bandeau réassurance — 4 pills.
  const reassurance = [
    {
      icon: Globe2,
      label: isFr ? "France & international" : "France & international",
    },
    {
      icon: Building2,
      label: isFr ? "TPE â†’ grandes entreprises" : "Small â†’ enterprise",
    },
    {
      icon: Clock,
      label: isFr ? "Devis sous 48 h ouvrées" : "Quote within 48 business hours",
    },
    {
      icon: Mail,
      label: isFr ? "Aucune relance, aucun engagement" : "No follow-up spam, no commitment",
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* Hero compact — paddings réduits pour rapprocher le formulaire de la fold. */}
      <section className="bg-halo-warm relative overflow-hidden pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-12 lg:pb-20">
        <Container className="relative">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Demande d'audit · 6 étapes" : "Audit request · 6 steps"}
          </p>
          <h1
            className="text-fg mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[1.04] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Demander un " : "Request an "}
            <span className="text-terracotta italic">
              {isFr ? "audit IA personnalisé" : "personalised AI audit"}
            </span>
          </h1>
          <p className="text-fg-soft mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
            {isFr
              ? "6 questions pour cadrer votre projet. Devis personnalisé sous 48 h ouvrées · TPE â†’ ETI · France & international."
              : "6 questions to frame your project. Personalised quote within 48 business hours · Small â†’ enterprise · France & worldwide."}
          </p>

          {/* Bandeau réassurance — 4 pills */}
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {reassurance.map((r) => {
              const Icon = r.icon;
              return (
                <li
                  key={r.label}
                  className="bg-paper/70 border-border-strong text-fg flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium"
                >
                  <Icon className="text-terracotta-deep h-4 w-4" aria-hidden="true" />
                  {r.label}
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Form */}
      <div className="bg-bg py-10 sm:py-14">
        <Container className="max-w-3xl">
          <UnifiedContactForm
            defaultType="audit"
            lockType
            advancedOpenByDefault
            source="/audit/demande"
          />
        </Container>
      </div>
    </>
  );
}
