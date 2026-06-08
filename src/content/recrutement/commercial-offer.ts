// Contenu éditorial PROPRE au recrutement de commerciaux (pages
// /devenir-commercial-ia). SSOT-friendly : ce fichier ne contient AUCUN prix ni
// montant de commission — ceux-ci viennent de `pricing.ts` (COMMERCIAL_COMMISSIONS)
// et `offers-catalog.ts` (OFFERS). Ici, uniquement le copy de recrutement
// (opportunité, statut, état d'esprit, méthode, FAQ) qui n'a pas de SSOT.
//
// Toutes les parties FIXES (identiques sur les ~400 villes) vivent ici. Les
// parties VARIABLES par ville (territoire de vente, secteurs réels, bassin) sont
// dérivées des données INSEE/economic-data dans les composants, pas ici.
//
// FR canonique — EN miroir (locale EN 301→FR, règle Will 2026-05-16). On garde
// les deux langues pour ne pas casser le pré-rendu FR+EN.

import type { ServiceHeroNode } from "@/components/sections/ServiceHero";

export interface LocalizedText {
  readonly fr: string;
  readonly en: string;
}

// ── HÉRO ────────────────────────────────────────────────────────────────────
// Les 8 satellites du schéma orbital — réinterprétés « métier commercial ».

export const COMMERCIAL_HERO_NODES: ReadonlyArray<ServiceHeroNode & { benefitEn: string }> = [
  {
    label: "Prospection",
    benefit: "Tous types d'entreprises",
    benefitEn: "All company types",
    accent: "terracotta",
  },
  {
    label: "Formations IA",
    benefit: "Commission fixe par vente",
    benefitEn: "Flat commission per sale",
    accent: "primary",
  },
  { label: "Audits", benefit: "% de la facture", benefitEn: "% of the invoice", accent: "sage" },
  {
    label: "1-to-1",
    benefit: "Dirigeants & équipes",
    benefitEn: "Executives & teams",
    accent: "mocha",
  },
  {
    label: "Intégrations",
    benefit: "% sur l'automatisation",
    benefitEn: "% on automation",
    accent: "terracotta",
  },
  {
    label: "Produits financés",
    benefit: "Coût quasi nul côté client",
    benefitEn: "Near-zero client cost",
    accent: "primary",
  },
  {
    label: "Liberté",
    benefit: "Statut indépendant",
    benefitEn: "Self-employed status",
    accent: "sage",
  },
  {
    label: "Dashboard",
    benefit: "Suivi & commissions",
    benefitEn: "Tracking & commissions",
    accent: "mocha",
  },
];

export const COMMERCIAL_HERO = {
  eyebrow: {
    fr: "Recrutement · +200 commerciaux en France",
    en: "Hiring · 200+ sales reps in France",
  },
  /** {ville} résolu dans le composant. */
  titleFr: "Devenez commercial IA à",
  titleEnPrefix: "Become an AI sales rep in",
  titleEm: { fr: "revenus déplafonnés", en: "uncapped income" },
  description: {
    fr: "L'IA, le marché le plus porteur des prochaines décennies. Des produits simples, souvent finançables, que les entreprises s'arrachent. Statut indépendant, revenus sans plafond — démarrer ne vous coûte rien.",
    en: "AI — the biggest market of the coming decades. Simple, often-fundable products that companies are eager to buy. Self-employed, uncapped income — getting started costs you nothing.",
  },
  ariaLabel: {
    fr: "Le métier de commercial IA chez Axion-IA en 8 volets : prospection tous secteurs, vente de formations, audits, accompagnements 1-to-1, intégrations, produits financés à coût quasi nul pour le client, statut indépendant et dashboard de suivi des commissions.",
    en: "The Axion-IA AI sales role in 8 facets: all-sector prospecting, selling trainings, audits, 1-on-1 support, integrations, funded near-zero-cost products, self-employed status and a commission tracking dashboard.",
  },
  ctaLabel: { fr: "Je veux devenir commercial", en: "I want to become a sales rep" },
} as const;

// ── L'OPPORTUNITÉ (section + encart noir) ─────────────────────────────────────
// Marché énorme non desservi + produits financés — SANS nommer Qualiopi.

