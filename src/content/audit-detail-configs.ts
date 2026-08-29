// Configs SSOT des pages détail Audit — Sprint 14.10.8 (Will 2026-05-12).
//
// Pattern miroir d'`intervention-detail-configs.ts`. Le template
// `AuditDetailPage` consomme ces configs pour rendre les 4 pages tier (flash,
// cible, strategique-pme, strategique-eti) de manière harmonisée.
//
// Enrichissement restitution de valeur (2026-08-15) — l'audit est une
// prestation de CONSEIL, hors champ du Référentiel National Qualité : la valeur
// s'exprime en LIVRABLES (quoi, sous quelle forme, sous quel délai) et en
// DÉCISIONS rendues possibles, jamais en acquis pédagogiques. Registre imposé :
// « estimation », « ordre de grandeur », « gains attendus » — aucune promesse
// de résultat chiffré (obligation de moyens, cf. CGV). Les 4 tiers portent
// désormais tous `deliverables` / `forWhomFr` / `heroMetaFr` : ne jamais
// renseigner ces champs pour un seul tier, le rendu deviendrait incohérent.

import {
  Compass,
  Sparkles,
  Target,
  Eye,
  Lightbulb,
  TrendingUp,
  ShieldCheck,
  Workflow,
  Inbox,
  Users,
  Network,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AuditTier } from "./audit-taxonomy";
import type { InterventionSlug } from "@/lib/intervention-type";
import {
  formatAmount,
  formatSubTierPrice,
  AUDIT_FLASH_SUB_TIERS,
  AUDIT_CIBLE_SUB_TIERS,
  AUDIT_STRATEGIQUE_PME_SUB_TIERS,
  AUDIT_STRATEGIQUE_ETI_SUB_TIERS,
  type PricingSubTier,
} from "./pricing";

// Lookup type-safe d'un sous-tier par id — throw si introuvable (erreur de
// migration des ids → casse tôt). `getTierById` de pricing.ts cible
// `PricingTier`, pas `PricingSubTier` (descriptionFr/En requis), d'où ce helper
// local dédié aux AUDIT_*_SUB_TIERS.
const subTierOf = (tiers: ReadonlyArray<PricingSubTier>, id: string): PricingSubTier => {
  const tier = tiers.find((t) => t.id === id);
  if (!tier) {
    throw new Error(`[audit-detail-configs] sous-tier introuvable : "${id}"`);
  }
  return tier;
};

// Sous-tiers complets (et non juste leur montant) : les cartes doivent lire
// `isFromPrice` en SSOT. Will 2026-07-17 — « de partout à partir de » : AUCUN
// prix d'audit ne s'affiche en ferme, d'où `formatSubTierPrice` partout.
// Toute modification de tarif se fait dans pricing.ts — ces constantes suivent.
const SUB_FLASH_ONSITE = subTierOf(AUDIT_FLASH_SUB_TIERS, "audit-flash-onsite");
const SUB_CIBLE_SOLO = subTierOf(AUDIT_CIBLE_SUB_TIERS, "audit-cible-solo");
const SUB_CIBLE_STANDARD = subTierOf(AUDIT_CIBLE_SUB_TIERS, "audit-cible-standard");
const SUB_CIBLE_AVANCE = subTierOf(AUDIT_CIBLE_SUB_TIERS, "audit-cible-avance");
const SUB_PME_20_50 = subTierOf(AUDIT_STRATEGIQUE_PME_SUB_TIERS, "audit-strategique-pme-20-50");
const SUB_PME_50_250 = subTierOf(AUDIT_STRATEGIQUE_PME_SUB_TIERS, "audit-strategique-pme-50-250");

// Montants bruts — pour la prose (FAQ, promesses) qui écrit déjà « dès X ».
const PRICE_FLASH_ONSITE = SUB_FLASH_ONSITE.priceFlat;
const PRICE_CIBLE_SOLO = SUB_CIBLE_SOLO.priceFlat;
const PRICE_CIBLE_STANDARD = SUB_CIBLE_STANDARD.priceFlat;
const PRICE_CIBLE_AVANCE = SUB_CIBLE_AVANCE.priceFlat;
const PRICE_PME_20_50 = SUB_PME_20_50.priceFlat;
const PRICE_PME_50_250 = SUB_PME_50_250.priceFlat;
// L'ETI est un plancher (`isFromPrice`), pas un prix ferme — d'où le sous-tier
// complet et non juste son montant : la carte lit le flag depuis la SSOT.
const SUB_ETI_BASE = subTierOf(AUDIT_STRATEGIQUE_ETI_SUB_TIERS, "audit-strategique-eti-base");
const PRICE_ETI_BASE = SUB_ETI_BASE.priceFlat;

export interface AuditBenefit {
  icon: LucideIcon;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
}

export interface AuditScheduleItem {
  time: string;
  titleFr: string;
  titleEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
}

export interface AuditFaq {
  qFr: string;
  qEn: string;
  aFr: string;
  aEn: string;
}

export interface AuditSubTierCard {
  /** ID PricingSubTier (cf. pricing.ts AUDIT_*_SUB_TIERS). */
  subTierId: string;
  labelFr: string;
  labelEn: string;
  rangeFr: string;
  rangeEn: string;
  priceLabelFr: string;
  priceLabelEn: string;
  /** Description courte (1-2 phrases) — pourquoi ce sous-tier. */
  bodyFr: string;
  bodyEn: string;
  /** CTA : "calendar" (réservation directe) | "contact" (devis) | "quote" (sur devis). */
  ctaType: "calendar" | "contact" | "quote";
  /** Pour ctaType=contact : query objet à pré-remplir. */
  contactObject?: string;
  /** Pour ctaType=calendar : pré-fill intervention slug du calendrier. */
  /** Slug InterventionSlug typé — empêche les typos à la compilation. */
  calendarSlug?: InterventionSlug;
  /** Mise en avant visuelle (1 par tier). */
  isFeatured?: boolean;
}

export interface AuditDetailConfig {
  tier: AuditTier;
  titleFr: string;
  titleEn: string;
  titleEmFr: string;
  titleEmEn: string;
  /** Promesse hero. */
  promiseFr: string;
  promiseEn: string;
  chipsFr: ReadonlyArray<string>;
  chipsEn: ReadonlyArray<string>;
  benefits: ReadonlyArray<AuditBenefit>;
  /** Programme type d'une journée (Flash 9h-17h) ou d'une mission (Cible/PME/ETI). */
  schedule: ReadonlyArray<AuditScheduleItem>;
  scheduleEyebrowFr: string;
  scheduleEyebrowEn: string;
  scheduleDescriptionFr: string;
  scheduleDescriptionEn: string;
  /** Sous-tiers cliquables (cartes prix). */
  subTiers: ReadonlyArray<AuditSubTierCard>;
  faq: ReadonlyArray<AuditFaq>;
  /** Texte du CTA hero principal. */
  ctaPrimaryLabelFr: string;
  ctaPrimaryLabelEn: string;

  // ── Refonte 2026-05-31 (Will) — champs optionnels additifs pour la page
  //    détail « à la perfection » (hero visuel, déroulé heure par heure,
  //    livrables, à qui ça s'adresse). Si absents, le template retombe sur le
  //    rendu historique (zéro casse sur les tiers non encore enrichis).

  /** Image hero (bannière paysage de la banque public/images ou /illustrations). */
  heroImage?: { src: string; altFr: string; altEn: string };
  /** Phrase de réassurance sous le hero (durée · lieu · livrable). */
  heroMetaFr?: string;
  heroMetaEn?: string;
  /** Livrables concrets repartis à l'issue de l'audit. */
  deliverables?: ReadonlyArray<{
    titleFr: string;
    titleEn: string;
    descFr: string;
    descEn: string;
  }>;
  /** « Pour qui » — 3 profils que ce tier sert le mieux. */
  forWhomFr?: ReadonlyArray<string>;
  forWhomEn?: ReadonlyArray<string>;

  // ── Refonte 2026-07-07 (Will) — alignement sur le template FormationDetailPage
  //    (héro + carte infos-clés, PAS de timeline horaire). `infoCard` alimente
  //    à la fois la carte sticky du héro et la section Modalités. Valeurs
  //    dérivées du contenu existant (aucune fabrication).
  infoCard: {
    /** Sous-titre sous le prix (périmètre couvert). */
    scopeFr: string;
    scopeEn: string;
    durationFr: string;
    durationEn: string;
    formatFr: string;
    formatEn: string;
    audienceFr: string;
    audienceEn: string;
    deliverableFr: string;
    deliverableEn: string;
  };
}

// ============================================================================
// AUDIT SUR PLACE (PME mono-site) — 1 journée complète sur site,
// 1190 € HT présentiel (Will 2026-05-31 : suppression du 490 € distanciel).
// ============================================================================

