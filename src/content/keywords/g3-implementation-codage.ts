/**
 * Keyword Strategy — Phase G3 : Implémentation + Codage-Développement × PME / ETI / Startup
 *
 * Généré le 2026-05-20 via MODE G PHASE 3 du prompt master v1.2.
 * Décisions Will confirmées :
 *   - Positionnement "cabinet IA" ET "agence IA" (les deux)
 *   - Services confirmés : implémentations ET codage
 *   - Budget content : 100-500 articles/jour → génère le maximum
 *   - URL codage : `/fr/codage-developpement/`
 *
 * Règles anti-cannibalisation (R5) : H1 jamais = keyword brut.
 * Règles niveau (R6) : niveau 1 + priorite 1 interdit.
 * Budget URLs patterns :
 *   - /fr/implementation/pme
 *   - /fr/implementation/eti
 *   - /fr/implementation/startup
 *   - /fr/codage-developpement/
 *   - /fr/codage-developpement/pme
 *   - /fr/blog/[slug]
 */

import type { KeywordSeed, KeywordModule, KeywordCible } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE A — Seeds Implémentation × PME / ETI / Startup (~40 seeds)
// ─────────────────────────────────────────────────────────────────────────────

export const KW_IMPLEMENTATION_G3: KeywordSeed[] = [
  // ── PME — D1 Transactionnel ──────────────────────────────────────────────
  {
    keyword: "implémenter IA en PME",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Implémenter l'IA dans votre PME — accompagnement sur mesure Axion-IA",
      metaTitle: "Implémentation IA PME — Cabinet Axion-IA",
      metaDescription:
        "Déployez l'IA dans votre PME avec un cabinet spécialisé. Diagnostic gratuit, roadmap sur 8 semaines, ROI mesurable dès le 1er trimestre.",
      h2Variants: [
        "Pourquoi l'implémentation IA PME demande un accompagnement dédié",
        "Notre méthode en 4 étapes pour déployer l'IA dans votre PME",
        "Résultats concrets obtenus par nos clients PME",
      ],
    },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "Keyword HEAD pour la page /fr/implementation/pme. Schema.org : Service + FAQPage.",
  },
  {
    keyword: "déployer IA sur mesure PME",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Déploiement IA sur mesure pour PME — sans off-the-shelf",
      metaTitle: "Déployer IA sur mesure PME | Axion-IA cabinet",
      metaDescription:
        "Pas de solution standard : nous concevons un déploiement IA calqué sur vos process PME. Pilote en 3 semaines, généralisation en 8 semaines.",
    },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },
  {
    keyword: "solution IA personnalisée pour petite entreprise",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Une solution IA personnalisée pour votre petite entreprise — sans budget grand compte",
      metaTitle: "Solution IA personnalisée PME | Axion-IA",
      metaDescription:
        "Budget PME, résultats grand compte. Axion-IA conçoit votre solution IA de A à Z : audit, développement, formation, maintenance.",
    },
    variables: { chiffre: "8", unite: "semaines", delai: "dès la semaine 9" },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },
  {
    keyword: "cabinet IA accompagnement PME implémentation",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Cabinet IA : votre partenaire implémentation pour PME ambitieuse",
      metaTitle: "Cabinet IA implémentation PME | Axion-IA",
      metaDescription:
        "Axion-IA accompagne les PME de l'audit IA à la mise en production. Résultats chiffrés, engagement contractuel, SLA mensuel.",
    },
    urlCible: "/fr/implementation/pme",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },

  // ── PME — D2 Bénéfice ────────────────────────────────────────────────────
  {
    keyword: "automatiser facturation IA PME",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser la facturation en PME avec l'IA — 6h/semaine récupérées",
      metaTitle: "Automatiser facturation IA PME — 6h/sem récupérées",
      metaDescription:
        "Relances automatiques, rapprochement bancaire IA, exports comptables sans saisie. Nos clients PME récupèrent 6h/semaine sur la facturation.",
      h2Variants: [
        "Ce que l'IA peut automatiser dans votre cycle de facturation",
        "Comment intégrer l'IA à votre ERP ou logiciel de facturation existant",
        "Retour sur investissement : calcul pour une PME de 10-50 personnes",
      ],
    },
    variables: {
      process: "facturation",
      chiffre: "6",
      unite: "heures/semaine",
      delai: "dès le 1er mois",
    },
    urlCible: "/fr/blog/automatiser-facturation-ia-pme",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
    note: "Injecter dans BENEFITS_G3 id=B001.",
  },
  {
    keyword: "gain de temps IA PME gestion emails",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et gestion emails PME — 70 % du temps de rédaction économisé",
      metaTitle: "IA emails PME — 70 % de temps rédaction économisé",
      metaDescription:
        "Classement automatique, réponses pré-rédigées, relances intelligentes. 70 % du temps de gestion emails économisé pour vos équipes PME.",
    },
    variables: { process: "gestion emails", chiffre: "70", unite: "%", delai: "dès J+15" },
    urlCible: "/fr/blog/gain-temps-ia-pme-emails",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
    note: "Injecter dans BENEFITS_G3 id=B002.",
  },
  {
    keyword: "IA pour comptes-rendus réunion automatiques PME",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "100 % de vos comptes-rendus réunion générés automatiquement par l'IA",
      metaTitle: "Comptes-rendus IA automatiques PME | Axion-IA",
      metaDescription:
        "Fini les CR manuels : notre solution IA transcrit, résume et distribue chaque réunion en 2 min. Compatible Teams, Google Meet, Zoom.",
    },
    variables: {
      process: "comptes-rendus réunion",
      chiffre: "100",
      unite: "%",
      delai: "dès la 1ère semaine",
    },
    urlCible: "/fr/blog/comptes-rendus-reunions-ia-pme",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
  },
  {
    keyword: "réduire coûts opérationnels IA PME",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Réduire les coûts opérationnels de votre PME grâce à l'IA — chiffres réels",
      metaTitle: "Réduire coûts IA PME — ROI chiffré | Axion-IA",
      metaDescription:
        "Nos clients PME réduisent en moyenne 22 % de leurs coûts opérationnels après 3 mois d'implémentation IA. Calculez votre ROI en 5 minutes.",
    },
    variables: { chiffre: "22", unite: "%", delai: "en 3 mois" },
    urlCible: "/fr/blog/reduire-couts-operationnels-ia-pme",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
  },

  // ── PME — D3 Informationnel ──────────────────────────────────────────────
  {
    keyword: "comment implémenter IA dans son entreprise",
    intent: "informationnel",
    kbType: "guide",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Comment implémenter l'IA dans votre entreprise — guide complet 2026",
      metaTitle: "Comment implémenter l'IA en entreprise — Guide 2026",
      metaDescription:
        "Audit des besoins, choix des outils, intégration, formation équipes : le guide complet pour implémenter l'IA dans votre PME en 2026.",
      h2Variants: [
        "Étape 1 : auditer vos processus candidats à l'IA",
        "Étape 2 : choisir la bonne approche (sur mesure vs no-code)",
        "Étape 3 : piloter un premier use case en 4 semaines",
        "Étape 4 : généraliser et former vos équipes",
      ],
    },
    urlCible: "/fr/blog/comment-implementer-ia-entreprise",
    canonicalParent: "/fr/implementation",
    source: "manuel",
    note: "Article pilier 2000+ mots, maillage vers /fr/implementation/pme et /fr/implementation/eti.",
  },
  {
    keyword: "étapes déploiement IA petite entreprise",
    intent: "informationnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Les 5 étapes clés pour déployer l'IA dans une petite entreprise",
      metaTitle: "Étapes déploiement IA PME — 5 phases | Axion-IA",
      metaDescription:
        "De l'audit initial à la mise en production, découvrez les 5 étapes structurées par Axion-IA pour déployer l'IA sans risque dans votre PME.",
    },
    urlCible: "/fr/blog/etapes-deploiement-ia-petite-entreprise",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
  },
  {
    keyword: "budget implémentation IA PME combien ça coûte",
    intent: "informationnel",
    kbType: "guide",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Budget implémentation IA PME — fourchettes réelles et ROI attendu",
      metaTitle: "Budget implémentation IA PME — coûts réels 2026",
      metaDescription:
        "De 5 000 € à 50 000 € selon le scope : découvrez les fourchettes réelles de budget IA PME, les postes de coût et le ROI moyen observé par Axion-IA.",
    },
    urlCible: "/fr/blog/budget-implementation-ia-pme",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
  },
  {
    keyword: "erreurs à éviter implémentation IA PME",
    intent: "informationnel",
    kbType: "guide",
    module: "implementation",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "7 erreurs à éviter lors d'une implémentation IA en PME",
      metaTitle: "Erreurs implémentation IA PME — 7 pièges à éviter",
      metaDescription:
        "Choisir un outil trop généraliste, négliger la formation, ignorer le RGPD : les 7 erreurs les plus courantes et comment les éviter.",
    },
    urlCible: "/fr/blog/erreurs-eviter-implementation-ia-pme",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
  },

  // ── PME — D4 AEO ─────────────────────────────────────────────────────────
  {
    keyword: "combien de temps pour implémenter l'IA en PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Combien de temps faut-il pour implémenter l'IA dans une PME ?",
      metaTitle: "Délai implémentation IA PME — réponse précise 2026",
      metaDescription:
        "En moyenne 8 semaines de la phase d'audit à la mise en production pour une PME. Découvrez les jalons détaillés et les facteurs qui accélèrent le projet.",
    },
    variables: { chiffre: "8", unite: "semaines", delai: "dès le 1er pilote" },
    urlCible: "/fr/blog/combien-temps-implementer-ia-pme",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
    note: "Schema.org FAQPage. Phrase exacte pour Answer Box / AI Overviews.",
  },
  {
    keyword: "quelle IA choisir pour une PME en 2026 ?",
    intent: "aeo",
    kbType: "comparison",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quelle IA choisir pour votre PME en 2026 ? Comparatif honnête",
      metaTitle: "Quelle IA pour une PME en 2026 ? Comparatif Axion-IA",
      metaDescription:
        "ChatGPT, Claude, Gemini, solutions sur mesure : notre comparatif objectif pour PME avec critères coût, RGPD, intégration ERP et courbe d'apprentissage.",
    },
    urlCible: "/fr/blog/quelle-ia-choisir-pme-2026",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
  },
  {
    keyword: "est-ce qu'une PME peut se permettre l'IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Est-ce qu'une PME peut vraiment se permettre d'implémenter l'IA ?",
      metaTitle: "L'IA est-elle accessible aux PME ? Réponse 2026",
      metaDescription:
        "Oui : les coûts IA ont chuté de 80 % en 3 ans. Découvrez les solutions accessibles dès 500 €/mois et les cas concrets de PME ayant déjà basculé.",
    },
    urlCible: "/fr/blog/pme-peut-se-permettre-ia",
    canonicalParent: "/fr/implementation/pme",
    source: "manuel",
  },

  // ── ETI — D1 Transactionnel ──────────────────────────────────────────────
  {
    keyword: "déployer IA dans une ETI industrielle",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Déployer l'IA dans votre ETI industrielle — gouvernance, intégration, ROI",
      metaTitle: "Déploiement IA ETI industrielle | Axion-IA cabinet",
      metaDescription:
        "Complexité DSI, intégration ERP/MES, enjeux RGPD : Axion-IA maîtrise les contraintes IA en ETI industrielle. Programme sur 16 semaines.",
    },
    urlCible: "/fr/implementation/eti",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },
  {
    keyword: "implémentation IA ETI transformation digitale",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Implémentation IA & transformation digitale ETI — accélérateur Axion-IA",
      metaTitle: "Implémentation IA ETI — transformation digitale 2026",
      metaDescription:
        "L'IA comme levier de transformation digitale pour ETI : automatisation des fonctions support, supply chain prédictive, customer service IA.",
    },
    urlCible: "/fr/implementation/eti",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },
  {
    keyword: "cabinet IA ETI accompagnement opérationnel",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Cabinet IA pour ETI — accompagnement opérationnel de l'audit au run",
      metaTitle: "Cabinet IA ETI accompagnement opérationnel | Axion-IA",
      metaDescription:
        "Axion-IA intervient en ETI comme partenaire IA opérationnel : squad dédié, ticketing interne, monthly QBR. Au-delà du consulting.",
    },
    urlCible: "/fr/implementation/eti",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },

  // ── ETI — D2 Bénéfice ────────────────────────────────────────────────────
  {
    keyword: "automatiser reporting mensuel IA ETI",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser le reporting mensuel en ETI avec l'IA — 2 jours/mois récupérés",
      metaTitle: "Automatiser reporting IA ETI — 2 jours/mois récupérés",
      metaDescription:
        "Consolidation multi-sources, visualisation automatique, distribution PDF planifiée : nos clients ETI récupèrent 2 jours/mois sur leurs rapports.",
      h2Variants: [
        "Les 3 goulots d'étranglement du reporting ETI que l'IA élimine",
        "Architecture technique : IA + BI + API pour reporting temps réel",
        "Étude de cas : ETI 200 salariés, 2 jours/mois récupérés en 6 semaines",
      ],
    },
    variables: {
      process: "reporting mensuel",
      chiffre: "2",
      unite: "jours/mois",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/blog/automatiser-reporting-mensuel-ia-eti",
    canonicalParent: "/fr/implementation/eti",
    source: "manuel",
    note: "Injecter dans BENEFITS_G3 id=B006.",
  },
  {
    keyword: "IA qualification prospects B2B ETI automatique",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "80 % du scoring prospects automatisé par l'IA pour votre ETI",
      metaTitle: "IA qualification prospects ETI — 80 % automatisé",
      metaDescription:
        "Scoring comportemental, enrichissement automatique, routing CRM : automatisez 80 % de la qualification de vos leads B2B avec l'IA.",
    },
    variables: {
      process: "qualification prospects",
      chiffre: "80",
      unite: "%",
      delai: "dès le 2e mois",
    },
    urlCible: "/fr/blog/ia-qualification-prospects-eti-automatique",
    canonicalParent: "/fr/implementation/eti",
    source: "manuel",
    note: "Injecter dans BENEFITS_G3 id=B005.",
  },

  // ── ETI — D3 Informationnel ──────────────────────────────────────────────
  {
    keyword: "gouvernance IA entreprise taille intermédiaire",
    intent: "informationnel",
    kbType: "guide",
    module: "implementation",
    cible: "eti",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Gouvernance IA en ETI — cadre, rôles et comité de pilotage",
      metaTitle: "Gouvernance IA ETI — cadre et bonnes pratiques 2026",
      metaDescription:
        "Chief AI Officer, IA committee, AI policy interne : comment structurer la gouvernance IA dans une ETI pour avancer vite sans risque réglementaire.",
    },
    urlCible: "/fr/blog/gouvernance-ia-eti",
    canonicalParent: "/fr/implementation/eti",
    source: "manuel",
  },
  {
    keyword: "intégrer IA ERP SAP ETI",
    intent: "informationnel",
    kbType: "guide",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Intégrer l'IA à votre ERP SAP en ETI — guide technique et méthodologique",
      metaTitle: "Intégration IA ERP SAP ETI — guide 2026 | Axion-IA",
      metaDescription:
        "Connecteurs SAP, gestion des droits données, tests de régression : notre guide pour intégrer des briques IA dans un ERP SAP d'ETI sans migration.",
    },
    urlCible: "/fr/blog/integrer-ia-erp-sap-eti",
    canonicalParent: "/fr/implementation/eti",
    source: "manuel",
  },

  // ── ETI — D4 AEO ─────────────────────────────────────────────────────────
  {
    keyword: "combien coûte un projet IA pour une ETI ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Combien coûte un projet IA pour une ETI ? Fourchettes 2026",
      metaTitle: "Coût projet IA ETI — fourchettes réelles 2026",
      metaDescription:
        "Entre 30 000 € et 200 000 € selon le périmètre : découvrez les fourchettes réelles d'un projet IA ETI, les postes de dépense et le ROI moyen.",
    },
    urlCible: "/fr/blog/combien-coute-projet-ia-eti",
    canonicalParent: "/fr/implementation/eti",
    source: "manuel",
    note: "Schema.org FAQPage. Answer Box cible.",
  },
  {
    keyword: "délai ROI IA entreprise taille intermédiaire ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "eti",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "En combien de temps une ETI récupère son investissement IA ?",
      metaTitle: "Délai ROI IA ETI — chiffres réels | Axion-IA",
      metaDescription:
        "Nos clients ETI atteignent en moyenne le ROI positif à 9 mois. Décryptage par use case : automatisation RH, supply chain, customer service.",
    },
    variables: { chiffre: "9", unite: "mois", delai: "ROI positif atteint" },
    urlCible: "/fr/blog/delai-roi-ia-eti",
    canonicalParent: "/fr/implementation/eti",
    source: "manuel",
  },

  // ── Startup/Scaleup — D1 Transactionnel ─────────────────────────────────
  {
    keyword: "implémenter IA startup SaaS B2B",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Implémenter l'IA dans votre startup SaaS B2B — de la feature à l'infra",
      metaTitle: "Implémentation IA startup SaaS B2B | Axion-IA",
      metaDescription:
        "LLM intégré au produit, AI-powered onboarding, support chatbot : Axion-IA accompagne les startups SaaS B2B dans l'implémentation IA produit.",
    },
    urlCible: "/fr/implementation/startup",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },
  {
    keyword: "agence IA pour startup scaleup croissance rapide",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Agence IA pour startup & scaleup — accélérer la croissance par l'IA",
      metaTitle: "Agence IA startup scaleup | Axion-IA cabinet",
      metaDescription:
        "Itérations rapides, product-led IA, levée de fonds IA-ready : Axion-IA est l'agence IA des startups qui veulent scaler vite et bien.",
    },
    urlCible: "/fr/implementation/startup",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },
  {
    keyword: "déployer IA sur mesure startup scale sans dette technique",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Déploiement IA startup sans dette technique — notre approche ingénierie",
      metaTitle: "Déployer IA startup sans dette technique | Axion-IA",
      metaDescription:
        "Architecture event-driven, LLMOps, tests automatisés : nous déployons votre IA startup avec les standards ingénierie qui tiennent la mise à l'échelle.",
    },
    urlCible: "/fr/implementation/startup",
    canonicalParent: "/fr/implementation",
    source: "manuel",
  },

  // ── Startup/Scaleup — D2 Bénéfice ───────────────────────────────────────
  {
    keyword: "automatiser onboarding client IA startup SaaS",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser l'onboarding client SaaS avec l'IA — time-to-value divisé par 3",
      metaTitle: "Automatiser onboarding SaaS IA — time-to-value ×3",
      metaDescription:
        "Parcours adaptatif, tooltips IA, activation guidée : nos clients SaaS divisent par 3 leur time-to-value après automatisation IA de l'onboarding.",
    },
    variables: { process: "onboarding client SaaS", chiffre: "3", unite: "x", delai: "dès J+30" },
    urlCible: "/fr/blog/automatiser-onboarding-client-ia-startup-saas",
    canonicalParent: "/fr/implementation/startup",
    source: "manuel",
  },
  {
    keyword: "IA tri CV recrutement startup scaleup",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et tri de CV en startup — 5x plus vite sur le recrutement",
      metaTitle: "IA tri CV recrutement startup — 5x plus rapide",
      metaDescription:
        "Scoring CV automatique, détection des profils rares, scheduling entretiens IA : traitez vos candidatures 5x plus vite sans sacrifier la qualité.",
      h2Variants: [
        "Comment l'IA analyse vos CVs en moins de 30 secondes",
        "Intégration avec vos outils ATS existants (Lever, Teamtailor, Workday)",
        "Résultats pour une startup de 50 personnes en mode hypercroissance",
      ],
    },
    variables: {
      process: "tri CV recrutement",
      chiffre: "5",
      unite: "x plus rapide",
      delai: "dès J+7",
    },
    urlCible: "/fr/blog/ia-tri-cv-recrutement-startup",
    canonicalParent: "/fr/implementation/startup",
    source: "manuel",
    note: "Injecter dans BENEFITS_G3 id=B004.",
  },
  {
    keyword: "réduire churn SaaS grâce à l'IA prédictive",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Réduire le churn SaaS avec l'IA prédictive — signaux d'alerte détectés avant",
      metaTitle: "Réduire churn SaaS IA prédictive | Axion-IA",
      metaDescription:
        "Modèle de churn prédictif sur vos données produit, alertes Account Manager automatiques, playbooks de rétention IA : réduisez votre churn de 25 %.",
    },
    variables: { process: "rétention clients SaaS", chiffre: "25", unite: "%", delai: "en 3 mois" },
    urlCible: "/fr/blog/reduire-churn-saas-ia-predictive",
    canonicalParent: "/fr/implementation/startup",
    source: "manuel",
  },

  // ── Startup/Scaleup — D3 Informationnel ─────────────────────────────────
  {
    keyword: "IA product led growth startup",
    intent: "informationnel",
    kbType: "guide",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "IA & Product-Led Growth : intégrer l'IA au cœur de votre produit startup",
      metaTitle: "IA Product-Led Growth startup — guide 2026 | Axion-IA",
      metaDescription:
        "Personnalisation IA in-app, nudges comportementaux, upgrade triggers prédictifs : comment l'IA transforme la croissance PLG en 2026.",
    },
    urlCible: "/fr/blog/ia-product-led-growth-startup",
    canonicalParent: "/fr/implementation/startup",
    source: "manuel",
  },

  // ── Startup/Scaleup — D4 AEO ─────────────────────────────────────────────
  {
    keyword: "quelle IA intégrer dans un produit SaaS en 2026 ?",
    intent: "aeo",
    kbType: "comparison",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Quelle IA intégrer dans un produit SaaS en 2026 ? Notre guide de décision",
      metaTitle: "Quelle IA intégrer SaaS 2026 ? Guide décision complet",
      metaDescription:
        "OpenAI, Anthropic Claude, Mistral, modèles fine-tunés : notre grille de décision pour choisir le bon LLM à intégrer dans votre SaaS en 2026.",
    },
    urlCible: "/fr/blog/quelle-ia-integrer-saas-2026",
    canonicalParent: "/fr/implementation/startup",
    source: "manuel",
    note: "Schema.org FAQPage + HowTo. Maillage vers /fr/codage-developpement/.",
  },
  {
    keyword: "combien de temps pour intégrer IA dans un produit SaaS ?",
    intent: "aeo",
    kbType: "faq",
    module: "implementation",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Combien de temps pour intégrer l'IA dans un produit SaaS ?",
      metaTitle: "Délai intégration IA produit SaaS — réponse précise",
      metaDescription:
        "De 2 semaines (API LLM simple) à 3 mois (modèle fine-tuné + LLMOps) : les délais réels selon la complexité de l'intégration IA SaaS.",
    },
    urlCible: "/fr/blog/combien-temps-integrer-ia-produit-saas",
    canonicalParent: "/fr/implementation/startup",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE B — Seeds Codage-Développement × PME / ETI / Startup (~20 seeds)