export const COMMERCIAL_OPPORTUNITY = {
  eyebrow: { fr: "Un marché énorme, encore à prendre", en: "A huge market, still up for grabs" },
  title: {
    fr: "Vous ouvrez les portes,",
    en: "You open the doors,",
  },
  titleEm: { fr: "on conclut avec vous", en: "we close with you" },
  paragraphs: {
    fr: [
      "Chaque dirigeant veut l'IA, peu savent par où commencer. Votre rôle : faire connaître nos solutions aux entreprises de votre secteur — pas de pression de closing.",
      "Et beaucoup de nos prestations sont finançables : nous montons le dossier avec l'entreprise, qui n'a parfois même pas à avancer les fonds. Un argument qui ouvre grand les portes.",
    ],
    en: [
      "Every executive wants AI, few know where to start. Your role: introduce our solutions to companies in your area — no closing pressure.",
      "And many of our services are fundable: we build the application with the company, which sometimes doesn't even advance the money. An argument that opens doors wide.",
    ],
  },
  /** Encart sombre à droite — le modèle de paiement (tracé, sans pression de closing). */
  darkCard: {
    label: { fr: "Comment vous êtes payé", en: "How you get paid" },
    headline: {
      fr: "« Vous présentez. C'est tracé. Vous touchez. »",
      en: '"You introduce. It\'s tracked. You get paid."',
    },
    sub: {
      fr: "Pas besoin d'être un closeur. Chaque entreprise que vous faites connaître est enregistrée à votre nom sur votre dashboard. Qu'elle signe avec vous ou qu'elle nous contacte directement, la commission vous revient sur chaque vente.",
      en: "No need to be a closer. Every company you introduce is logged under your name on your dashboard. Whether it signs with you or contacts us directly, the commission is yours on every sale.",
    },
  },
} as const;

// ── COMMENT ÇA FONCTIONNE (méthode commercial) ────────────────────────────────

export interface CommercialStep {
  readonly titleFr: string;
  readonly titleEn: string;
  readonly textFr: string;
  readonly textEn: string;
}

export const COMMERCIAL_STEPS: ReadonlyArray<CommercialStep> = [
  {
    titleFr: "Vous démarchez",
    titleEn: "You prospect",
    textFr:
      "Vous contactez tous types d'entreprises de votre secteur — TPE, artisans, commerçants, PME, ETI, grandes entreprises — pour leur faire connaître nos formations, audits, accompagnements et intégrations IA.",
    textEn:
      "You reach out to all kinds of companies in your area — micro-businesses, artisans, retailers, SMEs, mid-caps, large enterprises — to introduce our AI trainings, audits, support and integrations.",
  },
  {
    titleFr: "Vous présentez une offre simple",
    titleEn: "You present a simple offer",
    textFr:
      "Seulement une dizaine de produits clairs, faciles à comprendre et à vendre. Pas de catalogue interminable : vous maîtrisez l'offre en quelques heures.",
    textEn:
      "Just about ten clear products, easy to understand and sell. No endless catalogue: you master the offer in a few hours.",
  },
  {
    titleFr: "Vous tracez vos entreprises",
    titleEn: "You log your companies",
    textFr:
      "Vous renseignez sur votre dashboard les entreprises démarchées avec votre nom et prénom — c'est ce qui sécurise et déclenche vos commissions sur chaque vente signée.",
    textEn:
      "You record prospected companies on your dashboard under your name — this secures and triggers your commissions on every signed sale.",
  },
  {
    titleFr: "Vous touchez vos commissions",
    titleEn: "You earn your commissions",
    textFr:
      "Commission fixe sur les formations, pourcentage de la facture sur les audits et les intégrations. Plus vous vendez, plus vous gagnez — sans plafond.",
    textEn:
      "Flat commission on trainings, a percentage of the invoice on audits and integrations. The more you sell, the more you earn — with no cap.",
  },
];

// ── STATUT ────────────────────────────────────────────────────────────────────

export const COMMERCIAL_STATUS = {
  title: { fr: "Indépendant, et bien accompagné", en: "Self-employed, and well supported" },
  text: {
    fr: "Vous travaillez en indépendant : vous organisez vos journées, votre secteur, votre rythme. Mais vous n'êtes jamais seul — notre équipe vous accompagne au quotidien : supports de vente prêts à l'emploi, formation à l'offre, réponses techniques rapides et suivi de vos commissions. La liberté de l'indépendant, la force d'une structure derrière vous.",
    en: "You work as a self-employed rep: you organise your days, your territory, your pace. But you're never alone — our team supports you day to day: ready-to-use sales materials, training on the offer, fast technical answers and commission tracking. The freedom of going solo, with a real structure behind you.",
  },
} as const;