const FLASH_BENEFITS: ReadonlyArray<AuditBenefit> = [
  {
    icon: Inbox,
    titleFr: "Cartographie écrite de votre activité",
    titleEn: "Written map of your activity",
    bodyFr:
      "Une journée sur place à passer en revue vos tâches réelles, poste par poste. Vous récupérez la carte écrite de votre activité : chronophages classés par temps passé estimé, outils déjà en place, et en face de chacun ce que l'IA peut reprendre — ou pas.",
    bodyEn:
      "A day on site reviewing your real tasks, role by role. You get the written map of your activity: time-sinks ranked by estimated time spent, tools already in place, and against each one what AI can take over — or not.",
  },
  {
    icon: Sparkles,
    titleFr: "Prompts testés devant vous, puis remis",
    titleEn: "Prompts tested in front of you, then handed over",
    bodyFr:
      "Pas de slides théoriques : on teste l'IA en direct sur 2-3 cas réels de votre quotidien. Ceux qui fonctionnent sont consignés dans le rapport, prêts à copier-coller dans vos outils — vous les réutilisez dès le lendemain, sans nous.",
    bodyEn:
      "No theoretical slides: we test AI live on 2-3 real cases from your daily work. Those that work are recorded in the report, ready to copy-paste into your tools — you reuse them the next day, without us.",
  },
  {
    icon: Target,
    titleFr: "Plan d'action écrit sous 48 h",
    titleEn: "Written action plan within 48 h",
    bodyFr:
      "Rapport de synthèse sous 48 h ouvrées en règle générale — remis sous 7 jours au plus tard : outils recommandés avec leur coût mensuel, 3 à 5 quick-wins classés par impact et par facilité, ordre de grandeur du temps libéré chaque mois. De quoi trancher seul·e ce que vous lancez en premier.",
    bodyEn:
      "Synthesis report within 48 business hours as a rule — 7 days at the latest: recommended tools with their monthly cost, 3 to 5 quick-wins ranked by impact and ease, order of magnitude of the time freed each month. Enough to decide on your own what to start first.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Confidentialité totale",
    titleEn: "Total confidentiality",
    bodyFr:
      "Vos données restent les vôtres. Aucune utilisation pour entraîner les modèles (comptes Anthropic Team / Enterprise). Confidentialité contractuelle garantie avant tout échange, y compris sur le contenu du rapport.",
    bodyEn:
      "Your data stays yours. No training use (Anthropic Team / Enterprise accounts). Contractual confidentiality guaranteed before any exchange, including on the report's content.",
  },
];

const FLASH_SCHEDULE: ReadonlyArray<AuditScheduleItem> = [
  {
    time: "Jour J",
    titleFr: "Cadrage par appel 15 min",
    titleEn: "15-min framing call",
    descriptionFr: "Vous nous décrivez votre contexte, on cale la zone d'usage prioritaire.",
    descriptionEn: "You describe your context, we lock the priority use area.",
  },
  {
    time: "Jour de l'audit",
    titleFr: "Diagnostic sur site",
    titleEn: "On-site diagnosis",
    descriptionFr:
      "1 journée complète 9 h-17 h dans vos locaux : observation terrain, démos IA sur vos vrais cas avec votre équipe, cartographie de toute l'activité.",
    descriptionEn:
      "1 full day 9 a.m.-5 p.m. on your premises: field observation, AI demos on your real cases with your team, mapping of the whole activity.",
  },
  {
    time: "J+7 max",
    titleFr: "Remise du rapport de synthèse",
    titleEn: "Synthesis report handover",
    descriptionFr:
      "PDF 8-15 pages : cartographie, outils recommandés et leur coût, prompts testés, 3 à 5 quick-wins classés, ordre de grandeur du temps libéré chaque mois.",
    descriptionEn:
      "8-15 page PDF: mapping, recommended tools and their cost, tested prompts, 3 to 5 ranked quick-wins, order of magnitude of the time freed each month.",
  },
];

const FLASH_FAQ: ReadonlyArray<AuditFaq> = [
  {
    qFr: "Pourquoi l'audit se fait-il sur place ?",
    qEn: "Why is the audit done on site?",
    aFr: "Une journée complète dans vos locaux permet de capter ce qui ne s'écrit pas : frictions d'équipe, outils en place, processus oraux. On voit l'IA opérer sur vos vrais cas, avec vos équipes — c'est ce qui rend le plan réellement actionnable.",
    aEn: "A full day on your premises captures what isn't written down: team friction, existing tools, oral processes. We see AI operate on your real cases, with your teams — that's what makes the plan truly actionable.",
  },
  {
    qFr: "Qu'est-ce qu'on nous remet exactement, et sous quelle forme ?",
    qEn: "What exactly do we receive, and in what form?",
    aFr: "Un rapport écrit de 8 à 15 pages, en PDF, structuré en quatre parties : la cartographie de votre activité (chronophages classés par temps passé estimé), les outils recommandés avec leur coût mensuel et leur cadre RGPD, les prompts testés devant vous pendant la journée, et 3 à 5 quick-wins classés par impact et par facilité de mise en œuvre. Chaque quick-win porte un ordre de grandeur du temps libéré chaque mois si vous le mettez en place — une estimation de travail, pas un engagement de résultat. Le document est rédigé pour être exécuté par vous, sans nous.",
    aEn: "A written 8 to 15 page PDF report, in four parts: the map of your activity (time-sinks ranked by estimated time spent), the recommended tools with their monthly cost and GDPR framing, the prompts tested in front of you during the day, and 3 to 5 quick-wins ranked by impact and ease of implementation. Each quick-win carries an order of magnitude of the time freed each month if you implement it — a working estimate, not a commitment on results. The document is written to be executed by you, without us.",
  },
  {
    qFr: "Pour qui est-ce vraiment fait ?",
    qEn: "Who is this really for?",
    aFr: `PME (1-19 salariés), indépendant·e·s, freelances, professions libérales. Si vous avez plus de 20 salariés et plusieurs services concernés, l'audit Ciblé (${PRICE_CIBLE_SOLO}-${PRICE_CIBLE_AVANCE} €) ou Stratégique PME (${PRICE_PME_20_50}-${PRICE_PME_50_250} €) est mieux calibré.`,
    aEn: `Small businesses (1-19 staff), independents, freelancers. If you have 20+ staff and multiple departments concerned, the Targeted audit (€${PRICE_CIBLE_SOLO}-${PRICE_CIBLE_AVANCE}) or Strategic SME (€${PRICE_PME_20_50}-${PRICE_PME_50_250}) is better calibrated.`,
  },
  {
    qFr: "Que se passe-t-il après l'audit ?",
    qEn: "What happens after the audit?",
    aFr: "Vous repartez avec un plan actionnable directement par vos soins. Si vous voulez aller plus loin, on bascule vers une intervention équipe (formation) ou une implémentation IA (module Implémentation). Pas d'engagement caché — vous décidez en autonomie.",
    aEn: "You leave with a plan actionable by yourself. To go further, we switch to a team session (training) or AI implementation (Implementation module). No hidden commitment — you decide in autonomy.",
  },
];

const FLASH_SUB_TIERS: ReadonlyArray<AuditSubTierCard> = [
  {
    subTierId: "audit-flash-onsite",
    labelFr: "Audit sur place · 1 journée",
    labelEn: "On-site audit · 1 day",
    rangeFr: "Toute l'entreprise · sur site",
    rangeEn: "Whole company · on site",
    priceLabelFr: formatSubTierPrice(SUB_FLASH_ONSITE, "fr"),
    priceLabelEn: formatSubTierPrice(SUB_FLASH_ONSITE, "en", { compact: true }),
    bodyFr:
      "1 journée complète dans vos locaux (9 h-17 h). Vous voyez l'IA opérer sur vos vrais cas avec votre équipe. Rapport écrit de 8 à 15 pages, prompts testés et quick-wins classés, remis sous 48 h ouvrées (7 j au plus tard). Réservation directe sur le calendrier.",
    bodyEn:
      "1 full day on your premises (9 a.m.-5 p.m.). You see AI operate on your real cases with your team. Written 8 to 15 page report, tested prompts and ranked quick-wins, delivered within 48 business hours (7 days at the latest). Direct booking on the calendar.",
    ctaType: "calendar",
    calendarSlug: "audit-flash-onsite",
  },
];

// ============================================================================
// CIBLÉ — 3 sous-tiers : Solo / Standard / Avancé
// ============================================================================

