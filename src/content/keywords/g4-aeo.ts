/**
 * Keyword Strategy Engine — Phase G4 : Seeds AEO (Questions Featured Snippets / PAA / AI Overviews)
 *
 * Source : `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` MODE G PHASE 4 (2026-05-20)
 * Audit AEO de référence : `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/A7-AUDIT-AEO-FEATURED-SNIPPETS.md`
 *
 * Règles de génération :
 *   - 5-12 mots, naturel, oral, se termine par "?"
 *   - Commence par : comment, combien, pourquoi, quelle, quel, est-ce que, faut-il,
 *     quelle différence, par où, en combien
 *   - Réponse snippet ≤ 60 mots (QAPage schema via `buildQAPageJsonLd` factories)
 *   - intent "aeo" + kbType "faq" sur toutes les entrées
 *   - urlCible sous `/fr/faq/[slug]` (template QAPage opérationnel)
 *   - niveau 1 + priorite 1 interdit (règle types.ts)
 *
 * Couverture : 65 seeds répartis sur 5 modules
 *   - audit             : 12 seeds (#1–#12)
 *   - interventions-formations : 15 seeds (#13–#27)
 *   - implementation    : 12 seeds (#28–#39)
 *   - AI Act conformité : 8 seeds (#40–#47)
 *   - transversal       : 18 seeds (#48–#65)
 */

import type { KeywordSeed } from "./types";

