// Configs SSOT des pages détail Audit — Sprint 14.10.8 (Will 2026-05-12).
//
// Pattern miroir d'`intervention-detail-configs.ts`. Le template
// `AuditDetailPage` consomme ces configs pour rendre les 4 pages tier (flash,
// cible, strategique-pme, strategique-eti) de manière harmonisée.

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
}

// ============================================================================
// FLASH — 2 sous-tiers : distance 490 € / sur site 890 € (calendrier)
// ============================================================================

const FLASH_BENEFITS: ReadonlyArray<AuditBenefit> = [
  {
    icon: Inbox,
    titleFr: "Cartographie 1 zone d'usage",
    titleEn: "Map 1 use area",
    bodyFr:
      "Vous nous décrivez votre fonction prioritaire (rédaction, support client, reporting, recherche…). On identifie les chronophages, on liste les outils IA pertinents, on quantifie le gain horaire potentiel.",
    bodyEn:
      "You describe your priority function (writing, customer support, reporting, research…). We identify time-sinks, list relevant AI tools, quantify potential hourly gain.",
  },
  {
    icon: Sparkles,
    titleFr: "Démos live sur vos vrais cas",
    titleEn: "Live demos on your real cases",
    bodyFr:
      "Pas de slides théoriques. On teste l'IA en direct sur 2-3 cas réels de votre quotidien — vous voyez ce que ça donne, vous comprenez ce qui marche, vous repartez avec des prompts testés.",
    bodyEn:
      "No theoretical slides. We test AI live on 2-3 real cases from your daily work — you see the result, you understand what works, you leave with tested prompts.",
  },
  {
    icon: Target,
    titleFr: "Plan d'action sous 48 h",
    titleEn: "Action plan within 48 h",
    bodyFr:
      "Rapport synthèse sous 48 h ouvrées : outils recommandés, 3-5 quick-wins activables maintenant, estimation gain horaire mensuel. Document directement actionnable.",
    bodyEn:
      "Synthesis report within 48 business hours: recommended tools, 3-5 quick-wins activable now, monthly hourly gain estimate. Directly actionable document.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Confidentialité totale",
    titleEn: "Total confidentiality",
    bodyFr:
      "Vos données restent les vôtres. Aucune utilisation pour entraîner les modèles (comptes Anthropic Team / Enterprise). NDA fourni sur demande avant le rendez-vous.",
    bodyEn:
      "Your data stays yours. No training use (Anthropic Team / Enterprise accounts). NDA provided on request before the meeting.",
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
    time: "J+1 à J+5",
    titleFr: "Diagnostic (distance ou sur site)",
    titleEn: "Diagnosis (remote or on site)",
    descriptionFr:
      "Distance : 2 sessions visio (2 h chacune) sur vos cas. Sur site : 1 journée complète 9 h-17 h dans vos locaux avec démos terrain.",
    descriptionEn:
      "Remote: 2 video sessions (2 h each) on your cases. On site: 1 full day 9 a.m.-5 p.m. on your premises with field demos.",
  },
  {
    time: "J+7 max",
    titleFr: "Livrable rapport synthèse",
    titleEn: "Synthesis report deliverable",
    descriptionFr: "PDF 8-15 pages : recommandations, prompts testés, quick-wins, gain estimé.",
    descriptionEn: "8-15 page PDF: recommendations, tested prompts, quick-wins, estimated gain.",
  },
];

