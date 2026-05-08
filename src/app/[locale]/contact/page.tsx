import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, ShieldCheck, HeartHandshake, BookOpenCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ContactForm } from "@/components/forms/ContactForm";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ContactHeroSchema } from "@/components/sections/ContactHeroSchema";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";

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
        ? "Demandez un devis ou réservez une intervention. Réponse sous 48 h ouvrées. Axion-IA OÜ — cabinet IA opérationnel."
        : "Request a quote or book a session. Reply within 48 business hours. Axion-IA OÜ — operational AI consultancy.",
  });
}

export default async function Contact({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [{ href: "/contact", label: "Contact" }];

  // Trust pills hero — réassurance dimension-1 (cf. audit V14, D3 pills 0â†’3).
  const pills = isFr
    ? [
        { icon: Clock, label: "48 h ouvrées" },
        { icon: HeartHandshake, label: "Sans engagement" },
        { icon: ShieldCheck, label: "RGPD · UE" },
        { icon: BookOpenCheck, label: "Méthode documentée" },
      ]
    : [
        { icon: Clock, label: "48 business hours" },
        { icon: HeartHandshake, label: "No commitment" },
        { icon: ShieldCheck, label: "GDPR · EU" },
        { icon: BookOpenCheck, label: "Documented method" },
      ];

  // Micro-FAQ — 5 entrées, focus AEO (réponses ~50-80 mots = citables LLM).
  // FaqBlock émet la FAQPage JSON-LD via `emitJsonLd` (par défaut true).
  const faqItems = isFr
    ? [
        {
          id: "delai",
          question: "Sous combien de temps obtenez-vous une réponse ?",
          answer:
            "Tous les messages reçus en jours ouvrés sont traités sous 48 h ouvrées maximum, fuseau Europe/Paris. La plupart des demandes obtiennent une réponse le jour même ou le lendemain. Pas de réponse automatisée : un humain lit chaque message avant de répondre.",
        },
        {
          id: "engagement",
          question: "Faut-il signer un engagement pour échanger ?",
          answer: `Non. L'échange initial — message, appel découverte, envoi d'informations — est sans engagement. L'engagement contractuel commence uniquement à la réservation d'une intervention payante (Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} ou plus) ou d'un audit cadré, et fait l'objet d'un devis explicite.`,
        },
        {
          id: "rgpd",
          question: "Comment traitez-vous les données envoyées via le formulaire ?",
          answer:
            "Les données du formulaire sont stockées en Estonie (UE), traitées exclusivement pour répondre Ã  votre demande, et supprimées Ã  six mois si la conversation n'aboutit pas. Aucune revente, aucun outil tiers de tracking, pas de profilage. Détails dans la politique de confidentialité.",
        },
        {
          id: "rdv",
          question: "Puis-je réserver un appel directement ?",
          answer: `Oui. L'Essentielle (${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}, 90 min) est un appel diagnostic facturé qui se réserve sur le calendrier maison avec créneaux en temps réel. Pour un échange découverte gratuit (15-20 min), passez par le formulaire en précisant « appel découverte » dans le message.`,
        },
        {
          id: "scope",
          question: "Quels sujets traitez-vous, lesquels écartez-vous ?",
          answer:
            "Axion-IA intervient sur l'IA opérationnelle B2B : audits, intégration IA Custom, automatisations, formation. Hors scope : développement d'apps grand public, projets ML pure recherche, hébergement long terme. En cas de hors scope, nous orientons vers un partenaire pertinent dans la réponse.",
        },
      ]
    : [
        {
          id: "delai",
          question: "How fast do you reply?",
          answer:
            "All messages received on business days are processed within 48 business hours max (Europe/Paris timezone). Most requests get a reply same day or next day. No automated response: a human reads every message before answering.",
        },
        {
          id: "engagement",
          question: "Do I need to commit to anything to talk?",
          answer: `No. The initial exchange — message, discovery call, info sent — is no-commitment. Contractual commitment only starts when you book a paid session (Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })} or above) or a scoped audit, and is always covered by an explicit quote.`,
        },
        {
          id: "rgpd",
          question: "How is data submitted through the form handled?",
          answer:
            "Form data is stored in Estonia (EU), used solely to reply to your request, and deleted after six months if the conversation does not lead anywhere. No resale, no third-party tracking, no profiling. Details in the privacy policy.",
        },
        {
          id: "rdv",
          question: "Can I book a call directly?",
          answer: `Yes. The Essential (${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}, 90 min) is a paid diagnostic call bookable on the on-site calendar with live availability. For a free discovery exchange (15-20 min), use the form and mention « discovery call » in the message.`,
        },
        {
          id: "scope",
          question: "What topics do you cover, what do you decline?",
          answer:
            "Axion-IA covers operational B2B AI: audits, Custom AI integration, automations, training. Out of scope: consumer apps, pure ML research, long-term hosting. When out of scope, we point you to a relevant partner in the reply.",
        },
      ];

  // ContactPage JSON-LD enrichi : `mainEntity: ContactPoint` expose le canal
  // contact comme entité actionnable (AEO/GEO 2026, Perplexity / SGE / Claude.ai
  // resolution d'entité « comment contacter Axion-IA »). Cohérent avec la
  // doctrine `buildOrganizationJsonLd` du layout — ici on déclare le point
  // de contact spécifique de la page /contact (vs Organization global).
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

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2-col — texte Ã  gauche, ContactHeroSchema (3 portes d'entrée) Ã  droite */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                Contact
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Démarrer " : "Start "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "un échange" : "a conversation"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Réponse sous 48 h ouvrées par un humain. Décrivez votre besoin ou posez une question — vous repartez avec un devis détaillé ou une orientation honnête, sans relance commerciale."
                  : "Reply within 48 business hours, by a human. Describe your need or ask a question — you walk away with a detailed quote or an honest pointer, no commercial chasing."}
              </p>
              {/* Pills réassurance */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {pills.map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
              {/* CTAs hero */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="#message" size="lg">
                  {isFr ? "Envoyer un message" : "Send a message"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/interventions/essentielle" variant="outline" size="lg">
                  {isFr
                    ? `Voir l'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
                    : `See the Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}
                </Cta>
              </div>
            </div>
            <ContactHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? `Schéma : 3 portes d'entrée Axion-IA — message direct (48 h ouvrées), Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}, audit cadré 4 tailles.`
                  : `Diagram: 3 ways into Axion-IA — direct message (48 business hours), Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}, scoped audit 4 sizes.`
              }
            />
          </div>
        </Container>
      </section>

      {/* Pillar copy — posture relation client */}
      <Section eyebrow={isFr ? "Posture" : "Stance"} tone="paper">
        <Container className="max-w-3xl">
          <p className="text-fg-soft text-lg leading-relaxed">
            {isFr
              ? "Axion-IA traite chaque message comme un signal opérationnel, pas comme un lead. La règle est explicite : un humain lit, un humain répond, et la réponse arrive sous 48 heures ouvrées — souvent avant. Si votre besoin sort de notre périmètre (apps grand public, R&D pure, hébergement long terme), nous le disons et nous vous orientons vers un partenaire pertinent. Si la demande tombe pile dans nos interventions, vous repartez avec un devis cadré, un planning, et la doctrine que nous appliquerons. Pas de relance commerciale automatisée, pas de séquence email, pas d'outil tiers de tracking. Cabinet IA opérationnel signifie aussi : relation client opérationnelle."
              : "Axion-IA treats every message as an operational signal, not a lead. The rule is explicit: a human reads, a human replies, and the reply lands within 48 business hours — often sooner. If your need falls out of scope (consumer apps, pure R&D, long-term hosting), we say so and point you to a relevant partner. If the request lands squarely in our practice, you walk away with a scoped quote, a schedule, and the doctrine we will apply. No automated chasing, no email sequence, no third-party tracking. Operational AI consultancy also means: operational client relationship."}
          </p>
        </Container>
      </Section>

      {/* Trois portes d'entrée — anti-fear / cartes maturité */}
      <Section
        eyebrow={isFr ? "Trois façons de nous joindre" : "Three ways to reach us"}
        tone="sand"
      >
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{isFr ? "Réserver une intervention" : "Book a session"}</CardTitle>
                <CardDescription>
                  {isFr
                    ? "Le calendrier maison affiche les créneaux disponibles en temps réel."
                    : "Live availability via the on-site calendar."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Cta href="/interventions/essentielle" variant="primary">
                  {isFr ? "Réserver" : "Book"} â†’
                </Cta>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{isFr ? "Demander un audit" : "Request an audit"}</CardTitle>
                <CardDescription>
                  {isFr
                    ? "4 tailles Ã— 2 modalités. Formulaire 5 étapes."
                    : "4 sizes Ã— 2 modalities. 5-step form."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Cta href="/audit" variant="outline">
                  {isFr ? "Voir les audits" : "See audits"} â†’
                </Cta>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{isFr ? "Implémentation IA" : "AI implementation"}</CardTitle>
                <CardDescription>
                  {isFr
                    ? "9 prestations dont l'IA Custom premium."
                    : "9 services including premium Custom AI."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Cta href="/implementation" variant="outline">
                  {isFr ? "Voir les prestations" : "See services"} â†’
                </Cta>
              </CardContent>
            </Card>
          </div>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Coordonnées" : "Details"}>
        <Container className="text-fg max-w-2xl space-y-2 text-base leading-relaxed">
          <p>
            <strong>{isFr ? "Société" : "Company"} :</strong> Axion-IA OÜ
          </p>
          <p>
            <strong>Email :</strong>{" "}
            <a href="mailto:contact@axion-ia.com" className="text-primary hover:underline">
              contact@axion-ia.com
            </a>
          </p>
          <p className="text-fg-soft text-sm">
            {isFr
              ? "Coordonnées complètes et juridiction : voir mentions légales."
              : "Full details and jurisdiction: see legal notice."}
          </p>
        </Container>
      </Section>

      <Section id="message" eyebrow={isFr ? "Message direct" : "Direct message"}>
        <Container className="max-w-2xl">
          <ContactForm
            labels={
              isFr
                ? {
                    name: "Nom & prénom",
                    email: "Email professionnel",
                    company: "Entreprise (optionnel)",
                    message: "Votre message",
                    consent:
                      "J'accepte que mes données soient utilisées pour traiter cette demande conformément Ã  la politique de confidentialité.",
                    submit: "Envoyer le message",
                    sending: "Envoi…",
                    success: "Message reçu. Nous vous répondons sous 48 h ouvrées.",
                    failure:
                      "Une erreur est survenue. Réessayez ou écrivez Ã  contact@axion-ia.com.",
                  }
                : {
                    name: "Full name",
                    email: "Professional email",
                    company: "Company (optional)",
                    message: "Your message",
                    consent:
                      "I agree to my data being used to process this request in accordance with the privacy policy.",
                    submit: "Send message",
                    sending: "Sending…",
                    success: "Message received. We will reply within 48 business hours.",
                    failure: "An error occurred. Try again or email contact@axion-ia.com.",
                  }
            }
          />
        </Container>
      </Section>

      {/* Micro-FAQ — 5 entrées AEO citables (FAQPage JSON-LD émis par FaqBlock) */}
      <FaqBlock
        eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
        title={isFr ? "Avant d'écrire" : "Before you write"}
        description={
          isFr
            ? "Les questions reçues le plus souvent — délais, engagement, RGPD, scope."
            : "The questions we get the most — delays, commitment, GDPR, scope."
        }
        items={faqItems}
        tone="canvas"
      />

      <CtaBlock
        title={isFr ? "Prête Ã  démarrer ?" : "Ready to start?"}
        description={
          isFr
            ? "Réservez une intervention ou demandez un devis — réponse sous 48 h ouvrées."
            : "Book a session or request a quote — reply within 48 business hours."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr
              ? `Voir l'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
              : `See the Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}{" "}
            â†’
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={contactJsonLd} />
    </>
  );
}
