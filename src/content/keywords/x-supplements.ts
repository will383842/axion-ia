// src/content/keywords/x-supplements.ts
// Seeds complémentaires — 2026-05-20
// Couvrent les gaps identifiés après Mode G + H + I + J + M :
//   - Coaching 1-to-1 × positionnements (absent de Mode M)
//   - Audit × positionnements P2 opérationnel + P3 accessible (peu couvert)
//   - Implémentation IA / automatisation processus — angle générique sans outils tiers

import type { KeywordSeed } from "./types";

export const KW_SUPPLEMENTS_X: KeywordSeed[] = [
  // ────────────────────────────────────────────────────────────────────────────
  // COACHING 1-TO-1 × POSITIONNEMENTS
  // ────────────────────────────────────────────────────────────────────────────

  {
    keyword: "coaching IA dirigeant résultats rapides",
    intent: "benefice",
    kbType: "intervention_module",
    module: "coaching-1-to-1",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Coaching IA dirigeant — maîtrisez l'IA en 3 séances opérationnelles",
      metaTitle: "Coaching IA dirigeant PME — résultats rapides | Axion-IA",
      metaDescription:
        "Coaching IA individuel pour dirigeants de PME : 3 séances sur vos propres cas, vos outils, vos décisions. Opérationnel dès la 1ère session.",
      h2Variants: [
        "Pourquoi un dirigeant a besoin d'un coach IA plutôt d'une formation collective",
        "Ce qu'un dirigeant maîtrise après 3 séances de coaching IA",
        "ROI du coaching IA 1-to-1 pour une PME",
      ],
    },
    variables: { resultat: "autonomie IA opérationnelle", delai: "dès la 1ère séance" },
    urlCible: "/fr/coaching-1-to-1/",
    canonicalParent: "/fr/coaching-1-to-1/",
    source: "manuel",
    note: "Positionnement P2 opérationnel rapide pour coaching 1-to-1",
  },

  {
    keyword: "accompagnement IA personnalisé dirigeant PME",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "coaching-1-to-1",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Accompagnement IA 1-to-1 — fait sur mesure pour votre contexte de dirigeant",
      metaTitle: "Accompagnement IA dirigeant PME sur mesure | Axion-IA",
      metaDescription:
        "Cabinet & agence IA : coaching individuel dirigeants de PME. Sur vos cas réels, vos outils, vos équipes. Résultats mesurables dès la première séance.",
      h2Variants: [
        "Ce qui différencie un coaching IA individuel d'une formation collective",
        "Programme coaching IA dirigeant : contenu et déroulement",
        "Témoignages dirigeants : ce que le coaching IA change concrètement",
      ],
    },
    urlCible: "/fr/coaching-1-to-1/",
    source: "manuel",
    note: "Intent transactionnel — lier vers /fr/reserver pour conversion directe",
  },

  {
    keyword: "coach IA pour chef d'entreprise accessible",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "coaching-1-to-1",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Coaching IA pour chef d'entreprise — accessible, sans jargon, sur vos cas réels",
      metaTitle: "Coach IA chef d'entreprise accessible | Axion-IA",
      metaDescription:
        "Vous êtes chef d'entreprise, pas ingénieur. Le coaching IA Axion-IA s'adapte à votre niveau et à vos process métier. Séance individuelle, résultats concrets.",
      h2Variants: [
        "L'IA pour les dirigeants non-techniques : par où commencer ?",
        "1 séance de coaching IA : ce que vous repartez avec",
        "Coaching IA vs formation collective : lequel choisir ?",
      ],
    },
    urlCible: "/fr/coaching-1-to-1/",
    source: "manuel",
    note: "Positionnement P3 accessible pour coaching 1-to-1 × TPE",
  },

  {
    keyword: "coaching IA ETI directeur général programme stratégie",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "coaching-1-to-1",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Coaching IA stratégique pour directeurs généraux d'ETI",
      metaTitle: "Coaching IA DG ETI — stratégie IA | Axion-IA",
      metaDescription:
        "Coaching IA individuel pour directeurs généraux d'ETI : gouvernance IA, roadmap stratégique, transformation opérationnelle. Programme sur mesure, résultats mesurables.",
      h2Variants: [
        "Quel rôle le DG joue dans la transformation IA de son ETI ?",
        "Programme coaching IA DG ETI : durée, contenu, livrables",
        "Transformer une ETI par l'IA : l'angle dirigeant",
      ],
    },
    urlCible: "/fr/coaching-1-to-1/dirigeants",
    source: "manuel",
    note: "Positionnement P4 grands programmes pour coaching 1-to-1 × ETI",
  },

  // ────────────────────────────────────────────────────────────────────────────
  // AUDIT × POSITIONNEMENTS P2 OPÉRATIONNEL + P3 ACCESSIBLE
  // ────────────────────────────────────────────────────────────────────────────

  {
    keyword: "audit IA entreprise résultats en 5 jours",
    intent: "benefice",
    kbType: "implementation_playbook",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA en 5 jours — plan d'action chiffré livré, pas de projet interminable",
      metaTitle: "Audit IA PME en 5 jours — plan chiffré | Axion-IA",
      metaDescription:
        "L'audit IA Axion-IA dure 5 jours : 2 jours d'interviews + 2 jours d'analyse + 1 jour de restitution. Livrable PDF 25-40 pages + plan priorisé. Opérationnel.",
      h2Variants: [
        "Pourquoi 5 jours suffisent pour un audit IA complet en PME",
        "Ce que contient le livrable de l'audit IA Axion-IA",
        "Audit IA en 5 jours vs mission de conseil de 3 mois : la différence",
      ],
    },
    variables: { delai: "5 jours", resultat: "plan d'action chiffré priorisé" },
    urlCible: "/fr/audit/pme",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "Positionnement P2 opérationnel rapide pour audit × PME",
  },

  {
    keyword: "audit IA flash PME rapide diagnostic",
    intent: "transactionnel",
    kbType: "faq",
    module: "audit",
    cible: "tpe",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA Flash — diagnostic rapide et accessible pour TPE et PME",
      metaTitle: "Audit IA Flash TPE PME — diagnostic rapide | Axion-IA",
      metaDescription:
        "L'audit sur place Axion-IA est le format d'entrée : 1 journée, identification des 3-5 process candidats à l'IA, plan de priorisation. Sans engagement sur la suite.",
      h2Variants: [
        "Qu'est-ce qu'un audit IA Flash et à quoi ça sert ?",
        "Audit sur place vs audit complet : lequel choisir pour ma TPE ?",
        "Ce que vous avez en main après un audit IA Flash",
      ],
    },
    urlCible: "/fr/audit/tpe-1-jour",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "Positionnement P3 accessible pour audit × TPE — lier vers audit/flash",
  },

  {
    keyword: "cabinet IA audit entreprise opérationnel sans engagement",
    intent: "transactionnel",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA sans engagement — diagnostic indépendant de toute suite commerciale",
      metaTitle: "Audit IA sans engagement — cabinet indépendant | Axion-IA",
      metaDescription:
        "L'audit Axion-IA est indépendant de la suite. Vous repartez avec le plan, libre de l'implémenter avec qui vous voulez. Cabinet & agence IA franco-européen.",
      h2Variants: [
        "Pourquoi choisir un audit IA indépendant de l'implémentation",
        "Ce que garantit l'audit Axion-IA : livrables, délais, périmètre",
        "Comment l'audit IA précède (et accélère) l'implémentation",
      ],
    },
    urlCible: "/fr/audit/",
    source: "manuel",
    note: "Différenciateur fort : audit indépendant vs cabinets qui font audit + implémentation captive",
  },

  // ────────────────────────────────────────────────────────────────────────────
  // IMPLÉMENTATION IA & AUTOMATISATION PROCESSUS
  // ────────────────────────────────────────────────────────────────────────────

  {
    keyword: "automatisation IA processus PME France",
    intent: "transactionnel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Automatisez vos process métier avec l'IA — opérationnel en 4 semaines",
      metaTitle: "Automatisation IA processus PME France | Axion-IA",
      metaDescription:
        "Cabinet & agence IA : automatisation de vos processus PME avec l'intelligence artificielle. Relances, facturation, qualification prospects — opérationnel en 4 semaines.",
      h2Variants: [
        "Quels processus PME automatiser en priorité avec l'IA ?",
        "5 automatisations IA les plus rentables pour une PME en 2026",
        "Comment Axion-IA automatise vos processus en 4 semaines",
      ],
    },
    variables: {
      process: "automatisation processus IA",
      resultat: "process automatisé",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "Angle automatisation processus métier — générique, sans mention d'outils tiers spécifiques",
  },

  {
    keyword: "déploiement agent IA entreprise sur mesure",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Déployez un agent IA sur mesure dans votre entreprise — opérationnel en 6 semaines",
      metaTitle: "Agent IA sur mesure entreprise | Axion-IA",
      metaDescription:
        "Cabinet IA : conception et déploiement d'agents IA sur mesure. S'intègre à vos outils et données existants. PME et ETI, résultats mesurables.",
      h2Variants: [
        "Qu'est-ce qu'un agent IA sur mesure et à quoi ça sert en PME ?",
        "Agent IA personnalisé : comment ça fonctionne concrètement ?",
        "Déploiement agent IA : les 5 étapes Axion-IA",
      ],
    },
    variables: { process: "agent IA sur mesure", delai: "en 6 semaines" },
    urlCible: "/fr/implementation/",
    source: "manuel",
    note: "Angle agent IA custom — sans référence à des outils tiers spécifiques",
  },

  {
    keyword: "intégration IA logiciel métier existant PME",
    intent: "transactionnel",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Intégrez l'IA à votre logiciel métier existant — sans tout remettre à plat",
      metaTitle: "Intégration IA logiciel métier PME | Axion-IA",
      metaDescription:
        "L'IA s'intègre à votre ERP, CRM, comptabilité sans migration ni refonte. Axion-IA déploie une solution IA sur vos outils existants. Démo sur vos données réelles.",
      h2Variants: [
        "L'IA peut-elle se connecter à mon logiciel métier actuel ?",
        "ERP, CRM, comptabilité : comment l'IA s'intègre sans friction",
        "3 exemples d'intégration IA sur logiciel métier déployés par Axion-IA",
      ],
    },
    urlCible: "/fr/implementation/",
    source: "manuel",
    note: "Angle intégration logiciel existant — sans mention d'outils tiers spécifiques",
  },

  {
    keyword: "automatisation processus répétitifs IA PME gain temps",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Automatisez vos tâches répétitives avec l'IA — gagnez 5 à 10h par semaine",
      metaTitle: "Automatiser tâches répétitives IA PME | Axion-IA",
      metaDescription:
        "Emails, relances, comptes-rendus, classement, rapports : l'IA prend en charge les tâches répétitives de votre PME. Cabinet IA franco-européen, résultats mesurables.",
      h2Variants: [
        "Quelles tâches répétitives l'IA peut automatiser dans une PME ?",
        "Combien d'heures par semaine récupère-t-on après automatisation IA ?",
        "Par où commencer l'automatisation IA dans ma PME ?",
      ],
    },
    variables: {
      process: "tâches répétitives",
      resultat: "5 à 10h/semaine gagnées",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/blog/automatiser-taches-repetitives-ia-pme",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
    note: "Bénéfice chiffré fort — lier vers /fr/roi pour simulateur",
  },

  {
    keyword: "automatisation facturation devis emails IA PME",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Automatisez facturation, devis et emails — libérez 6h par semaine dans votre PME",
      metaTitle: "Automatiser facturation devis emails IA PME | Axion-IA",
      metaDescription:
        "L'IA prend en charge relances, génération de devis, envoi d'emails — connectée à vos outils existants. 6h/semaine récupérées en moyenne sur une PME de 5 personnes.",
      h2Variants: [
        "Comment l'IA automatise la facturation d'une PME ?",
        "Génération de devis assistée par IA : de la demande au document signé",
        "6h/semaine récupérées : le calcul pour une PME de 5 personnes",
      ],
    },
    variables: {
      process: "facturation, devis, emails",
      resultat: "6h/semaine",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/blog/automatiser-facturation-devis-emails-ia-pme",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
    note: "Cas d'usage concret facturation/devis/emails — sans mention d'outils tiers",
  },
];