const FLASH_FAQ: ReadonlyArray<AuditFaq> = [
  {
    qFr: "Pourquoi 2 prix (490 € distance / 890 € sur site) ?",
    qEn: "Why 2 prices (€490 remote / €890 on site)?",
    aFr: "Sur site = 1 journée complète dans vos locaux, démos avec votre équipe, observation terrain. Distance = 2 sessions visio (2 h chacune) sur vos cas. Mêmes livrables, mais l'immersion sur site permet de capter ce qui ne s'écrit pas (frictions équipe, outils legacy, processus oraux).",
    aEn: "On site = full day on your premises, demos with your team, field observation. Remote = 2 video sessions (2 h each) on your cases. Same deliverables, but on-site immersion captures what isn't written down (team friction, legacy tools, oral processes).",
  },
  {
    qFr: "Pour qui est-ce vraiment fait ?",
    qEn: "Who is this really for?",
    aFr: "TPE (1-19 salariés), indépendant·e·s, freelances, professions libérales. Si vous avez plus de 20 salariés et plusieurs services concernés, l'audit Ciblé (1900-3900 €) ou Stratégique PME (4900-9900 €) est mieux calibré.",
    aEn: "Small businesses (1-19 staff), independents, freelancers. If you have 20+ staff and multiple departments concerned, the Targeted audit (€1900-3900) or Strategic SME (€4900-9900) is better calibrated.",
  },
  {
    qFr: "Que se passe-t-il après l'audit Flash ?",
    qEn: "What happens after the Flash audit?",
    aFr: "Vous repartez avec un plan actionnable directement par vos soins. Si vous voulez aller plus loin, on bascule vers une intervention équipe (formation) ou une implémentation IA (module Implémentation). Pas d'engagement caché — vous décidez en autonomie.",
    aEn: "You leave with a plan actionable by yourself. To go further, we switch to a team session (training) or AI implementation (Implementation module). No hidden commitment — you decide in autonomy.",
  },
];

const FLASH_SUB_TIERS: ReadonlyArray<AuditSubTierCard> = [
  {
    subTierId: "audit-flash-distance",
    labelFr: "Flash distance",
    labelEn: "Flash remote",
    rangeFr: "1 zone d'usage · à distance",
    rangeEn: "1 use area · remote",
    priceLabelFr: "490 € HT",
    priceLabelEn: "€490",
    bodyFr:
      "2 sessions visio (2 h chacune). Idéal si vous êtes indépendant·e, dans un bureau partagé, ou si votre besoin est très ciblé. Démarrage sous 7 jours ouvrés.",
    bodyEn:
      "2 video sessions (2 h each). Ideal if you're independent, in a shared office, or if your need is very targeted. Start within 7 business days.",
    ctaType: "contact",
    contactObject: "audit-flash-distance",
    isFeatured: true,
  },
  {
    subTierId: "audit-flash-onsite",
    labelFr: "Flash terrain",
    labelEn: "Flash on site",
    rangeFr: "Sur site · 1 jour",
    rangeEn: "On site · 1 day",
    priceLabelFr: "890 € HT",
    priceLabelEn: "€890",
    bodyFr:
      "1 journée complète dans vos locaux (9 h-17 h). Vous voyez l'IA opérer sur vos vrais cas avec votre équipe. Réservation directe sur le calendrier.",
    bodyEn:
      "1 full day on your premises (9 a.m.-5 p.m.). You see AI operate on your real cases with your team. Direct booking on the calendar.",
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
      "Marketing, RH, opérations, finance, juridique, support : on choisit un département prioritaire et on cartographie TOUS ses processus. Quels chronophages, quelle volumétrie, quels outils actuels, quelles frictions.",
    bodyEn:
      "Marketing, HR, ops, finance, legal, support: we pick a priority department and map ALL its processes. Which time-sinks, what volume, what current tools, what frictions.",
  },
  {
    icon: TrendingUp,
    titleFr: "Scoring opportunités ROI",
    titleEn: "ROI opportunity scoring",
    bodyFr:
      "Chaque opportunité IA reçoit un scoring : ROI estimé / complexité technique / délai d'implémentation. Vous savez ce qu'il faut faire en premier, ce qui peut attendre, ce qu'il faut abandonner.",
    bodyEn:
      "Each AI opportunity gets a scoring: estimated ROI / technical complexity / implementation delay. You know what to do first, what can wait, what to drop.",
  },
  {
    icon: Workflow,
    titleFr: "Plan d'exécution priorisé",
    titleEn: "Prioritised execution plan",
    bodyFr:
      "Roadmap 3-12 mois avec phases, charges, dépendances, gating decisions. Document directement utilisable par vos équipes (ou par nous via le module Implémentation).",
    bodyEn:
      "3-12 month roadmap with phases, workload, dependencies, gating decisions. Document directly usable by your teams (or by us via the Implementation module).",
  },
  {
    icon: ShieldCheck,
    titleFr: "Souveraineté & RGPD",
    titleEn: "Sovereignty & GDPR",
    bodyFr:
      "Chaque recommandation est cadrée RGPD (où sont stockées les données, qui y accède, quel modèle, quelle base juridique). Compatibilité AI Act 2026 vérifiée par défaut.",
    bodyEn:
      "Each recommendation is GDPR-framed (where data is stored, who accesses it, what model, what legal basis). 2026 AI Act compatibility verified by default.",
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
    descriptionFr: "Atelier restitution 2 h + plan détaillé chiffré (15-25 pages).",
    descriptionEn: "2 h restitution workshop + detailed quantified plan (15-25 pages).",
  },
];

