import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldCheck, Building2, Calendar, Globe2 } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { TimelineBlock } from "@/components/sections/TimelineBlock";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { AboutHeroSchema } from "@/components/sections/AboutHeroSchema";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { ABOUT_TIMELINE, ABOUT_TEAM } from "@/content/transversal";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import {
  buildProductMetadata,
  buildPersonJsonLd,
  buildLocalBusinessJsonLd,
  SITE_URL,
  SITE_EDITORIAL_DATE,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/a-propos",
    title:
      locale === "fr"
        ? "À propos · cabinet IA opérationnel · Axion-IA"
        : "About · operational AI consultancy · Axion-IA",
    description:
      locale === "fr"
        ? "Axion-IA, cabinet IA opérationnel basé à Paris : mission, équipe, valeurs E-E-A-T, hébergement UE et réponse humaine sous 48 h. Découvrez notre parcours depuis 2024."
        : "Axion-IA — operational AI consultancy for companies. Mission, team, values, timeline.",
    alternates: { fr: "/a-propos", en: "/about" },
  });
}

export default async function About({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/a-propos", label: isFr ? "À propos" : "About" }];

  // Person JSON-LD — E-E-A-T 2026 (Will fondateur identifié auprès des
  // answer engines : Google AI Overviews + Claude.ai + Perplexity + Bing
  // Copilot citent davantage les sources qui exposent un humain identifié
  // qu'une Organization faceless).
  const personJsonLd = buildPersonJsonLd({ locale: loc });

  // LocalBusiness root — 1 SEULE émission propre sur le site, sur /a-propos
  // (Sprint Correctif P1-2 2026-05-23 — audit E2E passe 2 runtime + décision Will).
  //
  // Axion-IA = 1 siège FR Paris (Service Area Business pattern). Toutes les
  // autres pages ville-service émettent Service+areaServed (pas LocalBusiness)
  // pour ne pas claim de bureau physique dans chaque ville (anti-spam local Google).
  // Cette émission ici donne à Google + AI overviews une ancre locale CLAIRE et
  // UNIQUE pour ancrer l'entité Axion-IA à Paris.
  //
  // ⚠️ Champs ÉMIS uniquement avec données réelles (no street/geo/horaires/CP
  // car données précises non publiables par Will pour l'instant — à compléter
  // dès que disponibles). Ce LB minimal reste compatible Schema.org et ne ment
  // pas sur des coords physiques inexistantes.
  const localBusinessRootJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: "/a-propos",
    name: isFr
      ? "Axion-IA — Cabinet IA opérationnel B2B (siège Paris, France)"
      : "Axion-IA — Operational B2B AI consultancy (HQ Paris, France)",
    description: isFr
      ? "Axion-IA est un cabinet IA opérationnel basé à Paris, qui intervient sur toute la France auprès de TPE, PME, ETI et grands comptes : interventions IA, audits, implémentations, coaching 1-to-1 et sites web augmentés."
      : "Axion-IA is an operational AI consultancy headquartered in Paris, serving the whole of France for SMBs, mid-caps and enterprises: AI sessions, audits, implementations, 1-to-1 coaching and AI-augmented websites.",
    areaServed: { type: "AdministrativeArea", name: "France" },
    address: {
      city: "Paris",
      region: "Île-de-France",
      country: "FR",
    },
  });

  // AboutPage JSON-LD — wrapper sémantique de la page « À propos ». Relie la
  // page au #website (isPartOf) et à l'entité canonique #organization (about /
  // mainEntity) pour consolider le knowledge graph (Google + AI Overviews
  // rattachent la page d'autorité à l'entité Axion-IA). dateModified = signal
  // de fraîcheur AEO 2026.
  const aboutPageUrl = `${SITE_URL}/${loc}/a-propos`;
  const aboutPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": aboutPageUrl,
    url: aboutPageUrl,
    inLanguage: loc,
    name: isFr ? "À propos d'Axion-IA" : "About Axion-IA",
    description: isFr
      ? "Axion-IA, cabinet IA opérationnel basé à Paris : mission, équipe, valeurs E-E-A-T et parcours depuis 2024."
      : "Axion-IA, an operational AI consultancy based in Paris: mission, team, E-E-A-T values and journey since 2024.",
    dateModified: SITE_EDITORIAL_DATE,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    mainEntity: { "@id": `${SITE_URL}/#organization` },
    about: { "@id": `${SITE_URL}/#organization` },
  } as const;

  // FAQ AEO — Q/R factuelles citables sur l'entité Axion-IA (siège, ancienneté,
  // périmètre). FaqBlock émet automatiquement le FAQPage JSON-LD via FaqAccordion.
  const aboutFaq = isFr
    ? [
        {
          id: "siege",
          question: "Où est le siège d'Axion-IA ?",
          answer:
            "Le siège d'Axion-IA est à Paris, France. C'est un cabinet IA opérationnel français, qui intervient sur toute la France auprès des TPE, PME, ETI et grands comptes.",
        },
        {
          id: "depuis-quand",
          question: "Depuis quand Axion-IA existe-t-il ?",
          answer:
            "Axion-IA a été fondé en 2024. Le cabinet a été créé en France pour la stabilité juridique et la proximité avec les entreprises françaises et européennes.",
        },
        {
          id: "perimetre",
          question: "Quel est le périmètre d'intervention d'Axion-IA ?",
          answer:
            "Axion-IA couvre les interventions IA, les audits, les implémentations en production, le coaching 1-à-1 et les sites web augmentés. Les données sont hébergées dans l'Union européenne (Hetzner Frankfurt).",
        },
        {
          id: "delai-reponse",
          question: "En combien de temps Axion-IA répond-il à une demande ?",
          answer:
            "Toute demande de devis ou de contact reçoit une réponse humaine sous 48 heures ouvrées, sans engagement.",
        },
      ]
    : [
        {
          id: "siege",
          question: "Where is Axion-IA's head office?",
          answer:
            "Axion-IA's head office is in Paris, France. It is a French operational AI consultancy serving the whole of France for small businesses, SMEs, mid-caps and large accounts.",
        },
        {
          id: "depuis-quand",
          question: "How long has Axion-IA existed?",
          answer:
            "Axion-IA was founded in 2024. The consultancy was created in France for legal stability and proximity to French and European companies.",
        },
        {
          id: "perimetre",
          question: "What is Axion-IA's scope of work?",
          answer:
            "Axion-IA covers AI sessions, audits, production implementations, 1-to-1 coaching and AI-augmented websites. Data is hosted in the European Union (Hetzner Frankfurt).",
        },
        {
          id: "delai-reponse",
          question: "How quickly does Axion-IA reply to a request?",
          answer:
            "Every quote or contact request gets a human reply within 48 business hours, with no commitment.",
        },
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2-col custom — texte à gauche, AboutHeroSchema à droite */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "À propos" : "About"}
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Cabinet IA " : "Operational AI "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "opérationnel" : "consultancy"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Axion-IA accompagne les entreprises dans l'identification, la démonstration et l'implémentation d'usages IA générant un ROI mesurable. Hébergement UE, méthode documentée, livrables actionnables."
                  : "Axion-IA helps companies identify, demonstrate and implement AI use cases generating measurable ROI. EU hosting, documented method, actionable deliverables."}
              </p>
              {/* Pills réassurance */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  { icon: Building2, label: isFr ? "Axion-IA · Europe" : "Axion-IA · Europe" },
                  { icon: ShieldCheck, label: isFr ? "Hébergement UE" : "EU hosting" },
                  { icon: Calendar, label: isFr ? "Fondé 2024" : "Founded 2024" },
                  { icon: Globe2, label: isFr ? "FR · EN · UE" : "FR · EN · EU" },
                ].map((pill) => {
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
                <Cta href="/interventions/essentielle" size="lg">
                  {isFr
                    ? `Voir l'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
                    : `See the Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/audit" variant="outline" size="lg">
                  {isFr ? "Demander un audit" : "Request an audit"}
                </Cta>
              </div>
            </div>
            <AboutHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Schéma : doctrine Axion-IA en 3 piliers — opérationnel d'abord, ROI mesurable, souveraineté UE."
                  : "Diagram: Axion-IA doctrine in 3 pillars — operational first, measurable ROI, EU sovereignty."
              }
            />
          </div>
        </Container>
      </section>

      {/* Pillar copy — pourquoi Axion-IA */}
      <Section eyebrow={isFr ? "Pourquoi Axion-IA" : "Why Axion-IA"} tone="paper">
        <Container className="max-w-3xl">
          <p className="text-fg-soft text-lg leading-relaxed">
            {isFr
              ? "Le marché de l'IA d'entreprise en 2026 est saturé de promesses non tenues. Pilotes qui ne passent jamais en production. Démos époustouflantes sur des données fabriquées. Factures longues comme un bras pour des outils sans ROI mesurable. Axion-IA prend le contre-pied : aucune intervention sans démonstration sur vos données réelles, aucun devis sans plan d'action chiffré priorisé, aucun déploiement sans support post-livraison. Cabinet IA opérationnel signifie : on travaille dans vos process, pas à côté. France : siège choisi pour la stabilité juridique et la proximité avec les entreprises françaises et européennes."
              : "The enterprise AI market in 2026 is saturated with broken promises. Pilots that never reach production. Stunning demos on fabricated data. Long invoices for tools without measurable ROI. Axion-IA takes the opposite stance: no engagement without a live demo on your real data, no quote without a costed prioritised action plan, no deployment without post-delivery support. Operational AI consultancy means: we work inside your processes, not next to them. France: HQ chosen for legal stability and proximity to French and European companies."}
          </p>
        </Container>
      </Section>

      {/* Proof — chiffres clés */}
      <Section eyebrow={isFr ? "Repères" : "Key figures"} tone="sand">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                figure: "2024",
                label: isFr ? "Fondée 2024" : "Founded 2024",
                detail: isFr
                  ? "Cabinet IA français fondé en 2024."
                  : "French AI consultancy founded in 2024.",
              },
              {
                figure: "100 %",
                label: isFr ? "Hébergement UE" : "EU hosting",
                detail: isFr
                  ? "Données stockées sur Hetzner Frankfurt."
                  : "Data hosted on Hetzner Frankfurt.",
              },
              {
                figure: "48 h",
                label: isFr ? "Réponse devis" : "Quote reply",
                detail: isFr
                  ? "Sous 48 heures ouvrées, par un humain."
                  : "Within 48 business hours, by a human.",
              },
              {
                figure: "30 j",
                label: isFr ? "Support inclus" : "Support included",
                detail: isFr
                  ? "Maintenance corrective post-livraison incluse."
                  : "Post-delivery corrective maintenance included.",
              },
            ].map((stat) => (
              <div
                key={stat.figure}
                className="border-border bg-paper shadow-subtle rounded-2xl border p-6"
              >
                <p
                  className="text-terracotta text-4xl leading-none font-medium tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {stat.figure}
                </p>
                <p className="text-fg mt-3 text-sm font-semibold tracking-tight">{stat.label}</p>
                <p className="text-fg-soft mt-1.5 text-sm leading-snug">{stat.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Parcours" : "Timeline"}>
        <Container className="max-w-3xl">
          <TimelineBlock
            events={ABOUT_TIMELINE.map((e) => ({
              id: e.id,
              date: e.date,
              title: e[loc].title,
              description: e[loc].description,
            }))}
          />
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Équipe" : "Team"}>
        <TeamGrid
          members={ABOUT_TEAM.map((m) => ({
            id: m.id,
            name: m[loc].name,
            role: m[loc].role,
            bio: m[loc].bio,
          }))}
        />
      </Section>

      <Section eyebrow={isFr ? "Valeurs" : "Values"}>
        <Container className="max-w-5xl">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14">
            <div className="text-fg space-y-6 text-lg leading-relaxed">
              <p>
                <strong>{isFr ? "Opérationnel d'abord." : "Operational first."}</strong>{" "}
                {isFr
                  ? "Aucune intervention sans démonstration sur vos données réelles."
                  : "No engagement without a live demo on your real data."}
              </p>
              <p>
                <strong>{isFr ? "ROI mesurable." : "Measurable ROI."}</strong>{" "}
                {isFr
                  ? "Plan d'action chiffré priorisé, support post-livraison inclus."
                  : "Costed prioritised action plan, post-delivery support included."}
              </p>
              <p>
                <strong>{isFr ? "Souveraineté." : "Sovereignty."}</strong>{" "}
                {isFr
                  ? "Hébergement UE par défaut, modèles open-source quand pertinent."
                  : "EU hosting by default, open-source models when relevant."}
              </p>
            </div>
            <Illustration
              slot="APROPOS-02-mid"
              aspectRatio="1:1"
              filenameTarget="public/illustrations/a-propos-mid-1.avif"
              caption={
                isFr
                  ? "Atelier de conception — précision, traces de craie, plan ouvert"
                  : "Design studio — precision, chalk traces, open blueprint"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'un atelier de conception symbolisant la précision opérationnelle d'Axion-IA."
                  : "Editorial illustration of a design studio symbolizing Axion-IA's operational precision."
              }
            />
          </div>
        </Container>
      </Section>

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="APROPOS-03-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/a-propos-closing.avif"
            caption={
              isFr
                ? "Cabinet IA opérationnel — vue éditoriale d'un système en marche"
                : "Operational AI consultancy — editorial view of a system at work"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'un cabinet IA opérationnel en activité — vue d'ensemble du système Axion-IA."
                : "Editorial illustration of an operational AI consultancy at work — overview of the Axion-IA system."
            }
          />
        </Container>
      </Section>

      {/* FAQ AEO — entité Axion-IA (siège, ancienneté, périmètre) + FAQPage
         JSON-LD auto via FaqAccordion */}
      <FaqBlock
        tone="canvas"
        eyebrow="FAQ"
        title={isFr ? "Questions sur" : "Questions about"}
        titleEm="Axion-IA"
        description={
          isFr
            ? "Siège, ancienneté, périmètre, délai de réponse — l'essentiel sur le cabinet."
            : "Head office, history, scope, response time — the essentials about the consultancy."
        }
        items={aboutFaq}
      />

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={
          isFr ? "Démarrons par une intervention concrète" : "Let's start with a concrete session"
        }
        description={
          isFr
            ? `L'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} est conçue pour démarrer vite, sans pré-requis IA.`
            : `The Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })} is designed to start fast, with no AI prerequisites.`
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle" : "See the Essential"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={aboutPageJsonLd} scriptId="jsonld-axion-ia-aboutpage" />
      <JsonLd data={personJsonLd} />
      <JsonLd data={localBusinessRootJsonLd} scriptId="jsonld-axion-ia-root-localbusiness" />
    </>
  );
}