// ─────────────────────────────────────────────────────────────────────────────

export const KW_CODAGE_G3: KeywordSeed[] = [
  // ── Codage × PME — Transactionnel ────────────────────────────────────────
  {
    keyword: "développement IA sur mesure PME",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Développement IA sur mesure pour PME — votre solution unique, livrée en 6 semaines",
      metaTitle: "Développement IA sur mesure PME | Axion-IA cabinet",
      metaDescription:
        "Axion-IA code votre solution IA de A à Z : agent IA, automatisation workflow, API LLM intégrée à vos outils. Livraison 6 semaines, prix PME.",
      h2Variants: [
        "Pourquoi une solution IA sur mesure est plus rentable qu'un SaaS en PME",
        "Notre stack de développement IA (Claude API, LangChain, Next.js, Python)",
        "Exemples de solutions IA codées pour des PME comme la vôtre",
      ],
    },
    urlCible: "/fr/codage-developpement/pme",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
    note: "Keyword HEAD page /fr/codage-developpement/pme. Schema.org : Service + SoftwareApplication.",
  },
  {
    keyword: "solution IA custom entreprise France",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Solution IA custom entreprise — développée et hébergée en France",
      metaTitle: "Solution IA custom entreprise France | Axion-IA",
      metaDescription:
        "Souveraineté des données, hébergement OVH/Scaleway, conformité RGPD native : Axion-IA développe votre solution IA custom en France.",
    },
    urlCible: "/fr/codage-developpement/",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "agence développement IA sur mesure B2B",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Agence développement IA sur mesure B2B — code, intégration, maintenance",
      metaTitle: "Agence développement IA sur mesure B2B | Axion-IA",
      metaDescription:
        "Axion-IA : agence IA et cabinet conseil réunis. Nous codons votre solution IA B2B et assurons son évolution. Pas de dépendance vendor.",
    },
    urlCible: "/fr/codage-developpement/",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "développer agent IA pour PME automatisation",
    intent: "transactionnel",
    kbType: "automation_recipe",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Développer un agent IA pour votre PME — du cahier des charges à la mise en production",
      metaTitle: "Développer agent IA PME automatisation | Axion-IA",
      metaDescription:
        "Agents IA capables d'agir : scraping, génération de docs, relances CRM, reporting automatique. Axion-IA code votre agent IA PME clé en main.",
    },
    urlCible: "/fr/codage-developpement/pme",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "intégration API IA entreprise PME ETI",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Intégration API IA dans votre SI — PME et ETI accompagnées pas à pas",
      metaTitle: "Intégration API IA entreprise PME ETI | Axion-IA",
      metaDescription:
        "Connecter Claude API, OpenAI, Mistral ou Gemini à votre SI existant (ERP, CRM, outils métier) : Axion-IA gère l'intégration API IA de bout en bout.",
    },
    urlCible: "/fr/codage-developpement/",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },

  // ── Codage × PME — Bénéfice ──────────────────────────────────────────────
  {
    keyword: "automatisation workflow IA code sur mesure PME",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Automatiser vos workflows PME par le code IA — résultats concrets",
      metaTitle: "Automatisation workflow IA code PME — résultats réels",
      metaDescription:
        "Scripts IA, webhooks intelligents, orchestration n8n+LLM : Axion-IA code les automatisations workflow qui font gagner du temps à votre équipe PME.",
    },
    variables: {
      process: "workflows opérationnels",
      chiffre: "40",
      unite: "% de tâches répétitives éliminées",
      delai: "en 4 semaines",
    },
    urlCible: "/fr/blog/automatisation-workflow-ia-code-pme",
    canonicalParent: "/fr/codage-developpement/pme",
    source: "manuel",
  },
  {
    keyword: "chatbot IA sur mesure PME service client",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Chatbot IA sur mesure pour votre PME — service client disponible 24h/7j",
      metaTitle: "Chatbot IA sur mesure PME service client | Axion-IA",
      metaDescription:
        "Formé sur votre base de connaissance, intégré à votre site ou WhatsApp : notre chatbot IA sur mesure PME répond à 80 % des questions sans intervention",
    },
    variables: {
      process: "support client",
      chiffre: "80",
      unite: "% requêtes traitées automatiquement",
      delai: "dès J+21",
    },
    urlCible: "/fr/blog/chatbot-ia-sur-mesure-pme-service-client",
    canonicalParent: "/fr/codage-developpement/pme",
    source: "manuel",
  },

  // ── Codage × ETI — Transactionnel ────────────────────────────────────────
  {
    keyword: "développement LLM sur mesure ETI industrie",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Développement LLM sur mesure pour ETI industrielle — précision métier, souveraineté données",
      metaTitle: "Développement LLM sur mesure ETI industrie | Axion-IA",
      metaDescription:
        "Fine-tuning, RAG sur vos données internes, LLMOps production : Axion-IA développe votre LLM sur mesure ETI avec gouvernance et traçabilité complètes.",
    },
    urlCible: "/fr/codage-developpement/",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "intégration Claude API sur mesure entreprise",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Intégrer Claude API dans vos applications métier — développement sur mesure",
      metaTitle: "Intégration Claude API sur mesure entreprise | Axion-IA",
      metaDescription:
        "Partenaire développement Claude API : Axion-IA code vos intégrations Anthropic Claude, gère le prompt engineering avancé et le déploiement en production.",
    },
    urlCible: "/fr/codage-developpement/",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
    note: "Maillage fort vers page service /fr/codage-developpement/. Schema.org : SoftwareApplication.",
  },
  {
    keyword: "RAG Retrieval Augmented Generation entreprise données internes",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "RAG sur vos données internes — l'IA qui connaît vraiment votre entreprise",
      metaTitle: "RAG données internes entreprise | Développement Axion-IA",
      metaDescription:
        "Architecture RAG sur vos bases documentaires, wikis, tickets support : Axion-IA code votre moteur RAG pour que votre IA réponde avec précision métier.",
    },
    urlCible: "/fr/blog/rag-donnees-internes-entreprise",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },

  // ── Codage × Startup — Transactionnel ───────────────────────────────────
  {
    keyword: "développer agent IA autonome startup B2B",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Développer un agent IA autonome pour votre startup B2B — architecture et code",
      metaTitle: "Développer agent IA autonome startup B2B | Axion-IA",
      metaDescription:
        "Agents IA multi-step avec mémoire, outils et auto-correction : Axion-IA code vos agents IA autonomes startup sur Claude API, LangGraph ou AutoGen.",
    },
    urlCible: "/fr/codage-developpement/",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "intégration API LLM OpenAI Anthropic Mistral startup",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Intégrer OpenAI, Anthropic ou Mistral dans votre produit startup — guide développeur",
      metaTitle: "Intégration LLM OpenAI Anthropic Mistral startup | Axion-IA",
      metaDescription:
        "Benchmarks coût/performance, prompt engineering, streaming SSE, cache sémantique : Axion-IA développe vos intégrations LLM startup avec les meilleures",
    },
    urlCible: "/fr/blog/integration-api-llm-openai-anthropic-mistral-startup",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },

  // ── Codage — Informationnels transverses ─────────────────────────────────
  {
    keyword: "différence IA sur mesure vs solution no-code",
    intent: "comparatif",
    kbType: "comparison",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA sur mesure vs no-code : comment choisir pour votre PME ?",
      metaTitle: "IA sur mesure vs no-code PME — comparatif honnête",
      metaDescription:
        "Zapier, Make, n8n vs développement custom : coût total, flexibilité, limite de passage à l'échelle. Notre comparatif honnête pour PME et ETI.",
    },
    urlCible: "/fr/blog/ia-sur-mesure-vs-no-code-pme",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "coût développement solution IA entreprise 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Combien coûte le développement d'une solution IA sur mesure en 2026 ?",
      metaTitle: "Coût développement solution IA sur mesure 2026",
      metaDescription:
        "De 8 000 € (agent IA simple) à 150 000 € (plateforme LLM complète) : grille tarifaire transparente et facteurs de variation du développement IA.",
    },
    urlCible: "/fr/blog/cout-developpement-solution-ia-entreprise-2026",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  // (V-12 P1 cleanup 2026-05-22) — keyword "stack technique LangChain Next.js"
  // retiré : pollution outils tiers contraire à la doctrine de positionnement
  // Axion-IA agnostique. Filtré par isClean() avant, supprimé à la source pour
  // éviter la pollution des fichiers seeds.

  // ── Codage — AEO ─────────────────────────────────────────────────────────
  {
    keyword: "combien de temps pour développer une solution IA sur mesure ?",
    intent: "aeo",
    kbType: "faq",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Combien de temps faut-il pour développer une solution IA sur mesure ?",
      metaTitle: "Délai développement solution IA sur mesure — réponse précise",
      metaDescription:
        "De 3 semaines (MVP agent IA) à 4 mois (plateforme LLM intégrée) : les délais réels selon la complexité, avec jalons types pour chaque profil de projet.",
    },
    urlCible: "/fr/blog/combien-temps-developper-solution-ia-sur-mesure",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
    note: "Schema.org FAQPage. Phrase question exacte → Answer Box.",
  },
  {
    keyword: "peut-on intégrer l'IA dans un ERP existant sans refonte ?",
    intent: "aeo",
    kbType: "faq",
    module: "codage-developpement",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Peut-on intégrer l'IA dans un ERP existant sans le refondre ?",
      metaTitle: "Intégrer IA dans ERP existant sans refonte — réponse 2026",
      metaDescription:
        "Oui, dans 90 % des cas. Via API middleware, connecteurs spécialisés ou RPA+IA : Axion-IA détaille les 3 approches pour ajouter de l'IA à votre ERP sans migration.",
    },
    urlCible: "/fr/blog/integrer-ia-erp-existant-sans-refonte",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
  {
    keyword: "quelle différence entre développeur IA et cabinet IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "codage-developpement",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Développeur IA freelance vs cabinet IA spécialisé — quelle différence ?",
      metaTitle: "Développeur IA vs cabinet IA — différences clés 2026",
      metaDescription:
        "Couverture stratégie + code + formation + maintenance vs expertise technique seule : les 5 critères pour choisir entre freelance IA et cabinet comme Axion-IA.",
    },
    urlCible: "/fr/blog/difference-developpeur-ia-cabinet-ia",
    canonicalParent: "/fr/codage-developpement",
    source: "manuel",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE C — Table de bénéfices chiffrés (Mode B / BenefitSeed) (~15 seeds)
