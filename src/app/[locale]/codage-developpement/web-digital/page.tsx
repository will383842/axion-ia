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
      ? "Intégrer l'IA dans votre site web PME | Axion-IA"
      : "Add AI to your website | Axion-IA",
    description: isFr
      ? "Axion-IA greffe l'IA sur votre site existant : chatbot RAG, recherche sémantique, personnalisation. Livraison 3-6 semaines, sans refonte."
      : "Axion-IA adds AI to your existing website: RAG chatbot, semantic search, personalization. 3-6 week delivery, no redesign needed.",
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
        { icon: ShieldCheck, label: "Pas de refonte — on greffe sur l'existant" },
        { icon: Code2, label: "Compatible WordPress, Shopify, custom" },
        { icon: Sparkles, label: "Données hébergées en UE · RGPD natif" },
      ]
    : [
        { icon: Clock, label: "Delivery 3 to 6 weeks" },
        { icon: ShieldCheck, label: "No redesign — we graft onto what exists" },
        { icon: Code2, label: "Compatible WordPress, Shopify, custom" },
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
            "L'IA comprend l'intention derrière la requête, pas juste les mots. Résultats pertinents même avec des fautes ou des synonymes. +25 % de clics vers panier.",
          metric: "+25 %",
          metricLabel: "clics vers panier",
          delay: "2 semaines",
        },
        {
          icon: "⭐",
          title: "Recommandations produit",
          description:
            "Moteur IA qui analyse le comportement visiteur et suggère les produits les plus pertinents. Compatible WooCommerce, Shopify et catalogues custom.",
          metric: "+18 %",
          metricLabel: "taux de conversion",
          delay: "4 semaines",
        },
        {
          icon: "🎯",
          title: "Personnalisation dynamique",
          description:
            "Contenu, CTAs et offres adaptés au profil de chaque visiteur (secteur, historique, source). Sans cookie tiers — IA côté serveur, RGPD strict.",
          metric: "−30 %",
          metricLabel: "abandon de panier",
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
            "AI understands the intent behind the query, not just the words. Relevant results even with typos or synonyms. +25% more cart clicks.",
          metric: "+25%",
          metricLabel: "cart click increase",
          delay: "2 weeks",
        },
        {
          icon: "⭐",
          title: "Product recommendations",
          description:
            "AI engine that analyzes visitor behaviour and suggests the most relevant products. Compatible with WooCommerce, Shopify and custom catalogues.",
          metric: "+18%",
          metricLabel: "conversion rate",
          delay: "4 weeks",
        },
        {
          icon: "🎯",
          title: "Dynamic personalization",
          description:
            "Content, CTAs and offers adapted to each visitor's profile (sector, history, source). No third-party cookie — server-side AI, strict GDPR.",
          metric: "−30%",
          metricLabel: "cart abandonment",
          delay: "6 weeks",
        },
      ];

  const scenarios = isFr
    ? [
        {
          type: "E-commerce",
          stack: "Shopify / WooCommerce / custom",
          before:
            "Visiteurs qui cherchent mal, abandonnent le panier, posent les mêmes questions SAV.",
          after:
            "Search IA qui comprend, chatbot SAV intégré, recommandations produit. Conversion mesurée semaine 1.",
          metric: "+18 % conversion",
        },
        {
          type: "Site vitrine / CMS",
          stack: "WordPress / Webflow / Drupal",
          before: "Visiteurs qui quittent sans convertir, formulaires de contact peu remplis.",
          after:
            "Chatbot IA qui qualifie et guide chaque visiteur vers le bon service, disponible 24h/7j.",
          metric: "−60 % tickets support",
        },
        {
          type: "Application web B2B",
          stack: "SaaS / plateforme métier / ERP web",
          before:
            "Utilisateurs qui cherchent dans la doc, ouvrent des tickets pour des questions simples.",
          after:
            "Assistant IA contextuel intégré à l'interface, recherche documentaire sémantique, aide inline.",
          metric: "−40 % tickets niveau 1",
        },
      ]
    : [
        {
          type: "E-commerce",
          stack: "Shopify / WooCommerce / custom",
          before: "Visitors who search poorly, abandon carts, ask the same support questions.",
          after:
            "AI search that understands, integrated support chatbot, product recommendations. Conversion measured week 1.",
          metric: "+18% conversion",
        },
        {
          type: "Showcase / CMS site",
          stack: "WordPress / Webflow / Drupal",
          before: "Visitors who leave without converting, contact forms rarely filled.",
          after: "AI chatbot qualifying and guiding each visitor to the right service, 24/7.",
          metric: "−60% support tickets",
        },
        {
          type: "B2B web application",
          stack: "SaaS / business platform / web ERP",
          before: "Users searching docs, opening tickets for simple questions.",
          after:
            "Contextual AI assistant embedded in the interface, semantic doc search, inline help.",
          metric: "−40% L1 tickets",
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
            "WordPress, Webflow, Shopify, WooCommerce, sites custom (React, Vue, Next.js), et toute application avec une API accessible. Si votre stack a une API ou accepte du JS externe, on peut y greffer l'IA.",
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
            "Un chatbot FAQ simple est en ligne en 3 semaines. Un moteur de recommandation e-commerce avec personnalisation : 5-6 semaines. On livre par modules, vous voyez les résultats avant la fin du projet.",
        },
        {
          id: "q-cout",
          question: "Combien ça coûte d'intégrer l'IA dans un site web ?",
          answer:
            "De 2 000 € (chatbot simple sur une FAQ) à 15 000-25 000 € (search + recommandations + personnalisation sur un e-commerce). Toujours en forfait fixe, devis ferme avant démarrage.",
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
            "WordPress, Webflow, Shopify, WooCommerce, custom sites (React, Vue, Next.js), and any application with an accessible API. If your stack has an API or accepts external JS, we can graft AI onto it.",
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
            "A simple FAQ chatbot is live in 3 weeks. An e-commerce recommendation engine with personalization: 5-6 weeks. We deliver module by module, you see results before the end of the project.",
        },
        {
          id: "q-cost",
          question: "How much does it cost to add AI to a website?",
          answer:
            "From €2,000 (simple chatbot on a FAQ) to €15,000-25,000 (search + recommendations + personalization on an e-commerce). Always fixed fee, firm quote before kick-off.",
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
      ? "Intégration de briques IA sur vos sites et applications existants : chatbot RAG, recherche sémantique, recommandations produit, personnalisation dynamique. Compatible WordPress, Shopify, custom. Livraison 3 à 6 semaines."
      : "AI brick integration on your existing sites and apps: RAG chatbot, semantic search, product recommendations, dynamic personalization. WordPress, Shopify, custom compatible. 3 to 6 week delivery.",
    serviceType: "AI web integration",
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
            {isFr ? "Votre site web existant," : "Your existing website,"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "boosté par l'IA." : "boosted by AI."}
            </span>
          </h1>

          <p className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl">
            {isFr
              ? "On ne refait pas votre site — on y greffe les briques IA qui convertissent : chatbot RAG, recherche sémantique, recommandations produit, personnalisation. Compatible WordPress, Shopify, WooCommerce, sites custom."
              : "We don't rebuild your site — we graft the AI bricks that convert: RAG chatbot, semantic search, product recommendations, personalization. Compatible with WordPress, Shopify, WooCommerce, custom sites."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Cta href="/contact" size="lg" track="web-digital-hero-primary">
              {isFr ? "Décrire mon site · devis 48 h" : "Describe my site · quote 48 h"}
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

      {/* MODULES IA */}
      <Section
        eyebrow={isFr ? "4 briques à greffer" : "4 bricks to graft"}
        title={isFr ? "L'IA qui s'intègre," : "AI that integrates,"}
        titleEm={isFr ? "pas qui remplace" : "doesn't replace"}
        description={
          isFr
            ? "Chaque module est indépendant. On démarre par celui qui a le meilleur ROI pour votre contexte — chatbot ou search — puis on complète au rythme qui vous convient."
            : "Each module is independent. We start with the highest ROI for your context — chatbot or search — then complete at your pace."
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
            ? "L'approche est la même : on part de l'existant, on greffe l'IA, on mesure le résultat."
            : "The approach is the same: we start from what exists, graft AI, measure the result."
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
        titleEm={isFr ? "sans refonte" : "no redesign"}
        description={
          isFr
            ? "On s'intègre à votre environnement existant. Pas de migration, pas de downtime, pas de surprise."
            : "We integrate into your existing environment. No migration, no downtime, no surprise."
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
                    "Refonte ou création de site web from scratch",
                    "Design UX/UI, charte graphique",
                    "Développement mobile natif (iOS/Android)",
                    "Certification Shopify Partner",
                    "Hébergement web ou infra généraliste",
                  ]
                : [
                    "Website redesign or creation from scratch",
                    "UX/UI design, visual identity",
                    "Native mobile development (iOS/Android)",
                    "Shopify Partner certification",
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
        title={isFr ? "Votre site existant vaut" : "Your existing site is worth"}
        titleEm={isFr ? "plus avec l'IA." : "more with AI."}
        description={
          isFr
            ? "Pas de refonte, pas de migration. On greffe l'IA sur ce que vous avez déjà. Devis ferme en 48 h, livraison en 3 à 6 semaines."
            : "No redesign, no migration. We graft AI onto what you already have. Firm quote in 48 h, delivery in 3 to 6 weeks."
        }
        cta={
          <>
            <Cta href="/contact" size="lg" track="web-digital-final-primary">
              {isFr ? "Décrire mon site · devis 48 h" : "Describe my site · quote 48 h"}
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