const CIBLE_FAQ: ReadonlyArray<AuditFaq> = [
  {
    qFr: "Quelle différence entre les 3 sous-tiers Solo / Standard / Avancé ?",
    qEn: "What's the difference between Solo / Standard / Advanced sub-tiers?",
    aFr: "Solo (1 900 €) : à distance, périmètre simple, 1 sous-fonction d'un département. Standard (2 900 €) : mix site + visio, 1 département complet. Avancé (3 900 €) : service complexe, multi-acteurs, intégrations techniques approfondies. Le cadrage 15 min permet de choisir ensemble.",
    aEn: "Solo (€1,900): remote, simple scope, 1 sub-function of a department. Standard (€2,900): mix on-site + remote, 1 full department. Advanced (€3,900): complex service, multi-stakeholder, deep technical integrations. The 15-min framing helps choose together.",
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
    priceLabelFr: "1 900 € HT",
    priceLabelEn: "€1,900",
    bodyFr:
      "1 sous-fonction d'un département (ex. : 1 typologie de mails du support). 100 % à distance, 2 semaines, rapport 10-15 pages.",
    bodyEn:
      "1 sub-function of a department (e.g.: 1 mail category of support). 100 % remote, 2 weeks, 10-15 page report.",
    ctaType: "contact",
    contactObject: "audit-cible-solo",
  },
  {
    subTierId: "audit-cible-standard",
    labelFr: "Ciblé Standard",
    labelEn: "Targeted Standard",
    rangeFr: "Mix site + visio",
    rangeEn: "Mix on-site + remote",
    priceLabelFr: "2 900 € HT",
    priceLabelEn: "€2,900",
    bodyFr:
      "1 département complet (marketing, RH, ops, finance, juridique, support). Mix site (2-3 jours) + visio. 3 semaines, rapport 20-25 pages.",
    bodyEn:
      "1 full department (marketing, HR, ops, finance, legal, support). Mix on-site (2-3 days) + remote. 3 weeks, 20-25 page report.",
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
    priceLabelFr: "3 900 € HT",
    priceLabelEn: "€3,900",
    bodyFr:
      "Département avec intégrations techniques (CRM, ERP, outils legacy) ou multi-équipes. 4 semaines, rapport 30-40 pages, intégrations cartographiées.",
    bodyEn:
      "Department with technical integrations (CRM, ERP, legacy tools) or multi-team. 4 weeks, 30-40 page report, mapped integrations.",
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
      "2 à 4 services majeurs cartographiés (commercial, marketing, ops, RH, finance, juridique). Vue d'ensemble cohérente des opportunités IA de TOUTE l'entreprise, pas d'un seul silo.",
    bodyEn:
      "2 to 4 major services mapped (sales, marketing, ops, HR, finance, legal). Coherent overview of WHOLE company AI opportunities, not just one silo.",
  },
  {
    icon: Eye,
    titleFr: "Vision IA 12-24 mois chiffrée",
    titleEn: "Quantified 12-24 month AI vision",
    bodyFr:
      "Roadmap stratégique avec phases, charges, gating decisions, KPI cibles. Document directement utilisable en COMEX / CODIR pour arbitrer les investissements IA des 2 prochaines années.",
    bodyEn:
      "Strategic roadmap with phases, workload, gating decisions, target KPIs. Document directly usable in EXCOM / CEO board to arbitrate next 2 years AI investments.",
  },
  {
    icon: Lightbulb,
    titleFr: "Quick-wins déployables sous 30 jours",
    titleEn: "Quick-wins deployable within 30 days",
    bodyFr:
      "Identification systématique de 3-5 quick-wins activables immédiatement par vos équipes (ou par nous), pendant que la stratégie long terme se met en place. Premier ROI mesurable dès le 2e mois.",
    bodyEn:
      "Systematic identification of 3-5 quick-wins activable immediately by your teams (or by us), while the long-term strategy is being set up. First measurable ROI from month 2.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Conformité AI Act + RGPD by default",
    titleEn: "AI Act + GDPR compliance by default",
    bodyFr:
      "Chaque recommandation est validée RGPD (base juridique, transferts hors UE, DPIA) et AI Act 2026 (catégorie de risque, obligations transparence, supervision humaine). Pas de bombe à retardement.",
    bodyEn:
      "Each recommendation is GDPR-validated (legal basis, non-EU transfers, DPIA) and 2026 AI Act (risk category, transparency obligations, human oversight). No time bomb.",
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
    descriptionFr: "Plan détaillé 12-24 mois + restitution COMEX 3 h + Q&A.",
    descriptionEn: "Detailed 12-24 month plan + 3 h EXCOM restitution + Q&A.",
  },
];