// ── ÉTAT D'ESPRIT (culture) ───────────────────────────────────────────────────

export interface MindsetItem {
  readonly fr: string;
  readonly en: string;
}

export const COMMERCIAL_MINDSET = {
  title: { fr: "L'état d'esprit qu'on recherche", en: "The mindset we're looking for" },
  items: [
    { fr: "Sympa et à l'aise", en: "Friendly and at ease" },
    { fr: "Travailleur, vraiment", en: "A genuine hard worker" },
    { fr: "Une énorme motivation", en: "Huge motivation" },
    { fr: "L'envie d'apprendre l'IA", en: "Eager to learn AI" },
    { fr: "Autonome et fiable", en: "Autonomous and reliable" },
    { fr: "Ambition d'évoluer avec nous", en: "Ambition to grow with us" },
  ] satisfies ReadonlyArray<MindsetItem>,
} as const;

// ── PROFILS RECHERCHÉS ────────────────────────────────────────────────────────
// QUI peut devenir commercial Axion-IA (≠ état d'esprit : ici les parcours).

export interface ProfileItem {
  readonly titleFr: string;
  readonly titleEn: string;
  readonly descFr: string;
  readonly descEn: string;
}

export const COMMERCIAL_PROFILES = {
  title: { fr: "Les profils qu'on recherche", en: "The profiles we're looking for" },
  intro: {
    fr: "Pas besoin d'un parcours type : ce qui compte, c'est la fibre commerciale et l'envie. Quelques profils qui réussissent chez nous —",
    en: "No standard background needed: what counts is sales instinct and drive. A few profiles that thrive with us —",
  },
  /** Réassurance forte (frein n°1 des indépendants). */
  reassurance: {
    fr: "Vous avez déjà un portefeuille d'entreprises ? Vous le gardez. Vous ajoutez simplement nos produits IA à ce que vous vendez déjà.",
    en: "Already have a portfolio of companies? You keep it. You simply add our AI products to what you already sell.",
  },
  items: [
    {
      titleFr: "Commerciaux indépendants",
      titleEn: "Independent sales reps",
      descFr:
        "Agents commerciaux et indépendants qui veulent ajouter une offre IA porteuse à leur portefeuille — qu'ils conservent intégralement.",
      descEn:
        "Sales agents and freelancers who want to add a high-demand AI offer to their portfolio — which they keep entirely.",
    },
    {
      titleFr: "Commerciaux en reconversion",
      titleEn: "Sales reps in transition",
      descFr:
        "Anciens commerciaux B2B qui cherchent un secteur d'avenir, des produits faciles à défendre et des revenus déplafonnés.",
      descEn:
        "Former B2B reps looking for a future-proof sector, easy-to-pitch products and uncapped income.",
    },
    {
      titleFr: "Apporteurs d'affaires & réseaux",
      titleEn: "Business introducers & networks",
      descFr:
        "Consultants, formateurs, indépendants bien implantés localement avec un bon carnet d'adresses entreprises.",
      descEn:
        "Consultants, trainers, locally well-connected freelancers with a strong business address book.",
    },
    {
      titleFr: "Débutants très motivés",
      titleEn: "Highly motivated beginners",
      descFr:
        "Pas (encore) d'expérience commerciale mais une vraie fibre et l'envie d'apprendre l'IA : on vous forme à l'offre.",
      descEn:
        "No sales experience (yet) but real instinct and eagerness to learn AI: we train you on the offer.",
    },
  ] satisfies ReadonlyArray<ProfileItem>,
} as const;

// ── FAQ FIXE (les Q locales sont ajoutées par ville dans le composant) ─────────

export interface FaqItem {
  readonly q: LocalizedText;
  readonly a: LocalizedText;
}

