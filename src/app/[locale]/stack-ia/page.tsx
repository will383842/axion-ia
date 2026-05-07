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
import {
  STACK_CATEGORIES,
  STACK_TOOLS,
  STACK_FAQS,
  type StackAccent,
  type StackTool,
} from "@/content/stack-ia";
import { buildProductMetadata, buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo";

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
        ? "Stack IA opérationnelle 2026 · les 11 IA qu'on déploie réellement · cabinet AxionIA"
        : "Operational AI stack 2026 · the 11 AIs we actually deploy · AxionIA consultancy",
    description:
      locale === "fr"
        ? "Pas un catalogue. Les 11 IA qu'AxionIA déploie réellement chez ses clients en 2026, par fonction métier — penser, produire, capter, construire, orchestrer. Choix assumés, aucun partenariat commercial."
        : "Not a catalogue. The 11 AIs AxionIA actually deploys at clients in 2026, by business function — think, produce, capture, build, orchestrate. Assumed choices, no commercial partnerships.",
    alternates: { fr: "/stack-ia", en: "/ai-stack" },
  });
}

// Padding latéral réduit (cohérent avec /interventions, /audit).
const TIGHT_X = "lg:px-6 xl:px-10";

// Mapping classes accent — pré-définis statiquement pour Tailwind JIT.
// Aligné sur /interventions, sans copie-coller : 1 source de vérité par page.
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

// Maturité — pill discrète à droite du nom de l'outil.
const maturityCopy: Record<
  StackTool["maturity"],
  { fr: string; en: string; tone: "neutral" | "rising" | "niche" }
> = {
  standard: { fr: "Standard 2026", en: "2026 standard", tone: "neutral" },
  rising: { fr: "Adoption forte", en: "Rising fast", tone: "rising" },
  niche: { fr: "Niche assumée", en: "Niche bet", tone: "niche" },
};