const PME_FAQ: ReadonlyArray<AuditFaq> = [
  {
    qFr: "Quelle différence entre 20-50 salariés (4 900 €) et 50-250 salariés (9 900 €) ?",
    qEn: "What's the difference between 20-50 staff (€4,900) and 50-250 staff (€9,900)?",
    aFr: "20-50 : 2 services majeurs cartographiés, 8 interviews, plan 25-30 pages, 5 semaines. 50-250 : 3-4 services, 15 interviews, plan 40-60 pages, 6 semaines, restitution COMEX dédiée. La complexité organisationnelle croît exponentiellement avec la taille.",
    aEn: "20-50: 2 major services mapped, 8 interviews, 25-30 page plan, 5 weeks. 50-250: 3-4 services, 15 interviews, 40-60 page plan, 6 weeks, dedicated EXCOM restitution. Organisational complexity grows exponentially with size.",
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
    priceLabelFr: "4 900 € HT",
    priceLabelEn: "€4,900",
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
    priceLabelFr: "9 900 € HT",
    priceLabelEn: "€9,900",
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
      "Cartographie cohérente entre BU/filiales/sites : où sont les redondances IA, où sont les synergies à capter, où faut-il mutualiser. Vision groupe, pas vision silo.",
    bodyEn:
      "Coherent mapping across BUs/subsidiaries/sites: where are AI redundancies, where are synergies to capture, where to mutualise. Group view, not silo view.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Gouvernance IA + comité de pilotage",
    titleEn: "AI governance + steering committee",
    bodyFr:
      "Mise en place d'un comité IA (rôles, instances, RACI), charte IA interne, processus d'arbitrage des cas d'usage. Conformité AI Act 2026 + RGPD + sectoriel (santé/finance/défense si applicable).",
    bodyEn:
      "AI committee setup (roles, instances, RACI), internal AI charter, use case arbitration process. 2026 AI Act + GDPR + sectoral compliance (health/finance/defence if applicable).",
  },
  {
    icon: Eye,
    titleFr: "Livrables board-ready",
    titleEn: "Board-ready deliverables",
    bodyFr:
      "Documents calibrés pour COMEX, conseil d'administration, comité d'audit : note de cadrage stratégique, dashboard d'arbitrage, business case par opportunité, plan investissement chiffré.",
    bodyEn:
      "Documents calibrated for EXCOM, board of directors, audit committee: strategic framing note, arbitration dashboard, business case per opportunity, quantified investment plan.",
  },
  {
    icon: Users,
    titleFr: "Accompagnement post-audit inclus",
    titleEn: "Post-audit support included",
    bodyFr:
      "30 jours d'accompagnement inclus après livraison : Q&A illimité, ajustements plan, accompagnement présentation board. Au-delà : retainer mensuel sur devis si nécessaire.",
    bodyEn:
      "30 days of support included after delivery: unlimited Q&A, plan adjustments, board presentation support. Beyond: monthly retainer on request if needed.",
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
      "Plan détaillé 18-36 mois, charte IA, comité, restitution COMEX + board (2 sessions).",
    descriptionEn:
      "Detailed 18-36 month plan, AI charter, committee, EXCOM + board restitution (2 sessions).",
  },
];