const CIBLE_BENEFITS: ReadonlyArray<AuditBenefit> = [
  {
    icon: Compass,
    titleFr: "Cartographie complète d'un département",
    titleEn: "Complete mapping of one department",
    bodyFr:
      "Marketing, RH, opérations, finance, juridique, support : on choisit un département prioritaire et on cartographie TOUS ses processus. Vous récupérez cette carte : pour chaque processus, la volumétrie traitée, le temps passé estimé, l'outil en place et la friction constatée. C'est votre photo de départ, et votre point de comparaison plus tard.",
    bodyEn:
      "Marketing, HR, ops, finance, legal, support: we pick a priority department and map ALL its processes. You get that map: for each process, the volume handled, estimated time spent, the tool in place and the friction observed. Your baseline picture, and your comparison point later on.",
  },
  {
    icon: TrendingUp,
    titleFr: "Tableau de scoring des opportunités",
    titleEn: "Opportunity scoring table",
    bodyFr:
      "Chaque opportunité IA est notée sur trois axes : gain estimé, complexité technique, délai de mise en œuvre. Le tableau vous est remis tel quel — vous arbitrez ligne par ligne ce que vous lancez, ce qui attend, ce que vous abandonnez, et vous pouvez le rejouer dans six mois.",
    bodyEn:
      "Each AI opportunity is scored on three axes: estimated gain, technical complexity, implementation delay. The table is handed over as is — you arbitrate line by line what you start, what waits, what you drop, and you can rerun it in six months.",
  },
  {
    icon: Workflow,
    titleFr: "Plan d'exécution priorisé et chiffré",
    titleEn: "Prioritised, costed execution plan",
    bodyFr:
      "Roadmap 3-12 mois avec phases, charges, dépendances et points de décision. Chaque chantier porte son coût de mise en œuvre et le gain de temps estimé : le budget se défend en interne sans retravail, et l'exécution revient à vos équipes (ou à nous via le module Implémentation IA).",
    bodyEn:
      "3-12 month roadmap with phases, workload, dependencies and decision points. Each project carries its implementation cost and estimated time gain: the budget stands up internally without rework, and execution goes to your teams (or to us via the AI Implementation module).",
  },
  {
    icon: ShieldCheck,
    titleFr: "Souveraineté & RGPD",
    titleEn: "Sovereignty & GDPR",
    bodyFr:
      "Chaque recommandation est cadrée RGPD (où sont stockées les données, qui y accède, quel modèle, quelle base juridique) et sa compatibilité AI Act 2026 est vérifiée. Ces éléments figurent noir sur blanc dans la fiche de l'opportunité : votre DPO ou votre conseil peut les relire sans nous solliciter.",
    bodyEn:
      "Each recommendation is GDPR-framed (where data is stored, who accesses it, what model, what legal basis) and its 2026 AI Act compatibility is checked. These appear in writing on the opportunity sheet: your DPO or counsel can review them without involving us.",
  },
];

const CIBLE_SCHEDULE: ReadonlyArray<AuditScheduleItem> = [
  {
    time: "Semaine 1",
    titleFr: "Cadrage + interviews terrain",
    titleEn: "Framing + field interviews",
    descriptionFr: "3-5 interviews collaborateurs du département cible + collecte documents.",
    descriptionEn: "3-5 interviews with target department staff + document collection.",
  },
  {
    time: "Semaine 2",
    titleFr: "Cartographie & scoring",
    titleEn: "Mapping & scoring",
    descriptionFr: "Cartographie processus, scoring opportunités IA, benchmark outils.",
    descriptionEn: "Process mapping, AI opportunity scoring, tool benchmark.",
  },
  {
    time: "Semaine 3",
    titleFr: "Restitution + plan d'exécution",
    titleEn: "Restitution + execution plan",
    descriptionFr:
      "Atelier de restitution 2 h avec vos équipes, puis remise du rapport et du plan chiffré (10-40 pages selon le format).",
    descriptionEn:
      "2 h restitution workshop with your teams, then handover of the report and costed plan (10-40 pages depending on format).",
  },
];

const CIBLE_FAQ: ReadonlyArray<AuditFaq> = [
  {
    qFr: "Quelle différence entre les 3 sous-tiers Solo / Standard / Avancé ?",
    qEn: "What's the difference between Solo / Standard / Advanced sub-tiers?",
    aFr: `Solo (${formatAmount(PRICE_CIBLE_SOLO, "fr", { compact: true })}) : à distance, périmètre simple, 1 sous-fonction d'un département. Standard (${formatAmount(PRICE_CIBLE_STANDARD, "fr", { compact: true })}) : mix site + visio, 1 département complet. Avancé (${formatAmount(PRICE_CIBLE_AVANCE, "fr", { compact: true })}) : service complexe, multi-acteurs, intégrations techniques approfondies. Le cadrage 15 min permet de choisir ensemble.`,
    aEn: `Solo (${formatAmount(PRICE_CIBLE_SOLO, "en", { compact: true })}): remote, simple scope, 1 sub-function of a department. Standard (${formatAmount(PRICE_CIBLE_STANDARD, "en", { compact: true })}): mix on-site + remote, 1 full department. Advanced (${formatAmount(PRICE_CIBLE_AVANCE, "en", { compact: true })}): complex service, multi-stakeholder, deep technical integrations. The 15-min framing helps choose together.`,
  },
  {
    qFr: "Que contient exactement le livrable, et à quoi sert-il ensuite ?",
    qEn: "What exactly does the deliverable contain, and what is it used for afterwards?",
    aFr: "Un rapport PDF de 10 à 40 pages selon le format retenu, remis pendant un atelier de restitution de 2 h. Quatre blocs : la carte des processus du département (volumétrie, temps passé estimé, outils, frictions) ; une fiche par opportunité IA (gain estimé, complexité, délai, outil pressenti, cadre RGPD) ; le tableau de scoring qui les compare ; le plan d'exécution 3-12 mois, phasé et chiffré. Après l'atelier, le document sert de dossier d'arbitrage budgétaire, de cahier des charges pour consulter un prestataire, et de feuille de route pour vos équipes.",
    aEn: "A 10 to 40 page PDF report depending on the chosen format, handed over during a 2 h restitution workshop. Four blocks: the department process map (volumes, estimated time spent, tools, frictions); one sheet per AI opportunity (estimated gain, complexity, delay, candidate tool, GDPR framing); the scoring table comparing them; the phased, costed 3-12 month execution plan. After the workshop, the document serves as a budget arbitration file, a specification to consult a provider, and a roadmap for your teams.",
  },
  {
    qFr: "Combien de temps prend l'audit complet ?",
    qEn: "How long does the full audit take?",
    aFr: "3 à 4 semaines selon la complexité. Semaine 1 : cadrage + interviews. Semaine 2 : cartographie + scoring. Semaine 3 : restitution + plan. Possible compression à 2 semaines pour Solo. Démarrage sous 2-3 semaines après signature.",
    aEn: "3 to 4 weeks depending on complexity. Week 1: framing + interviews. Week 2: mapping + scoring. Week 3: restitution + plan. Compression to 2 weeks possible for Solo. Start within 2-3 weeks after signing.",
  },
  {
    qFr: "Qui mobilisez-vous chez nous ?",
    qEn: "Who do you mobilise on our side?",
    aFr: "3 à 8 interviews de 45 min selon la taille du département : 1 sponsor exécutif, 2-3 managers, 2-4 opérationnels. Plus documents (procédures, volumétrie, KPI actuels). Charge totale interne : 6-10 h cumulées sur 3 semaines.",
    aEn: "3 to 8 45-min interviews depending on department size: 1 exec sponsor, 2-3 managers, 2-4 operators. Plus documents (procedures, volumes, current KPIs). Total internal load: 6-10 h over 3 weeks.",
  },
];

const CIBLE_SUB_TIERS: ReadonlyArray<AuditSubTierCard> = [
  {
    subTierId: "audit-cible-solo",
    labelFr: "Ciblé Solo",
    labelEn: "Targeted Solo",
    rangeFr: "À distance · périmètre simple",
    rangeEn: "Remote · simple scope",
    priceLabelFr: formatSubTierPrice(SUB_CIBLE_SOLO, "fr"),
    priceLabelEn: formatSubTierPrice(SUB_CIBLE_SOLO, "en", { compact: true }),
    bodyFr:
      "1 sous-fonction d'un département (ex. : 1 typologie de mails du support). 100 % à distance, 2 semaines, rapport 10-15 pages : carte des processus, fiches d'opportunité, tableau de scoring et plan chiffré. Restitution en visio.",
    bodyEn:
      "1 sub-function of a department (e.g.: 1 mail category of support). 100 % remote, 2 weeks, 10-15 page report: process map, opportunity sheets, scoring table and costed plan. Remote restitution.",
    ctaType: "contact",
    contactObject: "audit-cible-solo",
  },
  {
    subTierId: "audit-cible-standard",
    labelFr: "Ciblé Standard",
    labelEn: "Targeted Standard",
    rangeFr: "Mix site + visio",
    rangeEn: "Mix on-site + remote",
    priceLabelFr: formatSubTierPrice(SUB_CIBLE_STANDARD, "fr"),
    priceLabelEn: formatSubTierPrice(SUB_CIBLE_STANDARD, "en", { compact: true }),
    bodyFr:
      "1 département complet (marketing, RH, ops, finance, juridique, support). Mix site (2-3 jours) + visio. 3 semaines, rapport 20-25 pages et plan d'exécution 3-12 mois, remis en atelier de restitution de 2 h avec vos équipes.",
    bodyEn:
      "1 full department (marketing, HR, ops, finance, legal, support). Mix on-site (2-3 days) + remote. 3 weeks, 20-25 page report and 3-12 month execution plan, handed over in a 2 h restitution workshop with your teams.",
    ctaType: "contact",
    contactObject: "audit-cible-standard",
    isFeatured: true,
  },
  {
    subTierId: "audit-cible-avance",
    labelFr: "Ciblé Avancé",
    labelEn: "Targeted Advanced",
    rangeFr: "Service complexe, multi-acteurs",
    rangeEn: "Complex, multi-stakeholder",
    priceLabelFr: formatSubTierPrice(SUB_CIBLE_AVANCE, "fr"),
    priceLabelEn: formatSubTierPrice(SUB_CIBLE_AVANCE, "en", { compact: true }),
    bodyFr:
      "Département avec intégrations techniques (CRM, ERP, outils legacy) ou multi-équipes. 4 semaines, rapport 30-40 pages, intégrations cartographiées et prérequis techniques listés — de quoi consulter un intégrateur sur une base précise.",
    bodyEn:
      "Department with technical integrations (CRM, ERP, legacy tools) or multi-team. 4 weeks, 30-40 page report, mapped integrations and listed technical prerequisites — enough to consult an integrator on a precise basis.",
    ctaType: "contact",
    contactObject: "audit-cible-avance",
  },
];

