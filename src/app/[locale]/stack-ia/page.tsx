import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Info, RefreshCw, Sparkles, ShieldCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { StackHeroSchema, type StackHeroNode } from "@/components/sections/StackHeroSchema";
import { ToolLogo } from "@/components/sections/ToolLogo";
import {
  STACK_CATEGORIES,
  STACK_TOOLS,
  STACK_FAQS,
  type StackAccent,
  type StackTool,
} from "@/content/stack-ia";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildFaqSpeakableJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? "/stack-ia" : "/ai-stack",
    title:
      locale === "fr"
        ? "Stack IA opÃ©rationnelle 2026 Â· les IA dÃ©terminantes pour votre entreprise Â· cabinet AxionIA"
        : "Operational AI stack 2026 Â· the decisive AIs for your business Â· AxionIA consultancy",
    description:
      locale === "fr"
        ? "Pas un catalogue. Une sÃ©lection des IA les plus dÃ©terminantes en 2026 pour transformer votre entreprise, par fonction mÃ©tier â€” penser, produire, capter, construire, orchestrer. Choix assumÃ©s, aucun partenariat commercial."
        : "Not a catalogue. A selection of the most decisive 2026 AIs to transform your business, by function â€” think, produce, capture, build, orchestrate. Assumed choices, no commercial partnerships.",
    alternates: { fr: "/stack-ia", en: "/ai-stack" },
  });
}

// Padding latÃ©ral rÃ©duit (cohÃ©rent avec /interventions, /audit).
const TIGHT_X = "lg:px-6 xl:px-10";

// Mapping classes accent â€” prÃ©-dÃ©finis statiquement pour Tailwind JIT.
// AlignÃ© sur /interventions, sans copie-coller : 1 source de vÃ©ritÃ© par page.
const accentClasses: Record<
  StackAccent,
  {
    badge: string;
    border: string;
    title: string;
    line: string;
    chipBg: string;
    chipText: string;
    haloRing: string;
    monogramBg: string;
    monogramFg: string;
  }
> = {
  terracotta: {
    badge: "bg-terracotta-soft text-terracotta-deep border border-terracotta/20",
    border: "border-terracotta/30 hover:border-terracotta",
    title: "text-terracotta-deep",
    line: "bg-terracotta",
    chipBg: "bg-terracotta-soft",
    chipText: "text-terracotta-deep",
    haloRing: "ring-terracotta/15",
    monogramBg: "bg-terracotta",
    monogramFg: "text-mocha-fg",
  },
  primary: {
    badge: "bg-primary-soft text-primary border border-primary/25",
    border: "border-primary/30 hover:border-primary",
    title: "text-primary",
    line: "bg-primary",
    chipBg: "bg-primary-soft",
    chipText: "text-primary",
    haloRing: "ring-primary/15",
    monogramBg: "bg-primary",
    monogramFg: "text-primary-fg",
  },
  sage: {
    badge: "bg-sage-soft text-sage border border-sage/30",
    border: "border-sage/30 hover:border-sage",
    title: "text-sage",
    line: "bg-sage",
    chipBg: "bg-sage-soft",
    chipText: "text-sage",
    haloRing: "ring-sage/15",
    monogramBg: "bg-sage",
    monogramFg: "text-mocha-fg",
  },
  mocha: {
    badge: "bg-sand text-mocha border border-mocha/15",
    border: "border-mocha/20 hover:border-mocha",
    title: "text-mocha",
    line: "bg-mocha",
    chipBg: "bg-sand",
    chipText: "text-mocha",
    haloRing: "ring-mocha/10",
    monogramBg: "bg-mocha",
    monogramFg: "text-mocha-fg",
  },
};

// MaturitÃ© â€” pill discrÃ¨te Ã  droite du nom de l'outil.
const maturityCopy: Record<
  StackTool["maturity"],
  { fr: string; en: string; tone: "neutral" | "rising" | "niche" }
> = {
  standard: { fr: "Standard 2026", en: "2026 standard", tone: "neutral" },
  rising: { fr: "Adoption forte", en: "Rising fast", tone: "rising" },
  niche: { fr: "Niche assumÃ©e", en: "Niche bet", tone: "niche" },
};