const ETI_FAQ: ReadonlyArray<AuditFaq> = [
  {
    qFr: "Pourquoi un prix d'entrée à 12 000 € HT ?",
    qEn: "Why an entry price of €12,000?",
    aFr: "Un audit ETI 1-2 BU mobilise 9 semaines de cadrage, 20-30 interviews, livrables board-ready (note stratégique + business cases + plan investissement + charte gouvernance). Le ratio coût/valeur reste très favorable : un audit ETI évite des erreurs d'investissement IA chiffrées en centaines de milliers d'euros.",
    aEn: "A 1-2 BU mid-cap audit mobilises 9 weeks of framing, 20-30 interviews, board-ready deliverables (strategic note + business cases + investment plan + governance charter). Cost/value ratio remains very favourable: a mid-cap audit prevents AI investment mistakes worth hundreds of thousands of euros.",
  },
  {
    qFr: "Et pour les groupes très grands (3+ BU, multi-sites, multinational) ?",
    qEn: "What about very large groups (3+ BUs, multi-site, multinational)?",
    aFr: "Sur devis selon le périmètre : nombre de BU, nombre de sites, langues (FR/EN/autres), profondeur sectorielle. On démarre toujours par 1 phase de cadrage (1-2 semaines) pour figer le périmètre avant engagement ferme. Possible 50k € à 200k € selon ambition.",
    aEn: "On request based on scope: number of BUs, number of sites, languages (FR/EN/others), sector depth. Always start with 1 framing phase (1-2 weeks) to lock scope before firm commitment. Possible €50k to €200k depending on ambition.",
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
    priceLabelFr: "12 000 € HT",
    priceLabelEn: "€12,000",
    bodyFr:
      "Audit stratégique pour ETI 1-2 BU. 9 semaines, 20-30 interviews, plan 60-80 pages, restitution COMEX + board, 30 j d'accompagnement post-audit inclus.",
    bodyEn:
      "Strategic audit for 1-2 BU mid-cap. 9 weeks, 20-30 interviews, 60-80 page plan, EXCOM + board restitution, 30 days post-audit support included.",
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
    titleFr: "Audit Flash",
    titleEn: "Flash audit",
    titleEmFr: "1 zone d'usage · 48 h",
    titleEmEn: "1 use area · 48 h",
    promiseFr:
      "Diagnostic IA rapide pour TPE / indépendant·e. On cartographie 1 zone d'usage prioritaire (rédaction, support, reporting, recherche…), on teste l'IA en live sur vos vrais cas, on livre un plan d'action sous 48 h. À distance (490 €) ou sur site avec réservation calendrier (890 €).",
    promiseEn:
      "Quick AI diagnosis for small business / independent. We map 1 priority use area (writing, support, reporting, research…), test AI live on your real cases, deliver an action plan within 48 h. Remote (€490) or on site with calendar booking (€890).",
    chipsFr: ["Plan sous 48 h", "Démos live · vos cas", "Confidentialité totale"],
    chipsEn: ["48-h plan", "Live demos · your cases", "Total confidentiality"],
    benefits: FLASH_BENEFITS,
    schedule: FLASH_SCHEDULE,
    scheduleEyebrowFr: "Déroulé type · 7 jours",
    scheduleEyebrowEn: "Standard flow · 7 days",
    scheduleDescriptionFr:
      "De la prise de contact au livrable, voici comment se déroule un audit Flash — quel que soit le sous-tier choisi.",
    scheduleDescriptionEn:
      "From first contact to deliverable, here's how a Flash audit unfolds — whichever sub-tier you choose.",
    subTiers: FLASH_SUB_TIERS,
    faq: FLASH_FAQ,
    ctaPrimaryLabelFr: "Choisir un format Flash",
    ctaPrimaryLabelEn: "Choose a Flash format",
  },
  "audit-cible": {
    tier: "audit-cible",
    titleFr: "Audit Ciblé",
    titleEn: "Targeted audit",
    titleEmFr: "1 département · 3 semaines",
    titleEmEn: "1 department · 3 weeks",
    promiseFr:
      "Audit IA focalisé sur 1 département précis (marketing, RH, opérations, finance, juridique, support). Cartographie complète, scoring opportunités ROI/complexité, plan d'exécution priorisé. 3 sous-tiers Solo (1 900 €) · Standard (2 900 €) · Avancé (3 900 €) selon la complexité.",
    promiseEn:
      "AI audit focused on 1 specific department (marketing, HR, ops, finance, legal, support). Complete mapping, ROI/complexity scoring, prioritised execution plan. 3 sub-tiers: Solo (€1,900) · Standard (€2,900) · Advanced (€3,900) depending on complexity.",
    chipsFr: ["Cartographie complète", "Scoring ROI/complexité", "Plan chiffré 3-12 mois"],
    chipsEn: ["Complete mapping", "ROI/complexity scoring", "3-12 month quantified plan"],
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
  },
  "audit-strategique-pme": {
    tier: "audit-strategique-pme",
    titleFr: "Audit Stratégique PME",
    titleEn: "SME Strategic audit",
    titleEmFr: "multi-départements · roadmap 12-24 mois",
    titleEmEn: "multi-department · 12-24 month roadmap",
    promiseFr:
      "Audit IA complet multi-départements pour PME ambitieuses (20 à 250 salariés). Cartographie 2-4 services majeurs, plan d'exécution chiffré, roadmap stratégique 12-24 mois, restitution COMEX. 2 sous-tiers : 20-50 salariés (4 900 €) · 50-250 salariés (9 900 €).",
    promiseEn:
      "Full multi-department AI audit for ambitious SMEs (20 to 250 staff). Maps 2-4 major services, quantified execution plan, 12-24 month strategic roadmap, EXCOM restitution. 2 sub-tiers: 20-50 staff (€4,900) · 50-250 staff (€9,900).",
    chipsFr: ["2-4 services majeurs", "Restitution COMEX", "AI Act + RGPD by default"],
    chipsEn: ["2-4 major services", "EXCOM restitution", "AI Act + GDPR by default"],
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
  },
  "audit-strategique-eti": {
    tier: "audit-strategique-eti",
    titleFr: "Audit Stratégique ETI",
    titleEn: "Mid-cap Strategic audit",
    titleEmFr: "transverse · gouvernance · board-ready",
    titleEmEn: "transverse · governance · board-ready",
    promiseFr:
      "Audit IA transverse pour ETI (250-5000 salariés) et grandes entreprises. Cartographie multi-BU, gouvernance IA + comité de pilotage, livrables board-ready, conformité AI Act 2026 + RGPD + sectoriel. À partir de 12 000 € HT pour 1-2 BU, sur devis pour multi-BU.",
    promiseEn:
      "Transverse AI audit for mid-cap (250-5000 staff) and large enterprises. Multi-BU mapping, AI governance + steering committee, board-ready deliverables, 2026 AI Act + GDPR + sector compliance. From €12,000 for 1-2 BU, on request for multi-BU.",
    chipsFr: ["Multi-BU", "Gouvernance IA + comité", "Board-ready · 30 j accompagnement"],
    chipsEn: ["Multi-BU", "AI governance + committee", "Board-ready · 30-day support"],
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
  },
};