// ============================================================================
// STRATÉGIQUE PME — 2 sous-tiers : 20-50 / 50-250 salariés
// ============================================================================

const PME_BENEFITS: ReadonlyArray<AuditBenefit> = [
  {
    icon: Network,
    titleFr: "Cartographie multi-départements",
    titleEn: "Multi-department mapping",
    bodyFr:
      "2 à 4 services majeurs cartographiés (commercial, marketing, ops, RH, finance, juridique). Vous obtenez une vue d'ensemble cohérente des opportunités IA de TOUTE l'entreprise, pas d'un seul silo — avec les doublons entre services et les processus à mutualiser identifiés noir sur blanc.",
    bodyEn:
      "2 to 4 major services mapped (sales, marketing, ops, HR, finance, legal). You get a coherent overview of the WHOLE company's AI opportunities, not just one silo — with duplicates between departments and processes to pool identified in writing.",
  },
  {
    icon: Eye,
    titleFr: "Roadmap 12-24 mois chiffrée",
    titleEn: "Costed 12-24 month roadmap",
    bodyFr:
      "Phases, charges internes, points de décision et indicateurs de suivi : chaque phase porte son budget et ce qu'elle conditionne. Le document est calibré pour être présenté tel quel en COMEX / CODIR et faire trancher les investissements IA des deux prochaines années.",
    bodyEn:
      "Phases, internal workload, decision points and tracking indicators: each phase carries its budget and what it unlocks. The document is calibrated to be presented as is in EXCOM / board and to settle the next two years' AI investments.",
  },
  {
    icon: Lightbulb,
    titleFr: "Quick-wins déployables sous 30 jours",
    titleEn: "Quick-wins deployable within 30 days",
    bodyFr:
      "3 à 5 quick-wins activables immédiatement par vos équipes (ou par nous), pendant que la stratégie long terme se met en place. Chacun est livré avec sa marche à suivre, son coût et l'indicateur à relever — vous mesurez l'effet sur vos propres chiffres, sans attendre la fin de la roadmap.",
    bodyEn:
      "3 to 5 quick-wins activable immediately by your teams (or by us), while the long-term strategy ramps up. Each comes with its steps, its cost and the indicator to track — you measure the effect on your own figures, without waiting for the end of the roadmap.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Conformité AI Act + RGPD by default",
    titleEn: "AI Act + GDPR compliance by default",
    bodyFr:
      "Chaque recommandation est validée RGPD (base juridique, transferts hors UE, DPIA) et AI Act 2026 (catégorie de risque, obligations de transparence, supervision humaine). Ces analyses sont annexées au plan : votre DPO et votre conseil juridique les reprennent directement.",
    bodyEn:
      "Each recommendation is GDPR-validated (legal basis, non-EU transfers, DPIA) and 2026 AI Act (risk category, transparency obligations, human oversight). These analyses are annexed to the plan: your DPO and legal counsel can take them straight over.",
  },
];

const PME_SCHEDULE: ReadonlyArray<AuditScheduleItem> = [
  {
    time: "Semaines 1-2",
    titleFr: "Cadrage + 8-12 interviews",
    titleEn: "Framing + 8-12 interviews",
    descriptionFr: "Cadrage exécutif + interviews managers de 2-4 départements.",
    descriptionEn: "Executive framing + manager interviews across 2-4 departments.",
  },
  {
    time: "Semaines 3-4",
    titleFr: "Cartographie + benchmark + scoring",
    titleEn: "Mapping + benchmark + scoring",
    descriptionFr: "Cartographie processus, benchmark concurrents, scoring opportunités.",
    descriptionEn: "Process mapping, competitor benchmark, opportunity scoring.",
  },
  {
    time: "Semaines 5-6",
    titleFr: "Plan d'exécution + restitution COMEX",
    titleEn: "Execution plan + EXCOM restitution",
    descriptionFr:
      "Plan détaillé 12-24 mois, remis et déroulé en restitution COMEX de 3 h, suivie d'un Q&A sur les arbitrages.",
    descriptionEn:
      "Detailed 12-24 month plan, handed over and walked through in a 3 h EXCOM restitution, followed by a Q&A on trade-offs.",
  },
];

const PME_FAQ: ReadonlyArray<AuditFaq> = [
  {
    qFr: `Quelle différence entre 20-50 salariés (${formatAmount(PRICE_PME_20_50, "fr", { compact: true })}) et 50-250 salariés (${formatAmount(PRICE_PME_50_250, "fr", { compact: true })}) ?`,
    qEn: `What's the difference between 20-50 staff (${formatAmount(PRICE_PME_20_50, "en", { compact: true })}) and 50-250 staff (${formatAmount(PRICE_PME_50_250, "en", { compact: true })})?`,
    aFr: "20-50 : 2 services majeurs cartographiés, 8 interviews, plan 25-30 pages, 5 semaines. 50-250 : 3-4 services, 15 interviews, plan 40-60 pages, 6 semaines, restitution COMEX dédiée. La complexité organisationnelle croît exponentiellement avec la taille.",
    aEn: "20-50: 2 major services mapped, 8 interviews, 25-30 page plan, 5 weeks. 50-250: 3-4 services, 15 interviews, 40-60 page plan, 6 weeks, dedicated EXCOM restitution. Organisational complexity grows exponentially with size.",
  },
  {
    qFr: "Que contient le plan remis, et qui peut s'en servir ?",
    qEn: "What does the delivered plan contain, and who can use it?",
    aFr: "Un document de 25 à 60 pages selon votre taille, remis et déroulé en restitution COMEX. Il réunit la cartographie des 2 à 4 services audités, une fiche par opportunité IA (gain estimé, complexité, délai, coût de mise en œuvre, cadre RGPD et catégorie AI Act), la roadmap 12-24 mois phasée avec ses points de décision, et le lot de 3 à 5 quick-wins activables sous 30 jours. Il sert à trois lectures différentes : la direction y trouve son dossier d'arbitrage budgétaire, les managers leur feuille de route par service, le DPO et le conseil juridique leurs annexes de conformité.",
    aEn: "A 25 to 60 page document depending on your size, handed over and walked through in an EXCOM restitution. It brings together the map of the 2 to 4 audited departments, one sheet per AI opportunity (estimated gain, complexity, delay, implementation cost, GDPR framing and AI Act category), the phased 12-24 month roadmap with its decision points, and the batch of 3 to 5 quick-wins activable within 30 days. It serves three different readings: leadership finds its budget arbitration file, managers their department roadmap, the DPO and legal counsel their compliance annexes.",
  },
  {
    qFr: "Quelle charge interne pendant l'audit ?",
    qEn: "What's the internal load during the audit?",
    aFr: "8 à 15 h cumulées sur 5-6 semaines selon votre taille : 1 sponsor exécutif (3 h), 4-6 managers (8 h), 4-8 opérationnels (4 h). Pas de gel d'activité — interviews planifiées au fil de l'eau.",
    aEn: "8 to 15 h cumulative over 5-6 weeks depending on your size: 1 exec sponsor (3 h), 4-6 managers (8 h), 4-8 operators (4 h). No activity freeze — interviews scheduled progressively.",
  },
  {
    qFr: "Et après l'audit, comment passer à l'action ?",
    qEn: "After the audit, how do we move to action?",
    aFr: "Le plan stratégique liste les quick-wins (activables seuls) et les chantiers structurants (qui nécessitent un sprint dédié). Pour ces derniers, on bascule vers le module Implémentation IA. Vos équipes peuvent aussi exécuter en autonomie — le plan est rédigé pour ça.",
    aEn: "The strategic plan lists quick-wins (self-activable) and structuring projects (needing a dedicated sprint). For the latter, we switch to the AI Implementation module. Your teams can also execute autonomously — the plan is written for that.",
  },
];