export const COMMERCIAL_FAQ_FIXED: ReadonlyArray<FaqItem> = [
  {
    q: { fr: "Faut-il déjà connaître l'IA pour postuler ?", en: "Do I need to know AI to apply?" },
    a: {
      fr: "Non. Une fibre commerciale et de la motivation suffisent : on vous forme à l'offre et aux arguments. L'offre tient en une dizaine de produits simples.",
      en: "No. A sales instinct and motivation are enough: we train you on the offer and the pitch. The catalogue is about ten simple products.",
    },
  },
  {
    q: { fr: "Quel statut et quelle rémunération ?", en: "What status and pay?" },
    a: {
      fr: "Statut indépendant. Vous êtes payé à la commission : montant fixe par formation vendue, pourcentage de la facture sur les audits et les intégrations. Revenus déplafonnés.",
      en: "Self-employed. You're paid on commission: a flat amount per training sold, a percentage of the invoice on audits and integrations. Uncapped income.",
    },
  },
  {
    q: {
      fr: "Pourquoi les produits sont-ils faciles à vendre ?",
      en: "Why are the products easy to sell?",
    },
    a: {
      fr: "Parce que la demande IA est immense et que beaucoup de prestations sont éligibles à des financements. Nous aidons l'entreprise à monter son dossier, et parfois elle n'a même pas à avancer les fonds — le reste à charge devient minime, ce qui raccourcit fortement le cycle de vente.",
      en: "Because AI demand is huge and many services are eligible for funding. We help the company build its application, and sometimes it doesn't even advance the money — the out-of-pocket cost becomes minimal, which dramatically shortens the sales cycle.",
    },
  },
  {
    q: {
      fr: "Je garde mon portefeuille d'entreprises ?",
      en: "Do I keep my own client portfolio?",
    },
    a: {
      fr: "Oui. Si vous avez déjà un portefeuille d'entreprises, vous le gardez intégralement : vous ajoutez simplement nos produits IA à ce que vous vendez déjà, sans rien perdre de votre activité.",
      en: "Yes. If you already have a portfolio of companies, you keep it entirely: you simply add our AI products to what you already sell, without losing any of your activity.",
    },
  },
  {
    q: {
      fr: "Comment suis-je sûr de toucher mes commissions ?",
      en: "How am I sure to get my commissions?",
    },
    a: {
      fr: "Chaque entreprise démarchée est enregistrée sur votre dashboard à votre nom. Toute vente signée sur une de vos entreprises déclenche votre commission, tracée de bout en bout.",
      en: "Every prospected company is logged on your dashboard under your name. Any signed sale on one of your companies triggers your commission, tracked end to end.",
    },
  },
];

// ── MOTS-CLÉS SÉMANTIQUES (SEO/AEO) ───────────────────────────────────────────
// Portée maximale : métiers, synonymes, intentions (emploi/job/argent/liberté),
// cibles entreprises. Consommés par `keywords` des metadata + enrichissent la
// citabilité LLM. Les variantes par ville sont ajoutées dynamiquement.

export const COMMERCIAL_KEYWORDS_BASE: ReadonlyArray<string> = [
  "devenir commercial IA",
  "commercial intelligence artificielle",
  "emploi commercial IA",
  "offre d'emploi IA",
  "job dans l'IA",
  "recrutement commercial",
  "commercial indépendant",
  "agent commercial indépendant",
  "VRP",
  "apporteur d'affaires",
  "commercial freelance",
  "vendre de l'IA",
  "réseau commercial",
  "rémunération à la commission",
  "revenus déplafonnés",
  "revenus complémentaires",
  "gagner de l'argent",
  "compléter ses revenus",
  "emploi du temps libre",
  "travailler à son compte",
  "reconversion commerciale",
  "vente B2B",
  "prospection entreprises",
  "formation IA",
  "audit IA",
  "intégration IA",
  "automatisation IA",
  "TPE",
  "PME",
  "ETI",
  "artisans",
  "commerçants",
  "grandes entreprises",
  "dirigeants",
  "financement formation",
  "OPCO",
  "CPF",
];

/** Construit la liste de mots-clés, enrichie des variantes locales (ville/dpt/région). */
export function buildCommercialKeywords(
  villeName?: string,
  departementLabel?: string,
  region?: string,
): string[] {
  const kw = [...COMMERCIAL_KEYWORDS_BASE];
  if (villeName) {
    kw.push(
      `emploi commercial ${villeName}`,
      `offre d'emploi IA ${villeName}`,
      `devenir commercial ${villeName}`,
      `commercial indépendant ${villeName}`,
      `vendre de l'IA à ${villeName}`,
      `job IA ${villeName}`,
      `recrutement commercial ${villeName}`,
    );
  }
  if (departementLabel)
    kw.push(`emploi commercial ${departementLabel}`, `commercial IA ${departementLabel}`);
  if (region) kw.push(`commercial IA ${region}`, `emploi IA ${region}`);
  return kw;
}
