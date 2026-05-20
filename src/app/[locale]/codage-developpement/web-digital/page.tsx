import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock, Code2, Globe, ShieldCheck, Sparkles } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildServiceJsonLd, buildFaqJsonLd } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/codage-developpement/web-digital",
    title: isFr
      ? "Plateforme web IA-native ou site augmenté | Axion-IA"
      : "AI-native web platform or site augmentation | Axion-IA",
    description: isFr
      ? "Axion-IA conçoit des plateformes web sur mesure IA-native ou greffe l'IA sur votre existant. Toute stack moderne — chatbot RAG, search sémantique, automatisations. Devis 48 h."
      : "Axion-IA builds AI-native custom platforms or grafts AI onto your existing stack. Any modern tech stack — RAG chatbot, semantic search, automations. Quote in 48 h.",
    alternates: {
      fr: "/codage-developpement/web-digital",
      en: "/codage-developpement/web-digital",
    },
  });
}

export default async function WebDigitalPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    {
      href: "/implementation" as const,
      label: isFr ? "Implémentation IA" : "AI implementation",
    },
    {
      href: "/codage-developpement/web-digital" as const,
      label: isFr ? "Web & Digital augmentés" : "AI-augmented web & digital",
    },
  ];

  const trustItems = isFr
    ? [
        { icon: Clock, label: "Livraison 3 à 6 semaines" },
        { icon: ShieldCheck, label: "Build IA-native ou augmentation de l'existant" },
        { icon: Code2, label: "Toute stack moderne — on s'adapte à votre env" },
        { icon: Sparkles, label: "Données hébergées en UE · RGPD natif" },
      ]
    : [
        { icon: Clock, label: "Delivery 3 to 6 weeks" },
        { icon: ShieldCheck, label: "AI-native build or augmentation of existing stack" },
        { icon: Code2, label: "Toute stack moderne — on s'adapte à votre env" },
        { icon: Sparkles, label: "EU hosting · GDPR by design" },
      ];

  const modules = isFr
    ? [
        {
          icon: "💬",
          title: "Chatbot IA sur mesure",
          description:
            "Formé sur votre base documentaire (FAQ, catalogue, procédures), il répond précisément à vos visiteurs 24h/7j. 80 % des questions traitées automatiquement.",
          metric: "80 %",
          metricLabel: "questions traitées auto",
          delay: "3 semaines",
        },
        {
          icon: "🔍",
          title: "Recherche sémantique",
          description:
            "L'IA comprend l'intention derrière la requête, pas juste les mots. Résultats pertinents même avec des formulations approximatives ou des synonymes métier.",
          metric: "+40 %",
          metricLabel: "requêtes résolues précisément",
          delay: "2 semaines",
        },
        {
          icon: "⭐",
          title: "Suggestions intelligentes",
          description:
            "Moteur IA qui analyse le comportement de chaque utilisateur et suggère le contenu, la fonctionnalité ou la ressource la plus pertinente à l'instant T.",
          metric: "+18 %",
          metricLabel: "taux d'engagement",
          delay: "4 semaines",
        },
        {
          icon: "🎯",
          title: "Personnalisation dynamique",
          description:
            "Contenu, CTAs et offres adaptés au profil de chaque visiteur (secteur, historique, source). Sans cookie tiers — IA côté serveur, RGPD strict.",
          metric: "−30 %",
          metricLabel: "visiteurs perdus sans action",
          delay: "6 semaines",
        },
      ]
    : [
        {
          icon: "💬",
          title: "Custom AI chatbot",
          description:
            "Trained on your knowledge base (FAQ, catalogue, procedures), it answers your visitors precisely 24/7. 80% of questions handled automatically.",
          metric: "80%",
          metricLabel: "auto-resolved questions",
          delay: "3 weeks",
        },
        {
          icon: "🔍",
          title: "Semantic search",
          description:
            "AI understands the intent behind the query, not just the words. Relevant results even with approximate phrasing or business-specific synonyms.",
          metric: "+40%",
          metricLabel: "queries resolved precisely",
          delay: "2 weeks",
        },
        {
          icon: "⭐",
          title: "Smart suggestions",
          description:
            "AI engine that analyses each user's behaviour and suggests the most relevant content, feature or resource at the right moment.",
          metric: "+18%",
          metricLabel: "engagement rate",
          delay: "4 weeks",
        },
        {
          icon: "🎯",
          title: "Dynamic personalization",
          description:
            "Content, CTAs and offers adapted to each visitor's profile (sector, history, source). No third-party cookie — server-side AI, strict GDPR.",
          metric: "−30%",
          metricLabel: "visitors lost without action",
          delay: "6 weeks",
        },
      ];

  const scenarios = isFr
    ? [
        {
          type: "Plateforme SaaS B2B",
          stack: "Next.js + Laravel + Postgres · construite par Axion-IA",
          before: "Client qui veut lancer une plateforme métier mais sans savoir intégrer l'IA.",
          after:
            "Plateforme livrée avec agents IA, automatisations métier, search sémantique et chatbot intégrés dès le premier sprint.",
          metric: "IA-native dès J+1",
        },
        {
          type: "Application web existante",
          stack: "Next.js, Laravel ou toute stack avec API",
          before:
            "Plateforme fonctionnelle mais sans IA — utilisateurs qui cherchent dans la doc, ouvrent des tickets pour des questions simples.",
          after:
            "Assistant IA contextuel greffé dans l'interface, recherche documentaire sémantique, automatisations ajoutées sans refonte.",
          metric: "−40 % tickets niveau 1",
        },
        {
          type: "Portail client / espace membre",
          stack: "Stack custom ou Webflow + API",
          before:
            "Clients qui ne trouvent pas l'information, support surchargé, relances manuelles chronophages.",
          after:
            "Chatbot RAG formé sur vos contenus, relances automatiques, personnalisation par profil client. Support allégé de 60 %.",
          metric: "−60 % charge support",
        },
      ]
    : [
        {
          type: "B2B SaaS platform",
          stack: "Next.js + Laravel + Postgres · built by Axion-IA",
          before:
            "Client wants to launch a business platform but doesn't know how to integrate AI.",
          after:
            "Platform delivered with AI agents, business automations, semantic search and chatbot integrated from the first sprint.",
          metric: "AI-native from day 1",
        },
        {
          type: "Existing web application",
          stack: "Next.js, Laravel or any API-enabled stack",
          before:
            "Working platform but no AI — users searching docs, opening tickets for simple questions.",
          after:
            "Contextual AI assistant grafted into the interface, semantic doc search, automations added without a rebuild.",
          metric: "−40% L1 tickets",
        },
        {
          type: "Client portal / member area",
          stack: "Custom stack or Webflow + API",
          before:
            "Clients can't find information, support overwhelmed, manual follow-ups time-consuming.",
          after:
            "RAG chatbot trained on your content, automatic follow-ups, personalization by client profile. Support reduced by 60%.",
          metric: "−60% support load",
        },
      ];

  const processSteps = isFr
    ? [
        {
          id: "s1",
          title: "Audit de votre existant · 2 h",
          description:
            "On analyse votre site, votre stack technique, vos données disponibles (FAQ, catalogue, docs). On identifie les 2-3 briques IA à plus fort ROI.",
        },
        {
          id: "s2",
          title: "Devis ferme sous 48 h",
          description:
            "Périmètre exact, modules choisis, prix fixe, délai garanti. Pas d'ambiguïté avant la signature.",
        },
        {
          id: "s3",
          title: "Intégration sans refonte",
          description:
            "On greffe l'IA sur votre site via widget JS, API ou plugin — pas de migration, pas de downtime.",
        },
        {
          id: "s4",
          title: "Tests & validation",
          description:
            "Démos hebdomadaires, corrections en continu. Vous validez chaque module avant mise en ligne.",
        },
        {
          id: "s5",
          title: "Livraison + formation incluse",
          description:
            "Vos équipes prennent en main en 2 h. Documentation, accès admin, logs de performance. C'est à vous.",
        },
      ]
    : [
        {
          id: "s1",
          title: "Audit of your existing setup · 2 h",
          description:
            "We analyse your site, tech stack and available data (FAQ, catalogue, docs). We identify the 2-3 highest-ROI AI bricks.",
        },
        {
          id: "s2",
          title: "Firm quote within 48 h",
          description:
            "Exact scope, chosen modules, fixed price, guaranteed timeline. No ambiguity before signing.",
        },
        {
          id: "s3",
          title: "Integration without redesign",
          description:
            "We graft AI onto your site via JS widget, API or plugin — no migration, no downtime.",
        },
        {
          id: "s4",
          title: "Tests & validation",
          description:
            "Weekly demos, continuous fixes. You validate each module before going live.",
        },
        {
          id: "s5",
          title: "Delivery + included training",
          description:
            "Your teams are up to speed in 2 h. Documentation, admin access, performance logs. It's yours.",
        },
      ];

  const faqs = isFr
    ? [
        {
          id: "q-refonte",
          question: "Faut-il refaire mon site pour intégrer l'IA ?",
          answer:
            "Non. On greffe l'IA sur votre site existant via widget JavaScript, plugin ou API REST — sans toucher au design ni à la structure de vos pages. La mise en ligne ne provoque aucun downtime.",
        },
        {
          id: "q-stack",
          question: "Vous travaillez sur quelles technologies ?",
          answer:
            "On travaille sur toute stack moderne : Next.js, Laravel, Django, Rails, Symfony, Vue, React, Angular, Postgres, MySQL, MongoDB — la liste n'est pas exhaustive. Pour les augmentations : toute application avec une API REST, GraphQL ou webhook.",
        },
        {
          id: "q-donnees",
          question: "L'IA a-t-elle besoin de données pour fonctionner ?",
          answer:
            "Oui, mais vous les avez déjà : FAQ, catalogue produit, documentation, tickets support. On structure et indexe vos données existantes — pas besoin d'en créer de nouvelles. Hébergement EU, RGPD natif.",
        },
        {
          id: "q-delai",
          question: "En combien de temps est-ce opérationnel ?",
          answer:
            "Un chatbot RAG opérationnel : 3 semaines. Une plateforme sur mesure avec IA intégrée : 6 à 12 semaines selon le périmètre. On livre par modules, vous voyez les résultats avant la fin du projet.",
        },
        {
          id: "q-cout",
          question: "Combien ça coûte d'intégrer l'IA dans un site web ?",
          answer:
            "De 2 000 € (chatbot RAG sur une base documentaire) à 30 000 €+ (plateforme sur mesure complète avec IA intégrée). Toujours en forfait fixe, devis ferme avant démarrage.",
        },
        {
          id: "q-proprio",
          question: "Qui est propriétaire de l'IA intégrée ?",
          answer:
            "Vous. Code, données, configuration, logs — tout est dans votre infrastructure. Si vous nous quittez demain, l'IA continue de fonctionner. Pas d'abonnement mensuel imposé.",
        },
      ]
    : [
        {
          id: "q-redesign",
          question: "Do I need to redesign my site to integrate AI?",
          answer:
            "No. We graft AI onto your existing site via JavaScript widget, plugin or REST API — without touching design or page structure. Going live causes zero downtime.",
        },
        {
          id: "q-stack",
          question: "Which technologies do you work with?",
          answer:
            "We work on any modern stack: Next.js, Laravel, Django, Rails, Symfony, Vue, React, Angular, Postgres, MySQL, MongoDB — the list is not exhaustive. For augmentations: any application with a REST, GraphQL or webhook API.",
        },
        {
          id: "q-data",
          question: "Does AI need data to work?",
          answer:
            "Yes, but you already have it: FAQ, product catalogue, documentation, support tickets. We structure and index your existing data — no need to create new ones. EU hosting, GDPR by design.",
        },
        {
          id: "q-time",
          question: "How fast is it operational?",
          answer:
            "A RAG chatbot is operational in 3 weeks. A full custom platform with integrated AI: 6 to 12 weeks depending on scope. We deliver module by module, you see results before the end of the project.",
        },
        {
          id: "q-cost",
          question: "How much does it cost to add AI to a website?",
          answer:
            "From €2,000 (RAG chatbot on a knowledge base) to €30,000+ (full custom platform with integrated AI). Always fixed fee, firm quote before kick-off.",
        },
        {
          id: "q-owner",
          question: "Who owns the integrated AI?",
          answer:
            "You do. Code, data, configuration, logs — everything in your infrastructure. If you leave us tomorrow, the AI keeps running. No imposed monthly subscription.",
        },
      ];

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/codage-developpement/web-digital",
    name: isFr
      ? "Web & Digital augmentés par l'IA · Axion-IA"
      : "AI-augmented web & digital · Axion-IA",
    description: isFr
      ? "Conception de plateformes web sur mesure IA-native ou intégration de briques IA sur plateforme existante. Toute stack moderne. Chatbot RAG, search sémantique, agents, automatisations. Devis ferme 48 h."
      : "AI-native custom web platform design or AI brick integration on existing platforms. Any modern stack. RAG chatbot, semantic search, agents, automations. Firm quote in 48 h.",
    serviceType: "AI web integration",
    areasServed: buildServiceAreasServed(loc),
  });

  const faqJsonLd = buildFaqJsonLd({ items: faqs });

  return (
    <>
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd} />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-warm text-fg relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            opacity: 0.18,
          }}
        />
        <Container className="relative max-w-3xl">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Web & Digital · augmentés par l'IA" : "Web & Digital · AI-augmented"}
          </p>

          <h1 className="display-editorial text-fg mt-5">
            {isFr ? "Plateforme web sur mesure," : "Custom web platform,"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "IA intégrée par défaut." : "AI built in by default."}
            </span>
          </h1>

          <p className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl">
            {isFr
              ? "On construit votre plateforme sur mesure avec l'IA et les automatisations intégrées dès la conception — toute stack, on s'adapte à votre contexte. Ou on augmente votre plateforme existante — chatbot RAG, search sémantique, agents — sans tout refaire."
              : "We build your custom platform with AI and automations built in from day one — any stack, we adapt to your context. Or we augment your existing platform — RAG chatbot, semantic search, agents — without a full rebuild."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Cta href="/contact" size="lg" track="web-digital-hero-primary">
              {isFr ? "Décrire mon projet · devis 48 h" : "Describe my project · quote 48 h"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" track="web-digital-hero-audit">
              {isFr ? "Commencer par un audit" : "Start with an audit"}
            </Cta>
          </div>
        </Container>
      </section>

      {/* RÉASSURANCE */}
      <section className="bg-paper border-border border-y py-8">
        <Container>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex items-center gap-3">
                  <span className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="text-fg text-sm leading-snug font-medium">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* DEUX APPROCHES */}
      <Section
        eyebrow={isFr ? "Deux points d'entrée" : "Two entry points"}
        title={isFr ? "Nouvelle plateforme ou" : "New platform or"}
        titleEm={isFr ? "existante — on s'adapte" : "existing — we adapt"}
      >
        <ul className="grid gap-6 md:grid-cols-2">
          {(isFr
            ? [
                {
                  tag: "Vous partez de zéro",
                  title: "Plateforme sur mesure IA-native",
                  description:
                    "On conçoit et développe votre plateforme sur mesure avec l'IA intégrée dès la conception : agents, automatisations, search sémantique, chatbot. Toute stack — on s'adapte à votre contexte et vos contraintes.",
                  cta: "Décrire mon projet",
                  accent: true,
                },
                {
                  tag: "Vous avez déjà une plateforme",
                  title: "Augmentation IA sans refonte",
                  description:
                    "On greffe les briques IA sur votre existant : chatbot RAG, recherche sémantique, automatisations, personnalisation. Compatible Next.js, Laravel, toute stack avec API. Zéro downtime.",
                  cta: "Décrire ma plateforme",
                  accent: false,
                },
              ]
            : [
                {
                  tag: "Starting from scratch",
                  title: "AI-native custom platform",
                  description:
                    "We design and build your custom platform with AI integrated from day one: agents, automations, semantic search, chatbot. Any stack — we adapt to your context and constraints.",
                  cta: "Describe my project",
                  accent: true,
                },
                {
                  tag: "You already have a platform",
                  title: "AI augmentation without rebuild",
                  description:
                    "We graft AI bricks onto your existing platform: RAG chatbot, semantic search, automations, personalization. Compatible with Next.js, Laravel, any API-enabled stack. Zero downtime.",
                  cta: "Describe my platform",
                  accent: false,
                },
              ]
          ).map((item) => (
            <li
              key={item.title}
              className={
                item.accent
                  ? "border-terracotta bg-paper ring-terracotta/20 flex flex-col gap-4 rounded-2xl border-2 p-7 ring-4 sm:p-8"
                  : "border-border bg-paper flex flex-col gap-4 rounded-2xl border p-7 sm:p-8"
              }
            >
              <p className="text-fg-muted text-[12px] font-medium tracking-[0.16em] uppercase">
                {item.tag}
              </p>
              <h3
                className={
                  item.accent
                    ? "text-terracotta-deep text-2xl leading-tight font-medium"
                    : "text-fg text-2xl leading-tight font-medium"
                }
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {item.title}
              </h3>
              <p className="text-fg-soft text-base leading-relaxed">{item.description}</p>
              <div className="mt-auto pt-2">
                <Cta
                  href="/contact"
                  size="sm"
                  variant={item.accent ? "primary" : "outline"}
                  track={item.accent ? "web-digital-new" : "web-digital-existing"}
                >
                  {item.cta}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Cta>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* MODULES IA */}
      <Section
        tone="paper"
        eyebrow={isFr ? "4 briques IA" : "4 AI bricks"}
        title={isFr ? "L'IA au cœur," : "AI at the core,"}
        titleEm={isFr ? "pas en option" : "not optional"}
        description={
          isFr
            ? "Que ce soit sur une nouvelle plateforme ou une existante, ces 4 modules sont les plus demandés et les plus rentables pour vos clients."
            : "Whether on a new or existing platform, these 4 modules are the most requested and most profitable for your clients."
        }
      >
        <ul className="grid gap-6 sm:grid-cols-2">
          {modules.map((m) => (
            <li
              key={m.title}
              className="border-border bg-paper flex flex-col gap-4 rounded-2xl border p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-2xl" aria-hidden="true">
                    {m.icon}
                  </span>
                  <h3 className="text-fg mt-2 text-xl leading-tight font-semibold">{m.title}</h3>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className="text-terracotta-deep text-2xl leading-none font-medium tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {m.metric}
                  </p>
                  <p className="text-fg-muted mt-1 text-[11px] leading-tight tracking-wide uppercase">
                    {m.metricLabel}
                  </p>
                </div>
              </div>
              <p className="text-fg-soft text-sm leading-relaxed">{m.description}</p>
              <p className="text-fg-muted mt-auto text-[12px] font-medium">
                <Globe aria-hidden="true" className="mr-1.5 inline-block h-3.5 w-3.5" />
                {isFr ? `Opérationnel en ${m.delay}` : `Live in ${m.delay}`}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* SCÉNARIOS */}
      <Section
        tone="sand"
        eyebrow={isFr ? "3 profils de site" : "3 site profiles"}
        title={isFr ? "Quel que soit votre" : "Whatever your"}
        titleEm={isFr ? "stack" : "stack"}
        description={
          isFr
            ? "Nouvelle plateforme ou existante — l'IA est au cœur, les automatisations sont intégrées, les résultats sont mesurés."
            : "New platform or existing one — AI is at the core, automations are built in, results are measured."
        }
      >
        <ul className="grid gap-5 lg:grid-cols-3">
          {scenarios.map((s) => (
            <li
              key={s.type}
              className="border-border bg-paper flex flex-col gap-4 rounded-2xl border p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                    {s.type}
                  </span>
                  <p className="text-fg-muted mt-2 text-xs">{s.stack}</p>
                </div>
                <p
                  className="text-terracotta-deep shrink-0 text-lg leading-tight font-medium"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.metric}
                </p>
              </div>
              <div className="border-border space-y-2.5 border-t pt-4">
                <p className="text-fg-soft flex items-start gap-2 text-sm leading-relaxed">
                  <span className="text-fg-muted mt-0.5 w-12 shrink-0 text-[10px] font-semibold tracking-widest uppercase">
                    {isFr ? "Avant" : "Before"}
                  </span>
                  <span>{s.before}</span>
                </p>
                <p className="text-fg flex items-start gap-2 text-sm leading-relaxed">
                  <span className="text-terracotta-deep mt-0.5 w-12 shrink-0 text-[10px] font-semibold tracking-widest uppercase">
                    {isFr ? "Après" : "After"}
                  </span>
                  <span>{s.after}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-fg-muted mt-8 text-xs">
          {isFr
            ? "Scénarios représentatifs. Les résultats varient selon le contenu disponible, le volume de trafic et l'engagement des équipes. Devis personnalisé sous 48 h."
            : "Representative scenarios. Results vary by available content, traffic volume and team engagement. Personalized quote within 48 h."}
        </p>
      </Section>

      {/* PROCESS */}
      <Section
        eyebrow={isFr ? "Comment ça se passe" : "How it runs"}
        title={isFr ? "5 étapes," : "5 steps,"}
        titleEm={isFr ? "nouvelle ou existante" : "new or existing"}
        description={
          isFr
            ? "Même process pour un build from scratch ou une augmentation de l'existant. Sprints courts, démos hebdomadaires, zéro tunnel."
            : "Same process for a new build or an existing augmentation. Short sprints, weekly demos, zero tunnel effect."
        }
      >
        <ProcessSteps steps={processSteps} />
      </Section>

      {/* CE QU'ON NE FAIT PAS */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Transparence" : "Transparency"}
        title={isFr ? "Ce qu'on fait," : "What we do,"}
        titleEm={isFr ? "et ce qu'on ne fait pas" : "and what we don't"}
      >
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="border-border rounded-2xl border p-6">
            <p className="text-sage mb-4 text-sm font-semibold tracking-wider uppercase">
              {isFr ? "On fait" : "We do"}
            </p>
            <ul className="space-y-2.5">
              {(isFr
                ? [
                    "Greffer l'IA sur votre site ou app existants",
                    "Chatbot RAG formé sur vos données",
                    "Recherche sémantique IA",
                    "Recommandations produit IA",
                    "Personnalisation dynamique",
                    "Génération de fiches produit IA",
                    "Intégration API LLM dans vos outils",
                  ]
                : [
                    "Graft AI onto your existing site or app",
                    "RAG chatbot trained on your data",
                    "AI semantic search",
                    "AI product recommendations",
                    "Dynamic personalization",
                    "AI product description generation",
                    "LLM API integration in your tools",
                  ]
              ).map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-fg text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-border rounded-2xl border p-6">
            <p className="text-fg-muted mb-4 text-sm font-semibold tracking-wider uppercase">
              {isFr ? "On ne fait pas" : "We don't do"}
            </p>
            <ul className="space-y-2.5">
              {(isFr
                ? [
                    "Design UX/UI, charte graphique",
                    "Développement mobile natif (iOS/Android)",
                    "Maintenance mensuelle imposée sans accord",
                    "Hébergement web ou infra généraliste",
                  ]
                : [
                    "UX/UI design, visual identity",
                    "Native mobile development (iOS/Android)",
                    "Imposed monthly maintenance without agreement",
                    "Web hosting or general infrastructure",
                  ]
              ).map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="text-fg-muted mt-1 h-1 w-4 shrink-0 border-t-2 border-current"
                  />
                  <span className="text-fg-muted text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Vos questions" : "Your questions"}
        title={isFr ? "Réponses" : "Straight"}
        titleEm={isFr ? "directes" : "answers"}
      >
        <FaqAccordion items={faqs} className="mx-auto max-w-3xl" />
      </Section>

      {/* CTA FINAL */}
      <CtaBlock
        eyebrow={isFr ? "Prêt à démarrer" : "Ready to start"}
        title={isFr ? "Nouvelle plateforme ou existante —" : "New platform or existing —"}
        titleEm={isFr ? "l'IA dedans par défaut." : "AI inside by default."}
        description={
          isFr
            ? "On construit votre plateforme sur mesure IA-native, ou on augmente l'existant. Devis ferme en 48 h, forfait fixe, vous êtes propriétaire du code."
            : "We build your AI-native custom platform, or we augment what you have. Firm quote in 48 h, fixed fee, you own the code."
        }
        cta={
          <>
            <Cta href="/contact" size="lg" track="web-digital-final-primary">
              {isFr ? "Décrire mon projet · devis 48 h" : "Describe my project · quote 48 h"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/implementation" size="lg" variant="outline" track="web-digital-final-impl">
              {isFr ? "Voir toutes les implémentations" : "See all implementations"}
            </Cta>
          </>
        }
        tone="mocha"
      />
    </>
  );
}
