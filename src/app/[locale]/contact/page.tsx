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
        ? "Contact Â· AxionIA Â· rÃ©ponse sous 48 h ouvrÃ©es"
        : "Contact Â· AxionIA Â· 48 business-hour reply",
    description:
      locale === "fr"
        ? "Demandez un devis ou rÃ©servez une intervention. RÃ©ponse sous 48 h ouvrÃ©es. AxionIA OÃœ â€” cabinet IA opÃ©rationnel."
        : "Request a quote or book a session. Reply within 48 business hours. AxionIA OÃœ â€” operational AI consultancy.",
  });
}

export default async function Contact({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [{ href: "/contact", label: "Contact" }];

  // Trust pills hero â€” rÃ©assurance dimension-1 (cf. audit V14, D3 pills 0â†’3).
  const pills = isFr
    ? [
        { icon: Clock, label: "48 h ouvrÃ©es" },
        { icon: HeartHandshake, label: "Sans engagement" },
        { icon: ShieldCheck, label: "RGPD Â· UE" },
        { icon: BookOpenCheck, label: "MÃ©thode documentÃ©e" },
      ]
    : [
        { icon: Clock, label: "48 business hours" },
        { icon: HeartHandshake, label: "No commitment" },
        { icon: ShieldCheck, label: "GDPR Â· EU" },
        { icon: BookOpenCheck, label: "Documented method" },
      ];

  // Micro-FAQ â€” 5 entrÃ©es, focus AEO (rÃ©ponses ~50-80 mots = citables LLM).
  // FaqBlock Ã©met la FAQPage JSON-LD via `emitJsonLd` (par dÃ©faut true).
  const faqItems = isFr
    ? [
        {
          id: "delai",
          question: "Sous combien de temps obtenez-vous une rÃ©ponse ?",
          answer:
            "Tous les messages reÃ§us en jours ouvrÃ©s sont traitÃ©s sous 48 h ouvrÃ©es maximum, fuseau Europe/Paris. La plupart des demandes obtiennent une rÃ©ponse le jour mÃªme ou le lendemain. Pas de rÃ©ponse automatisÃ©e : un humain lit chaque message avant de rÃ©pondre.",
        },
        {
          id: "engagement",
          question: "Faut-il signer un engagement pour Ã©changer ?",
          answer:
            "Non. L'Ã©change initial â€” message, appel dÃ©couverte, envoi d'informations â€” est sans engagement. L'engagement contractuel commence uniquement Ã  la rÃ©servation d'une intervention payante (Essentielle 490 â‚¬ ou plus) ou d'un audit cadrÃ©, et fait l'objet d'un devis explicite.",
        },
        {
          id: "rgpd",
          question: "Comment traitez-vous les donnÃ©es envoyÃ©es via le formulaire ?",
          answer:
            "Les donnÃ©es du formulaire sont stockÃ©es en Estonie (UE), traitÃ©es exclusivement pour rÃ©pondre Ã  votre demande, et supprimÃ©es Ã  six mois si la conversation n'aboutit pas. Aucune revente, aucun outil tiers de tracking, pas de profilage. DÃ©tails dans la politique de confidentialitÃ©.",
        },
        {
          id: "rdv",
          question: "Puis-je rÃ©server un appel directement ?",
          answer:
            "Oui. L'Essentielle (490 â‚¬, 90 min) est un appel diagnostic facturÃ© qui se rÃ©serve sur le calendrier maison avec crÃ©neaux en temps rÃ©el. Pour un Ã©change dÃ©couverte gratuit (15-20 min), passez par le formulaire en prÃ©cisant Â« appel dÃ©couverte Â» dans le message.",
        },
        {
          id: "scope",
          question: "Quels sujets traitez-vous, lesquels Ã©cartez-vous ?",
          answer:
            "AxionIA intervient sur l'IA opÃ©rationnelle B2B : audits, intÃ©gration IA Custom, automatisations, formation. Hors scope : dÃ©veloppement d'apps grand public, projets ML pure recherche, hÃ©bergement long terme. En cas de hors scope, nous orientons vers un partenaire pertinent dans la rÃ©ponse.",
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
          answer:
            "No. The initial exchange â€” message, discovery call, info sent â€” is no-commitment. Contractual commitment only starts when you book a paid session (Essential â‚¬490 or above) or a scoped audit, and is always covered by an explicit quote.",
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
          answer:
            "Yes. The Essential (â‚¬490, 90 min) is a paid diagnostic call bookable on the on-site calendar with live availability. For a free discovery exchange (15-20 min), use the form and mention Â« discovery call Â» in the message.",
        },
        {
          id: "scope",
          question: "What topics do you cover, what do you decline?",
          answer:
            "AxionIA covers operational B2B AI: audits, Custom AI integration, automations, training. Out of scope: consumer apps, pure ML research, long-term hosting. When out of scope, we point you to a relevant partner in the reply.",
        },
      ];

  // ContactPage JSON-LD enrichi : `mainEntity: ContactPoint` expose le canal
  // contact comme entitÃ© actionnable (AEO/GEO 2026, Perplexity / SGE / Claude.ai
  // resolution d'entitÃ© Â« comment contacter AxionIA Â»). CohÃ©rent avec la
  // doctrine `buildOrganizationJsonLd` du layout â€” ici on dÃ©clare le point
  // de contact spÃ©cifique de la page /contact (vs Organization global).
  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: `${SITE_URL}/${loc}/contact`,
    inLanguage: loc,
    name: isFr ? "Contact AxionIA" : "Contact AxionIA",
    description: isFr
      ? "Formulaire de contact AxionIA â€” rÃ©ponse sous 48 h ouvrÃ©es, sans engagement, donnÃ©es stockÃ©es en UE."
      : "AxionIA contact form â€” reply within 48 business hours, no commitment, data stored in the EU.",
    publisher: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
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

      {/* HERO 2-col â€” texte Ã  gauche, ContactHeroSchema (3 portes d'entrÃ©e) Ã  droite */}
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
                {isFr ? "DÃ©marrer " : "Start "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "un Ã©change" : "a conversation"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "RÃ©ponse sous 48 h ouvrÃ©es par un humain. DÃ©crivez votre besoin ou posez une question â€” vous repartez avec un devis dÃ©taillÃ© ou une orientation honnÃªte, sans relance commerciale."
                  : "Reply within 48 business hours, by a human. Describe your need or ask a question â€” you walk away with a detailed quote or an honest pointer, no commercial chasing."}
              </p>
              {/* Pills rÃ©assurance */}
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
                  {isFr ? "Voir l'Essentielle 490 â‚¬" : "See the Essential â‚¬490"}
                </Cta>
              </div>
            </div>
            <ContactHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "SchÃ©ma : 3 portes d'entrÃ©e AxionIA â€” message direct (48 h ouvrÃ©es), Essentielle 490 â‚¬, audit cadrÃ© 4 tailles."
                  : "Diagram: 3 ways into AxionIA â€” direct message (48 business hours), Essential â‚¬490, scoped audit 4 sizes."
              }
            />
          </div>
        </Container>
      </section>

      {/* Pillar copy â€” posture relation client */}
      <Section eyebrow={isFr ? "Posture" : "Stance"} tone="paper">
        <Container className="max-w-3xl">
          <p className="text-fg-soft text-lg leading-relaxed">
            {isFr
              ? "AxionIA traite chaque message comme un signal opÃ©rationnel, pas comme un lead. La rÃ¨gle est explicite : un humain lit, un humain rÃ©pond, et la rÃ©ponse arrive sous 48 heures ouvrÃ©es â€” souvent avant. Si votre besoin sort de notre pÃ©rimÃ¨tre (apps grand public, R&D pure, hÃ©bergement long terme), nous le disons et nous vous orientons vers un partenaire pertinent. Si la demande tombe pile dans nos interventions, vous repartez avec un devis cadrÃ©, un planning, et la doctrine que nous appliquerons. Pas de relance commerciale automatisÃ©e, pas de sÃ©quence email, pas d'outil tiers de tracking. Cabinet IA opÃ©rationnel signifie aussi : relation client opÃ©rationnelle."
              : "AxionIA treats every message as an operational signal, not a lead. The rule is explicit: a human reads, a human replies, and the reply lands within 48 business hours â€” often sooner. If your need falls out of scope (consumer apps, pure R&D, long-term hosting), we say so and point you to a relevant partner. If the request lands squarely in our practice, you walk away with a scoped quote, a schedule, and the doctrine we will apply. No automated chasing, no email sequence, no third-party tracking. Operational AI consultancy also means: operational client relationship."}
          </p>
        </Container>
      </Section>

      {/* Trois portes d'entrÃ©e â€” anti-fear / cartes maturitÃ© */}
      <Section
        eyebrow={isFr ? "Trois faÃ§ons de nous joindre" : "Three ways to reach us"}
        tone="sand"
      >
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{isFr ? "RÃ©server une intervention" : "Book a session"}</CardTitle>
                <CardDescription>
                  {isFr
                    ? "Le calendrier maison affiche les crÃ©neaux disponibles en temps rÃ©el."
                    : "Live availability via the on-site calendar."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Cta href="/interventions/essentielle" variant="primary">
                  {isFr ? "RÃ©server" : "Book"} â†’
                </Cta>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{isFr ? "Demander un audit" : "Request an audit"}</CardTitle>
                <CardDescription>
                  {isFr
                    ? "4 tailles Ã— 2 modalitÃ©s. Formulaire 5 Ã©tapes."
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
                <CardTitle>{isFr ? "ImplÃ©mentation IA" : "AI implementation"}</CardTitle>
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

      <Section eyebrow={isFr ? "CoordonnÃ©es" : "Details"}>
        <Container className="text-fg max-w-2xl space-y-2 text-base leading-relaxed">
          <p>
            <strong>{isFr ? "SociÃ©tÃ©" : "Company"} :</strong> AxionIA OÃœ
          </p>
          <p>
            <strong>Email :</strong>{" "}
            <a href="mailto:contact@axion-ia.com" className="text-primary hover:underline">
              contact@axion-ia.com
            </a>
          </p>
          <p className="text-fg-soft text-sm">
            {isFr
              ? "CoordonnÃ©es complÃ¨tes et juridiction : voir mentions lÃ©gales."
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
                    name: "Nom & prÃ©nom",
                    email: "Email professionnel",
                    company: "Entreprise (optionnel)",
                    message: "Votre message",
                    consent:
                      "J'accepte que mes donnÃ©es soient utilisÃ©es pour traiter cette demande conformÃ©ment Ã  la politique de confidentialitÃ©.",
                    submit: "Envoyer le message",
                    sending: "Envoiâ€¦",
                    success: "Message reÃ§u. Nous vous rÃ©pondons sous 48 h ouvrÃ©es.",
                    failure:
                      "Une erreur est survenue. RÃ©essayez ou Ã©crivez Ã  contact@axion-ia.com.",
                  }
                : {
                    name: "Full name",
                    email: "Professional email",
                    company: "Company (optional)",
                    message: "Your message",
                    consent:
                      "I agree to my data being used to process this request in accordance with the privacy policy.",
                    submit: "Send message",
                    sending: "Sendingâ€¦",
                    success: "Message received. We will reply within 48 business hours.",
                    failure: "An error occurred. Try again or email contact@axion-ia.com.",
                  }
            }
          />
        </Container>
      </Section>

      {/* Micro-FAQ â€” 5 entrÃ©es AEO citables (FAQPage JSON-LD Ã©mis par FaqBlock) */}
      <FaqBlock
        eyebrow={isFr ? "Questions frÃ©quentes" : "Frequently asked"}
        title={isFr ? "Avant d'Ã©crire" : "Before you write"}
        description={
          isFr
            ? "Les questions reÃ§ues le plus souvent â€” dÃ©lais, engagement, RGPD, scope."
            : "The questions we get the most â€” delays, commitment, GDPR, scope."
        }
        items={faqItems}
        tone="canvas"
      />

      <CtaBlock
        title={isFr ? "PrÃªte Ã  dÃ©marrer ?" : "Ready to start?"}
        description={
          isFr
            ? "RÃ©servez une intervention ou demandez un devis â€” rÃ©ponse sous 48 h ouvrÃ©es."
            : "Book a session or request a quote â€” reply within 48 business hours."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle 490 â‚¬" : "See the Essential â‚¬490"} â†’
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={contactJsonLd} />
    </>
  );
}