export default async function StackIaPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // 4 piliers de la doctrine â€” bandeau de rÃ©assurance immÃ©diate sous le hero.
  const principles = [
    {
      icon: Sparkles,
      label: isFr ? "SÃ©lection assumÃ©e" : "Curated selection",
      detail: isFr ? "Les outils les plus dÃ©terminants en 2026" : "The most decisive 2026 picks",
    },
    {
      icon: ShieldCheck,
      label: isFr ? "Aucun partenariat commercial" : "No commercial partnership",
      detail: isFr
        ? "Choix terrain, ni commission ni affiliation"
        : "Field choices, no commission, no affiliate",
    },
    {
      icon: Info,
      label: isFr ? "Choix assumÃ©s, pas neutres" : "Assumed picks, not neutral",
      detail: isFr ? "On vous dit aussi quand l'Ã©viter" : "We also tell you when to skip it",
    },
    {
      icon: RefreshCw,
      label: isFr ? "Mise Ã  jour trimestrielle" : "Quarterly update",
      detail: isFr
        ? "Et Ã  chaque sortie majeure d'Ã©diteur"
        : "Plus on every major vendor release",
    },
  ];

  // ItemList JSON-LD â€” chaque outil exposÃ© pour AEO/GEO.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr
      ? "SÃ©lection IA opÃ©rationnelle 2026 Â· cabinet AxionIA"
      : "Operational AI selection 2026 Â· AxionIA consultancy",
    numberOfItems: STACK_TOOLS.length,
    itemListElement: STACK_TOOLS.map((tool, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "SoftwareApplication",
        name: tool.name,
        applicationCategory: "BusinessApplication",
        url: tool.url,
        description: tool[loc].tagline,
        publisher: { "@type": "Organization", name: tool.vendor },
      },
    })),
  } as const;

  // Breadcrumb visuel + JSON-LD intÃ©grÃ© (composant unique). L'item "Accueil"
  // est ajoutÃ© automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: isFr ? "/stack-ia" : "/ai-stack",
      label: isFr ? "Stack IA 2026" : "AI Stack 2026",
    },
  ];

  const faqJsonLd = buildFaqSpeakableJsonLd({
    items: STACK_FAQS.map((f) => ({ question: f[loc].question, answer: f[loc].answer })),
  });

  // 6 bÃ©nÃ©fices ultimes que la stack IA dÃ©bloque pour l'entreprise.
  // Disposition orbitale = sens horaire depuis le haut-gauche.
  // Ordre choisi : Futur (vision) â†’ Performance (opÃ©rationnel) â†’
  // RentabilitÃ© (financier) â†’ Monde (portÃ©e) â†’ Argent (rÃ©sultat) â†’
  // LibertÃ© (humain). On boucle sur l'humain, fin du parcours.
  const heroNodes: ReadonlyArray<StackHeroNode> = isFr
    ? [
        { label: "Futur", detail: "Anticiper l'avenir", accent: "terracotta" },
        { label: "Performance", detail: "Mieux, plus vite", accent: "primary" },
        { label: "RentabilitÃ©", detail: "Marges qui durent", accent: "sage" },
        { label: "Monde", detail: "PrÃ©sent partout", accent: "primary" },
        { label: "Argent", detail: "CA dÃ©bloquÃ©", accent: "terracotta" },
        { label: "LibertÃ©", detail: "Hors du rÃ©pÃ©titif", accent: "mocha" },
      ]
    : [
        { label: "Future", detail: "Read what's coming", accent: "terracotta" },
        { label: "Performance", detail: "Better, faster", accent: "primary" },
        { label: "Profitability", detail: "Margins that last", accent: "sage" },
        { label: "Reach", detail: "Present everywhere", accent: "primary" },
        { label: "Revenue", detail: "Top line unlocked", accent: "terracotta" },
        { label: "Freedom", detail: "Out of grunt work", accent: "mocha" },
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO â€” layout 2 colonnes (texte + grille monogrammes). Doctrine v3 :
          halo-warm, titleEm serif italique terracotta, padding TIGHT_X. */}
      <section className="bg-halo-warm text-fg relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        {/* Grille texturÃ©e fond â€” vignette douce (identique Ã  /interventions) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            opacity: 0.18,
          }}
        />

        <Container className={cn("relative", TIGHT_X)}>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche â€” eyebrow + titre + description + CTAs */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Doctrine Â· Stack 2026" : "Doctrine Â· 2026 Stack"}
              </p>

              {/* H1 â€” display-editorial standard (cohÃ©rence cross-pages).
                  Italique court Â« qui tourne Â» (multi-mots courts, points de
                  wrap naturels) plutÃ´t qu'Â« opÃ©rationnelle Â» (14 char unique
                  qui dÃ©bordait Ã  7rem). Sens prÃ©servÃ© : Â« entreprise qui
                  tourne Â» = Â« entreprise opÃ©rationnelle Â» en franÃ§ais vivant.
                  hyphens-auto + lang en safety-net si jamais. */}
              <h1
                lang={isFr ? "fr" : "en"}
                className="display-editorial text-fg mt-5 [overflow-wrap:break-word] hyphens-auto"
              >
                {isFr ? "La stack IA d'une entreprise " : "The AI stack of a business "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "qui tourne" : "that just works"}
                </span>
                {isFr ? " en 2026." : " in 2026."}
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Il existe plus de 2 000 outils IA en 2026. En voici une sÃ©lection des plus dÃ©terminantes pour transformer votre entreprise â€” par fonction mÃ©tier, sans partenariat commercial, mise Ã  jour chaque trimestre."
                  : "There are over 2,000 AI tools out there in 2026. Here's a selection of the most decisive ones to transform your business â€” by function, no commercial partnership, refreshed every quarter."}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href="/interventions/essentielle"
                  size="lg"
                  className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
                >
                  {isFr
                    ? "DÃ©marrer avec l'Essentielle Â· 490 â‚¬"
                    : "Start with the Essential Â· â‚¬490"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/audit/flash" variant="outline" size="lg">
                  {isFr ? "Auditer ma stack actuelle" : "Audit my current stack"}
                </Cta>
              </div>
            </div>

            {/* Colonne droite â€” schÃ©ma SVG portrait : votre business au centre,
                propulsÃ© par les 11 outils, dÃ©bloque 6 bÃ©nÃ©fices ultimes en orbite.
                CohÃ©rence stricte avec InterventionsHeroSchema (mÃªme grammaire
                visuelle : halos, anneaux, particules, serif italique terracotta). */}
            <StackHeroSchema
              className="hero-schema pointer-events-none"
              centerLabel={isFr ? "Votre business" : "Your business"}
              centerCaption={isFr ? "Stack IA Â· 2026" : "AI stack Â· 2026"}
              ariaLabel={
                isFr
                  ? "SchÃ©ma : votre business au centre, propulsÃ© par sa stack IA 2026, dÃ©bloque 6 bÃ©nÃ©fices â€” futur, performance, rentabilitÃ©, monde, argent, libertÃ©."
                  : "Diagram: your business at the center, powered by its 2026 AI stack, unlocks 6 outcomes â€” future, performance, profitability, reach, revenue, freedom."
              }
              nodes={heroNodes}
            />
          </div>
        </Container>
      </section>

      {/* BANDEAU Â« Notre principe Â» â€” 4 pills de rÃ©assurance doctrine */}
      <section className="bg-paper border-border border-y py-10">
        <Container className={TIGHT_X}>
          <ul className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
            {principles.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.label} className="flex items-start gap-3">
                  <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-fg text-sm font-semibold">{p.label}</p>
                    <p className="text-fg-soft mt-1 text-xs">{p.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* MANIFESTE â€” section paper, 1 paragraphe punchy + 3 piliers chiffrÃ©s */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Pourquoi cette page existe" : "Why this page exists"}
        title={isFr ? "Une doctrine," : "One doctrine,"}
        titleEm={isFr ? "pas un comparatif" : "not a comparison chart"}
        description={
          isFr
            ? "Le marchÃ© ne demande plus Â« quel outil choisir Â» â€” il existe 200 sites qui rÃ©pondent Ã  Ã§a. Il demande comment les faire travailler ensemble. Cette page est notre rÃ©ponse, en 11 outils et 5 fonctions."
            : "The market no longer asks 'which tool should I pick' â€” there are 200 sites for that. It asks how to make them work together. This page is our answer, in 11 tools and 5 functions."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              n: "01",
              titleFr: "On choisit pour vous",
              titleEn: "We pick for you",
              bodyFr:
                "Pas une liste neutre des Â« 50 meilleures IA Â». Onze outils qu'on connaÃ®t Ã  fond et qu'on dÃ©ploie nous-mÃªmes â€” vous gagnez les heures qu'on a passÃ©es Ã  les comparer.",
              bodyEn:
                "Not a neutral list of the '50 best AIs'. Eleven tools we know inside out and deploy ourselves â€” you save the hours we spent comparing them.",
            },
            {
              n: "02",
              titleFr: "On vous dit aussi quand l'Ã©viter",
              titleEn: "We also tell you when to skip it",
              bodyFr:
                "Chaque fiche outil a son Â« Quand on l'Ã©vite Â». Un outil qui marche partout n'existe pas. ConnaÃ®tre ses angles morts vaut autant que connaÃ®tre ses forces.",
              bodyEn:
                "Each tool card has a 'When to skip'. A tool that works everywhere doesn't exist. Knowing its blind spots matters as much as knowing its strengths.",
            },
            {
              n: "03",
              titleFr: "On montre les combos qui marchent",
              titleEn: "We show the combos that actually work",
              bodyFr:
                "La valeur n'est jamais dans un outil isolÃ© : elle est dans deux outils qui se parlent. Chaque fiche mentionne avec quoi on l'utilise pour livrer un rÃ©sultat client.",
              bodyEn:
                "Value never lives in a single tool: it lives in two tools that talk to each other. Each card shows what we pair it with to ship a client result.",
            },
          ].map((card) => (
            <article
              key={card.n}
              className="border-border bg-paper relative rounded-2xl border p-6"
            >
              <p
                className="text-terracotta-deep text-3xl italic"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                {card.n}
              </p>
              <h3 className="text-fg mt-3 text-lg leading-snug font-semibold">
                {isFr ? card.titleFr : card.titleEn}
              </h3>
              <p className="text-fg-soft mt-2 text-base leading-relaxed">
                {isFr ? card.bodyFr : card.bodyEn}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* 5 CATÃ‰GORIES â€” chacune une Section avec ses outils en cards */}
      {STACK_CATEGORIES.map((cat) => {
        const acc = accentClasses[cat.accent];
        const tools = STACK_TOOLS.filter((t) => t.category === cat.id);
        const c = cat[loc];

        return (
          <Section
            key={cat.id}
            id={`cat-${cat.id}`}
            tone={cat.tone}
            eyebrow={c.eyebrow}
            title={c.title}
            titleEm={c.titleEm}
            description={c.description}
            contentClassName={TIGHT_X}
          >
            <div
              className={cn(
                "grid gap-6 lg:gap-7",
                tools.length === 1 && "lg:grid-cols-1",
                tools.length === 2 && "lg:grid-cols-2",
                tools.length === 3 && "lg:grid-cols-3",
              )}
            >
              {tools.map((tool) => {
                const t = tool[loc];
                const m = maturityCopy[tool.maturity];
                return (
                  <article
                    key={tool.id}
                    className={cn(
                      "shadow-subtle bg-paper hover:shadow-card relative overflow-hidden rounded-3xl border-2 ring-1 transition-shadow",
                      acc.border,
                      acc.haloRing,
                    )}
                  >
                    {/* LiserÃ© accent en haut â€” signature visuelle alignÃ©e /interventions */}
                    <span aria-hidden="true" className={cn("block h-1.5 w-full", acc.line)} />

                    <div className="p-7 sm:p-8">
                      {/* Header : logo + nom + vendor + maturity pill */}
                      <header className="flex items-start gap-4">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "shadow-subtle flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                            acc.monogramBg,
                            acc.monogramFg,
                          )}
                        >
                          <ToolLogo id={tool.id} className="h-7 w-7" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h3
                              className={cn(
                                "text-fg text-2xl leading-tight font-semibold tracking-tight",
                              )}
                            >
                              {tool.name}
                            </h3>
                            <span className="text-fg-muted text-xs">{tool.vendor}</span>
                          </div>
                          <span
                            className={cn(
                              "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium tracking-wide uppercase",
                              acc.badge,
                            )}
                          >
                            {isFr ? m.fr : m.en}
                          </span>
                        </div>
                      </header>

                      {/* Tagline â€” phrase punch */}
                      <p
                        className={cn("mt-5 text-lg leading-snug italic", acc.title)}
                        style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                      >
                        Â« {t.tagline} Â»
                      </p>

                      {/* Use case AxionIA â€” paragraphe terrain */}
                      <p className="text-fg-soft mt-4 text-[15.5px] leading-relaxed">{t.useCase}</p>

                      {/* Quand on le sort */}
                      <div className="mt-6">
                        <p
                          className={cn(
                            "text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase",
                          )}
                        >
                          {isFr ? "Quand on le sort" : "When we reach for it"}
                        </p>
                        <ul className="space-y-2">
                          {t.whenToUse.map((use, i) => (
                            <li key={i} className="text-fg flex items-start gap-3 text-[15px]">
                              <span
                                className={cn(
                                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                  acc.chipBg,
                                  acc.chipText,
                                )}
                              >
                                <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                              </span>
                              <span className="leading-relaxed">{use}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Quand on l'Ã©vite */}
                      <div className="mt-5">
                        <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
                          {isFr ? "Quand on l'Ã©vite" : "When we skip it"}
                        </p>
                        <ul className="space-y-2">
                          {t.whenToAvoid.map((avoid, i) => (
                            <li
                              key={i}
                              className="text-fg-soft flex items-start gap-3 text-[14.5px]"
                            >
                              <span
                                aria-hidden="true"
                                className="bg-fg-muted/30 text-fg-muted mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                              >
                                <span className="block h-0.5 w-2.5 rounded-full bg-current" />
                              </span>
                              <span className="leading-relaxed">{avoid}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Combo + lien externe */}
                      <footer className="border-border mt-6 border-t pt-5">
                        <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                          {isFr ? "Combo gagnant" : "Winning combo"}
                        </p>
                        <p className="text-fg mt-2 text-[14.5px] leading-relaxed">{t.combo}</p>
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noreferrer nofollow"
                          className={cn(
                            "mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium underline underline-offset-4 hover:no-underline",
                            acc.title,
                          )}
                        >
                          {isFr ? "Site officiel" : "Official site"}
                          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                      </footer>
                    </div>
                  </article>
                );
              })}
            </div>
          </Section>
        );
      })}

      {/* MATRICE COMBOS â€” synthÃ¨se visuelle des associations */}
      <Section
        tone="paper"
        eyebrow={isFr ? "La valeur composÃ©e" : "Composed value"}
        title={isFr ? "Les combos qui font" : "The combos that"}
        titleEm={isFr ? "vraiment livrer" : "actually ship"}
        description={
          isFr
            ? "La rÃ¨gle : un outil seul produit un brouillon, deux outils alignÃ©s produisent un livrable client. Voici les enchaÃ®nements qu'on rejoue chez la plupart de nos clients."
            : "The rule: one tool produces a draft, two aligned tools produce a deliverable. Here are the chains we replay at most clients."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              fromId: "granola",
              fromName: "Granola",
              toId: "claude",
              toName: "Claude",
              outputFr: "Compte-rendu client â†’ plan de mission",
              outputEn: "Client minutes â†’ mission plan",
              accent: "sage" as const,
            },
            {
              fromId: "perplexity",
              fromName: "Perplexity",
              toId: "claude",
              toName: "Claude",
              outputFr: "Veille sourcÃ©e â†’ mÃ©mo stratÃ©gique",
              outputEn: "Sourced watch â†’ strategic memo",
              accent: "sage" as const,
            },
            {
              fromId: "chatgpt",
              fromName: "ChatGPT",
              toId: "claude",
              toName: "Claude",
              outputFr: "Brainstorming â†’ version qui passe en prod",
              outputEn: "Brainstorm â†’ version that ships",
              accent: "primary" as const,
            },
            {
              fromId: "cursor",
              fromName: "Cursor",
              toId: "claude-code",
              toName: "Claude Code",
              outputFr: "Micro-itÃ©rations â†’ marathon refactoring",
              outputEn: "Micro-iterations â†’ refactor marathon",
              accent: "mocha" as const,
            },
            {
              fromId: "v0",
              fromName: "v0",
              toId: "cursor",
              toName: "Cursor",
              outputFr: "Prototype 30s â†’ composant en repo",
              outputEn: "30s prototype â†’ in-repo component",
              accent: "mocha" as const,
            },
            {
              fromId: "n8n",
              fromName: "n8n",
              toId: "claude",
              toName: "Claude",
              outputFr: "Workflow CRM â†’ enrichissement IA",
              outputEn: "CRM workflow â†’ AI enrichment",
              accent: "terracotta" as const,
            },
          ].map((combo, idx) => {
            const acc = accentClasses[combo.accent];
            return (
              <article
                key={idx}
                className={cn(
                  "shadow-subtle bg-paper hover:shadow-card rounded-2xl border p-6 transition-shadow",
                  acc.border,
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold",
                      acc.chipBg,
                      acc.chipText,
                    )}
                  >
                    <ToolLogo id={combo.fromId} className="h-3.5 w-3.5" />
                    {combo.fromName}
                  </span>
                  <ArrowRight aria-hidden="true" className={cn("h-4 w-4", acc.title)} />
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold",
                      acc.chipBg,
                      acc.chipText,
                    )}
                  >
                    <ToolLogo id={combo.toId} className="h-3.5 w-3.5" />
                    {combo.toName}
                  </span>
                </div>
                <p className="text-fg mt-4 text-[15.5px] leading-relaxed">
                  {isFr ? combo.outputFr : combo.outputEn}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      {/* CE QU'ON A Ã‰CARTÃ‰ â€” renforce Â« choix assumÃ©s Â» et nourrit l'AEO
          (queries du type Â« Notion AI vs Claude Â», Â« Make vs n8n Â»). */}
      <Section
        tone="canvas"
        eyebrow={isFr ? "Choix Ã©ditorial" : "Editorial choice"}
        title={isFr ? "Ce qu'on a Ã©cartÃ©" : "What we ruled out"}
        titleEm={isFr ? "(et pourquoi)" : "(and why)"}
        description={
          isFr
            ? "Une stack honnÃªte nomme aussi ce qu'elle ne prend pas. Voici cinq outils populaires qu'on a regardÃ©s sÃ©rieusement et qui ne sont pas dans notre dÃ©ploiement 2026 â€” pas qu'ils soient mauvais, ils ne gagnent pas leur place."
            : "An honest stack names what it leaves out. Here are five popular tools we looked at seriously and ruled out for our 2026 deployment â€” not because they're bad, but because they don't earn the slot."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              tool: "Notion AI",
              fr: "Couche IA correcte, mais Claude fait mieux le job ailleurs. On garde Notion, sans son IA.",
              en: "Decent AI layer, but Claude does the job better elsewhere. We keep Notion, drop its AI.",
            },
            {
              tool: "GitHub Copilot",
              fr: "Solide. Cursor a pris la main chez les seniors qui veulent du contrÃ´le plutÃ´t que de l'autocomplete.",
              en: "Solid. Cursor took over with senior engineers who want control over raw autocomplete.",
            },
            {
              tool: "Make Â· Zapier",
              fr: "HÃ©bergement tiers = vos donnÃ©es partent. n8n auto-hÃ©bergeable prÃ©serve la souverainetÃ©.",
              en: "Third-party hosting = your data leaves. Self-hostable n8n keeps sovereignty intact.",
            },
            {
              tool: "Gemini",
              fr: "Excellent en intÃ©gration Workspace. N'apporte rien de plus si vous Ãªtes dÃ©jÃ  sur Microsoft 365.",
              en: "Excellent in Workspace integration. Adds nothing if you're already on Microsoft 365.",
            },
            {
              tool: "Jasper Â· Writer",
              fr: "Wrappers GPT avec couche mÃ©tier marketing. Aussi bien d'utiliser GPT directement avec un bon prompt.",
              en: "GPT wrappers with a marketing layer. You're as well off using GPT directly with a strong prompt.",
            },
            {
              tool: "Otter Â· Fireflies",
              fr: "Capture solide, mais avec bot dans la rÃ©union. Granola tourne en fond, sans interrompre.",
              en: "Solid capture, but with a bot in the meeting. Granola runs in the background, no interruption.",
            },
          ].map((item) => (
            <article
              key={item.tool}
              className="border-border bg-paper relative rounded-2xl border p-6"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="bg-fg-muted/15 text-fg-muted mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                >
                  <span className="block h-0.5 w-3 rounded-full bg-current" />
                </span>
                <div>
                  <h3 className="text-fg text-base leading-tight font-semibold">{item.tool}</h3>
                  <p className="text-fg-soft mt-2 text-[14.5px] leading-relaxed">
                    {isFr ? item.fr : item.en}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* FAQ â€” questions vraies, format AEO. Pas d'accordion JS car
          Server Component pur + meilleure indexation : tout est exposÃ©
          en HTML statique, sans JS. */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Questions frÃ©quentes" : "Frequently asked"}
        title={isFr ? "Ce que les dirigeants" : "What leaders"}
        titleEm={isFr ? "nous demandent" : "actually ask"}
        contentClassName={TIGHT_X}
      >
        <div className="mx-auto max-w-4xl space-y-5">
          {STACK_FAQS.map((faq) => (
            <article key={faq.id} className="border-border bg-paper rounded-2xl border p-6 sm:p-7">
              <h3 className="text-fg text-lg leading-snug font-semibold">{faq[loc].question}</h3>
              <p className="text-fg-soft mt-3 text-[15.5px] leading-relaxed">{faq[loc].answer}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* DISCLAIMER â€” transparence lÃ©gale + posture Ã©ditoriale */}
      <section className="bg-bg border-border border-t py-10">
        <Container className={TIGHT_X}>
          <p className="text-fg-muted mx-auto max-w-3xl text-center text-[13px] leading-relaxed">
            {isFr
              ? "AxionIA n'est partenaire commercial, affiliÃ©, ni rÃ©munÃ©rÃ© par aucun des Ã©diteurs citÃ©s sur cette page. Les marques sont la propriÃ©tÃ© de leurs dÃ©tenteurs respectifs. Les choix prÃ©sentÃ©s reflÃ¨tent l'usage terrain quotidien du cabinet et sont susceptibles d'Ã©voluer Ã  chaque revue trimestrielle."
              : "AxionIA is not a commercial partner, affiliate, or paid promoter of any vendor listed on this page. All trademarks are the property of their respective owners. The picks reflect the consultancy's daily field usage and are subject to change at each quarterly review."}
          </p>
        </Container>
      </section>

      {/* CLOSING ILLUSTRATION â€” Sprint Visual Rhythm 2026 */}
      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="STACK-02-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/stack-ia-closing.avif"
            caption={
              isFr
                ? "Atelier d'outils Ã©ditorial â€” stack en mouvement, prÃªte Ã  servir"
                : "Editorial tool workshop â€” stack in motion, ready to serve"
            }
            alt={
              isFr
                ? "Illustration Ã©ditoriale d'un atelier d'outils opÃ©rationnels symbolisant la stack IA AxionIA en marche."
                : "Editorial illustration of an operational tool workshop symbolizing the AxionIA AI stack at work."
            }
          />
        </Container>
      </Section>

      {/* CTA FINAL */}
      <CtaBlock
        eyebrow={isFr ? "Mettre la stack en mouvement" : "Put the stack in motion"}
        title={isFr ? "Quelle stack pour" : "Which stack fits"}
        titleEm={isFr ? "votre entreprise ?" : "your company?"}
        description={
          isFr
            ? "30 minutes en visio, gratuit. On regarde ensemble ce que vous utilisez dÃ©jÃ , ce qui manque, ce qui peut sortir. Vous repartez avec votre stack ciblÃ©e â€” qu'on dÃ©ploie ensuite ou non."
            : "30 minutes on video, free. Together we look at what you already use, what's missing, what can go. You leave with your targeted stack â€” whether or not we then deploy it."
        }
        cta={
          <>
            <Cta href="/audit/flash" size="lg">
              {isFr ? "RÃ©server l'audit flash" : "Book the flash audit"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Link
              href="/interventions"
              className="text-mocha-fg/85 hover:text-mocha-fg inline-flex items-center gap-1 text-base font-medium underline underline-offset-4"
            >
              {isFr ? "Voir les interventions" : "See the sessions"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </>
        }
        tone="dark"
      />

      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />
    </>
  );
}