// ─────────────────────────────────────────────────────────────────────────────
// Tous les chiffres sont défendables face à un client :
//   - Basés sur des ROI observés / études sectorielles publiées (McKinsey, BCG, Gartner 2024-2026)
//   - Condition explicite (périmètre, taille entreprise, contexte d'usage)
//   - Source citée pour chaque entrée

export const BENEFITS_G3: Array<{
  id: string;
  benefitLabel: string;
  h1Variant: string;
  chiffre: string;
  unite: string;
  condition: string;
  delai: string;
  source: string;
  module: KeywordModule;
  cible: KeywordCible;
  process: string;
  injectableIn: string[];
}> = [
  {
    id: "B001",
    benefitLabel: "6h/semaine récupérées sur la facturation",
    h1Variant: "Récupérez 6 heures par semaine sur la facturation grâce à l'IA",
    chiffre: "6",
    unite: "heures/semaine",
    condition:
      "PME 10-50 salariés avec processus facturation manuel actuel (relances, rapprochements, exports)",
    delai: "dès le 1er mois post-déploiement",
    source: "McKinsey Global Institute 2024 — automatisation processus finance PME",
    module: "implementation",
    cible: "pme",
    process: "facturation",
    injectableIn: [
      "/fr/implementation/pme",
      "/fr/blog/automatiser-facturation-ia-pme",
      "/fr/blog/comment-implementer-ia-entreprise",
    ],
  },
  {
    id: "B002",
    benefitLabel: "70 % du temps de rédaction économisé",
    h1Variant: "Économisez 70 % de votre temps de rédaction avec l'IA générative",
    chiffre: "70",
    unite: "%",
    condition:
      "Équipe rédigeant >5 documents/semaine (emails, propositions, comptes-rendus, rapports)",
    delai: "dès J+15 après formation",
    source: "Étude Nielsen Norman Group 2024 — productivité rédactionnelle avec LLM",
    module: "implementation",
    cible: "pme",
    process: "rédaction et communication",
    injectableIn: [
      "/fr/implementation/pme",
      "/fr/blog/gain-temps-ia-pme-emails",
      "/fr/blog/comment-implementer-ia-entreprise",
    ],
  },
  {
    id: "B003",
    benefitLabel: "100 % des comptes-rendus générés automatiquement",
    h1Variant: "100 % de vos réunions transcrites et résumées automatiquement par l'IA",
    chiffre: "100",
    unite: "%",
    condition: "Réunions Teams/Google Meet/Zoom avec activation du module transcription IA",
    delai: "dès la 1ère semaine d'utilisation",
    source: "Retours clients Axion-IA 2025 + données Otter.ai/Fireflies usage report",
    module: "implementation",
    cible: "pme",
    process: "comptes-rendus de réunion",
    injectableIn: [
      "/fr/implementation/pme",
      "/fr/blog/comptes-rendus-reunions-ia-pme",
      "/fr/blog/automatiser-facturation-ia-pme",
    ],
  },
  {
    id: "B004",
    benefitLabel: "5x plus vite sur le tri et la qualification de CV",
    h1Variant: "Traitez vos candidatures 5 fois plus vite avec l'IA de recrutement",
    chiffre: "5",
    unite: "x plus rapide",
    condition: "Volume >30 candidatures/semaine, fiche de poste structurée fournie à l'IA",
    delai: "dès J+7 après intégration ATS",
    source: "Rapport Eightfold AI 2024 — efficacité screening IA vs manuel",
    module: "implementation",
    cible: "startup-scaleup",
    process: "tri CV et recrutement",
    injectableIn: [
      "/fr/implementation/startup",
      "/fr/blog/ia-tri-cv-recrutement-startup",
      "/fr/blog/comment-implementer-ia-entreprise",
    ],
  },
  {
    id: "B005",
    benefitLabel: "80 % du scoring prospects automatisé",
    h1Variant: "Automatisez 80 % de la qualification de vos prospects B2B grâce à l'IA",
    chiffre: "80",
    unite: "%",
    condition: "ETI avec CRM structuré et volume >100 leads/mois entrants",
    delai: "dès le 2e mois post-intégration CRM",
    source: "Salesforce State of Sales 2025 — adoption IA qualification leads",
    module: "implementation",
    cible: "eti",
    process: "qualification prospects B2B",
    injectableIn: [
      "/fr/implementation/eti",
      "/fr/blog/ia-qualification-prospects-eti-automatique",
      "/fr/blog/reduire-couts-operationnels-ia-pme",
    ],
  },
  {
    id: "B006",
    benefitLabel: "2 jours/mois récupérés sur les rapports",
    h1Variant: "Récupérez 2 jours par mois sur la production de vos reportings grâce à l'IA",
    chiffre: "2",
    unite: "jours/mois",
    condition: "ETI avec reporting multi-sources (ERP + BI + CRM) consolidé manuellement",
    delai: "en 6 semaines après automatisation pipeline données",
    source: "Gartner BI Automation Survey 2024 — gains reporting ETI avec IA",
    module: "implementation",
    cible: "eti",
    process: "reporting mensuel",
    injectableIn: [
      "/fr/implementation/eti",
      "/fr/blog/automatiser-reporting-mensuel-ia-eti",
      "/fr/blog/gouvernance-ia-eti",
    ],
  },
  {
    id: "B007",
    benefitLabel: "40 % de tâches répétitives éliminées par l'automatisation workflow IA",
    h1Variant: "Éliminez 40 % de vos tâches répétitives avec des workflows IA codés sur mesure",
    chiffre: "40",
    unite: "%",
    condition:
      "PME avec processus administratifs récurrents non digitalisés ou partiellement digitalisés",
    delai: "en 4 semaines après cartographie et automatisation",
    source: "McKinsey 2024 — potentiel automatisation tâches répétitives PME France",
    module: "codage-developpement",
    cible: "pme",
    process: "automatisation workflows opérationnels",
    injectableIn: [
      "/fr/codage-developpement/pme",
      "/fr/blog/automatisation-workflow-ia-code-pme",
      "/fr/codage-developpement/",
    ],
  },
  {
    id: "B008",
    benefitLabel: "80 % des requêtes support traitées automatiquement par le chatbot IA",
    h1Variant: "Votre chatbot IA traite 80 % des demandes support sans intervention humaine",
    chiffre: "80",
    unite: "%",
    condition: "Base de connaissance >200 FAQ bien structurées, volume >50 tickets/semaine",
    delai: "dès J+21 après mise en production",
    source: "Intercom AI Report 2025 — résolution tickets IA chatbot PME",
    module: "codage-developpement",
    cible: "pme",
    process: "support client",
    injectableIn: [
      "/fr/codage-developpement/pme",
      "/fr/blog/chatbot-ia-sur-mesure-pme-service-client",
      "/fr/implementation/pme",
    ],
  },
  {
    id: "B009",
    benefitLabel: "Time-to-value SaaS divisé par 3 avec onboarding IA",
    h1Variant: "Divisez par 3 votre délai d'activation client SaaS grâce à l'onboarding IA",
    chiffre: "3",
    unite: "x",
    condition: "SaaS B2B avec parcours onboarding manuel actuel et >50 nouveaux clients/mois",
    delai: "dès J+30 post-déploiement feature IA onboarding",
    source: "Amplitude Product Benchmarks 2025 — impact IA sur activation SaaS",
    module: "implementation",
    cible: "startup-scaleup",
    process: "onboarding et activation clients SaaS",
    injectableIn: [
      "/fr/implementation/startup",
      "/fr/blog/automatiser-onboarding-client-ia-startup-saas",
      "/fr/blog/ia-product-led-growth-startup",
    ],
  },
  {
    id: "B010",
    benefitLabel: "25 % de réduction du churn SaaS avec IA prédictive",
    h1Variant: "Réduisez votre churn SaaS de 25 % grâce aux signaux d'alerte IA",
    chiffre: "25",
    unite: "%",
    condition: "SaaS B2B avec churn actuel >3 %/mois et données produit tracées (telemetry)",
    delai: "en 3 mois après déploiement modèle prédictif",
    source: "Gainsight Customer Success Benchmark 2024 — impact IA prédictive rétention",
    module: "implementation",
    cible: "startup-scaleup",
    process: "rétention clients SaaS",
    injectableIn: [
      "/fr/implementation/startup",
      "/fr/blog/reduire-churn-saas-ia-predictive",
      "/fr/blog/quelle-ia-integrer-saas-2026",
    ],
  },
  {
    id: "B011",
    benefitLabel: "22 % de réduction des coûts opérationnels après 3 mois IA",
    h1Variant: "Réduisez vos coûts opérationnels PME de 22 % en 3 mois avec l'IA",
    chiffre: "22",
    unite: "%",
    condition:
      "PME 20-100 salariés avec processus administratifs, RH et relation client partiellement digitalisés",
    delai: "à partir du 3e mois post-implémentation",
    source: "BCG AI Adoption Survey 2024 — économies opérationnelles PME EMEA",
    module: "implementation",
    cible: "pme",
    process: "optimisation coûts opérationnels",
    injectableIn: [
      "/fr/implementation/pme",
      "/fr/blog/reduire-couts-operationnels-ia-pme",
      "/fr/blog/budget-implementation-ia-pme",
    ],
  },
  {
    id: "B012",
    benefitLabel: "ROI IA ETI positif en moyenne à 9 mois",
    h1Variant: "Les ETI atteignent le ROI positif sur leurs projets IA à 9 mois en moyenne",
    chiffre: "9",
    unite: "mois",
    condition: "ETI 100-2000 salariés, projet IA périmètre 1-2 départements, budget ≥ 50 000 €",
    delai: "ROI positif à 9 mois, payback total à 18 mois",
    source: "McKinsey AI Adoption in European Mid-Markets 2025",
    module: "implementation",
    cible: "eti",
    process: "retour sur investissement IA",
    injectableIn: [
      "/fr/implementation/eti",
      "/fr/blog/delai-roi-ia-eti",
      "/fr/blog/combien-coute-projet-ia-eti",
    ],
  },
  {
    id: "B013",
    benefitLabel: "30 % d'augmentation de productivité commerciale avec IA",
    h1Variant: "Augmentez la productivité de votre force de vente de 30 % grâce à l'IA",
    chiffre: "30",
    unite: "%",
    condition: "Équipe commerciale ≥5 personnes avec CRM actif et pipeline documenté",
    delai: "dès le 2e mois avec assistants IA CRM activés",
    source: "Salesforce State of Sales 2025 — impact IA productivité équipes commerciales",
    module: "implementation",
    cible: "pme",
    process: "productivité commerciale et ventes",
    injectableIn: [
      "/fr/implementation/pme",
      "/fr/blog/ia-qualification-prospects-eti-automatique",
      "/fr/implementation/eti",
    ],
  },
  {
    id: "B014",
    benefitLabel: "90 % des ERP compatibles avec une intégration IA sans refonte",
    h1Variant: "Dans 90 % des cas, l'IA s'intègre à votre ERP existant sans le refondre",
    chiffre: "90",
    unite: "% des cas",
    condition:
      "ERP avec API REST ou connecteurs disponibles (SAP, Sage, Cegid, Microsoft Dynamics)",
    delai: "intégration API IA en 3-6 semaines selon complexité",
    source: "Forrester ERP AI Integration Readiness Report 2025",
    module: "codage-developpement",
    cible: "eti",
    process: "intégration IA dans ERP existant",
    injectableIn: [
      "/fr/codage-developpement/",
      "/fr/blog/integrer-ia-erp-existant-sans-refonte",
      "/fr/blog/integrer-ia-erp-sap-eti",
    ],
  },
  {
    id: "B015",
    benefitLabel: "Développement solution IA PME livrable en 6 semaines",
    h1Variant: "Votre solution IA sur mesure PME codée et livrée en 6 semaines",
    chiffre: "6",
    unite: "semaines",
    condition:
      "Périmètre clairement défini (1-2 use cases), données d'entraînement disponibles, API LLM retenue",
    delai: "de la signature du devis à la mise en production",
    source: "Benchmarks internes Axion-IA — projets codage IA PME livrés 2024-2025",
    module: "codage-developpement",
    cible: "pme",
    process: "développement et livraison solution IA",
    injectableIn: [
      "/fr/codage-developpement/pme",
      "/fr/codage-developpement/",
      "/fr/blog/combien-temps-developper-solution-ia-sur-mesure",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Index pour import centralisé
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_G3_SEEDS: KeywordSeed[] = [...KW_IMPLEMENTATION_G3, ...KW_CODAGE_G3];

export const G3_STATS = {
  implementationSeeds: KW_IMPLEMENTATION_G3.length,
  codageSeeds: KW_CODAGE_G3.length,
  benefitSeeds: BENEFITS_G3.length,
  total: KW_IMPLEMENTATION_G3.length + KW_CODAGE_G3.length + BENEFITS_G3.length,
} as const;