export const KW_AEO_G4: KeywordSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // MODULE : audit (12 seeds)
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "quel est le ROI d'un audit IA pour une PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "ROI d'un audit IA PME : chiffres réels 2026",
      metaTitle: "ROI audit IA PME : chiffres réels | Axion-IA",
      metaDescription:
        "Un audit IA PME rapporte 3 à 8× son coût en gains identifiés sur 12 mois. Découvrez les chiffres et comment les calculer gratuitement.",
      h2Variants: [
        "Comment calculer le ROI d'un audit IA ?",
        "Exemples de gains concrets post-audit",
        "Délai de retour sur investissement",
      ],
    },
    variables: { resultat: "3 à 8× le coût", delai: "sur 12 mois" },
    urlCible: "/fr/faq/roi-audit-ia-pme",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/audit/pme et /fr/roi. Snippet : ROI médian 159 % en 7 mois (études 2025-2026).",
  },

  {
    keyword: "en combien de jours se déroule un audit IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Durée d'un audit IA : de 1 jour à 6 semaines selon la formule",
      metaTitle: "Durée audit IA : 1 jour à 6 semaines | Axion-IA",
      metaDescription:
        "Un audit IA Flash prend 1 jour (1 190 €), un audit Ciblé 5 à 10 jours, un audit Stratégique PME 3 à 6 semaines.",
      h2Variants: [
        "Durée de l'audit sur place (1 jour)",
        "Durée de l'audit Stratégique PME",
        "Quel audit choisir selon mon calendrier ?",
      ],
    },
    variables: { resultat: "1 jour à 6 semaines", process: "audit IA" },
    urlCible: "/fr/faq/duree-audit-ia",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema + HowTo eligible. Lier vers /fr/audit/tpe-1-jour et /fr/audit/strategique-pme.",
  },

  {
    keyword: "que contient un audit IA en entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Contenu d'un audit IA entreprise : les 5 livrables clés",
      metaTitle: "Contenu audit IA entreprise : livrables | Axion-IA",
      metaDescription:
        "Un audit IA comprend : cartographie des processus, identification des gains, analyse des risques, feuille de route priorisée et rapport de restitution.",
      h2Variants: [
        "Les 5 livrables d'un audit IA Axion-IA",
        "Phase de diagnostic et cartographie",
        "Le rapport de restitution et la feuille de route",
      ],
    },
    variables: { process: "cartographie processus + feuille de route" },
    urlCible: "/fr/faq/contenu-audit-ia-entreprise",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Aligne avec HELP_ARTICLES slug perimetre-audit-ia.",
  },

  {
    keyword: "faut-il un audit IA avant d'automatiser ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA avant automatisation : obligatoire ou optionnel ?",
      metaTitle: "Faut-il un audit IA avant d'automatiser ? | Axion-IA",
      metaDescription:
        "Oui : sans audit préalable, 68 % des projets IA échouent faute de priorisation. L'audit identifie les 3 processus à plus fort ROI avant tout investissement",
      h2Variants: [
        "Les risques d'automatiser sans audit",
        "Ce que révèle un audit avant implémentation",
        "Audit flash ou audit complet avant de démarrer ?",
      ],
    },
    variables: { chiffre: "68", unite: "% d'échecs sans audit préalable" },
    urlCible: "/fr/faq/audit-ia-avant-automatisation",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/implementation et /fr/methodologie.",
  },

  {
    keyword: "comment choisir entre audit IA flash et audit stratégique ?",
    intent: "aeo",
    kbType: "comparison",
    module: "audit",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Audit IA Flash vs Stratégique : comment choisir en 2026 ?",
      metaTitle: "Audit sur place vs Stratégique : choisir | Axion-IA",
      metaDescription:
        "L'audit sur place (1 190 €, 1 jour) convient aux TPE/PME pressées. L'audit Stratégique (à partir de 4 900 €, 3-6 semaines) s'impose dès 20 salariés ou un enjeu de",
      h2Variants: [
        "L'audit sur place : pour qui et pour quoi ?",
        "L'audit Stratégique PME : critères de choix",
        "Tableau comparatif : Flash, Ciblé, Stratégique",
      ],
    },
    urlCible: "/fr/faq/audit-flash-vs-strategique",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Déclinable en page /fr/comparaisons/audit-flash-vs-strategique.",
  },

  {
    keyword: "combien coûte un audit IA en entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Prix d'un audit IA entreprise en France en 2026",
      metaTitle: "Prix audit IA entreprise 2026 | Axion-IA",
      metaDescription:
        "Un audit IA Axion-IA démarre à 1 190 € (Flash, 1 jour) ; Ciblé, Stratégique PME et ETI sur devis. Le marché pratique 1 500 à 25 000 €, Axion-IA est positionné PME avec des",
      h2Variants: [
        "Tableau des tarifs audit IA Axion-IA",
        "Marché des prix : comparatif cabinets IA",
      ],
    },
    variables: { resultat: "à partir de 1 190 €", delai: "selon taille entreprise" },
    urlCible: "/fr/faq/prix-audit-ia-entreprise",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Ne pas afficher de prix fixe dans le snippet. Lier vers les 4 pages audit détail.",
  },

  {
    keyword: "quelle différence entre audit IA et diagnostic IA ?",
    intent: "aeo",
    kbType: "comparison",
    module: "audit",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA vs diagnostic IA : deux mots, deux réalités",
      metaTitle: "Audit IA vs diagnostic IA : différences | Axion-IA",
      metaDescription:
        "Le diagnostic IA est souvent une prise de contact gratuite (1-2h). L'audit IA est une prestation structurée avec livrables, méthode et feuille de route.",
      h2Variants: [
        "Ce que recouvre le terme diagnostic IA",
        "Ce que garantit un audit IA professionnel",
        "Quand passer du diagnostic à l'audit ?",
      ],
    },
    urlCible: "/fr/faq/audit-ia-vs-diagnostic-ia",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Capte les requêtes PAA confusion sémantique.",
  },

  {
    keyword: "comment préparer son entreprise à un audit IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Préparer son entreprise à un audit IA : 5 étapes pratiques",
      metaTitle: "Préparer un audit IA PME : étapes | Axion-IA",
      metaDescription:
        "Avant l'audit : listez vos 10 principaux processus, identifiez les outils existants, notez les frustrations quotidiennes de votre équipe.",
      h2Variants: [
        "Ce que vous devez préparer avant l'audit",
        "Qui mobiliser en interne ?",
        "Ce que l'auditeur apporte clé en main",
      ],
    },
    urlCible: "/fr/faq/preparer-entreprise-audit-ia",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema + HowTo eligible (5 étapes). Aligne avec HELP_ARTICLES preparer-une-intervention.",
  },

  {
    keyword: "quels processus auditer en priorité avec l'IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quels processus auditer en premier avec l'IA ? Les 5 priorités",
      metaTitle: "Processus à auditer en priorité avec l'IA | Axion-IA",
      metaDescription:
        "Les 5 processus à plus fort ROI IA dans une PME : traitement des emails, création de devis/rapports, tri des candidatures, relance clients, analyse de",
      h2Variants: [
        "Méthode pour identifier les quick wins IA",
        "Top 5 processus à forte valeur IA en PME",
        "Comment l'audit priorise vos chantiers IA",
      ],
    },
    variables: { process: "emails / devis / RH / relances / data" },
    urlCible: "/fr/faq/processus-prioritaires-audit-ia",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Fort potentiel PAA sur requêtes 'IA pour quoi faire'.",
  },

  {
    keyword: "qu'est-ce qu'un audit IA opérationnel pour une PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA opérationnel PME : définition et périmètre",
      metaTitle: "Audit IA opérationnel PME : définition | Axion-IA",
      metaDescription:
        "L'audit IA opérationnel analyse les processus métier existants pour identifier où l'IA gagne du temps ou de l'argent.",
      h2Variants: [
        "Différence avec un audit SI ou audit de conformité",
        "Les 3 livrables d'un audit opérationnel",
        "Pour qui l'audit opérationnel est-il fait ?",
      ],
    },
    urlCible: "/fr/faq/definition-audit-ia-operationnel",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Aligne FAQ_GLOBAL + /centre-aide/perimetre-audit-ia.",
  },

  {
    keyword: "pourquoi faire un audit IA avant de recruter un dev IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "audit",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA avant recrutement IA : éviter les erreurs coûteuses",
      metaTitle: "Auditer avant de recruter en IA | Axion-IA",
      metaDescription:
        "Sans audit, 4 entreprises sur 5 recrutent avant de savoir ce dont elles ont besoin.",
      h2Variants: [
        "Le coût d'un recrutement IA sans cadrage préalable",
        "Ce que l'audit révèle sur le besoin humain réel",
        "Recrutement ou sous-traitance IA : l'audit tranche",
      ],
    },
    variables: { chiffre: "4", unite: "entreprises sur 5 sans cadrage recrutent mal" },
    urlCible: "/fr/faq/audit-ia-avant-recrutement",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Capte décideurs RH + DG. Croiser avec /fr/codage-developpement.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MODULE : interventions-formations (15 seeds)
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "combien d'heures faut-il pour former une équipe à l'IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Former une équipe à l'IA : combien d'heures pour quel résultat ?",
      metaTitle: "Heures de formation IA équipe PME | Axion-IA",
      metaDescription:
        "Une équipe de 5 à 20 personnes atteint l'autonomie opérationnelle en 7 à 14 heures (2 à 3 jours).",
      h2Variants: [
        "Formation 4h : les cas d'usage immédiats",
        "Formation 2 jours : l'équipe autonome",
        "Formation 3 jours+ : transformation complète",
      ],
    },
    variables: { resultat: "7 à 14 heures", delai: "pour atteindre l'autonomie" },
    urlCible: "/fr/faq/heures-formation-ia-equipe",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Fort volume PAA. Lier vers /fr/interventions/collectives.",
  },

  {
    keyword: "quel est le délai pour que mes équipes soient autonomes sur l'IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Autonomie IA des équipes : le délai réaliste en PME",
      metaTitle: "Délai autonomie IA équipes PME | Axion-IA",
      metaDescription:
        "En PME, l'autonomie sur les outils IA du quotidien s'acquiert en 3 à 6 semaines après une formation de 2 jours.",
      h2Variants: [
        "Les 3 phases vers l'autonomie IA",
        "Pourquoi la pratique quotidienne est clé",
        "Comment mesurer l'autonomie de mon équipe ?",
      ],
    },
    variables: { delai: "3 à 6 semaines" },
    urlCible: "/fr/faq/delai-autonomie-ia-equipes",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/centre-aide/preparer-une-intervention.",
  },

  {
    keyword: "la formation IA est-elle adaptée aux non-techniques ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Formation IA pour non-techniques : accessible et concrète",
      metaTitle: "Formation IA non-techniques : accessible ? | Axion-IA",
      metaDescription:
        "Oui. 80 % de nos participants sont des non-techniques (commerciaux, RH, comptables, dirigeants).",
      h2Variants: [
        "Ce que nos participants non-tech apprennent en 1 jour",
        "Exemples de cas d'usage sans code",
        "Témoignages équipes non-techniques",
      ],
    },
    variables: { chiffre: "80", unite: "% de participants non-techniques" },
    urlCible: "/fr/faq/formation-ia-non-techniques",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Objection fréquente. Lier vers /fr/interventions/essentielle.",
  },

  {
    keyword: "comment choisir entre formation IA générale et formation outil spécifique ?",
    intent: "aeo",
    kbType: "comparison",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA générale vs formation outil : laquelle choisir ?",
      metaTitle: "Formation IA générale vs outil : choisir | Axion-IA",
      metaDescription:
        "La formation générale développe les réflexes IA (prompt, workflows, évaluation). La formation outil (ex.",
      h2Variants: [
        "Formation générale : quand et pourquoi",
        "Formation outil spécifique : les cas où ça s'impose",
        "Notre recommandation selon votre maturité IA",
      ],
    },
    urlCible: "/fr/faq/formation-ia-generale-vs-outil",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/interventions/intervention-claude.",
  },

  {
    keyword: "quelle formation IA pour les dirigeants de PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Formation IA dirigeants PME : ce qui change en 1 journée",
      metaTitle: "Formation IA dirigeants PME | Axion-IA",
      metaDescription:
        "Les dirigeants PME ont besoin de 3 choses : comprendre la valeur IA (1h), identifier leurs 3 cas d'usage prioritaires (2h), et piloter leurs équipes (2h).",
      h2Variants: [
        "Agenda type d'une journée dirigeant IA",
        "Ce que vous déciderez mieux après la formation",
        "Coaching dirigeant 1-to-1 vs formation collective",
      ],
    },
    urlCible: "/fr/faq/formation-ia-dirigeants-pme",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/interventions/coaching-decouverte et /fr/un-a-un.",
  },

  {
    keyword: "comment mesurer les progrès après une formation IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Mesurer les progrès post-formation IA : méthode et indicateurs",
      metaTitle: "Mesurer progrès formation IA | Axion-IA",
      metaDescription:
        "3 indicateurs simples : taux d'adoption (outils utilisés semaine 4), temps gagné déclaré par l'équipe, et nombre de cas d'usage autonomes.",
      h2Variants: [
        "Les 3 KPI post-formation IA",
        "Grille de suivi autonomie à J+30",
        "Que faire si les progrès sont insuffisants ?",
      ],
    },
    urlCible: "/fr/faq/mesurer-progres-formation-ia",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Objection ROI formation fréquente chez les DRH.",
  },

  {
    keyword: "faut-il se former à l'IA quand on est artisan ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour artisans : utile ou gadget ?",
      metaTitle: "Formation IA artisans et TPE | Axion-IA",
      metaDescription:
        "Oui, même les artisans gagnent 2 à 5h par semaine grâce à l'IA : devis automatisés, réponses clients, gestion des réseaux.",
      h2Variants: [
        "Ce que l'IA change concrètement pour un artisan",
        "Les 3 outils IA gratuits pour démarrer",
        "Une demi-journée pour être opérationnel",
      ],
    },
    variables: { resultat: "2 à 5h par semaine gagnées", delai: "dès la 1re semaine" },
    urlCible: "/fr/faq/formation-ia-artisans-tpe",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Segment TPE/artisans = souvent ignoré par la concurrence. Différenciateur fort.",
  },

  {
    keyword: "une journée de formation IA suffit-elle pour une équipe ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Une journée de formation IA : ce qu'on peut vraiment apprendre",
      metaTitle: "Une journée formation IA : résultats réels | Axion-IA",
      metaDescription:
        "En 1 journée, une équipe maîtrise 2 à 3 outils IA sur ses cas d'usage métier. C'est suffisant pour démarrer, insuffisant pour une transformation complète.",
      h2Variants: [
        "Programme type d'une journée formation IA collective",
        "Ce qu'une équipe retient après 1 jour",
        "Pourquoi ajouter une 2e journée dans les 30 jours",
      ],
    },
    urlCible: "/fr/faq/une-journee-formation-ia-suffit",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Objection budget récurrente. Lier vers /fr/interventions/essentielle et /fr/interventions/approfondie.",
  },

  {
    keyword: "quelle est la différence entre une intervention et une formation IA ?",
    intent: "aeo",
    kbType: "comparison",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Intervention IA vs formation IA : deux approches complémentaires",
      metaTitle: "Intervention vs formation IA : différences | Axion-IA",
      metaDescription:
        "La formation IA développe des compétences durables dans l'équipe. L'intervention IA résout un problème ou démontre un usage sur votre terrain.",
      h2Variants: [
        "Quand choisir une intervention IA ponctuelle",
        "Quand investir dans une formation longue",
        "Le combo intervention + formation en 2 jours",
      ],
    },
    urlCible: "/fr/faq/intervention-ia-vs-formation-ia",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Clarification sémantique importante pour les décideurs.",
  },

  {
    keyword: "combien coûte une journée de formation IA pour une entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Prix d'une journée de formation IA collective en 2026",
      metaTitle: "Tarif journée formation IA entreprise | Axion-IA",
      metaDescription:
        "Le marché pratique 400 à 2 000 € par personne par jour. En format collectif B2B sur site, notre journée couvre 5 à 20 personnes avec un tarif groupe.",
      h2Variants: [
        "Tarif groupe vs individuel : la différence",
        "Ce qui justifie le prix d'une formation IA",
      ],
    },
    urlCible: "/fr/faq/prix-journee-formation-ia-entreprise",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Ne pas afficher de prix fixe dans le snippet.",
  },

  {
    keyword: "faut-il avoir un niveau en IA avant une formation IA collective ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Prérequis d'une formation IA collective : aucun niveau requis",
      metaTitle: "Prérequis formation IA collective | Axion-IA",
      metaDescription:
        "Non : aucun prérequis technique n'est nécessaire. Nos formations partent du zéro absolu.",
      h2Variants: [
        "Le questionnaire d'évaluation amont",
        "Comment gérer les niveaux mixtes dans une équipe",
        "Formation initiale vs formation avancée : lequel choisir ?",
      ],
    },
    urlCible: "/fr/faq/prerequis-formation-ia-collective",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Lever l'objection initiation. Aligne FAQ Collectives existantes.",
  },

  {
    keyword: "la formation IA sur site est-elle meilleure qu'à distance ?",
    intent: "aeo",
    kbType: "comparison",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA sur site vs distanciel : laquelle choisir ?",
      metaTitle: "Formation IA sur site vs distanciel | Axion-IA",
      metaDescription:
        "Sur site : ancrage dans vos outils réels, engagement de l'équipe supérieur, démo en conditions réelles.",
      h2Variants: [
        "Avantages et limites du présentiel",
        "Quand la formation distanciel suffit",
        "Notre approche hybride présentiel + suivi async",
      ],
    },
    urlCible: "/fr/faq/formation-ia-site-vs-distanciel",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Question PAA fréquente post-COVID.",
  },

  {
    keyword: "comment former ses équipes à l'IA en entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Former ses équipes à l'IA : la méthode en 4 étapes",
      metaTitle: "Former équipes IA entreprise : méthode | Axion-IA",
      metaDescription:
        "4 étapes : 1. Auditer les besoins (0,5 jour), 2. Former par cas d'usage métier (1-2 jours), 3. Pratiquer avec un suivi (30 jours), 4. Mesurer et ancrer.",
      h2Variants: [
        "Étape 1 : identifier les besoins par métier",
        "Étape 2 : la formation sur cas d'usage réels",
        "Étape 3 : l'ancrage post-formation (J+30)",
      ],
    },
    variables: { chiffre: "60", unite: "% des acquis perdus sans ancrage" },
    urlCible: "/fr/faq/comment-former-equipes-ia-entreprise",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema + HowTo eligible (4 étapes). P0 volume. Gap identifié audit A7 Q1.",
  },

  {
    keyword: "pourquoi la formation IA ne se résume pas à un prompt engineering ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA vs prompt engineering : au-delà du ChatGPT basique",
      metaTitle: "Formation IA vs prompt engineering | Axion-IA",
      metaDescription:
        "Le prompt engineering est une brique, pas une stratégie. Une vraie formation IA couvre : évaluation des sorties, automatisation de workflows, intégration",
      h2Variants: [
        "Ce que le prompt engineering ne couvre pas",
        "Les 4 dimensions d'une formation IA complète",
        "Indicateurs d'une formation IA sérieuse",
      ],
    },
    urlCible: "/fr/faq/formation-ia-vs-prompt-engineering",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Différenciateur fort vs MOOC/tutos YouTube.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MODULE : implementation (12 seeds)
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "en combien de semaines peut-on déployer l'IA en PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Déployer l'IA en PME : délai réaliste par type de projet",
      metaTitle: "Déployer l'IA en PME : délai semaines | Axion-IA",
      metaDescription:
        "Un premier cas d'usage IA (automatisation, chatbot, rapport automatique) se déploie en 2 à 6 semaines. Un projet de transformation complet prend 3 à 6",
      h2Variants: [
        "Phase 1 : cadrage et configuration (2 semaines)",
        "Phase 2 : déploiement et tests (2-4 semaines)",
        "Phase 3 : formation et ancrage (2-4 semaines)",
      ],
    },
    variables: { delai: "2 à 6 semaines pour un 1er cas d'usage" },
    urlCible: "/fr/faq/delai-deploiement-ia-pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Gap identifié audit A7 Q13. Aligne HELP_ARTICLES phases-implementation.",
  },

  {
    keyword: "comment implémenter l'IA sans compétences techniques internes ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Implémenter l'IA sans équipe tech : c'est possible en 2026",
      metaTitle: "IA sans compétences techniques PME | Axion-IA",
      metaDescription:
        "Oui. 70 % de nos implémentations PME ne nécessitent aucun développeur : intégrations no-code (Zapier, Make), outils IA packagés, ou notre équipe technique prend en charge l'intégration clé en main.",
      h2Variants: [
        "Les outils IA no-code accessibles sans dev",
        "Quand faut-il vraiment un développeur ?",
        "Notre offre clé en main pour les PME sans DSI",
      ],
    },
    variables: { chiffre: "70", unite: "% d'implémentations sans développeur" },
    urlCible: "/fr/faq/implementer-ia-sans-competences-techniques",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/implementation/no-code.",
  },

  {
    keyword: "quelle différence entre implémentation IA et développement IA ?",
    intent: "aeo",
    kbType: "comparison",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Implémentation IA vs développement IA : deux niveaux distincts",
      metaTitle: "Implémentation IA vs développement IA | Axion-IA",
      metaDescription:
        "L'implémentation IA configure et intègre des outils existants dans vos processus. Le développement IA crée des modèles ou applications sur mesure.",
      h2Variants: [
        "Ce que couvre l'implémentation IA",
        "Quand le développement sur mesure est nécessaire",
        "Économies d'une implémentation vs développement full-custom",
      ],
    },
    variables: { chiffre: "90", unite: "% des PME suffisent avec l'implémentation" },
    urlCible: "/fr/faq/implementation-ia-vs-developpement-ia",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/implementation et /fr/codage-developpement.",
  },

  {
    keyword: "comment prioriser les projets IA en entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Prioriser ses projets IA : la matrice ROI × effort",
      metaTitle: "Prioriser projets IA entreprise | Axion-IA",
      metaDescription:
        "Critères de priorisation : 1. Volume de temps répétitif, 2. Coût d'erreur humaine, 3. Disponibilité des données, 4. Acceptation équipe.",
      h2Variants: [
        "La matrice impact × effort IA",
        "Les 3 critères de priorisation Axion-IA",
        "Quick wins vs projets stratégiques IA",
      ],
    },
    urlCible: "/fr/faq/prioriser-projets-ia-entreprise",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema + HowTo eligible. Lier vers /fr/audit et /fr/methodologie.",
  },

  {
    keyword: "l'IA peut-elle s'intégrer à mon logiciel métier existant ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Intégrer l'IA à son logiciel métier : ce qui est possible",
      metaTitle: "IA intégrée logiciel métier PME | Axion-IA",
      metaDescription:
        "Oui : via API (la plupart des SaaS modernes), via connecteurs no-code (Zapier, Make), ou via notre équipe pour des intégrations sur mesure. Nous avons intégré l'IA dans des ERP, CRM, outils RH et comptables.",
      h2Variants: [
        "API, connecteurs no-code ou développement : comment choisir",
        "Liste des logiciels métier compatibles IA",
        "Intégration CRM × IA : exemples concrets",
      ],
    },
    urlCible: "/fr/faq/integrer-ia-logiciel-metier",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/implementation/crm-erp et /fr/implementation/integrations.",
  },

  {
    keyword: "quel budget prévoir pour un premier projet IA en PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Budget premier projet IA en PME : les fourchettes réelles",
      metaTitle: "Budget premier projet IA PME | Axion-IA",
      metaDescription:
        "Un premier projet IA PME coûte entre 1 500 € (automatisation simple no-code) et 15 000 € (intégration avec développement sur mesure).",
      h2Variants: [
        "Fourchettes par type de projet IA",
        "Ce qui fait varier le budget IA",
        "Comment l'audit réduit le risque financier",
      ],
    },
    variables: { resultat: "1 500 € à 15 000 €" },
    urlCible: "/fr/faq/budget-premier-projet-ia-pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Gap critique audit A7 Q16. Lier vers /fr/roi.",
  },

  {
    keyword: "quelle différence entre IA no-code et IA sur mesure ?",
    intent: "aeo",
    kbType: "comparison",
    module: "implementation",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA no-code vs IA sur mesure : lequel choisir en PME ?",
      metaTitle: "IA no-code vs IA sur mesure PME | Axion-IA",
      metaDescription:
        "No-code : rapide (2-4 semaines), coût faible, limité en personnalisation. Sur mesure : puissant, scalable, coûteux, nécessite un dev. 80 % des PME peuvent démarrer en no-code.",
      h2Variants: [
        "No-code : ce que Zapier et Make permettent",
        "Sur mesure : quand ça devient nécessaire",
        "Scénario no-code → sur mesure en 2 étapes",
      ],
    },
    variables: { chiffre: "80", unite: "% des PME démarrent en no-code" },
    urlCible: "/fr/faq/ia-no-code-vs-sur-mesure",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Gap A7 Q17. Lier vers /fr/implementation/no-code et /fr/implementation/ia-custom.",
  },

  {
    keyword: "comment mesurer le ROI d'un projet d'implémentation IA ?",
    intent: "aeo",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Mesurer le ROI d'une implémentation IA : méthode et KPI",
      metaTitle: "ROI implémentation IA : mesure et KPI | Axion-IA",
      metaDescription:
        "3 indicateurs ROI : temps libéré par semaine × coût horaire, taux d'erreur avant/après, délai de traitement.",
      h2Variants: [
        "Calculer le temps libéré post-implémentation",
        "Les KPI business à suivre sur 6 mois",
        "Notre simulateur ROI gratuit",
      ],
    },
    variables: { resultat: "ROI médian 159 %", delai: "sur 7 mois" },
    urlCible: "/fr/faq/mesurer-roi-implementation-ia",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Gap A7 Q18. Lier vers /fr/roi simulateur.",
  },

  {
    keyword: "comment déployer un chatbot IA dans une PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Déployer un chatbot IA en PME : guide pratique 2026",
      metaTitle: "Chatbot IA PME : déploiement 2026 | Axion-IA",
      metaDescription:
        "Un chatbot IA PME se déploie en 3 à 5 semaines : choix de la plateforme (HubSpot, Intercom, solution sur mesure), alimentation de la base de connaissance",
      h2Variants: [
        "Étapes de déploiement d'un chatbot IA",
        "Plateformes chatbot IA recommandées en PME",
        "Éviter les erreurs classiques de déploiement",
      ],
    },
    variables: { delai: "3 à 5 semaines" },
    urlCible: "/fr/faq/deployer-chatbot-ia-pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/implementation/chatbot.",
  },

  {
    keyword: "par où commencer pour implémenter l'IA dans son entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Implémenter l'IA dans son entreprise : par où commencer ?",
      metaTitle: "Par où commencer pour implémenter l'IA | Axion-IA",
      metaDescription:
        "3 premières étapes : 1. Identifier le processus le plus chronophage et répétitif (30 min), 2. Tester un outil IA gratuit dessus (1 semaine), 3.",
      h2Variants: [
        "Étape 1 : identifier le processus cible",
        "Étape 2 : tester sans risque",
        "Étape 3 : structurer et déployer",
      ],
    },
    urlCible: "/fr/faq/par-ou-commencer-implementation-ia",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema + HowTo eligible (3 étapes). Volume élevé. Lier vers /fr/methodologie.",
  },

  {
    keyword: "combien d'employés faut-il libérer pour un projet IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Ressources internes pour un projet IA : ce qu'il faut prévoir",
      metaTitle: "Ressources internes projet IA PME | Axion-IA",
      metaDescription:
        "Un projet IA PME nécessite un référent interne à 20-30 % de son temps sur 6 semaines. Le reste est pris en charge par Axion-IA.",
      h2Variants: [
        "Le rôle du référent IA interne",
        "Ce que notre équipe prend en charge",
        "Implémentation en autonomie vs accompagnée",
      ],
    },
    urlCible: "/fr/faq/ressources-internes-projet-ia",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Objection 'on n'a pas le temps' fréquente.",
  },

  {
    keyword: "comment automatiser la création de rapports avec l'IA ?",
    intent: "aeo",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser ses rapports avec l'IA : méthode et outils",
      metaTitle: "Automatiser rapports IA PME | Axion-IA",
      metaDescription:
        "L'IA peut générer un rapport de 5 pages en 3 minutes à partir d'un tableau Excel ou d'une base de données.",
      h2Variants: [
        "Outils IA pour automatiser vos rapports",
        "Configuration d'un pipeline rapport automatique",
        "Exemples de rapports IA : RH, finance, marketing",
      ],
    },
    urlCible: "/fr/faq/automatiser-rapports-ia",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "QAPage schema. Cas d'usage très concret à fort potentiel long traîne.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MODULE : AI Act + Conformité (8 seeds)
  // URGENCE : deadline réglementaire 3 août 2026
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "quelles obligations AI Act 2026 pour les PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Obligations AI Act 2026 pour les PME : ce qui entre en vigueur le 3 août",
      metaTitle: "Obligations AI Act 2026 PME | Axion-IA",
      metaDescription:
        "À partir du 3 août 2026 : toute PME utilisant un système IA doit informer ses utilisateurs (art.",
      h2Variants: [
        "Ce qui s'applique aux PME dès le 3 août 2026",
        "Les 3 obligations minimum à anticiper maintenant",
        "Sanctions et contrôles AI Act : ce que risque une PME",
      ],
    },
    variables: { delai: "deadline 3 août 2026" },
    urlCible: "/fr/faq/obligations-ai-act-2026-pme",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. P0 URGENT. Gap A7 Q25. Créer cette page avant juillet 2026. JSON-LD aiGenerated:true si contenu généré.",
  },

  {
    keyword: "l'IA dans mon entreprise est-elle soumise à l'AI Act ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Mon entreprise est-elle concernée par l'AI Act 2026 ?",
      metaTitle: "Mon entreprise est soumise à l'AI Act ? | Axion-IA",
      metaDescription:
        "Si vous utilisez un outil IA (ChatGPT, Copilot, Midjourney) ou développez une application avec de l'IA, vous êtes concerné.",
      h2Variants: [
        "Qui est concerné par l'AI Act ?",
        "Les 4 niveaux de risque AI Act",
        "Vérifier son exposition en 10 minutes",
      ],
    },
    urlCible: "/fr/faq/entreprise-soumise-ai-act",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. P0 URGENT. Gap A7 Q26. Deadline 3 août 2026.",
  },

  {
    keyword: "comment se conformer à l'AI Act en PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Se conformer à l'AI Act en PME : guide pratique 2026",
      metaTitle: "Conformité AI Act PME : guide pratique | Axion-IA",
      metaDescription:
        "5 étapes : 1. Inventorier tous vos systèmes IA, 2. Classifier les risques, 3. Mettre en place l'information utilisateurs (art. 50), 4.",
      h2Variants: [
        "Étape 1 : inventorier vos systèmes IA",
        "Étape 2 : classifier les niveaux de risque",
        "L'audit AI Act Axion-IA : ce qu'il couvre",
      ],
    },
    urlCible: "/fr/faq/conformite-ai-act-pme",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema + HowTo eligible (5 étapes). P0 URGENT. Gap A7 Q27.",
  },

  {
    keyword: "quel est le risque de ne pas respecter l'AI Act ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Sanctions AI Act : les risques réels pour une entreprise",
      metaTitle: "Risques non-conformité AI Act | Axion-IA",
      metaDescription:
        "Les sanctions AI Act vont jusqu'à 7,5 M€ ou 1,5 % du chiffre d'affaires mondial pour les violations de l'art. 50 (information).",
      h2Variants: [
        "Les 3 niveaux de sanctions AI Act",
        "Qui contrôle la conformité AI Act en France ?",
        "Se mettre en conformité avant les premiers contrôles",
      ],
    },
    variables: { resultat: "jusqu'à 7,5 M€ ou 1,5 % du CA", delai: "dès fin 2026" },
    urlCible: "/fr/faq/sanctions-non-conformite-ai-act",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Urgence déclencheur achat. P0.",
  },

  {
    keyword: "faut-il former ses employés à l'IA pour respecter l'AI Act ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "AI Act et formation IA obligatoire : ce que dit le règlement",
      metaTitle: "AI Act formation obligatoire PME | Axion-IA",
      metaDescription:
        "Oui : l'AI Act (art. 4) impose d'assurer la 'littératie IA' de tous les employés utilisant des systèmes IA.",
      h2Variants: [
        "L'article 4 AI Act et la littératie IA",
        "Ce qu'une formation AI Act doit couvrir",
        "Comment documenter la conformité formation IA",
      ],
    },
    urlCible: "/fr/faq/formation-ia-obligatoire-ai-act",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Croise formation + AI Act. Fort potentiel PAA.",
  },

  {
    keyword: "IA et RGPD : comment rester conforme en 2026 ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "IA et RGPD en 2026 : les règles à respecter",
      metaTitle: "IA et RGPD conformité 2026 | Axion-IA",
      metaDescription:
        "3 règles clés IA × RGPD : ne pas envoyer de données personnelles brutes aux LLM sans contrat DPA, utiliser des modèles hébergés en Europe si possible, et",
      h2Variants: [
        "Les 3 obligations RGPD pour les usages IA",
        "Choisir des outils IA conformes RGPD",
        "Auditer ses usages IA vs RGPD en 1 journée",
      ],
    },
    urlCible: "/fr/faq/ia-rgpd-conformite-2026",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Croiser avec AI Act. Mentionner les 6 DPA Axion-IA (audit A10 P0).",
  },

  {
    keyword: "comment documenter l'usage de l'IA dans son entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Documenter l'usage IA en entreprise : les exigences AI Act",
      metaTitle: "Documenter usage IA entreprise AI Act | Axion-IA",
      metaDescription:
        "L'AI Act exige un registre des systèmes IA utilisés, avec niveau de risque, responsable, date de mise en service et mesures de conformité.",
      h2Variants: [
        "Ce que doit contenir le registre IA",
        "Modèle de registre IA PME téléchargeable",
        "Fréquence de mise à jour du registre",
      ],
    },
    urlCible: "/fr/faq/documenter-usage-ia-entreprise",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Capte la longue traîne AI Act praticien.",
  },

  {
    keyword: "quelle est la date d'entrée en vigueur de l'AI Act pour les PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Calendrier AI Act 2026 : les dates clés pour les PME",
      metaTitle: "AI Act 2026 : dates clés PME | Axion-IA",
      metaDescription:
        "Dates AI Act : 2 février 2025 (pratiques IA interdites), 2 août 2025 (gouvernance), 3 août 2026 (obligations générales dont art. 50 information + art.",
      h2Variants: [
        "Chronologie AI Act 2024-2027",
        "Ce qui s'applique le 3 août 2026",
        "Actions à mener avant juillet 2026",
      ],
    },
    urlCible: "/fr/faq/calendrier-ai-act-pme",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Urgence maximale. Fort trafic attendu sur la requête date.",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MODULE : transversal (18 seeds)
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "par où commencer pour adopter l'IA dans son entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Adopter l'IA en entreprise : le point de départ en 2026",
      metaTitle: "Par où commencer pour adopter l'IA | Axion-IA",
      metaDescription:
        "3 premières étapes : 1. Former 1 à 3 personnes clés en 1 journée, 2. Identifier le processus le plus chronophage, 3. Tester un outil IA 2 semaines.",
      h2Variants: [
        "Étape 1 : la formation éclair de 1 journée",
        "Étape 2 : le processus cible idéal",
        "Étape 3 : structurer avec un audit",
      ],
    },
    urlCible: "/fr/faq/par-ou-commencer-ia-entreprise",
    canonicalParent: "/fr/methodologie",
    source: "manuel",
    note: "QAPage schema + HowTo eligible. Volume élevé. Lier vers /fr/methodologie.",
  },

  {
    keyword: "combien d'heures l'IA peut-elle libérer par semaine en PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Heures gagnées par l'IA en PME : chiffres réels 2026",
      metaTitle: "Heures libérées par l'IA PME 2026 | Axion-IA",
      metaDescription:
        "En PME, l'IA libère en moyenne 2,4 h par personne par jour sur les tâches répétitives (emails, rapports, recherches, prises de notes).",
      h2Variants: [
        "Détail des tâches libérées par l'IA",
        "Comment calculer les heures libérées dans votre équipe",
        "De l'heure libérée au ROI chiffré",
      ],
    },
    variables: {
      chiffre: "2,4",
      unite: "h/personne/jour",
      resultat: "1,5 ETP récupéré sur 5 personnes",
    },
    urlCible: "/fr/faq/heures-liberees-ia-pme",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "QAPage schema. Lier vers /fr/roi simulateur. Chiffre issu des données Axion-IA.",
  },

  {
    keyword: "quelle différence entre un cabinet IA et une agence IA ?",
    intent: "aeo",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Cabinet IA vs agence IA : deux positionnements distincts",
      metaTitle: "Cabinet IA vs agence IA : différences | Axion-IA",
      metaDescription:
        "Un cabinet IA (comme Axion-IA) conseille, forme et accompagne la transformation : indépendance des fournisseurs, approche métier.",
      h2Variants: [
        "Ce que fait un cabinet IA",
        "Ce que fait une agence IA",
        "Quand choisir l'un plutôt que l'autre ?",
      ],
    },
    urlCible: "/fr/faq/cabinet-ia-vs-agence-ia",
    canonicalParent: "/fr/a-propos",
    source: "manuel",
    note: "QAPage schema. Gap A7 Q30. Positionnement différenciateur Axion-IA.",
  },

  {
    keyword: "comment choisir son prestataire IA en France ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Choisir un prestataire IA en France : 7 critères en 2026",
      metaTitle: "Choisir prestataire IA France 2026 | Axion-IA",
      metaDescription:
        "7 critères : indépendance des outils, références vérifiables, méthode documentée, transparence tarifaire, accompagnement post-déploiement, conformité",
      h2Variants: [
        "Les 7 questions à poser avant de signer",
        "Red flags d'un mauvais prestataire IA",
        "Comment comparer les offres IA sur le fond",
      ],
    },
    urlCible: "/fr/faq/choisir-prestataire-ia-france",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "QAPage schema. Intent comparatif fort. Lier vers /fr/comparaisons.",
  },

  {
    keyword: "l'IA va-t-elle remplacer mes employés ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "L'IA va-t-elle remplacer les employés ? Ce que montrent les données",
      metaTitle: "IA et emploi : l'IA remplace-t-elle les salariés | Axion-IA",
      metaDescription:
        "Non : l'IA remplace des tâches, pas des métiers. 85 % des entreprises ayant déployé l'IA rapportent qu'elles ont réaffecté les employés sur des missions à",
      h2Variants: [
        "Ce que l'IA remplace vraiment : les tâches répétitives",
        "Ce que l'IA ne peut pas remplacer",
        "Comment gérer la transition avec votre équipe",
      ],
    },
    variables: { chiffre: "85", unite: "% des entreprises réaffectent sans supprimer" },
    urlCible: "/fr/faq/ia-remplace-t-elle-employes",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Volume très élevé. Objection émotionnelle clé.",
  },

  {
    keyword: "combien investir dans l'IA pour une PME en 2026 ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Budget IA PME en 2026 : combien investir et comment phaser ?",
      metaTitle: "Budget IA PME 2026 : combien investir | Axion-IA",
      metaDescription:
        "Un budget IA PME réaliste : 2 000 à 5 000 € pour démarrer (audit + 1 formation + 1 outil). 15 000 à 50 000 € pour une transformation complète sur 12 mois.",
      h2Variants: [
        "Budget phase 1 : démarrer sans risque",
        "Budget phase 2 : transformer un service",
        "Calcul du ROI attendu par budget investi",
      ],
    },
    variables: { resultat: "2 000 à 50 000 € selon la phase", delai: "ROI médian 7 mois" },
    urlCible: "/fr/faq/budget-ia-pme-2026",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "QAPage schema. Gap A7 Q16. Fort volume. Lier vers /fr/roi.",
  },

  {
    keyword: "est-ce qu'une TPE peut se permettre d'adopter l'IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA pour les TPE : accessible et rentable en 2026",
      metaTitle: "IA pour TPE : accessible en 2026 ? | Axion-IA",
      metaDescription:
        "Oui : les outils IA gratuits ou à moins de 30 €/mois (ChatGPT, Claude, Mistral) sont accessibles à toute TPE.",
      h2Variants: [
        "Outils IA gratuits et accessibles aux TPE",
        "Combien une TPE peut gagner avec l'IA",
        "Formation IA TPE : la demi-journée efficace",
      ],
    },
    variables: { resultat: "30 €/mois max pour démarrer" },
    urlCible: "/fr/faq/ia-pour-tpe-accessible",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Gap audit A7 Q28. Segment TPE sous-couvert par la concurrence.",
  },

  {
    keyword: "quelle IA utiliser pour une PME en France en 2026 ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Quelle IA choisir pour une PME française en 2026 ?",
      metaTitle: "Quelle IA pour PME France 2026 | Axion-IA",
      metaDescription:
        "Top 3 PME France 2026 : Claude (Anthropic) pour la qualité du raisonnement et RGPD, ChatGPT (OpenAI) pour l'accessibilité, Mistral pour la souveraineté",
      h2Variants: [
        "Claude vs ChatGPT pour une PME française",
        "Mistral : l'option souverainiste",
        "Comment choisir selon son cas d'usage",
      ],
    },
    urlCible: "/fr/faq/quelle-ia-choisir-pme-france-2026",
    canonicalParent: "/fr/stack-ia",
    source: "manuel",
    note: "QAPage schema. Gap A7 Q14. Lier vers /fr/stack-ia et /fr/comparaisons.",
  },

  {
    keyword: "comment sécuriser ses données lors d'un projet IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Sécuriser ses données dans un projet IA : les 5 règles",
      metaTitle: "Sécurité données projet IA | Axion-IA",
      metaDescription:
        "5 règles : 1. Jamais de données personnelles brutes dans les prompts, 2. Contrat DPA signé avec chaque fournisseur IA, 3.",
      h2Variants: [
        "Règle 1 : anonymiser avant d'envoyer à l'IA",
        "Règle 2 : le contrat DPA, un must",
        "Axion-IA : notre politique sécurité données",
      ],
    },
    urlCible: "/fr/faq/securiser-donnees-projet-ia",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Gap A7 Q29. Aligne HELP_ARTICLES securite-donnees.",
  },

  {
    keyword: "pourquoi l'IA est plus utile en PME qu'en grand groupe ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA en PME : pourquoi l'impact est souvent supérieur aux grands groupes",
      metaTitle: "IA PME plus impactante que grands groupes | Axion-IA",
      metaDescription:
        "En PME, chaque heure libérée représente un % élevé du temps total. La décision est plus rapide, le déploiement plus agile.",
      h2Variants: [
        "Vitesse de déploiement : PME vs grande entreprise",
        "Le poids d'une heure libérée en PME",
        "Témoignages PME vs grands groupes",
      ],
    },
    urlCible: "/fr/faq/ia-pme-vs-grand-groupe",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "QAPage schema. Différenciateur positionnement cabinet PME.",
  },

  {
    keyword: "combien de temps faut-il pour voir les premiers résultats IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Premiers résultats IA en PME : délai réaliste",
      metaTitle: "Premiers résultats IA PME : délai | Axion-IA",
      metaDescription:
        "Les premiers gains mesurables apparaissent en 2 à 4 semaines (temps libéré sur les tâches ciblées). L'impact ROI global se consolide sur 3 à 6 mois.",
      h2Variants: [
        "Semaine 1-2 : les quick wins immédiats",
        "Mois 1-3 : l'impact cumulatif",
        "Mois 6-12 : la transformation visible",
      ],
    },
    variables: { delai: "2 à 4 semaines pour les premiers gains" },
    urlCible: "/fr/faq/delai-premiers-resultats-ia",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "QAPage schema. Objection impatience fréquente en cycle de vente.",
  },

  {
    keyword: "en combien de temps l'IA est-elle rentable dans une PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Rentabilité de l'IA en PME : le délai moyen de retour sur investissement",
      metaTitle: "Rentabilité IA PME : délai ROI | Axion-IA",
      metaDescription:
        "Le ROI médian d'un investissement IA en PME est de 159 % atteint en 7 mois. Les projets bien ciblés (processus répétitifs à fort volume) atteignent",
      h2Variants: [
        "Facteurs qui accélèrent le ROI IA",
        "Pourquoi certains projets IA ne sont jamais rentables",
        "Notre calculateur ROI en ligne",
      ],
    },
    variables: { resultat: "ROI 159 % médian", delai: "en 7 mois" },
    urlCible: "/fr/faq/rentabilite-ia-pme",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "QAPage schema. Gap A7 Q23. Lier vers /fr/roi simulateur.",
  },

  {
    keyword: "quel est le niveau de maturité IA de mon entreprise ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Maturité IA de mon entreprise : comment l'évaluer ?",
      metaTitle: "Maturité IA entreprise : évaluation | Axion-IA",
      metaDescription:
        "3 niveaux de maturité IA : Découverte (outils utilisés ponctuellement), Adoption (processus intégrés), Transformation (IA dans la stratégie).",
      h2Variants: [
        "Les 3 niveaux de maturité IA d'une entreprise",
        "Indicateurs pour s'auto-évaluer",
        "Le diagnostic gratuit de maturité IA",
      ],
    },
    urlCible: "/fr/faq/maturite-ia-entreprise",
    canonicalParent: "/fr/audit",
    source: "manuel",
    note: "QAPage schema. Entrée de funnel qualification. Lier vers /fr/audit/tpe-1-jour.",
  },

  {
    keyword: "quelle différence entre intelligence artificielle et automatisation ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA vs automatisation : deux technologies complémentaires",
      metaTitle: "IA vs automatisation : différences clés | Axion-IA",
      metaDescription:
        "L'automatisation exécute des règles fixes (si X alors Y). L'IA apprend et s'adapte aux situations nouvelles.",
      h2Variants: [
        "Ce que fait l'automatisation sans IA",
        "Ce que l'IA ajoute à l'automatisation",
        "Exemples concrets en PME",
      ],
    },
    urlCible: "/fr/faq/ia-vs-automatisation-differences",
    canonicalParent: "/fr/glossaire",
    source: "manuel",
    note: "QAPage schema. Clarification sémantique fréquemment recherchée.",
  },

  {
    keyword: "pourquoi faire appel à un cabinet IA plutôt qu'un freelance ?",
    intent: "aeo",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Cabinet IA vs freelance IA : lequel choisir pour une PME ?",
      metaTitle: "Cabinet IA vs freelance IA : choisir | Axion-IA",
      metaDescription:
        "Un freelance IA est compétent sur 1 à 2 outils. Un cabinet IA couvre la stratégie, la formation, l'implémentation et la conformité avec une équipe dédiée.",
      h2Variants: [
        "Quand le freelance IA suffit",
        "Quand le cabinet IA est nécessaire",
        "Coût cabinet vs freelance sur 12 mois",
      ],
    },
    urlCible: "/fr/faq/cabinet-ia-vs-freelance",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "QAPage schema. Intent comparatif fort. Lier vers /fr/comparaisons.",
  },

  {
    keyword: "comment l'IA peut-elle aider une PME à se développer ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et croissance PME : les 5 leviers concrets en 2026",
      metaTitle: "IA pour croissance PME : leviers 2026 | Axion-IA",
      metaDescription:
        "5 leviers IA pour la croissance PME : prospecter plus vite, personnaliser l'offre clients, réduire les coûts opérationnels, produire plus de contenu, et",
      h2Variants: [
        "Levier 1 : prospection et acquisition client IA",
        "Levier 2 : réduction des coûts par l'automatisation",
        "Levier 3 : décisions data-driven accélérées",
      ],
    },
    variables: { resultat: "+38 % productivité" },
    urlCible: "/fr/faq/ia-croissance-pme",
    canonicalParent: "/fr/roi",
    source: "manuel",
    note: "QAPage schema. Requête découverte intent informationnel fort.",
  },

  {
    keyword: "est-ce que l'IA fonctionne dans mon secteur d'activité ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA dans mon secteur : cas d'usage et exemples concrets",
      metaTitle: "IA dans mon secteur : cas d'usage 2026 | Axion-IA",
      metaDescription:
        "L'IA crée de la valeur dans 35+ secteurs. Les usages varient (RH, comptabilité, marketing, production, service client) mais les gains de temps sont",
      h2Variants: [
        "Secteurs où l'IA apporte le plus de valeur",
        "Ce qui ne change pas selon le secteur",
        "Trouver ses cas d'usage par secteur",
      ],
    },
    urlCible: "/fr/faq/ia-dans-mon-secteur",
    canonicalParent: "/fr/cas-concrets",
    source: "manuel",
    note: "QAPage schema. Entrée générique vers les pages sectorielles. Lier vers /fr/cas-concrets.",
  },

  {
    keyword: "comment expliquer l'IA à des collaborateurs réticents ?",
    intent: "aeo",
    kbType: "faq",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Équipe réticente à l'IA : comment lever les freins",
      metaTitle: "Collaborateurs réticents à l'IA — gérer les freins",
      metaDescription:
        "3 approches : montrer un gain concret sur leur propre tâche (pas une démo abstraite), commencer par les volontaires, nommer un ambassadeur IA interne.",
      h2Variants: [
        "Comprendre les 3 types de résistance IA",
        "La démo 'sur leur propre tâche' : pourquoi ça marche",
        "Le rôle de l'ambassadeur IA interne",
      ],
    },
    urlCible: "/fr/faq/gerer-equipe-reticente-ia",
    canonicalParent: "/fr/interventions",
    source: "manuel",
    note: "QAPage schema. Requête long traîne forte chez les managers et DRH.",
  },
];