const PME_SUB_TIERS: ReadonlyArray<AuditSubTierCard> = [
  {
    subTierId: "audit-strategique-pme-20-50",
    labelFr: "PME 20-50 salariés",
    labelEn: "SME 20-50 staff",
    rangeFr: "2 services majeurs",
    rangeEn: "2 major services",
    priceLabelFr: formatSubTierPrice(SUB_PME_20_50, "fr"),
    priceLabelEn: formatSubTierPrice(SUB_PME_20_50, "en", { compact: true }),
    bodyFr:
      "PME en croissance, 1er audit IA d'envergure. 2 services majeurs cartographiés, 8 interviews, plan 25-30 pages, 5 semaines.",
    bodyEn:
      "Growing SME, 1st serious AI audit. 2 major services mapped, 8 interviews, 25-30 page plan, 5 weeks.",
    ctaType: "contact",
    contactObject: "audit-strategique-pme-20-50",
  },
  {
    subTierId: "audit-strategique-pme-50-250",
    labelFr: "PME 50-250 salariés",
    labelEn: "SME 50-250 staff",
    rangeFr: "3-4 services majeurs",
    rangeEn: "3-4 major services",
    priceLabelFr: formatSubTierPrice(SUB_PME_50_250, "fr"),
    priceLabelEn: formatSubTierPrice(SUB_PME_50_250, "en", { compact: true }),
    bodyFr:
      "PME structurée multi-services, ambition IA forte. 3-4 services, 15 interviews, plan 40-60 pages, 6 semaines, restitution COMEX dédiée.",
    bodyEn:
      "Structured multi-department SME, strong AI ambition. 3-4 services, 15 interviews, 40-60 page plan, 6 weeks, dedicated EXCOM restitution.",
    ctaType: "contact",
    contactObject: "audit-strategique-pme-50-250",
    isFeatured: true,
  },
];

// ============================================================================
// STRATÉGIQUE ETI — 1 sous-tier base, extensible sur devis
// ============================================================================

const ETI_BENEFITS: ReadonlyArray<AuditBenefit> = [
  {
    icon: Network,
    titleFr: "Audit transverse multi-BU",
    titleEn: "Transverse multi-BU audit",
    bodyFr:
      "Cartographie cohérente entre BU/filiales/sites : où sont les redondances IA, où sont les synergies à capter, où faut-il mutualiser. Vous obtenez une vue groupe consolidée, chiffrée BU par BU, qui rend visibles les investissements engagés en double.",
    bodyEn:
      "Coherent mapping across BUs/subsidiaries/sites: where are AI redundancies, where are synergies to capture, where to pool. You get a consolidated group view, costed BU by BU, making duplicate investments visible.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Gouvernance IA + comité de pilotage",
    titleEn: "AI governance + steering committee",
    bodyFr:
      "Vous repartez avec le kit de gouvernance rédigé : charte IA interne, RACI et rôles du comité IA, processus d'arbitrage des cas d'usage, registre des systèmes. Prêt à adopter en conseil, aligné AI Act 2026 + RGPD + sectoriel (santé/finance si applicable).",
    bodyEn:
      "You leave with the governance kit written out: internal AI charter, AI committee RACI and roles, use-case arbitration process, systems register. Ready to adopt at board level, aligned with the 2026 AI Act + GDPR + sector rules (health/finance if applicable).",
  },
  {
    icon: Eye,
    titleFr: "Livrables board-ready",
    titleEn: "Board-ready deliverables",
    bodyFr:
      "Quatre documents calibrés pour COMEX, conseil d'administration et comité d'audit : note de cadrage stratégique, tableau d'arbitrage des opportunités, business case par opportunité, plan d'investissement chiffré et phasé. Ils passent en séance sans être reformatés par vos équipes.",
    bodyEn:
      "Four documents calibrated for EXCOM, board of directors and audit committee: strategic framing note, opportunity arbitration table, business case per opportunity, costed and phased investment plan. They go to the meeting without your teams reformatting them.",
  },
  {
    icon: Users,
    titleFr: "Accompagnement post-audit inclus",
    titleEn: "Post-audit support included",
    bodyFr:
      "30 jours d'accompagnement inclus après livraison : Q&A illimité, ajustements du plan, préparation de la présentation au board. Vos décisions ne restent pas suspendues à une relecture. Au-delà : retainer mensuel sur devis si nécessaire.",
    bodyEn:
      "30 days of support included after delivery: unlimited Q&A, plan adjustments, board presentation preparation. Your decisions do not stay pending a review. Beyond: monthly retainer on request if needed.",
  },
];

const ETI_SCHEDULE: ReadonlyArray<AuditScheduleItem> = [
  {
    time: "Semaines 1-3",
    titleFr: "Cadrage exécutif + interviews multi-BU",
    titleEn: "Executive framing + multi-BU interviews",
    descriptionFr: "20-30 interviews répartis sur 1-2 BU et 1-2 sites. Collecte documentaire.",
    descriptionEn: "20-30 interviews across 1-2 BUs and 1-2 sites. Document collection.",
  },
  {
    time: "Semaines 4-6",
    titleFr: "Cartographie + benchmark + scoring",
    titleEn: "Mapping + benchmark + scoring",
    descriptionFr: "Cartographie multi-BU, benchmark concurrents, scoring opportunités groupe.",
    descriptionEn: "Multi-BU mapping, competitor benchmark, group opportunity scoring.",
  },
  {
    time: "Semaines 7-9",
    titleFr: "Plan stratégique + gouvernance + restitution board",
    titleEn: "Strategic plan + governance + board restitution",
    descriptionFr:
      "Plan détaillé 18-36 mois, business cases, charte IA et comité, remis en restitution COMEX + board (2 sessions), puis 30 jours d'accompagnement.",
    descriptionEn:
      "Detailed 18-36 month plan, business cases, AI charter and committee, handed over at EXCOM + board restitution (2 sessions), then 30 days of support.",
  },
];

const ETI_FAQ: ReadonlyArray<AuditFaq> = [
  {
    qFr: `Pourquoi un prix d'entrée à ${formatAmount(PRICE_ETI_BASE, "fr")} ?`,
    qEn: `Why an entry price of ${formatAmount(PRICE_ETI_BASE, "en", { compact: true })}?`,
    aFr: "Un audit ETI 1-2 BU mobilise 9 semaines de cadrage, 20-30 interviews, et quatre livrables board-ready (note stratégique, business cases, plan d'investissement chiffré, kit de gouvernance). À cette échelle, un programme IA se chiffre couramment en centaines de milliers sur deux ans : l'audit sert précisément à instruire cette décision avant de l'engager, pas à la commenter après.",
    aEn: "A 1-2 BU mid-cap audit mobilises 9 weeks of framing, 20-30 interviews, and four board-ready deliverables (strategic note, business cases, costed investment plan, governance kit). At that scale an AI programme commonly runs into the hundreds of thousands over two years: the audit exists to inform that decision before it is committed, not to comment on it afterwards.",
  },
  {
    qFr: "Qu'est-ce qui est remis au board, concrètement ?",
    qEn: "What exactly is handed to the board?",
    aFr: "Un plan de 60 à 80 pages et quatre pièces autonomes, présentées en restitution COMEX puis en séance board : la note de cadrage stratégique (10-15 pages, lisible en séance), le tableau d'arbitrage qui compare les opportunités BU par BU, un business case par opportunité retenue (coût de mise en œuvre, gains attendus, hypothèses posées, risques), et le plan d'investissement chiffré et phasé sur 18-36 mois. S'y ajoute le kit de gouvernance : charte IA, RACI du comité, processus d'arbitrage, registre des systèmes. Les 30 jours d'accompagnement inclus servent à faire passer ces documents dans vos instances.",
    aEn: "A 60 to 80 page plan and four standalone pieces, presented at the EXCOM restitution then at the board session: the strategic framing note (10-15 pages, readable in session), the arbitration table comparing opportunities BU by BU, a business case per selected opportunity (implementation cost, expected gains, stated assumptions, risks), and the costed, phased 18-36 month investment plan. Plus the governance kit: AI charter, committee RACI, arbitration process, systems register. The 30 days of included support serve to carry these documents through your governance bodies.",
  },
  {
    qFr: "Et pour les groupes très grands (3+ BU, multi-sites, multinational) ?",
    qEn: "What about very large groups (3+ BUs, multi-site, multinational)?",
    aFr: "Sur devis selon le périmètre : nombre de BU, nombre de sites, langues (FR/EN/autres), profondeur sectorielle. On démarre toujours par 1 phase de cadrage (1-2 semaines) pour figer le périmètre avant engagement ferme. Possible 50k € à 200k € selon ambition." /* price-exempt: fourchette indicative multi-BU hors tiers Axion-IA */,
    aEn: "On request based on scope: number of BUs, number of sites, languages (FR/EN/others), sector depth. Always start with 1 framing phase (1-2 weeks) to lock scope before firm commitment. Possible €50k to €200k depending on ambition." /* price-exempt: fourchette indicative multi-BU hors tiers Axion-IA */,
  },
  {
    qFr: "Quels secteurs ou conformités spécifiques ?",
    qEn: "Which sectors or specific compliances?",
    aFr: "On opère sur tous secteurs hors défense classifiée. Compliance maîtrisée : RGPD, AI Act 2026, HDS (santé), conformité bancaire ACPR, normes ISO 27001 / SOC 2. Pour secteurs ultra-régulés (nucléaire, pharma, défense), on co-pilote avec un cabinet spécialisé partenaire.",
    aEn: "All sectors except classified defence. Mastered compliance: GDPR, 2026 AI Act, French HDS (health), banking compliance ACPR, ISO 27001 / SOC 2. For ultra-regulated sectors (nuclear, pharma, defence), we co-pilot with a specialised partner firm.",
  },
];

