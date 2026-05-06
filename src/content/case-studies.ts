// Case studies — 5 fixtures (Sprint 8). Replaced by Prisma in Sprint 15.
// Source: doc 17 (témoignages & preuves sociales), green accent.

export interface CaseStudy {
  slug: string;
  industry: string;
  industryEn: string;
  size: "tpe" | "pme" | "mid" | "enterprise";
  metric: string;
  fr: CaseCopy;
  en: CaseCopy;
}

interface CaseCopy {
  title: string;
  excerpt: string;
  context: string;
  problem: string;
  solution: string;
  result: string;
  testimonialQuote: string;
  testimonialAuthor: string;
  testimonialRole: string;
}

export const CASE_STUDIES: ReadonlyArray<CaseStudy> = [
  {
    slug: "industrie-comptabilite",
    industry: "Industrie",
    industryEn: "Industry",
    size: "pme",
    metric: "-32% admin",
    fr: {
      title: "Industriel · -32% temps administratif comptable",
      excerpt: "Implémentation IA sur les flux comptables et fournisseurs en 6 semaines.",
      context:
        "PME industrielle 80 personnes, 2 sites. Flux fournisseurs manuel : 4 ETP affectés au tri, validation et saisie de 1500 factures/mois.",
      problem:
        "Délai moyen de traitement de 11 jours, taux d'erreur 2.3 %, équipe en burnout sur les pics de fin de mois.",
      solution:
        "Lecture IA des factures entrantes (PDF, scan, email) + extraction structurée + push automatique dans l'ERP. Workflow de validation à 2 niveaux pour montants > 5000 €.",
      result:
        "-32 % temps administratif, -78 % taux d'erreur, délai moyen 1.2 jour. ROI atteint au mois 4.",
      testimonialQuote:
        "On a libéré 2 ETP qui peuvent enfin travailler sur du vrai contrôle de gestion.",
      testimonialAuthor: "C. Lambert",
      testimonialRole: "DAF",
    },
    en: {
      title: "Industrial · -32% accounting admin time",
      excerpt: "AI implementation on supplier accounting flows in 6 weeks.",
      context:
        "80-person industrial SME, 2 sites. Manual supplier flow: 4 FTEs allocated to sorting, validation and entry of 1500 invoices/month.",
      problem: "Average processing time 11 days, error rate 2.3%, team burnout on month-end peaks.",
      solution:
        "AI reading of incoming invoices (PDF, scan, email) + structured extraction + auto push into the ERP. 2-level validation workflow for amounts > €5000.",
      result: "-32% admin time, -78% error rate, avg lead time 1.2 days. ROI achieved by month 4.",
      testimonialQuote: "We freed 2 FTEs who can finally do actual management control.",
      testimonialAuthor: "C. Lambert",
      testimonialRole: "CFO",
    },
  },
  {
    slug: "cabinet-juridique-comptes-rendus",
    industry: "Juridique",
    industryEn: "Legal",
    size: "pme",
    metric: "+18% productivity",
    fr: {
      title: "Cabinet juridique · +18 % productivité par associé",
      excerpt: "Automatisation des comptes-rendus de réunions et de la veille juridique.",
      context:
        "Cabinet d'avocats 12 associés. Production manuelle de comptes-rendus de RDV clients (~ 30 min/CR) et veille juridique chronophage.",
      problem:
        "1.5 h/jour/associé sur les CR, veille incomplète et tardive, risque de manquer des évolutions clés.",
      solution:
        "Transcription IA des RDV + génération automatique de CR structurés (validés par l'associé). Pipeline de veille IA sur 12 sources avec alertes priorisées.",
      result: "+18 % de temps facturable par associé, veille livrée chaque matin à 8 h.",
      testimonialQuote:
        "Le cabinet a gagné l'équivalent d'un associé en productivité, sans recruter.",
      testimonialAuthor: "M. Petit",
      testimonialRole: "COO",
    },
    en: {
      title: "Law firm · +18% productivity per partner",
      excerpt: "Automated meeting minutes and legal intelligence pipeline.",
      context:
        "Law firm with 12 partners. Manual production of client meeting minutes (~30 min each) and time-consuming legal monitoring.",
      problem:
        "1.5h/day/partner on minutes, incomplete and late monitoring, risk of missing key updates.",
      solution:
        "AI transcription of meetings + auto-generated structured minutes (partner-validated). AI monitoring pipeline across 12 sources with prioritized alerts.",
      result: "+18% billable time per partner, daily 8 a.m. intelligence brief.",
      testimonialQuote:
        "The firm gained the equivalent of one partner in productivity, without hiring.",
      testimonialAuthor: "M. Petit",
      testimonialRole: "COO",
    },
  },
  {
    slug: "retail-tickets-sav",
    industry: "Retail",
    industryEn: "Retail",
    size: "mid",
    metric: "-45% SAV time",
    fr: {
      title: "Retail · -45 % temps de traitement SAV",
      excerpt: "Triage IA des tickets clients sur 6 semaines.",
      context:
        "Enseigne de prêt-à-porter, 35 magasins, ~ 800 tickets SAV/jour entre boutiques et e-commerce.",
      problem:
        "Temps moyen de réponse 38 h, classification manuelle imprécise, escalade trop fréquente.",
      solution:
        "Classification IA des tickets entrants par typologie + urgence + niveau de compétence requis. Routage automatique vers la bonne équipe avec brouillon de réponse pré-rempli.",
      result: "-45 % temps de traitement, satisfaction client +12 points.",
      testimonialQuote:
        "Nos conseillers ne traitent plus les sujets simples — l'IA les pré-résout.",
      testimonialAuthor: "S. Roussel",
      testimonialRole: "Directrice expérience client",
    },
    en: {
      title: "Retail · -45% customer-service handling time",
      excerpt: "AI ticket triage in 6 weeks.",
      context:
        "Apparel retailer, 35 stores, ~800 customer-service tickets/day across stores and e-commerce.",
      problem: "Average response 38h, imprecise manual classification, too-frequent escalation.",
      solution:
        "AI classification of incoming tickets by type + urgency + skill level required. Automatic routing to the right team with pre-filled draft response.",
      result: "-45% handling time, +12 points customer satisfaction.",
      testimonialQuote: "Our agents no longer handle simple topics — AI pre-resolves them.",
      testimonialAuthor: "S. Roussel",
      testimonialRole: "Customer Experience Director",
    },
  },
  {
    slug: "banque-onboarding",
    industry: "Banque",
    industryEn: "Banking",
    size: "enterprise",
    metric: "x3 onboarding speed",
    fr: {
      title: "Banque · onboarding KYC accéléré 3×",
      excerpt: "Lecture IA des documents KYC + scoring automatique pour les conseillers.",
      context:
        "Banque privée régionale. Onboarding KYC manuel : 4-7 jours, 30+ documents par dossier.",
      problem: "Délai trop long, abandons clients, équipe conformité saturée sur les pics.",
      solution:
        "Pipeline IA de lecture des justificatifs + extraction des champs + scoring de cohérence automatique. Conseiller valide en 15 min un dossier pré-instruit.",
      result:
        "Délai moyen ramené à 1.5 jour, abandons divisés par 4, conformité sur le terrain auditable.",
      testimonialQuote: "Nous ouvrons 3× plus de comptes par mois, à effectif constant.",
      testimonialAuthor: "L. Vidal",
      testimonialRole: "Directeur transformation",
    },
    en: {
      title: "Bank · 3× faster KYC onboarding",
      excerpt: "AI reading of KYC documents + auto scoring for advisors.",
      context: "Regional private bank. Manual KYC onboarding: 4-7 days, 30+ documents per file.",
      problem: "Lead time too long, customer drop-off, saturated compliance team on peaks.",
      solution:
        "AI pipeline reading supporting documents + field extraction + auto coherence scoring. Advisor validates a pre-processed file in 15 min.",
      result: "Lead time down to 1.5 days, drop-off divided by 4, auditable field compliance.",
      testimonialQuote: "We open 3× more accounts per month with the same headcount.",
      testimonialAuthor: "L. Vidal",
      testimonialRole: "Transformation Director",
    },
  },
  {
    slug: "tpe-artisan-prospection",
    industry: "Artisan",
    industryEn: "Trades",
    size: "tpe",
    metric: "+5 RDV/sem",
    fr: {
      title: "Artisan plombier · +5 RDV qualifiés / semaine",
      excerpt: "Agent IA de prospection LinkedIn et qualification de leads entrants.",
      context:
        "Artisan plombier 6 personnes, dépendant des annuaires en ligne. Marge faible, faible visibilité B2B.",
      problem:
        "Pas de capacité à prospecter activement les syndics et property managers de la région.",
      solution:
        "Agent IA de prospection LinkedIn ciblé + envoi de messages personnalisés sur 200 syndics/mois + qualification des réponses + relance automatique.",
      result:
        "+5 RDV qualifiés/semaine, taux de transformation 35 %, contrat-cadre signé avec 3 syndics.",
      testimonialQuote: "L'agent IA m'a apporté plus en 3 mois que les annuaires en 5 ans.",
      testimonialAuthor: "F. Mercier",
      testimonialRole: "Gérant",
    },
    en: {
      title: "Tradesperson · +5 qualified meetings/week",
      excerpt: "LinkedIn prospecting AI agent and inbound lead qualification.",
      context:
        "6-person plumber business, dependent on online directories. Low margin, low B2B visibility.",
      problem: "No capacity to actively prospect property managers in the region.",
      solution:
        "Targeted LinkedIn prospecting AI agent + personalized messages to 200 property managers/month + reply qualification + auto follow-up.",
      result: "+5 qualified meetings/week, 35% conversion, framework agreement with 3 managers.",
      testimonialQuote: "The AI agent brought me more in 3 months than directories in 5 years.",
      testimonialAuthor: "F. Mercier",
      testimonialRole: "Owner",
    },
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}

export function getAllSlugs(): string[] {
  return CASE_STUDIES.map((c) => c.slug);
}

function caseSlugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getAllIndustrySlugs(): string[] {
  const set = new Set(CASE_STUDIES.map((c) => caseSlugify(c.industry)));
  return [...set];
}

export function getCaseStudiesByIndustry(slug: string): CaseStudy[] {
  return CASE_STUDIES.filter((c) => caseSlugify(c.industry) === slug);
}

export function getIndustryLabel(slug: string, locale: "fr" | "en"): string | undefined {
  const found = CASE_STUDIES.find((c) => caseSlugify(c.industry) === slug);
  return locale === "fr" ? found?.industry : found?.industryEn;
}
