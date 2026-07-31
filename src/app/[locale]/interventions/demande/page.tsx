import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Clock, ShieldCheck, HeartHandshake, BookOpenCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { UnifiedContactForm } from "@/components/forms/UnifiedContactForm";
import { mapObjetToSubject } from "@/lib/intervention-subject-mapping";
import { JsonLd } from "@/components/marketing/JsonLd";
import { INTERVENTION_FORMATS } from "@/content/interventions-taxonomy";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { SERVICE_BY_ID, serviceOfficial } from "@/content/services";

// ============================================================================
// Sprint 14.10.7 fix Will (2026-05-12) — page formulaire repensée :
//   - Formulaire VISIBLE IMMÉDIATEMENT en hero (sans scroll)
//   - Champs étendus : prénom, nom, société, email, téléphone+indicatif,
//     objet (select), description
//   - Textes / sections de réassurance déplacés SOUS le formulaire
//   - Aucun bloc « nos coordonnées » (Will : pas besoin)
// ============================================================================

export const revalidate = 3600;

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

function buildDefaultDescription(objet: string | undefined, isFr: boolean): string {
  if (!objet) return "";
  const entry = INTERVENTION_FORMATS.find((f) => f.slug === objet);
  if (entry) {
    const label = isFr ? entry.labelFr : entry.labelEn;
    return isFr
      ? `Bonjour,\n\nJe souhaite plus d'informations sur l'intervention « ${label} ».\n\nMon contexte (taille d'équipe, secteur, niveau IA actuel, dates envisagées) :\n\n`
      : `Hello,\n\nI'd like more info on the « ${label} » session.\n\nMy context (team size, sector, current AI level, target dates):\n\n`;
  }
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
  const defaultDescription = buildDefaultDescription(objet, isFr);
  const defaultSubject = mapObjetToSubject(objet);

  const breadcrumbItems = [
    { href: "/formations", label: serviceOfficial(SERVICE_BY_ID.formations, isFr) },
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

      {/* HERO + FORMULAIRE COMPACT — Sprint 14.10.7 fix Will : formulaire
          visible immédiatement, pas de scroll. Layout 2 colonnes desktop
          (texte court à gauche, formulaire à droite). */}
      <section className="bg-halo-warm relative overflow-hidden py-10 sm:py-12 lg:py-14">
        <Container className="lg:px-6 xl:px-10">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
            {/* Colonne gauche : intro courte + trust pills */}
            <div>
              <h1 className="display-editorial text-fg">
                {isFr ? "Cadrons votre intervention " : "Let's frame your session "}
                <span
                  className="text-terracotta mx-1 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "ensemble" : "together"}
                </span>
              </h1>

              <p className="text-fg-soft mt-4 max-w-lg text-base leading-relaxed sm:text-lg">
                {isFr
                  ? "Décrivez votre besoin (intervention souhaitée, taille d'équipe, contexte). Nous revenons sous 48 h ouvrées avec un cadrage personnalisé."
                  : "Describe your need (preferred session, team size, context). We get back within 48 business hours with a personalised framing."}
              </p>

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

            {/* Colonne droite : FORMULAIRE en hero */}
            <div className="bg-paper border-border shadow-card rounded-3xl border p-6 sm:p-8">
              <UnifiedContactForm
                defaultType={defaultSubject === "coaching-individuel" ? "un_a_un" : "formation"}
                source="/interventions/demande"
                {...(defaultSubject ? { defaultSubType: defaultSubject } : {})}
                {...(defaultDescription ? { defaultMessage: defaultDescription } : {})}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* SECTION RÉASSURANCE — sous le formulaire (pas avant) */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Comment ça fonctionne" : "How it works"}
        title={isFr ? "Une réponse personnalisée" : "A personalised reply"}
        titleEm={isFr ? "sous 48 h ouvrées" : "within 48 business hours"}
        description={
          isFr
            ? "Plus le contexte est précis, plus notre réponse sera ciblée. Nous traitons chaque demande individuellement — pas de pipeline automatique."
            : "The more precise the context, the more targeted our reply. We handle each request individually — no automated pipeline."
        }
      >
        <Container className="max-w-3xl">
          <ol className="border-border/60 border-l-2 pl-6">
            {(isFr
              ? [
                  {
                    title: "Vous remplissez le formulaire",
                    description:
                      "Quelques minutes : prénom, nom, société, email, téléphone, objet, description. Pas de tracking, pas de profilage.",
                  },
                  {
                    title: "Nous vous appelons sous 48 h ouvrées",
                    description:
                      "Pour comprendre votre contexte, valider l'intervention adaptée, et chiffrer si nécessaire. Sans engagement.",
                  },
                  {
                    title: "Vous pré-réservez sur le calendrier",
                    description:
                      "Une fois le format validé, vous choisissez votre date sur le calendrier maison. Confirmation après un échange de cadrage.",
                  },
                ]
              : [
                  {
                    title: "You fill the form",
                    description:
                      "A few minutes: first name, last name, company, email, phone, subject, description. No tracking, no profiling.",
                  },
                  {
                    title: "We call you within 48 business hours",
                    description:
                      "To understand your context, validate the right session, and quote if needed. No commitment.",
                  },
                  {
                    title: "You pre-book on the calendar",
                    description:
                      "Once the format is validated, pick your date on our live calendar. Confirmation after a framing call.",
                  },
                ]
            ).map((step, i) => (
              <li key={i} className="relative pb-6 last:pb-0">
                <span
                  aria-hidden="true"
                  className="bg-terracotta ring-terracotta-soft absolute -left-[31px] mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ring-4"
                >
                  {i + 1}
                </span>
                <h3 className="text-fg text-base font-semibold">{step.title}</h3>
                <p className="text-fg-soft mt-1 text-[14.5px] leading-relaxed">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <JsonLd data={jsonLd} />
    </>
  );
}