const ETI_SUB_TIERS: ReadonlyArray<AuditSubTierCard> = [
  {
    subTierId: "audit-strategique-eti-base",
    labelFr: "ETI · 1-2 BU · 1-2 sites",
    labelEn: "Mid-cap · 1-2 BU · 1-2 sites",
    rangeFr: "3-4 services majeurs",
    rangeEn: "3-4 major services",
    priceLabelFr: formatSubTierPrice(SUB_ETI_BASE, "fr"),
    priceLabelEn: formatSubTierPrice(SUB_ETI_BASE, "en", { compact: true }),
    bodyFr:
      "Audit stratégique pour ETI 1-2 BU. 9 semaines, 20-30 interviews, plan 60-80 pages et quatre pièces board-ready (note de cadrage, tableau d'arbitrage, business cases, plan d'investissement) + kit de gouvernance. Restitution COMEX + board, 30 j d'accompagnement post-audit inclus.",
    bodyEn:
      "Strategic audit for 1-2 BU mid-cap. 9 weeks, 20-30 interviews, 60-80 page plan and four board-ready pieces (framing note, arbitration table, business cases, investment plan) + governance kit. EXCOM + board restitution, 30 days post-audit support included.",
    ctaType: "contact",
    contactObject: "audit-strategique-eti-base",
    isFeatured: true,
  },
  {
    subTierId: "audit-strategique-eti-bespoke",
    labelFr: "Multi-BU · multinational · sur devis",
    labelEn: "Multi-BU · multinational · on request",
    rangeFr: "3+ BU, multi-sites, conformité sectorielle",
    rangeEn: "3+ BUs, multi-site, sector compliance",
    priceLabelFr: "Sur devis",
    priceLabelEn: "On request",
    bodyFr:
      "Groupes très grands, conformité sectorielle (santé HDS, banque ACPR, défense). Cadrage 1-2 semaines avant devis ferme. Possibilité de co-pilotage avec cabinet partenaire spécialisé.",
    bodyEn:
      "Very large groups, sectoral compliance (health HDS, banking ACPR, defence). 1-2 week framing before firm quote. Co-pilot option with specialised partner firm.",
    ctaType: "quote",
    contactObject: "audit-strategique-eti-bespoke",
  },
];

// ============================================================================
// CONFIG MAP
// ============================================================================