export default async function StackIaPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // 4 piliers de la doctrine — bandeau de réassurance immédiate sous le hero.
  const principles = [
    {
      icon: Sparkles,
      label: isFr ? "11 outils, pas 200" : "11 tools, not 200",
      detail: isFr
        ? "La stack la plus courte qui tient en production"
        : "The shortest stack that stands up in production",
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
      label: isFr ? "Choix assumés, pas neutres" : "Assumed picks, not neutral",
      detail: isFr ? "On vous dit aussi quand l'éviter" : "We also tell you when to skip it",
    },
    {
      icon: RefreshCw,
      label: isFr ? "Mise à jour trimestrielle" : "Quarterly update",
      detail: isFr ? "Et à chaque sortie majeure d'éditeur" : "Plus on every major vendor release",
    },
  ];

  // ItemList JSON-LD — chaque outil exposé pour AEO/GEO.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr
      ? "Stack IA opérationnelle 2026 · cabinet AxionIA"
      : "Operational AI stack 2026 · AxionIA consultancy",
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

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      {
        name: isFr ? "Stack IA 2026" : "AI Stack 2026",
        href: isFr ? "/stack-ia" : "/ai-stack",
      },
    ],
  });

  const faqJsonLd = buildFaqJsonLd({
    items: STACK_FAQS.map((f) => ({ question: f[loc].question, answer: f[loc].answer })),
  });

  // Hero side panel : grille des 11 monogrammes — visuel éditorial qui montre
  // immédiatement le périmètre de la stack sans logo tiers (cohérence palette).
  const heroNumbers: ReadonlyArray<{ value: string; labelFr: string; labelEn: string }> = [
    { value: "11", labelFr: "outils retenus", labelEn: "tools retained" },
    { value: "5", labelFr: "fonctions métier", labelEn: "business functions" },
    { value: "0", labelFr: "partenariat commercial", labelEn: "commercial partnership" },
    { value: "Q1", labelFr: "fréquence de revue", labelEn: "review cadence" },
  ];

  return (
    <>
      {/* HERO — layout 2 colonnes (texte + grille monogrammes). Doctrine v3 :
          halo-warm, titleEm serif italique terracotta, padding TIGHT_X. */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-20 sm:py-24 lg:py-28">
        {/* Grille texturée fond — vignette douce (identique à /interventions) */}
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
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 xl:gap-20">
            {/* Colonne gauche — eyebrow + titre + description + CTAs */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Doctrine · Stack 2026" : "Doctrine · 2026 Stack"}
              </p>

              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "La stack IA d'un cabinet" : "The AI stack of a"}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "opérationnel" : "operational consultancy"}
                </span>
                {isFr ? " en 2026." : " in 2026."}
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Il existe plus de 2 000 outils IA. On en utilise 11. Voici lesquels, pourquoi, et ce qu'on en fait concrètement chez nos clients — par fonction métier, sans partenariat commercial, mis à jour chaque trimestre."
                  : "There are over 2,000 AI tools out there. We use 11. Here they are, why, and what we actually do with them at clients — by business function, no commercial partnership, refreshed every quarter."}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href="/interventions/essentielle"
                  size="lg"
                  className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
                >
                  {isFr ? "Démarrer avec l'Essentielle · 490 €" : "Start with the Essential · €490"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/audit/flash" variant="outline" size="lg">
                  {isFr ? "Auditer ma stack actuelle" : "Audit my current stack"}
                </Cta>
              </div>
            </div>

            {/* Colonne droite — panneau éditorial : 4 chiffres clés + grille
                monogrammes. Pas de logos tiers : cohérence palette + zéro
                problème de droits/licences. */}
            <aside
              aria-label={
                isFr ? "Aperçu de la stack en chiffres" : "Stack at a glance — by the numbers"
              }
              className="bg-paper border-border ring-terracotta/10 shadow-card relative rounded-3xl border p-7 ring-1 sm:p-8 lg:p-10"
            >
              <span
                aria-hidden="true"
                className="bg-terracotta absolute top-0 left-8 h-1.5 w-16 rounded-b-full"
              />

              <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
                {isFr ? "Aperçu" : "At a glance"}
              </p>

              {/* 4 chiffres clés — typo serif italique terracotta sur les valeurs */}
              <dl className="mt-5 grid grid-cols-2 gap-5">
                {heroNumbers.map((n) => (
                  <div key={n.value}>
                    <dt className="text-fg-muted text-[11px] tracking-[0.12em] uppercase">
                      {isFr ? n.labelFr : n.labelEn}
                    </dt>
                    <dd
                      className="text-terracotta-deep mt-1 text-4xl leading-none italic sm:text-5xl"
                      style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                    >
                      {n.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <hr className="border-border my-7" />

              {/* Grille monogrammes — 11 tiles colorées par accent de catégorie */}
              <p className="text-fg-muted mb-4 text-[11px] tracking-[0.16em] uppercase">
                {isFr ? "Les 11 outils" : "The 11 tools"}
              </p>
              <ul className="grid grid-cols-6 gap-2.5 sm:grid-cols-6 lg:grid-cols-6">
                {STACK_TOOLS.map((tool) => {
                  const cat = STACK_CATEGORIES.find((c) => c.id === tool.category);
                  const acc = accentClasses[cat?.accent ?? "terracotta"];
                  return (
                    <li
                      key={tool.id}
                      className="aspect-square"
                      title={`${tool.name} · ${tool.vendor}`}
                    >
                      <div
                        className={cn(
                          "flex h-full w-full items-center justify-center rounded-xl text-sm font-semibold tracking-tight shadow-[inset_0_-2px_0_rgba(0,0,0,0.08)]",
                          acc.monogramBg,
                          acc.monogramFg,
                        )}
                        style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                      >
                        {tool.monogram}
                      </div>
                    </li>
                  );
                })}
                {/* Tile "+" éditoriale qui complète la grille à 12 cases pour
                    l'équilibre visuel de la dernière ligne. */}
                <li className="aspect-square">
                  <div className="border-border-strong text-fg-muted flex h-full w-full items-center justify-center rounded-xl border border-dashed text-xs">
                    {isFr ? "Q1" : "Q1"}
                  </div>
                </li>
              </ul>
            </aside>
          </div>
        </Container>
      </section>

      {/* BANDEAU « Notre principe » — 4 pills de réassurance doctrine */}
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

      {/* MANIFESTE — section paper, 1 paragraphe punchy + 3 piliers chiffrés */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Pourquoi cette page existe" : "Why this page exists"}
        title={isFr ? "Une doctrine," : "One doctrine,"}
        titleEm={isFr ? "pas un comparatif" : "not a comparison chart"}
        description={
          isFr
            ? "Le marché ne demande plus « quel outil choisir » — il existe 200 sites qui répondent à ça. Il demande comment les faire travailler ensemble. Cette page est notre réponse, en 11 outils et 5 fonctions."
            : "The market no longer asks 'which tool should I pick' — there are 200 sites for that. It asks how to make them work together. This page is our answer, in 11 tools and 5 functions."
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
                "Pas une liste neutre des « 50 meilleures IA ». Onze outils qu'on connaît à fond et qu'on déploie nous-mêmes — vous gagnez les heures qu'on a passées à les comparer.",
              bodyEn:
                "Not a neutral list of the '50 best AIs'. Eleven tools we know inside out and deploy ourselves — you save the hours we spent comparing them.",
            },
            {
              n: "02",
              titleFr: "On vous dit aussi quand l'éviter",
              titleEn: "We also tell you when to skip it",
              bodyFr:
                "Chaque fiche outil a son « Quand on l'évite ». Un outil qui marche partout n'existe pas. Connaître ses angles morts vaut autant que connaître ses forces.",
              bodyEn:
                "Each tool card has a 'When to skip'. A tool that works everywhere doesn't exist. Knowing its blind spots matters as much as knowing its strengths.",
            },
            {
              n: "03",
              titleFr: "On montre les combos qui marchent",
              titleEn: "We show the combos that actually work",
              bodyFr:
                "La valeur n'est jamais dans un outil isolé : elle est dans deux outils qui se parlent. Chaque fiche mentionne avec quoi on l'utilise pour livrer un résultat client.",
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

      {/* 5 CATÉGORIES — chacune une Section avec ses outils en cards */}
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
                    {/* Liseré accent en haut — signature visuelle alignée /interventions */}
                    <span aria-hidden="true" className={cn("block h-1.5 w-full", acc.line)} />

                    <div className="p-7 sm:p-8">
                      {/* Header : monogramme + nom + vendor + maturity pill */}
                      <header className="flex items-start gap-4">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "shadow-subtle flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold",
                            acc.monogramBg,
                            acc.monogramFg,
                          )}
                          style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                        >
                          {tool.monogram}
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

                      {/* Tagline — phrase punch */}
                      <p
                        className={cn("mt-5 text-lg leading-snug italic", acc.title)}
                        style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                      >
                        « {t.tagline} »
                      </p>

                      {/* Use case AxionIA — paragraphe terrain */}
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

                      {/* Quand on l'évite */}
                      <div className="mt-5">
                        <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
                          {isFr ? "Quand on l'évite" : "When we skip it"}
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

      {/* MATRICE COMBOS — synthèse visuelle des associations */}
      <Section
        tone="paper"
        eyebrow={isFr ? "La valeur composée" : "Composed value"}
        title={isFr ? "Les combos qui font" : "The combos that"}
        titleEm={isFr ? "vraiment livrer" : "actually ship"}
        description={
          isFr
            ? "La règle : un outil seul produit un brouillon, deux outils alignés produisent un livrable client. Voici les enchaînements qu'on rejoue chez la plupart de nos clients."
            : "The rule: one tool produces a draft, two aligned tools produce a deliverable. Here are the chains we replay at most clients."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              from: "Granola",
              to: "Claude",
              outputFr: "Compte-rendu client → plan de mission",
              outputEn: "Client minutes → mission plan",
              accent: "sage" as const,
            },
            {
              from: "Perplexity",
              to: "Claude",
              outputFr: "Veille sourcée → mémo stratégique",
              outputEn: "Sourced watch → strategic memo",
              accent: "sage" as const,
            },
            {
              from: "ChatGPT",
              to: "Claude",
              outputFr: "Brainstorming → version qui passe en prod",
              outputEn: "Brainstorm → version that ships",
              accent: "primary" as const,
            },
            {
              from: "Cursor",
              to: "Claude Code",
              outputFr: "Micro-itérations → marathon refactoring",
              outputEn: "Micro-iterations → refactor marathon",
              accent: "mocha" as const,
            },
            {
              from: "v0",
              to: "Cursor",
              outputFr: "Prototype 30s → composant en repo",
              outputEn: "30s prototype → in-repo component",
              accent: "mocha" as const,
            },
            {
              from: "n8n",
              to: "Claude",
              outputFr: "Workflow CRM → enrichissement IA",
              outputEn: "CRM workflow → AI enrichment",
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
                      "rounded-lg px-3 py-1.5 text-sm font-semibold",
                      acc.chipBg,
                      acc.chipText,
                    )}
                  >
                    {combo.from}
                  </span>
                  <ArrowRight aria-hidden="true" className={cn("h-4 w-4", acc.title)} />
                  <span
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold",
                      acc.chipBg,
                      acc.chipText,
                    )}
                  >
                    {combo.to}
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

      {/* FAQ — questions vraies, format AEO. Pas d'accordion JS car
          Server Component pur + meilleure indexation : tout est exposé
          en HTML statique, sans JS. */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
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

      {/* DISCLAIMER — transparence légale + posture éditoriale */}
      <section className="bg-bg border-border border-t py-10">
        <Container className={TIGHT_X}>
          <p className="text-fg-muted mx-auto max-w-3xl text-center text-[13px] leading-relaxed">
            {isFr
              ? "AxionIA n'est partenaire commercial, affilié, ni rémunéré par aucun des éditeurs cités sur cette page. Les marques sont la propriété de leurs détenteurs respectifs. Les choix présentés reflètent l'usage terrain quotidien du cabinet et sont susceptibles d'évoluer à chaque revue trimestrielle."
              : "AxionIA is not a commercial partner, affiliate, or paid promoter of any vendor listed on this page. All trademarks are the property of their respective owners. The picks reflect the consultancy's daily field usage and are subject to change at each quarterly review."}
          </p>
        </Container>
      </section>

      {/* CTA FINAL */}
      <CtaBlock
        eyebrow={isFr ? "Mettre la stack en mouvement" : "Put the stack in motion"}
        title={isFr ? "Quelle stack pour" : "Which stack fits"}
        titleEm={isFr ? "votre entreprise ?" : "your company?"}
        description={
          isFr
            ? "30 minutes en visio, gratuit. On regarde ensemble ce que vous utilisez déjà, ce qui manque, ce qui peut sortir. Vous repartez avec votre stack ciblée — qu'on déploie ensuite ou non."
            : "30 minutes on video, free. Together we look at what you already use, what's missing, what can go. You leave with your targeted stack — whether or not we then deploy it."
        }
        cta={
          <>
            <Cta href="/audit/flash" size="lg">
              {isFr ? "Réserver l'audit flash" : "Book the flash audit"}
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

      <JsonLd data={breadcrumb} />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />
    </>
  );
}