export const AUDIT_DETAIL_CONFIGS: Record<AuditTier, AuditDetailConfig> = {
  "audit-flash": {
    tier: "audit-flash",
    titleFr: "Audit IA sur place",
    titleEn: "On-site AI audit",
    titleEmFr: "1 journée complète · sur site",
    titleEmEn: "1 full day · on site",
    infoCard: {
      scopeFr: "Toute l'entreprise · sur site",
      scopeEn: "Whole company · on site",
      durationFr: "1 journée complète (9 h-17 h)",
      durationEn: "1 full day (9 a.m.-5 p.m.)",
      formatFr: "Présentiel dans vos locaux",
      formatEn: "On site, at your premises",
      audienceFr: "PME 1-19 salariés · artisans · commerçants · indépendants",
      audienceEn: "Small businesses 1-19 staff · artisans · retailers · freelancers",
      deliverableFr:
        "Rapport 8-15 pages : cartographie, outils chiffrés, prompts testés, 3-5 quick-wins classés — sous 48 h ouvrées (7 jours max)",
      deliverableEn:
        "8-15 page report: mapping, costed tools, tested prompts, 3-5 ranked quick-wins — within 48 working hours (7 days max)",
    },
    promiseFr: `Audit IA complet pour PME ou ETI. Une journée complète sur place : on cartographie toute votre activité, on teste l'IA en live sur vos vrais cas, et vous recevez sous 48 h ouvrées (7 jours au plus tard) un rapport écrit de 8 à 15 pages — outils chiffrés, prompts testés, 3 à 5 quick-wins classés par impact. De quoi décider seul·e par quoi commencer. Réservation directe au calendrier (${formatAmount(PRICE_FLASH_ONSITE, "fr", { compact: true })}).`,
    promiseEn: `Complete AI audit for a small business, artisan or retailer. One full day on site: we map your entire activity, test AI live on your real cases, and within 48 business hours (7 days at the latest) you receive a written 8 to 15 page report — costed tools, tested prompts, 3 to 5 quick-wins ranked by impact. Enough to decide on your own where to start. Direct calendar booking (${formatAmount(PRICE_FLASH_ONSITE, "en", { compact: true })}).`,
    chipsFr: ["Rapport écrit sous 7 j max", "Prompts testés remis", "Confidentialité totale"],
    chipsEn: [
      "Written report within 7 days max",
      "Tested prompts handed over",
      "Total confidentiality",
    ],
    benefits: FLASH_BENEFITS,
    schedule: FLASH_SCHEDULE,
    scheduleEyebrowFr: "Déroulé type · 7 jours",
    scheduleEyebrowEn: "Standard flow · 7 days",
    scheduleDescriptionFr:
      "De la prise de contact au livrable, voici comment se déroule un audit sur place.",
    scheduleDescriptionEn:
      "From first contact to deliverable, here's how an on-site audit unfolds.",
    subTiers: FLASH_SUB_TIERS,
    faq: FLASH_FAQ,
    ctaPrimaryLabelFr: "Réserver l'audit sur place",
    ctaPrimaryLabelEn: "Book the on-site audit",
    heroImage: {
      src: "/images/axion-ia-audit-ia-entreprise-prete-intelligence-artificielle-banniere.webp",
      altFr:
        "Audit IA sur place pour PME — une journée complète dans vos locaux pour rendre votre entreprise prête à l'IA, avec cartographie des usages et plan d'action chiffré.",
      altEn:
        "On-site AI audit for small businesses — one full day on your premises to make your company AI-ready, with use-case mapping and a costed action plan.",
    },
    heroMetaFr:
      "1 journée sur site · 9 h-17 h · rapport écrit et plan chiffré sous 48 h ouvrées (7 j max)",
    heroMetaEn:
      "1 day on site · 9 a.m.-5 p.m. · written report and costed plan within 48 business hours (7 days max)",
    forWhomFr: [
      "PME mono-site",
      "Artisans, commerçants, professions libérales",
      "Indépendant·e·s & freelances qui veulent un cap clair",
    ],
    forWhomEn: [
      "Small businesses of 1 to 19 staff",
      "Artisans, retailers, liberal professions",
      "Freelancers who want a clear direction",
    ],
    deliverables: [
      {
        titleFr: "Rapport d'audit 8-15 pages · sous 48 h ouvrées",
        titleEn: "8-15 page audit report · within 48 business hours",
        descFr:
          "PDF remis sous 48 h ouvrées en règle générale, 7 jours au plus tard : cartographie de votre activité, opportunités IA priorisées, outils recommandés avec leur coût mensuel, ordre de grandeur du temps libéré. Le document sur lequel vous décidez d'investir — ou de ne pas investir.",
        descEn:
          "PDF delivered within 48 business hours as a rule, 7 days at the latest: map of your activity, prioritised AI opportunities, recommended tools with their monthly cost, order of magnitude of time freed. The document you decide on — whether to invest or not.",
      },
      {
        titleFr: "Bibliothèque de prompts testés",
        titleEn: "Library of tested prompts",
        descFr:
          "Les prompts essayés en direct pendant la journée sur vos propres cas, consignés tels quels dans le rapport, prêts à copier-coller dans vos outils. Utilisables dès le lendemain, sans nous rappeler.",
        descEn:
          "The prompts tried live during the day on your own cases, recorded as they are in the report, ready to copy-paste into your tools. Usable the very next day, without calling us back.",
      },
      {
        titleFr: "3 à 5 quick-wins classés",
        titleEn: "3 to 5 ranked quick-wins",
        descFr:
          "Des actions concrètes activables immédiatement, classées par impact et par facilité de mise en œuvre, chacune avec sa marche à suivre et son coût d'outillage. Vous savez par laquelle commencer lundi matin.",
        descEn:
          "Concrete actions you can activate immediately, ranked by impact and ease of implementation, each with its steps and tooling cost. You know which one to start with on Monday morning.",
      },
    ],
  },
  "audit-cible": {
    tier: "audit-cible",
    titleFr: "Audit Ciblé",
    titleEn: "Targeted audit",
    titleEmFr: "1 département · 3 semaines",
    titleEmEn: "1 department · 3 weeks",
    infoCard: {
      scopeFr: "1 département ciblé",
      scopeEn: "1 targeted department",
      durationFr: "3 à 4 semaines",
      durationEn: "3 to 4 weeks",
      formatFr: "À distance ou mix site + visio",
      formatEn: "Remote or mix on-site + remote",
      audienceFr: "PME · 1 département (marketing, RH, ops, finance, juridique, support)",
      audienceEn: "SME · 1 department (marketing, HR, ops, finance, legal, support)",
      deliverableFr:
        "Rapport 10-40 pages : carte des processus, fiches d'opportunité, tableau de scoring, plan chiffré 3-12 mois — remis en atelier de restitution (2 h)",
      deliverableEn:
        "10-40 page report: process map, opportunity sheets, scoring table, costed 3-12 month plan — handed over in a 2 h restitution workshop",
    },
    promiseFr: `Audit IA focalisé sur 1 département précis (marketing, RH, opérations, finance, juridique, support). Vous repartez avec la carte de ses processus, une fiche par opportunité IA, le tableau de scoring qui les compare et un plan d'exécution 3-12 mois chiffré — remis en atelier de restitution, prêt à défendre en budget. 3 sous-tiers Solo (${formatAmount(PRICE_CIBLE_SOLO, "fr", { compact: true })}) · Standard (${formatAmount(PRICE_CIBLE_STANDARD, "fr", { compact: true })}) · Avancé (${formatAmount(PRICE_CIBLE_AVANCE, "fr", { compact: true })}) selon la complexité.`,
    promiseEn: `AI audit focused on 1 specific department (marketing, HR, ops, finance, legal, support). You leave with the map of its processes, one sheet per AI opportunity, the scoring table comparing them and a costed 3-12 month execution plan — handed over in a restitution workshop, ready to defend in budget. 3 sub-tiers: Solo (${formatAmount(PRICE_CIBLE_SOLO, "en", { compact: true })}) · Standard (${formatAmount(PRICE_CIBLE_STANDARD, "en", { compact: true })}) · Advanced (${formatAmount(PRICE_CIBLE_AVANCE, "en", { compact: true })}) depending on complexity.`,
    chipsFr: [
      "Carte des processus remise",
      "Tableau de scoring des opportunités",
      "Plan chiffré 3-12 mois",
    ],
    chipsEn: ["Process map handed over", "Opportunity scoring table", "Costed 3-12 month plan"],
    benefits: CIBLE_BENEFITS,
    schedule: CIBLE_SCHEDULE,
    scheduleEyebrowFr: "Déroulé type · 3 semaines",
    scheduleEyebrowEn: "Standard flow · 3 weeks",
    scheduleDescriptionFr:
      "Une mission ciblée se déroule en 3 phases sur 3 à 4 semaines selon la complexité du département.",
    scheduleDescriptionEn:
      "A targeted mission unfolds in 3 phases over 3 to 4 weeks depending on department complexity.",
    subTiers: CIBLE_SUB_TIERS,
    faq: CIBLE_FAQ,
    ctaPrimaryLabelFr: "Choisir un format Ciblé",
    ctaPrimaryLabelEn: "Choose a Targeted format",
    heroMetaFr: "3 à 4 semaines · 1 département · rapport et plan chiffré remis en atelier",
    heroMetaEn: "3 to 4 weeks · 1 department · report and costed plan handed over in a workshop",
    forWhomFr: [
      "PME dont un département concentre l'essentiel du temps perdu",
      "Directions marketing, RH, opérations, finance, juridique ou support",
      "Équipes qui veulent un plan chiffré avant d'engager un budget IA",
    ],
    forWhomEn: [
      "SMEs where one department concentrates most of the lost time",
      "Marketing, HR, operations, finance, legal or support departments",
      "Teams who want a costed plan before committing an AI budget",
    ],
    deliverables: [
      {
        titleFr: "Carte des processus du département",
        titleEn: "Department process map",
        descFr:
          "Tous les processus du département, avec pour chacun la volumétrie traitée, le temps passé estimé, l'outil en place et la friction constatée. Votre photo de départ — et votre point de comparaison dans six mois.",
        descEn:
          "All the department's processes, each with the volume handled, estimated time spent, the tool in place and the friction observed. Your baseline picture — and your comparison point six months later.",
      },
      {
        titleFr: "Fiches d'opportunité + tableau de scoring",
        titleEn: "Opportunity sheets + scoring table",
        descFr:
          "Une fiche par cas d'usage IA (gain estimé, complexité technique, délai, outil pressenti, cadre RGPD) et le tableau qui les compare. Vous arbitrez ligne par ligne ce que vous lancez, ce qui attend, ce que vous abandonnez.",
        descEn:
          "One sheet per AI use case (estimated gain, technical complexity, delay, candidate tool, GDPR framing) and the table comparing them. You arbitrate line by line what you start, what waits, what you drop.",
      },
      {
        titleFr: "Plan d'exécution 3-12 mois chiffré",
        titleEn: "Costed 3-12 month execution plan",
        descFr:
          "Phases, charges, dépendances et points de décision, avec le coût de mise en œuvre en face de chaque chantier. Il sert de dossier de budget, de cahier des charges pour consulter un prestataire, ou de feuille de route pour vos équipes.",
        descEn:
          "Phases, workload, dependencies and decision points, with the implementation cost against each project. It works as a budget file, a specification to consult a provider, or a roadmap for your teams.",
      },
    ],
  },
  "audit-strategique-pme": {
    tier: "audit-strategique-pme",
    titleFr: "Audit Stratégique PME",
    titleEn: "SME Strategic audit",
    titleEmFr: "multi-départements · roadmap 12-24 mois",
    titleEmEn: "multi-department · 12-24 month roadmap",
    infoCard: {
      scopeFr: "Multi-départements (2 à 4 services)",
      scopeEn: "Multi-department (2 to 4 services)",
      durationFr: "5 à 6 semaines",
      durationEn: "5 to 6 weeks",
      formatFr: "Mix site + visio · restitution COMEX",
      formatEn: "Mix on-site + remote · EXCOM read-out",
      audienceFr: "PME 20-250 salariés · plusieurs services concernés",
      audienceEn: "SME 20-250 staff · several departments concerned",
      deliverableFr:
        "Plan 25-60 pages : cartographie, fiches d'opportunité, roadmap chiffrée 12-24 mois, quick-wins sous 30 jours — remis en restitution COMEX (3 h)",
      deliverableEn:
        "25-60 page plan: mapping, opportunity sheets, costed 12-24 month roadmap, quick-wins within 30 days — handed over in a 3 h EXCOM restitution",
    },
    promiseFr: `Audit IA complet multi-départements pour PME ambitieuses (20 à 250 salariés). Cartographie de 2 à 4 services majeurs, une fiche par opportunité IA, roadmap 12-24 mois chiffrée phase par phase et 3 à 5 quick-wins activables sous 30 jours — le tout remis et déroulé en restitution COMEX, prêt à servir de dossier d'arbitrage. 2 sous-tiers : 20-50 salariés (${formatAmount(PRICE_PME_20_50, "fr", { compact: true })}) · 50-250 salariés (${formatAmount(PRICE_PME_50_250, "fr", { compact: true })}).`,
    promiseEn: `Full multi-department AI audit for ambitious SMEs (20 to 250 staff). Mapping of 2 to 4 major departments, one sheet per AI opportunity, a 12-24 month roadmap costed phase by phase and 3 to 5 quick-wins activable within 30 days — all handed over and walked through in an EXCOM restitution, ready to serve as an arbitration file. 2 sub-tiers: 20-50 staff (${formatAmount(PRICE_PME_20_50, "en", { compact: true })}) · 50-250 staff (${formatAmount(PRICE_PME_50_250, "en", { compact: true })}).`,
    chipsFr: ["2-4 services cartographiés", "Roadmap chiffrée 12-24 mois", "Restitution COMEX 3 h"],
    chipsEn: ["2-4 departments mapped", "Costed 12-24 month roadmap", "3 h EXCOM restitution"],
    benefits: PME_BENEFITS,
    schedule: PME_SCHEDULE,
    scheduleEyebrowFr: "Déroulé type · 5-6 semaines",
    scheduleEyebrowEn: "Standard flow · 5-6 weeks",
    scheduleDescriptionFr:
      "Une mission stratégique PME se déroule en 3 phases sur 5 à 6 semaines selon votre taille.",
    scheduleDescriptionEn:
      "A strategic SME mission unfolds in 3 phases over 5 to 6 weeks depending on your size.",
    subTiers: PME_SUB_TIERS,
    faq: PME_FAQ,
    ctaPrimaryLabelFr: "Choisir un format Stratégique PME",
    ctaPrimaryLabelEn: "Choose a Strategic SME format",
    heroImage: {
      src: "/images/axion-ia-audit-ia-levier-croissance-mesurable-cartographie-roi-banniere.webp",
      altFr:
        "Audit IA stratégique pour PME — cartographie multi-départements, ROI chiffré et roadmap 12-24 mois pour faire de l'IA un levier de croissance mesurable.",
      altEn:
        "Strategic AI audit for SMEs — multi-department mapping, quantified ROI and a 12-24 month roadmap to turn AI into a measurable growth lever.",
    },
    heroMetaFr: "5-6 semaines · 2-4 services · restitution COMEX",
    heroMetaEn: "5-6 weeks · 2-4 departments · EXCOM read-out",
    forWhomFr: [
      "PME de 20 à 250 salariés",
      "Plusieurs services concernés par l'IA",
      "Dirigeant·e·s qui veulent une roadmap board-ready",
    ],
    forWhomEn: [
      "SMEs of 20 to 250 staff",
      "Several departments impacted by AI",
      "Leaders who want a board-ready roadmap",
    ],
    deliverables: [
      {
        titleFr: "Cartographie multi-départements",
        titleEn: "Multi-department mapping",
        descFr:
          "2 à 4 services majeurs cartographiés, avec une fiche par opportunité IA (gain estimé, complexité, délai, coût de mise en œuvre, cadre RGPD). Les doublons entre services et les processus à mutualiser apparaissent noir sur blanc.",
        descEn:
          "2 to 4 major departments mapped, with one sheet per AI opportunity (estimated gain, complexity, delay, implementation cost, GDPR framing). Duplicates between departments and processes to pool appear in writing.",
      },
      {
        titleFr: "Roadmap 12-24 mois chiffrée",
        titleEn: "Costed 12-24 month roadmap",
        descFr:
          "Plan d'exécution par phases, avec charges internes, points de décision et indicateurs de suivi. Il se présente tel quel en COMEX / CODIR : c'est le document sur lequel se tranche le budget IA des deux prochaines années.",
        descEn:
          "Phased execution plan, with internal workload, decision points and tracking indicators. It goes to EXCOM / board as is: the document on which the next two years' AI budget is settled.",
      },
      {
        titleFr: "Quick-wins activables sous 30 jours",
        titleEn: "Quick-wins activable within 30 days",
        descFr:
          "3 à 5 actions à lancer immédiatement pendant que la stratégie long terme se met en place. Chacune arrive avec sa marche à suivre, son coût et l'indicateur à relever pour en mesurer l'effet sur vos propres chiffres.",
        descEn:
          "3 to 5 actions to launch immediately while the long-term strategy ramps up. Each comes with its steps, its cost and the indicator to track so you can measure the effect on your own figures.",
      },
    ],
  },
  "audit-strategique-eti": {
    tier: "audit-strategique-eti",
    titleFr: "Audit Stratégique ETI",
    titleEn: "Mid-cap Strategic audit",
    titleEmFr: "transverse · gouvernance · board-ready",
    titleEmEn: "transverse · governance · board-ready",
    infoCard: {
      scopeFr: "Transverse multi-BU · gouvernance",
      scopeEn: "Transverse multi-BU · governance",
      durationFr: "9 semaines (multi-BU sur devis)",
      durationEn: "9 weeks (multi-BU on request)",
      formatFr: "Multi-sites · restitution COMEX + board",
      formatEn: "Multi-site · EXCOM + board read-out",
      audienceFr: "ETI 250-5000 salariés & grandes entreprises",
      audienceEn: "Mid-caps 250-5000 staff & large enterprises",
      deliverableFr:
        "Plan 60-80 pages + note de cadrage, tableau d'arbitrage, business cases, plan d'investissement, kit de gouvernance — restitution COMEX + board et 30 j d'accompagnement",
      deliverableEn:
        "60-80 page plan + framing note, arbitration table, business cases, investment plan, governance kit — EXCOM + board restitution and 30 days of support",
    },
    promiseFr: `Audit IA transverse pour ETI (250-5000 salariés) et grandes entreprises. Cartographie multi-BU chiffrée, note de cadrage stratégique, tableau d'arbitrage, business case par opportunité, plan d'investissement 18-36 mois et kit de gouvernance rédigé (charte, RACI, comité) : quatre pièces qui passent en séance sans être reformatées, plus 30 jours d'accompagnement pour les faire adopter. Conformité AI Act 2026 + RGPD + sectoriel. À partir de ${formatAmount(PRICE_ETI_BASE, "fr")} pour 1-2 BU, sur devis pour multi-BU.`,
    promiseEn: `Transverse AI audit for mid-cap (250-5000 staff) and large enterprises. Costed multi-BU mapping, strategic framing note, arbitration table, business case per opportunity, 18-36 month investment plan and a written governance kit (charter, RACI, committee): four pieces that go to the meeting without reformatting, plus 30 days of support to get them adopted. 2026 AI Act + GDPR + sector compliance. From ${formatAmount(PRICE_ETI_BASE, "en", { compact: true })} for 1-2 BU, on request for multi-BU.`,
    chipsFr: [
      "Cartographie multi-BU chiffrée",
      "Kit de gouvernance rédigé",
      "4 livrables board-ready · 30 j d'accompagnement",
    ],
    chipsEn: [
      "Costed multi-BU mapping",
      "Written governance kit",
      "4 board-ready deliverables · 30-day support",
    ],
    benefits: ETI_BENEFITS,
    schedule: ETI_SCHEDULE,
    scheduleEyebrowFr: "Déroulé type · 9 semaines",
    scheduleEyebrowEn: "Standard flow · 9 weeks",
    scheduleDescriptionFr:
      "Une mission stratégique ETI se déroule en 3 phases sur 9 semaines, avec restitution COMEX + board incluse.",
    scheduleDescriptionEn:
      "A strategic mid-cap mission unfolds in 3 phases over 9 weeks, with EXCOM + board restitution included.",
    subTiers: ETI_SUB_TIERS,
    faq: ETI_FAQ,
    ctaPrimaryLabelFr: "Demander un cadrage ETI",
    ctaPrimaryLabelEn: "Request a mid-cap framing",
    heroImage: {
      src: "/images/axion-ia-audit-ia-avantage-competitif-decisions-resultats-banniere.webp",
      altFr:
        "Audit IA transverse pour ETI et grandes entreprises — gouvernance IA, cartographie multi-BU et livrables board-ready pour transformer l'IA en avantage compétitif durable.",
      altEn:
        "Transverse AI audit for mid-caps and large enterprises — AI governance, multi-BU mapping and board-ready deliverables to turn AI into a lasting competitive advantage.",
    },
    heroMetaFr: "9 semaines · multi-BU · gouvernance + comité de pilotage",
    heroMetaEn: "9 weeks · multi-BU · governance + steering committee",
    forWhomFr: [
      "ETI de 250 à 5000 salariés & grandes entreprises",
      "Organisations multi-sites, multi-BU",
      "Comités exécutifs avec enjeux de gouvernance & conformité",
    ],
    forWhomEn: [
      "Mid-caps of 250 to 5000 staff & large enterprises",
      "Multi-site, multi-BU organisations",
      "Executive committees with governance & compliance stakes",
    ],
    deliverables: [
      {
        titleFr: "Cartographie multi-BU + tableau d'arbitrage",
        titleEn: "Multi-BU mapping + arbitration table",
        descFr:
          "Vue transverse de toutes vos business units — opportunités IA, dépendances, redondances — et le tableau qui les compare BU par BU. Les investissements engagés en double deviennent visibles avant d'être reconduits.",
        descEn:
          "A transverse view of all your business units — AI opportunities, dependencies, redundancies — and the table comparing them BU by BU. Duplicate investments become visible before they are renewed.",
      },
      {
        titleFr: "Kit de gouvernance IA rédigé",
        titleEn: "Written AI governance kit",
        descFr:
          "Charte IA interne, RACI et rôles du comité, processus d'arbitrage des cas d'usage, registre des systèmes. Prêt à être soumis au conseil, aligné AI Act 2026 + RGPD + sectoriel dès le diagnostic.",
        descEn:
          "Internal AI charter, committee RACI and roles, use-case arbitration process, systems register. Ready to submit to the board, aligned with the 2026 AI Act + GDPR + sector rules from the diagnosis onwards.",
      },
      {
        titleFr: "Business cases + plan d'investissement 18-36 mois",
        titleEn: "Business cases + 18-36 month investment plan",
        descFr:
          "Un business case par opportunité retenue (coût de mise en œuvre, gains attendus, hypothèses posées, risques) et le plan d'investissement phasé. Présentés en COMEX puis en board, avec 30 jours d'accompagnement pour les faire adopter.",
        descEn:
          "One business case per selected opportunity (implementation cost, expected gains, stated assumptions, risks) and the phased investment plan. Presented at EXCOM then at board, with 30 days of support to get them adopted.",
      },
    ],
  },
};
