/**
 * Keyword Seeds — MODE G PHASE 2
 * Module : interventions-formations
 * Cibles : tpe | pme | eti | ecole-privee | organisme-formation
 * Généré le 2026-05-20 par le Keyword Strategist Axion-IA
 *
 * ~15 seeds × 5 cibles = 75 seeds.
 * Distribution : D1 transactionnel (3-4) · D2 bénéfice (3-4) · D3 informationnel (3-4) · D4 AEO (3-4)
 * Règles :
 *   - niveau 1 → priorite ≥ 2 (HEAD ne s'attaque pas en priorite 1)
 *   - H1 toujours bénéfice, jamais keyword brut (règle R5)
 *   - metaTitle ≤ 60 chars · metaDescription ≤ 155 chars
 */

import type { KeywordSeed } from "./types";

export const KW_INTERVENTIONS_G2: KeywordSeed[] = [
  // ─────────────────────────────────────────────
  // CIBLE : TPE (≤ 10 salariés)
  // ─────────────────────────────────────────────

  {
    keyword: "formation IA pour TPE",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Formez votre TPE à l'IA — résultats concrets dès J+1",
      metaTitle: "Formation IA pour TPE — demi-journée ou journée",
      metaDescription:
        "Cabinet IA spécialisé TPE : formation sur site 4h ou 1 jour, cas réels de votre équipe, zéro jargon. Résultats mesurables dès la première semaine.",
      h2Variants: [
        "Pourquoi une TPE a tout à gagner à former ses équipes à l'IA",
        "Format 4h ou 1 jour : ce que vos collaborateurs maîtrisent en sortant",
        "Exemples concrets pour TPE : facturation, relance clients, rédaction",
      ],
    },
    variables: {
      process: "gestion quotidienne (devis, relances, planning)",
      resultat: "2h économisées par jour et par personne",
      chiffre: "2",
      unite: "h/jour",
      delai: "dès la 1re semaine",
    },
    urlCible: "/fr/interventions-formations/tpe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "BODY (niveau 2) · Pas de volume officiel mais intention forte TPE · schema.org Course",
  },

  {
    keyword: "agence IA formation équipe petite entreprise",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Votre agence IA pour former votre équipe — même 2 personnes",
      metaTitle: "Agence IA : formation équipe TPE sur site",
      metaDescription:
        "Axion-IA forme les équipes de petites entreprises à l'IA générative : session 4h sur vos vrais cas métier. Groupe de 2 à 15 personnes.",
      h2Variants: [
        "Ce que change une demi-journée d'IA sur vos outils du quotidien",
        "Nous adaptons chaque session aux cas réels de votre structure",
        "Tarif transparent : session forfait demi-journée ou journée complète",
      ],
    },
    variables: {
      process: "productivité bureautique et relation client",
      resultat: "autonomie IA complète en une session",
      chiffre: "4",
      unite: "heures",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/tpe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · cible décideur TPE cherchant prestataire",
  },

  {
    keyword: "cabinet IA intervention sur site TPE",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Un expert IA directement dans vos locaux — pour votre TPE",
      metaTitle: "Cabinet IA · intervention sur site TPE France",
      metaDescription:
        "Axion-IA se déplace dans vos locaux pour former vos équipes à l'IA. Format 4h ou 1 jour, exercices sur vos vrais dossiers. Devis sous 24h.",
      h2Variants: [
        "L'intervention sur site : pourquoi ça change tout pour une TPE",
        "Déroulé type d'une session 4h chez vous",
        "Régions couvertes et modalités de déplacement",
      ],
    },
    variables: {
      process: "adoption IA en situation réelle",
      resultat: "équipe autonome sur les outils IA du marché",
      chiffre: "1",
      unite: "journée",
      delai: "sous 15 jours calendaires",
    },
    urlCible: "/fr/interventions-formations/tpe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · différenciateur sur site vs en ligne · schema.org Event",
  },

  {
    keyword: "ROI formation IA pour petite entreprise",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA TPE : calculez votre retour sur investissement réel",
      metaTitle: "ROI formation IA petite entreprise — calcul concret",
      metaDescription:
        "Une session formation IA de 4h représente combien d'heures économisées ? Calculateur ROI + retours d'expérience TPE avec Axion-IA.",
      h2Variants: [
        "Méthode de calcul ROI formation IA adaptée aux TPE",
        "Exemples chiffrés : avant / après pour 5 métiers TPE courants",
        "Quand la formation IA se rembourse-t-elle pour une TPE ?",
      ],
    },
    variables: {
      process: "calcul ROI formation",
      resultat: "remboursée en moins d'un mois",
      chiffre: "3",
      unite: "semaines",
      delai: "en moins d'un mois",
    },
    urlCible: "/fr/interventions-formations/tpe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · ancre calculateur ROI embarqué dans la page",
  },

  {
    keyword: "gains productivité IA pour artisans et commerçants",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Artisans et commerçants : gagnez 2h par jour grâce à l'IA",
      metaTitle: "IA pour artisans : +2h/jour, formation 4h sur site",
      metaDescription:
        "Devis auto, relances clients, rédaction offres : nos formateurs IA montrent aux artisans et commerçants comment gagner du temps dès J+1.",
      h2Variants: [
        "5 tâches que l'IA gère à votre place dès aujourd'hui",
        "Session 4h : ce que maîtrisent les artisans en fin de journée",
        "Témoignages de TPE artisanales formées par Axion-IA",
      ],
    },
    variables: {
      process: "devis, relance clients, rédaction fiches produit",
      resultat: "+2h libérées par jour",
      chiffre: "2",
      unite: "h/jour",
      delai: "dès J+1",
    },
    urlCible: "/fr/interventions-formations/tpe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · secteur artisanat/commerce · long tail géographique possible",
  },

  {
    keyword: "comment former ses salariés à l'IA dans une TPE",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Former ses salariés à l'IA en TPE : guide pratique 2026",
      metaTitle: "Former ses salariés à l'IA en TPE — guide 2026",
      metaDescription:
        "Quels outils IA pour une TPE ? Comment organiser la formation ? Quels résultats attendre ? Guide complet avec exemples concrets et grille de formation.",
      h2Variants: [
        "Étape 1 : identifier les tâches à automatiser dans votre TPE",
        "Choisir le bon format de formation (4h, 1 jour, 2 jours)",
        "Mesurer les résultats après la formation IA",
      ],
    },
    variables: {
      process: "diagnostic + formation + mesure résultats",
      resultat: "équipe autonome sur 3 cas métier minimum",
      chiffre: "3",
      unite: "cas métier maîtrisés",
      delai: "en une journée",
    },
    urlCible: "/fr/blog/former-salaries-ia-tpe",
    canonicalParent: "/fr/interventions-formations/tpe",
    source: "manuel",
    note: "D3 informationnel · blog · intent dirigeant TPE débutant IA",
  },

  {
    keyword: "quel outil IA pour une petite entreprise débutante",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "TPE débutante en IA : quels outils choisir en 2026 ?",
      metaTitle: "Outils IA pour TPE débutante — guide choix 2026",
      metaDescription:
        "ChatGPT, Copilot, Notion AI… Quels outils IA adopter en priorité pour une TPE ? Notre guide sélectionne 5 outils opérationnels dès la 1re semaine.",
      h2Variants: [
        "Les 5 outils IA à adopter en premier quand on est TPE",
        "Comment tester un outil IA sans risque ni coût excessif",
        "Formation courte : passer d'outil inconnu à outil maîtrisé en 4h",
      ],
    },
    variables: {
      process: "sélection et prise en main d'outils IA",
      resultat: "5 outils opérationnels en 1 semaine",
      chiffre: "5",
      unite: "outils maîtrisés",
      delai: "dès la 1re semaine",
    },
    urlCible: "/fr/blog/outils-ia-tpe-debutante",
    canonicalParent: "/fr/interventions-formations/tpe",
    source: "manuel",
    note: "D3 informationnel · passerelle blog → page service TPE",
  },

  {
    keyword: "est-ce que l'IA peut vraiment aider une TPE de 3 personnes ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA peut-elle aider une TPE de 3 personnes ? Réponse honnête.",
      metaTitle: "L'IA aide-t-elle vraiment une TPE de 3 personnes ?",
      metaDescription:
        "Oui : une TPE de 3 personnes économise en moyenne 4h/semaine après une formation IA d'une demi-journée. Exemples réels et cas pratiques inclus.",
      h2Variants: [
        "Ce que l'IA fait réellement pour une toute petite équipe",
        "Ce que l'IA ne peut pas (encore) faire pour vous",
        "Retour d'expérience : TPE 3 personnes, secteur services, après 1 mois",
      ],
    },
    variables: {
      process: "tâches répétitives : emails, devis, recherche d'info",
      resultat: "4h libérées par semaine pour 3 personnes",
      chiffre: "4",
      unite: "h/semaine",
      delai: "après 1 mois",
    },
    urlCible: "/fr/faq/ia-aide-tpe-3-personnes",
    canonicalParent: "/fr/interventions-formations/tpe",
    source: "manuel",
    note: "D4 AEO · format FAQ · schema.org FAQPage · réponse vocale/SGE probable",
  },

  {
    keyword: "combien coûte une formation IA pour une TPE ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Prix d'une formation IA pour TPE : fourchette et ce qui est inclus",
      metaTitle: "Tarif formation IA TPE — fourchette réelle 2026",
      metaDescription:
        "Une demi-journée de formation IA sur site pour TPE coûte entre X et Y €. Découvrez ce qui est inclus et le calcul ROI.",
      h2Variants: [
        "Fourchette de prix selon le format (4h, 1j, 2j)",
        "Options de financement disponibles",
        "Calcul ROI : quand la formation est-elle remboursée ?",
      ],
    },
    variables: {
      process: "tarification formation IA sur site",
      resultat: "investissement amorti en moins de 3 semaines",
      chiffre: "3",
      unite: "semaines",
      delai: "avant remboursement",
    },
    urlCible: "/fr/faq/cout-formation-ia-tpe",
    canonicalParent: "/fr/interventions-formations/tpe",
    source: "manuel",
    note: "D4 AEO · question prix · schema.org FAQPage · fort taux de conversion",
  },

  // ─────────────────────────────────────────────
  // CIBLE : PME (10-250 salariés)
  // ─────────────────────────────────────────────

  {
    keyword: "formation IA pour PME française",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Formez vos équipes PME à l'IA — résultats dès J+1 sur vos vrais cas",
      metaTitle: "Formation IA pour PME — sur site, cas réels",
      metaDescription:
        "Cabinet IA spécialisé PME : sessions 1 à 3 jours sur site, exercices sur vos dossiers réels. Équipes autonomes, ROI mesurable sous 30 jours.",
      h2Variants: [
        "Pourquoi la formation IA sur site dépasse les MOOCs pour les PME",
        "Formats disponibles : 1 jour, 2 jours, 3 jours ou cycle modulaire",
        "Résultats typiques observés dans les PME formées",
      ],
    },
    variables: {
      process: "productivité transversale PME (RH, compta, commercial, ops)",
      resultat: "–30 % de tâches manuelles répétitives",
      chiffre: "30",
      unite: "%",
      delai: "en 30 jours",
    },
    urlCible: "/fr/interventions-formations/pme",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "BODY · forte intention achat · schéma Course + Organization · priorite 1 niveau 2 OK",
  },

  {
    keyword: "cabinet IA formation équipes PME sur site",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Cabinet IA dédié PME : formation sur site, sans jargon, avec vos cas",
      metaTitle: "Cabinet IA · formation PME sur site — Axion-IA",
      metaDescription:
        "Axion-IA, cabinet IA B2B : intervention sur site dans votre PME. Formateurs experts, exercices sur vos vrais dossiers. Devis 24h.",
      h2Variants: [
        "Ce qui distingue Axion-IA des formateurs IA généralistes",
        "Déroulé type d'une session 2 jours pour une équipe PME de 15 personnes",
        "Accompagnement post-formation : 30 jours de questions/réponses inclus",
      ],
    },
    variables: {
      process: "formation sur cas réels métier PME",
      resultat: "équipe autonome sur 5 cas métier en 2 jours",
      chiffre: "5",
      unite: "cas métier",
      delai: "en 2 jours",
    },
    urlCible: "/fr/interventions-formations/pme",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne transactionnel · cible DAF/DRH PME",
  },

  {
    keyword: "agence IA intervention formation département RH PME",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Former votre département RH à l'IA — résultats dès J+1",
      metaTitle: "Formation IA département RH PME — Axion-IA",
      metaDescription:
        "Tri CV, entretiens, onboarding : nos formateurs IA spécialisés RH forment votre équipe sur vos outils SIRH réels. Session 1 ou 2 jours.",
      h2Variants: [
        "5 cas IA concrets pour une équipe RH de PME",
        "Ce que change l'IA sur le tri CV et la pré-sélection",
        "Format recommandé pour une équipe RH de 4 à 8 personnes",
      ],
    },
    variables: {
      process: "tri CV, onboarding, plan de formation, entretiens annuels",
      resultat: "–60 % de temps sur tri CV et pré-sélection",
      chiffre: "60",
      unite: "%",
      delai: "dès la formation",
    },
    urlCible: "/fr/interventions-formations/pme",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · angle département RH · schema.org Course secteur",
  },

  {
    keyword: "réduire les coûts opérationnels PME grâce à l'IA",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "interventions-formations",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Réduisez vos coûts opérationnels PME : l'IA, levier n°1 en 2026",
      metaTitle: "Réduire coûts opérationnels PME avec l'IA — guide",
      metaDescription:
        "Formation IA pour PME : comment réduire de 20 à 35 % les coûts de traitement des tâches répétitives. Calculateur + cas réels PME françaises.",
      h2Variants: [
        "Les 4 postes de coûts que l'IA réduit le plus vite en PME",
        "Calculateur : combien économisez-vous en formant 10 personnes ?",
        "Étude de cas PME : –28 % de coûts administratifs en 6 semaines",
      ],
    },
    variables: {
      process: "administration, facturation, relances, reporting",
      resultat: "–28 % coûts admin en 6 semaines",
      chiffre: "28",
      unite: "%",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/interventions-formations/pme",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · calculateur ROI embarqué · priorite 1 niveau 3 OK",
  },

  {
    keyword: "productivité équipe commerciale PME avec l'intelligence artificielle",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA pour votre force de vente PME : +30 % de productivité commerciale",
      metaTitle: "IA & équipe commerciale PME — +30 % productivité",
      metaDescription:
        "Préparer les rendez-vous, rédiger les propositions, relancer les prospects : formez vos commerciaux PME à l'IA et gagnez 1h par jour par vendeur.",
      h2Variants: [
        "Les 6 tâches commerciales que l'IA automatise en PME",
        "Session 1 jour pour une équipe commerciale de 5 à 20 personnes",
        "Résultats observés : taux de conversion et temps de cycle de vente",
      ],
    },
    variables: {
      process: "prospection, rédaction offres, suivi CRM, relance",
      resultat: "+1h par commercial par jour, +15 % taux de closing",
      chiffre: "1",
      unite: "h/vendeur/jour",
      delai: "dès J+1",
    },
    urlCible: "/fr/interventions-formations/pme",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · angle force de vente · secteur commercial PME",
  },

  {
    keyword: "comment organiser une formation IA pour ses équipes en PME",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Organiser une formation IA en PME : guide étape par étape 2026",
      metaTitle: "Organiser formation IA PME — guide 2026",
      metaDescription:
        "De la définition des besoins au bilan post-formation : comment planifier une formation IA pour vos équipes PME sans perturber l'activité. Guide complet.",
      h2Variants: [
        "Étape 1 : cartographier les tâches à fort potentiel IA",
        "Choisir le bon prestataire et le bon format (1j, 2j, cycle)",
        "Mesurer l'impact : KPIs à suivre pendant les 30 jours post-formation",
      ],
    },
    variables: {
      process: "planification formation IA PME",
      resultat: "formation sans disruption + ROI mesuré à 30j",
      chiffre: "30",
      unite: "jours",
      delai: "bilan à 30j",
    },
    urlCible: "/fr/blog/organiser-formation-ia-pme",
    canonicalParent: "/fr/interventions-formations/pme",
    source: "manuel",
    note: "D3 informationnel · guide long · passerelle vers devis",
  },

  {
    keyword: "quelles compétences IA développer en priorité pour une PME",
    intent: "informationnel",
    kbType: "competence_boost",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "PME : les 8 compétences IA à développer en priorité en 2026",
      metaTitle: "Compétences IA prioritaires en PME — top 8 2026",
      metaDescription:
        "Prompt engineering, lecture de données, automatisation de flux : les 8 compétences IA que toute PME doit maîtriser en 2026. Grille d'auto-évaluation incluse.",
      h2Variants: [
        "Les 8 compétences IA incontournables pour les PME en 2026",
        "Comment auto-évaluer le niveau IA actuel de votre équipe",
        "Plan de montée en compétences selon le niveau de départ",
      ],
    },
    variables: {
      process: "montée en compétences IA transversales",
      resultat: "8 compétences clés maîtrisées en 2 jours",
      chiffre: "8",
      unite: "compétences",
      delai: "en 2 jours",
    },
    urlCible: "/fr/blog/competences-ia-prioritaires-pme",
    canonicalParent: "/fr/interventions-formations/pme",
    source: "manuel",
    note: "D3 informationnel · contenu haute valeur · lien interne vers /pme",
  },

  {
    keyword: "quelle durée de formation IA est efficace pour une PME ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA PME : quelle durée choisir pour de vrais résultats ?",
      metaTitle: "Durée formation IA PME : 4h, 1j ou 2j ?",
      metaDescription:
        "4h pour les fondamentaux, 1 jour pour l'autonomie sur 3 cas, 2 jours pour transformer durablement les pratiques : guide de choix selon vos objectifs PME.",
      h2Variants: [
        "Que couvre réellement une formation IA de 4 heures ?",
        "Quand opter pour une session 2 jours plutôt que 2 × 1 jour ?",
        "Cycle modulaire : l'option idéale pour les équipes PME > 20 personnes",
      ],
    },
    variables: {
      process: "choix du format formation IA",
      resultat: "équipe autonome selon le format choisi",
      chiffre: "3",
      unite: "formats disponibles (4h / 1j / 2j)",
      delai: "résultats dès la fin de session",
    },
    urlCible: "/fr/faq/duree-formation-ia-pme",
    canonicalParent: "/fr/interventions-formations/pme",
    source: "manuel",
    note: "D4 AEO · FAQ · schema.org FAQPage · intent présent dans recherches vocales",
  },

  // ─────────────────────────────────────────────
  // CIBLE : ETI (250-5000 salariés)
  // ─────────────────────────────────────────────

  {
    keyword: "formation IA ETI programme multi-équipes",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "eti",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Programme de formation IA pour ETI : montée en compétences à l'échelle",
      metaTitle: "Formation IA ETI — programme multi-équipes sur site",
      metaDescription:
        "Axion-IA déploie des programmes IA sur mesure pour les ETI : sessions multi-sites, formats 1j à 3j+, cas réels par département. ROI mesuré.",
      h2Variants: [
        "Déployer la formation IA sur 3 sites en 6 semaines : comment ça marche",
        "Formats adaptés aux ETI : parcours modulaires par département",
        "Gouvernance IA ETI : comment éviter la dispersion des usages",
      ],
    },
    variables: {
      process: "déploiement formation IA multi-équipes",
      resultat: "200 collaborateurs formés en 6 semaines",
      chiffre: "200",
      unite: "collaborateurs",
      delai: "en 6 semaines",
    },
    urlCible: "/fr/interventions-formations/eti",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "BODY · priorite 1 niveau 2 OK · cible DRH/COMEX ETI",
  },

  {
    keyword: "cabinet IA intervenant formation transformation digitale ETI",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "eti",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Cabinet IA spécialisé ETI : accélérez votre transformation IA",
      metaTitle: "Cabinet IA · transformation ETI par la formation",
      metaDescription:
        "Axion-IA accompagne les ETI dans leur transformation IA : audit des besoins, plan de formation sur mesure, déploiement multi-équipes. Cadrage offert.",
      h2Variants: [
        "Diagnostic préalable : cartographier les besoins IA de votre ETI",
        "Plan de formation IA sur 3 à 6 mois pour 50 à 500 collaborateurs",
        "Change management IA : gérer la résistance et pérenniser les usages",
      ],
    },
    variables: {
      process: "transformation IA structurée ETI",
      resultat: "plan IA opérationnel en 3 mois",
      chiffre: "3",
      unite: "mois",
      delai: "plan opérationnel à 3 mois",
    },
    urlCible: "/fr/interventions-formations/eti",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne transactionnel · cible COMEX/DSI ETI",
  },

  {
    keyword: "agence IA plan de montée en compétences IA ETI",
    intent: "transactionnel",
    kbType: "implementation_playbook",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Plan de montée en compétences IA pour votre ETI — Axion-IA",
      metaTitle: "Plan montée compétences IA ETI — Axion-IA",
      metaDescription:
        "Axion-IA construit votre plan de formation IA sur mesure : cartographie des métiers, niveaux de départ, séquençage des sessions. Livrable en 2 semaines.",
      h2Variants: [
        "Comment cartographier les besoins IA de chaque département",
        "Séquencer les sessions pour ne pas impacter la production",
        "Livrables attendus : plan détaillé, supports, suivi 90 jours",
      ],
    },
    variables: {
      process: "construction plan formation IA ETI",
      resultat: "plan livré en 2 semaines, déploiement dès semaine 3",
      chiffre: "2",
      unite: "semaines",
      delai: "livrable plan en 2 semaines",
    },
    urlCible: "/fr/interventions-formations/eti",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · cible RRH/DRH ETI · mots-clés formation plan",
  },

  {
    keyword: "impact IA sur la performance des équipes ETI",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et performance ETI : chiffres réels et leviers prioritaires",
      metaTitle: "Impact IA sur performance ETI — données 2026",
      metaDescription:
        "Études de cas ETI françaises : comment la formation IA a amélioré la productivité de 25 à 40 % sur les fonctions support en 90 jours.",
      h2Variants: [
        "Benchmark : performance des ETI françaises après formation IA",
        "Les 3 fonctions où l'IA performe le plus vite en ETI",
        "Gouvernance et mesure : comment piloter l'impact IA à l'échelle ETI",
      ],
    },
    variables: {
      process: "performance fonctions support : finance, RH, juridique, achats",
      resultat: "+35 % de productivité sur fonctions support en 90 jours",
      chiffre: "35",
      unite: "%",
      delai: "en 90 jours",
    },
    urlCible: "/fr/interventions-formations/eti",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · argument COMEX · benchmarks crédibles",
  },

  {
    keyword: "comment déployer l'IA dans une ETI sans perturber les opérations",
    intent: "informationnel",
    kbType: "implementation_playbook",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Déployer l'IA en ETI sans disruption : méthode Axion-IA",
      metaTitle: "Déployer l'IA en ETI sans disruption — méthode",
      metaDescription:
        "Comment former 200 collaborateurs à l'IA sans impacter la production ? Séquençage, change management, quick wins par département. Méthode éprouvée.",
      h2Variants: [
        "Les 4 erreurs classiques lors d'un déploiement IA en ETI",
        "Séquencer les formations pour préserver la continuité de service",
        "Change management IA : comment embarquer les managers intermédiaires",
      ],
    },
    variables: {
      process: "déploiement IA progressif ETI",
      resultat: "0 disruption opérationnelle + 90 % d'adoption à 3 mois",
      chiffre: "90",
      unite: "% adoption",
      delai: "à 3 mois",
    },
    urlCible: "/fr/blog/deployer-ia-eti-sans-disruption",
    canonicalParent: "/fr/interventions-formations/eti",
    source: "manuel",
    note: "D3 informationnel · long-form · cible DSI/DRH ETI",
  },

  {
    keyword: "formation IA pour équipes de direction ETI",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Former votre CODIR à l'IA : session 1 jour décideurs ETI",
      metaTitle: "Formation IA CODIR ETI — session dirigeants 1 jour",
      metaDescription:
        "Formez votre comité de direction à l'IA en 1 journée : enjeux stratégiques, cas d'usage par fonction, décisions à prendre. Session confidentielle sur site.",
      h2Variants: [
        "Ce qu'un CODIR doit comprendre de l'IA en 2026",
        "Programme type d'une journée IA pour dirigeants ETI",
        "Après la session : les 5 décisions stratégiques à prendre rapidement",
      ],
    },
    variables: {
      process: "sensibilisation et décision stratégique IA dirigeants",
      resultat: "CODIR aligné + plan IA voté en fin de session",
      chiffre: "1",
      unite: "journée",
      delai: "plan voté en fin de session",
    },
    urlCible: "/fr/interventions-formations/eti",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D1 transactionnel · format exclusif CODIR · angle stratégique vs opérationnel",
  },

  {
    keyword: "est-il rentable de former toute son ETI à l'IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Former toute une ETI à l'IA : rentable ou non ? Chiffres réels.",
      metaTitle: "Rentabilité formation IA ETI complète — analyse",
      metaDescription:
        "Former 200 personnes à l'IA sur 6 semaines : coût réel, gains mesurés, délai de retour sur investissement. Analyse chiffrée pour décideurs ETI.",
      h2Variants: [
        "Coût total d'un programme de formation IA pour 200 personnes",
        "Gains mesurés à 3, 6 et 12 mois après déploiement",
        "À quel seuil la formation IA devient-elle rentable en ETI ?",
      ],
    },
    variables: {
      process: "calcul ROI programme formation IA ETI",
      resultat: "ROI positif à partir du 4e mois",
      chiffre: "4",
      unite: "mois",
      delai: "ROI positif à 4 mois",
    },
    urlCible: "/fr/faq/rentabilite-formation-ia-eti",
    canonicalParent: "/fr/interventions-formations/eti",
    source: "manuel",
    note: "D4 AEO · question COMEX / DAF · schema.org FAQPage",
  },

  // ─────────────────────────────────────────────
  // CIBLE : ÉCOLE PRIVÉE
  // ─────────────────────────────────────────────

  {
    keyword: "conférencier IA pour école de commerce privée",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Conférencier IA pour votre école : masterclass inspirante et actionnable",
      metaTitle: "Conférencier IA école privée — masterclass Axion-IA",
      metaDescription:
        "Axion-IA intervient en conférence dans votre école de commerce, d'ingénieurs ou de design : IA générative, enjeux 2026, cas concrets par filière. Devis 24h.",
      h2Variants: [
        "Thèmes de conférence IA disponibles pour les grandes écoles",
        "Format masterclass 2h ou demi-journée avec ateliers pratiques",
        "Comment personnaliser l'intervention à votre programme et votre promo",
      ],
    },
    variables: {
      process: "conférence IA en école privée",
      resultat: "100 % des étudiants repartent avec 3 prompts opérationnels",
      chiffre: "3",
      unite: "prompts opérationnels",
      delai: "en fin de session",
    },
    urlCible: "/fr/interventions-formations/ecoles",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "BODY · cible responsables pédagogiques école privée · schema.org Event",
  },

  {
    keyword: "module IA programme grande école ingénieurs",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Module IA clé en main pour intégrer l'IA dans votre programme Grande École",
      metaTitle: "Module IA programme Grande École — Axion-IA",
      metaDescription:
        "Axion-IA co-conçoit le module IA de votre programme d'ingénieurs ou de management : contenus, exercices, évaluations. Accréditable RNCP.",
      h2Variants: [
        "Structure type d'un module IA de 15h pour une grande école",
        "Compétences visées et référentiel pédagogique 2026",
        "Modalités de co-conception avec vos équipes pédagogiques",
      ],
    },
    variables: {
      process: "co-conception module IA accréditable",
      resultat: "module de 15h opérationnel en 6 semaines",
      chiffre: "15",
      unite: "heures de module",
      delai: "livré en 6 semaines",
    },
    urlCible: "/fr/interventions-formations/ecoles",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · cible directeur pédagogique grande école · angle RNCP",
  },

  {
    keyword: "formateur IA certifié école privée management",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formateur IA pour votre école de management : expertise terrain, sans jargon",
      metaTitle: "Formateur IA école de management — Axion-IA",
      metaDescription:
        "Axion-IA fournit des formateurs IA praticiens pour vos cours de management : prompt engineering, automatisation, éthique IA. Conventions signées sous 48h.",
      h2Variants: [
        "Profil des formateurs Axion-IA : practitioners et non théoriciens",
        "Modules IA disponibles pour les programmes de management",
        "Processus de convention et d'intégration dans votre grille horaire",
      ],
    },
    variables: {
      process: "intégration formateur IA dans programme management",
      resultat: "formateur opérationnel en 2 semaines",
      chiffre: "2",
      unite: "semaines",
      delai: "formateur intégré en 2 semaines",
    },
    urlCible: "/fr/interventions-formations/ecoles",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · angle formateur externe récurrent · cible directeur études",
  },

  {
    keyword: "intégrer l'IA générative dans un cursus universitaire privé",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA générative dans l'enseignement privé : guide pédagogique 2026",
      metaTitle: "IA générative en école privée — guide pédagogique",
      metaDescription:
        "Comment intégrer ChatGPT, Copilot et Claude dans un programme accrédité ? Cadre pédagogique, règles d'usage académique, évaluations adaptées. Guide 2026.",
      h2Variants: [
        "Cadre réglementaire : que dit l'AI Act sur l'usage IA en éducation ?",
        "Intégrer l'IA sans fragiliser l'intégrité académique",
        "5 exercices pédagogiques IA pour des étudiants en management",
      ],
    },
    variables: {
      process: "intégration IA dans curricula accrédités",
      resultat: "programme IA-ready en un semestre",
      chiffre: "1",
      unite: "semestre",
      delai: "dès la rentrée suivante",
    },
    urlCible: "/fr/blog/ia-generative-cursus-ecole-privee",
    canonicalParent: "/fr/interventions-formations/ecoles",
    source: "manuel",
    note: "D3 informationnel · long-form · angle académique + AI Act",
  },

  {
    keyword: "bénéfices IA pour la pédagogie en école de commerce",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA en école de commerce : les bénéfices pédagogiques mesurés",
      metaTitle: "Bénéfices IA pédagogie école de commerce — 2026",
      metaDescription:
        "Les écoles de commerce qui intègrent l'IA dans leurs cours voient +40 % d'engagement étudiant et –25 % de temps de correction pour les enseignants.",
      h2Variants: [
        "Impact de l'IA sur l'engagement et la progression des étudiants",
        "Gain de temps pour les enseignants : correction, feedback, personnalisation",
        "Différenciation concurrentielle : l'IA comme argument de recrutement",
      ],
    },
    variables: {
      process: "intégration IA cours management et marketing",
      resultat: "+40 % engagement étudiant, –25 % temps correction",
      chiffre: "40",
      unite: "% engagement",
      delai: "dès le 1er semestre",
    },
    urlCible: "/fr/interventions-formations/ecoles",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · argument vers responsable pédagogique · données benchmark",
  },

  {
    keyword: "comment une école privée peut intégrer l'IA sans fraude académique ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA en école privée : comment éviter la fraude académique ?",
      metaTitle: "IA école privée : fraude académique — solutions",
      metaDescription:
        "Intégrer l'IA dans les cours sans encourager la triche : charte d'usage, évaluations adaptées, critères de détection. Réponses pratiques pour les écoles.",
      h2Variants: [
        "Ce que dit la réglementation sur l'IA dans les évaluations académiques",
        "Charte IA étudiant : que doit-elle contenir ?",
        "3 types d'évaluations résistantes aux usages abusifs de l'IA",
      ],
    },
    variables: {
      process: "cadrage usage IA étudiants + évaluations adaptées",
      resultat: "0 dossier fraude IA depuis la mise en place de la charte",
      chiffre: "0",
      unite: "dossier fraude",
      delai: "depuis la mise en place",
    },
    urlCible: "/fr/faq/ia-ecole-privee-fraude-academique",
    canonicalParent: "/fr/interventions-formations/ecoles",
    source: "manuel",
    note: "D4 AEO · préoccupation forte responsables pédagogiques · schema.org FAQPage",
  },

  {
    keyword: "quel tarif pour un conférencier IA en école de commerce ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Conférencier IA en école : quel budget prévoir en 2026 ?",
      metaTitle: "Tarif conférencier IA école — fourchette 2026",
      metaDescription:
        "Une masterclass IA de 2h en école de commerce : fourchette de tarifs, ce qui est inclus (slides, replay, Q&A), et comment obtenir un devis en 24h.",
      h2Variants: [
        "Fourchette tarifaire selon le format (2h, demi-journée, journée)",
        "Ce qui est inclus dans la prestation de conférence IA",
        "Comment obtenir une intervention IA dans votre école en moins de 2 semaines",
      ],
    },
    variables: {
      process: "tarification conférence IA école",
      resultat: "intervention planifiée en moins de 2 semaines",
      chiffre: "2",
      unite: "semaines",
      delai: "planifiée en moins de 2 semaines",
    },
    urlCible: "/fr/faq/tarif-conferencier-ia-ecole",
    canonicalParent: "/fr/interventions-formations/ecoles",
    source: "manuel",
    note: "D4 AEO · question budget · schema.org FAQPage + PriceSpecification",
  },

  // ─────────────────────────────────────────────
  // CIBLE : ORGANISME DE FORMATION
  // ─────────────────────────────────────────────

  {
    keyword: "automatiser la conception de formations avec l'IA",
    intent: "transactionnel",
    kbType: "automation_recipe",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Automatisez la conception de vos formations grâce à l'IA",
      metaTitle: "Automatiser conception formations avec IA — OF",
      metaDescription:
        "Storyboard, quiz, exercices, supports : l'IA réduit de 60 % le temps de conception pédagogique. Axion-IA forme vos équipes en 1 journée sur vos vrais projets.",
      h2Variants: [
        "Quelles tâches de conception l'IA automatise réellement",
        "Session 1 jour : vos ingénieurs pédagogiques autonomes sur l'IA",
        "Protéger la qualité pédagogique tout en accélérant avec l'IA",
      ],
    },
    variables: {
      process: "conception storyboards, quiz, exercices, supports",
      resultat: "–60 % de temps de conception pédagogique",
      chiffre: "60",
      unite: "%",
      delai: "dès la 1re semaine",
    },
    urlCible: "/fr/interventions-formations/",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne transactionnel · automation recipe · ROI très clair pour OF",
  },

  {
    keyword: "agence IA intégration outils IA pour organisme de formation",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Votre organisme de formation prêt pour l'IA — Axion-IA vous accompagne",
      metaTitle: "Agence IA pour organismes de formation — Axion-IA",
      metaDescription:
        "Formation formateurs, intégration d'outils IA dans vos LMS, automatisation de la conception pédagogique. Axion-IA, cabinet IA B2B spécialisé OF.",
      h2Variants: [
        "Les 4 chantiers IA prioritaires pour un organisme de formation",
        "Comment intégrer des outils IA dans votre LMS sans tout recoder",
        "Accompagnement sur 3 mois : de la formation à l'autonomie complète",
      ],
    },
    variables: {
      process: "intégration IA dans LMS + formation formateurs",
      resultat: "OF 100 % IA-ready en 3 mois",
      chiffre: "3",
      unite: "mois",
      delai: "autonomie complète à 3 mois",
    },
    urlCible: "/fr/interventions-formations/",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · cible directeur OF · angle agence + cabinet IA",
  },

  {
    keyword: "ROI IA pour un organisme de formation professionnel",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "IA en organisme de formation : ROI concret et rapide",
      metaTitle: "ROI IA organisme de formation — calcul concret",
      metaDescription:
        "Un OF qui automatise sa conception pédagogique avec l'IA économise 15 à 25h par module. Calculateur ROI + études de cas OF formés par Axion-IA.",
      h2Variants: [
        "Calcul ROI : conception pédagogique, animation, administratif",
        "Études de cas : 3 OF qui ont réduit leurs coûts grâce à l'IA",
        "À quel seuil la formation IA devient-elle rentable pour un OF ?",
      ],
    },
    variables: {
      process: "conception, animation, évaluation, gestion administrative",
      resultat: "économie de 20h par module conçu",
      chiffre: "20",
      unite: "h/module",
      delai: "dès la 1re conception",
    },
    urlCible: "/fr/interventions-formations/",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · calculateur ROI · priorite 1 niveau 3 OK",
  },

  {
    keyword: "comment l'IA permet de réduire le coût de conception pédagogique",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et conception pédagogique : réduire les coûts sans sacrifier la qualité",
      metaTitle: "IA conception pédagogique — réduire coûts OF 2026",
      metaDescription:
        "Guide pratique : comment les OF utilisent l'IA pour concevoir des modules en deux fois moins de temps. Outils, méthodes, pièges à éviter.",
      h2Variants: [
        "Les 5 étapes de conception qu'on peut accélérer avec l'IA",
        "Outils IA recommandés pour les ingénieurs pédagogiques en 2026",
        "Les limites de l'IA dans la conception pédagogique : ce qu'il faut garder humain",
      ],
    },
    variables: {
      process: "conception pédagogique IA-assistée",
      resultat: "–50 % temps conception, qualité préservée",
      chiffre: "50",
      unite: "%",
      delai: "dès la 1re utilisation structurée",
    },
    urlCible: "/fr/blog/ia-reduction-cout-conception-pedagogique-of",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D3 informationnel · long-form · cible ingénieur pédagogique OF",
  },

  {
    keyword: "l'IA peut-elle remplacer les formateurs humains dans un OF ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA va-t-elle remplacer les formateurs ? Réponse directe.",
      metaTitle: "IA remplace-t-elle les formateurs ? Réponse honnête",
      metaDescription:
        "Non, l'IA ne remplace pas les formateurs : elle automatise les tâches répétitives (conception, correction, FAQ) et libère du temps pour l'accompagnement humain.",
      h2Variants: [
        "Ce que l'IA fait mieux qu'un formateur (et pourquoi c'est une bonne nouvelle)",
        "Ce que seul un formateur humain peut apporter en 2026",
        "Comment l'IA augmente les formateurs plutôt que de les remplacer",
      ],
    },
    variables: {
      process: "positionnement IA vs formateur humain",
      resultat: "formateurs qui gagnent 10h/semaine grâce à l'IA",
      chiffre: "10",
      unite: "h/semaine",
      delai: "après formation IA de 1 jour",
    },
    urlCible: "/fr/faq/ia-remplace-formateurs-of",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D4 AEO · forte question SGE/vocale · schema.org FAQPage · angle rassurant",
  },

  {
    keyword: "comment intégrer l'IA dans un programme de formation accrédité RNCP ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA dans un programme RNCP : que dit la réglementation en 2026 ?",
      metaTitle: "IA et programme RNCP — ce que dit la réglementation",
      metaDescription:
        "Intégrer l'IA dans un bloc de compétences RNCP : contraintes France Compétences, modalités d'évaluation acceptées, traçabilité exigée. Réponses 2026.",
      h2Variants: [
        "Ce que France Compétences exige sur l'IA dans les blocs RNCP",
        "Modalités d'évaluation compatibles avec l'IA générative",
        "Comment déclarer l'IA dans votre prochain dossier de renouvellement",
      ],
    },
    variables: {
      process: "intégration IA dans blocs RNCP + dossier renouvellement",
      resultat: "dossier RNCP IA-conforme validé",
      chiffre: "1",
      unite: "dossier",
      delai: "avant prochain renouvellement",
    },
    urlCible: "/fr/faq/ia-programme-rncp-reglementation",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D4 AEO · angle réglementaire RNCP · schema.org FAQPage · France Compétences",
  },

  // ─────────────────────────────────────────────
  // SEEDS TRANSVERSAUX & HUB (toutes cibles)
  // ─────────────────────────────────────────────

  {
    keyword: "formation IA sur site France",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Formation IA sur site — intervenants experts dans toute la France",
      metaTitle: "Formation IA sur site France — Axion-IA",
      metaDescription:
        "Axion-IA intervient dans toute la France pour former vos équipes à l'IA : formats 4h, 1 jour, 2 jours, 3 jours+. Devis sous 24h. Exercices sur vos vrais cas.",
      h2Variants: [
        "Pourquoi la formation sur site change les résultats",
        "Toutes les cibles : TPE, PME, ETI, écoles, organismes de formation",
        "Prendre contact et obtenir un devis en moins de 24h",
      ],
    },
    variables: {
      process: "formation IA sur site toutes cibles",
      resultat: "équipes autonomes dès la fin de session",
      chiffre: "1",
      unite: "jour maximum pour un devis",
      delai: "devis sous 24h",
    },
    urlCible: "/fr/interventions-formations/",
    source: "manuel",
    note: "HEAD · niveau 1 → priorite 2 (règle anti-cannibalisation) · page hub principale",
  },

  {
    keyword: "cabinet IA interventions et formations entreprises",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Cabinet IA B2B : interventions & formations pour vos équipes",
      metaTitle: "Cabinet IA · interventions formations entreprises",
      metaDescription:
        "Axion-IA, cabinet IA B2B premium : formations sur site, interventions en entreprises, conférences. TPE, PME, ETI, écoles. Résultats mesurables dès J+1.",
      h2Variants: [
        "Ce qui distingue un cabinet IA d'une agence formation généraliste",
        "Nos formats d'intervention : de la conférence au programme multi-mois",
        "Témoignages d'entreprises formées par Axion-IA",
      ],
    },
    variables: {
      process: "positionnement cabinet IA vs agence formation",
      resultat: "100 % des participants repartent avec des cas opérationnels",
      chiffre: "100",
      unite: "%",
      delai: "en fin de session",
    },
    urlCible: "/fr/interventions-formations/",
    source: "manuel",
    note: "HEAD · niveau 1 → priorite 2 · page hub · mot-clé de marque cabinet IA",
  },

  {
    keyword: "agence IA formation professionnelle continue entreprises",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Agence IA spécialisée formation professionnelle continue : Axion-IA",
      metaTitle: "Agence IA formation pro continue — Axion-IA",
      metaDescription:
        "Axion-IA propose des formations IA continues pour les équipes d'entreprise : sessions sur site, résultats mesurés. Devis 24h.",
      h2Variants: [
        "Formation IA éligible au plan de développement des compétences",
        "Comment financer votre formation IA",
        "Nos programmes de formation IA par secteur et par cible",
      ],
    },
    variables: {
      process: "formation continue IA pour entreprises",
      resultat: "équipes opérationnelles sur les outils IA ciblés",
      chiffre: "80",
      unite: "% des cas",
      delai: "dès la première session",
    },
    urlCible: "/fr/interventions-formations/",
    source: "manuel",
    note: "BODY · angle formation continue TPE/PME · priorite 2 niveau 2 OK",
  },

  {
    keyword: "intervention IA en entreprise durée formats disponibles",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formats d'intervention IA en entreprise : 4h, 1j, 2j, 3j+ — lequel choisir ?",
      metaTitle: "Formats formation IA entreprise : 4h, 1j, 2j, 3j+",
      metaDescription:
        "Comment choisir entre une demi-journée de formation IA et un programme de 3 jours ? Comparatif des formats, objectifs, livrables et ROI attendu par format.",
      h2Variants: [
        "Format 4h : les fondamentaux IA pour des non-techniques",
        "Format 1 jour : autonomie sur 3 cas métier clés",
        "Format 2-3 jours : transformation durable des pratiques d'une équipe",
      ],
    },
    variables: {
      process: "choix du format d'intervention IA selon les objectifs",
      resultat: "format adapté identifié en 15 min de diagnostic",
      chiffre: "15",
      unite: "min de diagnostic",
      delai: "avant commande",
    },
    urlCible: "/fr/blog/formats-intervention-ia-entreprise",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D3 informationnel · comparatif formats · passerelle vers toutes pages cible",
  },

  {
    keyword: "quelle différence entre formation IA et audit IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA vs audit IA : quelle différence et par quoi commencer ?",
      metaTitle: "Formation IA vs audit IA — par quoi commencer ?",
      metaDescription:
        "Formation IA = montée en compétences équipes. Audit IA = diagnostic des processus à automatiser. Les deux se complètent : voici le bon séquençage.",
      h2Variants: [
        "Ce que couvre une formation IA et ce qu'elle ne fait pas",
        "Ce qu'apporte un audit IA avant de former les équipes",
        "Le parcours recommandé : audit D+0, formation D+30, implémentation D+90",
      ],
    },
    variables: {
      process: "séquençage audit + formation + implémentation",
      resultat: "ROI 3× supérieur avec audit préalable à la formation",
      chiffre: "3",
      unite: "×",
      delai: "vs formation sans audit",
    },
    urlCible: "/fr/faq/difference-formation-ia-audit-ia",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D4 AEO · cross-sell vers /audit · schema.org FAQPage",
  },

  {
    keyword: "combien de temps faut-il pour former une équipe à l'IA ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Combien de temps pour former une équipe à l'IA ? Réponse directe.",
      metaTitle: "Durée formation IA équipe — réponse honnête 2026",
      metaDescription:
        "4h pour les fondamentaux, 1 jour pour l'autonomie opérationnelle, 2 jours pour transformer durablement les pratiques. Détail par objectif et taille d'équipe.",
      h2Variants: [
        "4h : que peut-on réalistement apprendre sur l'IA en une demi-journée ?",
        "1 jour : le format le plus plébiscité par les PME en 2026",
        "2 jours et plus : pour les équipes qui veulent changer durablement leurs pratiques",
      ],
    },
    variables: {
      process: "durée formation IA selon objectif",
      resultat: "autonomie opérationnelle en 1 journée",
      chiffre: "1",
      unite: "journée",
      delai: "résultats dès la fin de session",
    },
    urlCible: "/fr/faq/duree-formation-ia-equipe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D4 AEO · question clé SGE/vocale · schema.org FAQPage",
  },

  {
    keyword: "formation IA en présentiel vs formation IA en ligne laquelle choisir ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA en présentiel ou en ligne : laquelle choisir pour votre équipe ?",
      metaTitle: "Formation IA présentiel vs en ligne — comparatif",
      metaDescription:
        "Le présentiel triple les résultats d'adoption IA vs MOOC. Comparatif honnête : quand choisir le présentiel, le distanciel synchrone ou le blended learning.",
      h2Variants: [
        "Pourquoi le présentiel sur vos cas réels génère 3× plus d'adoption",
        "Cas où le distanciel synchrone est suffisant",
        "Le blended learning : meilleur des deux mondes pour les ETI",
      ],
    },
    variables: {
      process: "choix modalité formation IA",
      resultat: "×3 taux d'adoption en présentiel vs MOOC",
      chiffre: "3",
      unite: "×",
      delai: "à 30 jours post-formation",
    },
    urlCible: "/fr/faq/formation-ia-presentiel-vs-ligne",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D4 AEO · argument différenciateur Axion-IA · schema.org FAQPage",
  },

  {
    keyword: "résultats concrets formation IA pour les équipes",
    intent: "benefice",
    kbType: "case_study",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA entreprise : résultats concrets mesurés à 30 jours",
      metaTitle: "Résultats formation IA équipes — chiffres réels",
      metaDescription:
        "+2h/jour économisées par collaborateur, –30 % de tâches répétitives, 90 % d'adoption à 30 jours : les résultats réels des équipes formées par Axion-IA.",
      h2Variants: [
        "Les 5 KPIs que nos clients mesurent après une formation IA",
        "Avant / après : récits de 3 équipes formées à l'IA par Axion-IA",
        "Comment mesurer l'impact d'une formation IA sur votre équipe",
      ],
    },
    variables: {
      process: "mesure impact formation IA",
      resultat: "+2h/jour, –30 % tâches répétitives, 90 % adoption",
      chiffre: "2",
      unite: "h/jour économisées",
      delai: "à 30 jours post-formation",
    },
    urlCible: "/fr/blog/resultats-concrets-formation-ia-equipes",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · page social proof · case studies · lien vers devis",
  },

  {
    keyword: "prompt engineering formation pratique entreprise",
    intent: "transactionnel",
    kbType: "competence_boost",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation Prompt Engineering en entreprise : pratique, opérationnelle, dès J+1",
      metaTitle: "Formation prompt engineering entreprise — Axion-IA",
      metaDescription:
        "Maîtrisez le prompt engineering en une demi-journée : structure, chaînes de prompts, cas métier réels. Formation sur site pour équipes 5 à 30 personnes.",
      h2Variants: [
        "Qu'est-ce que le prompt engineering et pourquoi toute équipe doit le maîtriser",
        "Programme type d'une demi-journée prompt engineering pour non-techniques",
        "Exercices sur vos vrais documents : emails, rapports, analyses",
      ],
    },
    variables: {
      process: "maîtrise prompt engineering sur cas métier réels",
      resultat: "×5 pertinence des réponses IA après formation",
      chiffre: "5",
      unite: "×",
      delai: "dès la fin de session",
    },
    urlCible: "/fr/interventions-formations/",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne transactionnel · compétence phare des formations Axion-IA",
  },

  {
    keyword: "certification formation IA professionnelle France 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Certifications IA professionnelles en France en 2026 — panorama complet",
      metaTitle: "Certifications IA professionnelles France 2026",
      metaDescription:
        "Google IA, Microsoft AI, IBM SkillsBuild, RNCP IA : panorama des certifications IA disponibles en France, coût, niveau, utilité réelle en 2026.",
      h2Variants: [
        "Les certifications IA reconnues en France en 2026",
        "Certification vs formation sur site : ce qu'on choisit selon l'objectif",
        "Quelles certifications IA valent vraiment quelque chose en entreprise ?",
      ],
    },
    variables: {
      process: "choix certification IA professionnelle",
      resultat: "certification choisie et préparée en 2 mois",
      chiffre: "2",
      unite: "mois",
      delai: "certification obtenue en 2 mois",
    },
    urlCible: "/fr/blog/certifications-ia-professionnelles-france-2026",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D3 informationnel · trafic SEO long-term · passerelle vers formation Axion-IA",
  },

  {
    keyword: "intelligence artificielle formation obligatoire salariés France 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et obligation de formation : ce que les employeurs doivent savoir en 2026",
      metaTitle: "Formation IA obligatoire salariés France — 2026",
      metaDescription:
        "L'AI Act européen impose-t-il une formation IA aux salariés ? Ce que les RH et dirigeants doivent anticiper dès 2026. Obligations, délais, recommandations.",
      h2Variants: [
        "Ce que l'AI Act impose aux entreprises en matière de formation IA",
        "Article 4 AI Act : obligation de compétence IA pour les utilisateurs de systèmes IA",
        "Comment anticiper ces obligations avant la date d'entrée en vigueur",
      ],
    },
    variables: {
      process: "conformité AI Act art. 4 + formation salariés",
      resultat: "entreprise conforme AI Act avant l'échéance 2026",
      chiffre: "1",
      unite: "programme de formation",
      delai: "avant l'échéance réglementaire 2026",
    },
    urlCible: "/fr/blog/formation-ia-obligatoire-salaries-france-2026",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D3 informationnel · angle réglementaire AI Act art. 4 · très stratégique 2026",
  },

  {
    keyword: "formation IA Paris Lyon Bordeaux Marseille sur site",
    intent: "local",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA sur site à Paris, Lyon, Bordeaux, Marseille — Axion-IA",
      metaTitle: "Formation IA sur site Paris Lyon Bordeaux — Axion-IA",
      metaDescription:
        "Axion-IA intervient dans toute la France : Paris, Lyon, Bordeaux, Marseille, Nantes, Toulouse. Formation IA sur site pour vos équipes. Devis en 24h.",
      h2Variants: [
        "Villes couvertes par Axion-IA pour les formations IA sur site",
        "Frais de déplacement et modalités d'intervention en régions",
        "Comment réserver une session IA dans votre ville",
      ],
    },
    variables: {
      process: "intervention formation IA multi-villes France",
      resultat: "intervention planifiée sous 2 semaines dans votre ville",
      chiffre: "2",
      unite: "semaines",
      delai: "intervention sous 2 semaines",
    },
    urlCible: "/fr/interventions-formations/",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D7 local · géographique · socle pour pages /fr/interventions-formations/[ville]",
  },

  // ─────────────────────────────────────────────
  // SEEDS COMPLÉMENTAIRES — TPE (4 seeds)
  // ─────────────────────────────────────────────

  {
    keyword: "formation IA demi-journée pour petite entreprise",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Demi-journée IA pour votre TPE : opérationnel en 4 heures",
      metaTitle: "Formation IA 4h TPE — opérationnel dès J+1",
      metaDescription:
        "Une demi-journée suffit pour qu'une TPE gagne en productivité avec l'IA. Exercices sur vos vrais documents, résultats mesurables dès le lendemain.",
      h2Variants: [
        "Programme détaillé d'une session IA de 4h pour TPE",
        "Combien de personnes peut-on former en demi-journée ?",
        "Ce que chaque participant maîtrise en sortant de la session",
      ],
    },
    variables: {
      process: "initiation IA sur cas TPE réels",
      resultat: "3 prompts métier opérationnels maîtrisés en 4h",
      chiffre: "3",
      unite: "prompts opérationnels",
      delai: "dès la fin de session",
    },
    urlCible: "/fr/interventions-formations/tpe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · format 4h spécifique TPE · angle durée courte rassurante",
  },

  {
    keyword: "aide à la transformation numérique TPE grâce à l'IA",
    intent: "benefice",
    kbType: "industry_use_case",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Transformation numérique TPE : l'IA, le levier le plus rapide en 2026",
      metaTitle: "Transformation numérique TPE avec l'IA — 2026",
      metaDescription:
        "L'IA est la transformation numérique la plus accessible pour une TPE : coût faible, résultats rapides. Découvrez comment Axion-IA accompagne les petites structures.",
      h2Variants: [
        "Pourquoi l'IA est le meilleur point d'entrée dans le numérique pour une TPE",
        "3 exemples de transformation numérique IA réussie par des TPE",
        "Par où commencer : le diagnostic gratuit Axion-IA pour TPE",
      ],
    },
    variables: {
      process: "adoption numérique via IA pour TPE",
      resultat: "première transformation opérationnelle en 2 semaines",
      chiffre: "2",
      unite: "semaines",
      delai: "premiers résultats en 2 semaines",
    },
    urlCible: "/fr/interventions-formations/tpe",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · angle transformation numérique · passerelle blog → service",
  },

  {
    keyword: "meilleur outil IA gratuit pour gérant de TPE",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Outils IA gratuits pour gérants de TPE : top 5 opérationnels en 2026",
      metaTitle: "Outils IA gratuits gérant TPE — top 5 2026",
      metaDescription:
        "ChatGPT Free, Copilot, Gemini, Mistral… Quels outils IA gratuits vaut-il la peine d'apprendre pour un gérant de TPE ? Comparatif honnête avec cas d'usage réels.",
      h2Variants: [
        "Les 5 meilleurs outils IA gratuits pour une TPE en 2026",
        "Quand passer à un outil IA payant : le bon moment pour une TPE",
        "Ce qu'une formation courte change à l'utilisation de ces outils",
      ],
    },
    variables: {
      process: "sélection outils IA gratuits pour gérants TPE",
      resultat: "5 outils gratuits maîtrisés en 1 journée",
      chiffre: "5",
      unite: "outils",
      delai: "en 1 journée",
    },
    urlCible: "/fr/blog/outils-ia-gratuits-gerant-tpe",
    canonicalParent: "/fr/interventions-formations/tpe",
    source: "manuel",
    note: "D3 informationnel · trafic haut entonnoir TPE · passerelle vers formation",
  },

  {
    keyword: "la formation IA peut-elle être financée pour une TPE de moins de 10 salariés ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Financement formation IA pour TPE de moins de 10 salariés : oui, c'est possible",
      metaTitle: "Financement formation IA TPE < 10 salariés — FAQ",
      metaDescription:
        "Les TPE de moins de 10 salariés peuvent financer leur formation IA via différents dispositifs. Conditions, démarches et montants disponibles en 2026.",
      h2Variants: [
        "Dispositifs de financement disponibles pour les TPE",
        "Comment vos salariés financent leur formation IA",
        "Aide régionale complémentaire : ce que certaines régions proposent",
      ],
    },
    variables: {
      process: "financement formation IA TPE",
      resultat: "formation financée à 100 % pour les TPE éligibles",
      chiffre: "100",
      unite: "%",
      delai: "après validation du dossier de financement",
    },
    urlCible: "/fr/faq/financement-formation-ia-tpe-moins-10-salaries",
    canonicalParent: "/fr/interventions-formations/tpe",
    source: "manuel",
    note: "D4 AEO · préoccupation prix + financement · schema.org FAQPage",
  },

  // ─────────────────────────────────────────────
  // SEEDS COMPLÉMENTAIRES — PME (4 seeds)
  // ─────────────────────────────────────────────

  {
    keyword: "formation IA 2 jours pour équipe commerciale PME",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA 2 jours pour vos commerciaux PME — résultats immédiats",
      metaTitle: "Formation IA 2j équipe commerciale PME — Axion-IA",
      metaDescription:
        "2 jours pour transformer les pratiques de votre équipe commerciale avec l'IA : prospection, rédaction d'offres, suivi CRM, relances. Sur vos vrais outils.",
      h2Variants: [
        "Programme J1 : comprendre et prompter l'IA pour les ventes",
        "Programme J2 : automatiser la prospection et la rédaction d'offres",
        "Livrables post-formation : prompts prêts à l'emploi pour votre équipe",
      ],
    },
    variables: {
      process: "automatisation prospection, offres, relances commerciales",
      resultat: "+20 % de propositions envoyées par semaine",
      chiffre: "20",
      unite: "%",
      delai: "dès la semaine suivante",
    },
    urlCible: "/fr/interventions-formations/pme",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne transactionnel · format 2j + équipe commerciale · cross-sell audit",
  },

  {
    keyword: "formation IA pour PME industrielle manufacturière",
    intent: "transactionnel",
    kbType: "industry_use_case",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA pour PME industrielle : formez vos équipes sur vos vrais process",
      metaTitle: "Formation IA PME industrielle — Axion-IA",
      metaDescription:
        "Maintenance prédictive, rédaction de rapports qualité, gestion des plannings : Axion-IA forme les équipes de PME industrielles à l'IA sur leurs outils réels.",
      h2Variants: [
        "5 cas d'usage IA concrets pour une PME industrielle",
        "Formation sur site en atelier : nos formateurs s'adaptent à votre environnement",
        "ROI IA en industrie PME : les chiffres observés sur le terrain",
      ],
    },
    variables: {
      process: "maintenance, qualité, planification, rapports",
      resultat: "–3h de saisie et rapports par technicien par semaine",
      chiffre: "3",
      unite: "h/semaine par technicien",
      delai: "dès J+1",
    },
    urlCible: "/fr/interventions-formations/pme",
    canonicalParent: "/fr/interventions-formations/",
    secteur: "industrie-manufacturiere",
    source: "manuel",
    note: "D1 transactionnel sectoriel · industrie manufacturière PME · angle terrain",
  },

  {
    keyword: "atelier IA pratique pour PME sans compétences techniques",
    intent: "benefice",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Atelier IA pour PME : aucune compétence technique requise, 100 % pratique",
      metaTitle: "Atelier IA pratique PME — sans technique — Axion-IA",
      metaDescription:
        "Vos équipes PME sans background technique peuvent maîtriser l'IA en 1 jour. Nos ateliers partent de zéro et arrivent à des cas opérationnels réels.",
      h2Variants: [
        "Pourquoi l'IA ne nécessite pas de compétences informatiques",
        "Ce que maîtrisent des collaborateurs non-techniques après 1 journée",
        "Exemples d'ateliers IA réussis avec des équipes administratives et commerciales",
      ],
    },
    variables: {
      process: "maîtrise IA sans background technique",
      resultat: "100 % des participants opérationnels en 1 jour",
      chiffre: "100",
      unite: "%",
      delai: "en 1 journée",
    },
    urlCible: "/fr/interventions-formations/pme",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · objection « trop technique » levée · cible RH PME",
  },

  {
    keyword: "comment mesurer l'efficacité d'une formation IA en PME",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Mesurer l'efficacité d'une formation IA en PME : la méthode Axion-IA",
      metaTitle: "Mesurer efficacité formation IA PME — méthode",
      metaDescription:
        "Taux d'adoption, temps économisé, satisfaction : comment mesurer concrètement l'impact d'une formation IA en PME. Grille d'évaluation à télécharger.",
      h2Variants: [
        "Les 6 KPIs à mesurer après une formation IA en PME",
        "Comment évaluer l'adoption IA à J+7, J+30 et J+90",
        "Grille d'évaluation formation IA : modèle PME à télécharger",
      ],
    },
    variables: {
      process: "évaluation impact formation IA PME",
      resultat: "ROI mesuré et documenté à 90 jours",
      chiffre: "90",
      unite: "jours",
      delai: "bilan à 90 jours",
    },
    urlCible: "/fr/blog/mesurer-efficacite-formation-ia-pme",
    canonicalParent: "/fr/interventions-formations/pme",
    source: "manuel",
    note: "D3 informationnel · grille téléchargeable · asset lead gen PME",
  },

  // ─────────────────────────────────────────────
  // SEEDS COMPLÉMENTAIRES — ETI (4 seeds)
  // ─────────────────────────────────────────────

  {
    keyword: "formation IA pour DSI et équipes IT en ETI",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Former les équipes IT de votre ETI à l'IA : au-delà du ChatGPT",
      metaTitle: "Formation IA équipes IT ETI — DSI Axion-IA",
      metaDescription:
        "Pour les DSI et équipes IT d'ETI : formation IA avancée (RAG, agents, API LLM, gouvernance données). 1 à 3 jours sur vos architectures réelles.",
      h2Variants: [
        "Ce que les équipes IT apprennent en formation IA avancée",
        "Gouvernance IA pour le DSI : contrôle des usages et sécurité",
        "De l'expérimentation au déploiement : structurer l'IA dans le SI ETI",
      ],
    },
    variables: {
      process: "formation IA avancée DSI/IT ETI (RAG, agents, API)",
      resultat: "architecture IA pilote déployée en 4 semaines",
      chiffre: "4",
      unite: "semaines",
      delai: "pilote en production en 4 semaines",
    },
    urlCible: "/fr/interventions-formations/eti",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "Longue traîne · cible DSI/CTO ETI · technique avancé · cross-sell implémentation",
  },

  {
    keyword: "retour sur investissement formation IA ETI secteur services",
    intent: "benefice",
    kbType: "roi_calculator_template",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "ETI de services formée à l'IA : ROI réel mesuré à 6 mois",
      metaTitle: "ROI formation IA ETI services — 6 mois de données",
      metaDescription:
        "Étude de cas : ETI de services (250 personnes) après 6 mois de déploiement IA. –20 % de charge administrative, +18 % de productivité sur les missions clients.",
      h2Variants: [
        "Avant / après : l'ETI de conseil de 250 personnes",
        "Les 3 leviers IA qui ont généré le plus de valeur",
        "Extrapoler ce ROI à votre ETI : calculateur en ligne",
      ],
    },
    variables: {
      process: "déploiement IA ETI services sur 6 mois",
      resultat: "–20 % charge admin, +18 % productivité missions",
      chiffre: "18",
      unite: "% productivité",
      delai: "à 6 mois",
    },
    urlCible: "/fr/interventions-formations/eti",
    canonicalParent: "/fr/interventions-formations/",
    secteur: "conseil-affaires",
    source: "manuel",
    note: "D2 bénéfice · étude de cas sectorielle ETI services · social proof fort",
  },

  {
    keyword: "quel budget formation IA pour 100 personnes en ETI ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Budget formation IA pour 100 collaborateurs en ETI : fourchette réelle",
      metaTitle: "Budget formation IA 100 personnes ETI — 2026",
      metaDescription:
        "Former 100 collaborateurs à l'IA en ETI : fourchette budgétaire, coût par personne et ROI attendu. Réponse chiffrée 2026.",
      h2Variants: [
        "Fourchette de coût pour former 100 personnes à l'IA",
        "Options de financement pour les ETI",
        "À quel budget allouer pour une transformation IA durable en ETI",
      ],
    },
    variables: {
      process: "budgétisation programme formation IA 100 personnes",
      resultat: "ROI positif avant la fin de l'exercice fiscal",
      chiffre: "1",
      unite: "exercice fiscal",
      delai: "ROI avant la fin de l'exercice",
    },
    urlCible: "/fr/faq/budget-formation-ia-100-personnes-eti",
    canonicalParent: "/fr/interventions-formations/eti",
    source: "manuel",
    note: "D4 AEO · question budgétaire COMEX/DAF ETI · schema.org FAQPage",
  },

  {
    keyword: "plan de formation IA ETI secteur bancaire assurance",
    intent: "transactionnel",
    kbType: "secteur_brief",
    module: "interventions-formations",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA pour ETI banque et assurance : conformité et performance",
      metaTitle: "Formation IA ETI banque assurance — Axion-IA",
      metaDescription:
        "Axion-IA forme les ETI du secteur bancaire et assurantiel : traitement de dossiers, conformité RGPD/AI Act, automatisation sans risque. Programme sur mesure.",
      h2Variants: [
        "Cas d'usage IA dans les ETI banque et assurance",
        "Conformité réglementaire et IA : ce que les équipes doivent maîtriser",
        "Programme de formation IA adapté aux contraintes du secteur financier",
      ],
    },
    variables: {
      process: "traitement dossiers, conformité, relation client, reporting",
      resultat: "–40 % temps de traitement des dossiers clients",
      chiffre: "40",
      unite: "%",
      delai: "en 60 jours",
    },
    urlCible: "/fr/interventions-formations/eti",
    canonicalParent: "/fr/interventions-formations/",
    secteur: "banque-finance",
    source: "manuel",
    note: "D1 transactionnel sectoriel · ETI fintech/assurance · AI Act angle fort",
  },

  // ─────────────────────────────────────────────
  // SEEDS COMPLÉMENTAIRES — ÉCOLE PRIVÉE (4 seeds)
  // ─────────────────────────────────────────────

  {
    keyword: "intervention IA école de design créativité intelligence artificielle",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et design : formez vos étudiants créatifs à l'IA générative",
      metaTitle: "Formation IA école design créativité — Axion-IA",
      metaDescription:
        "Midjourney, DALL-E, Stable Diffusion, Firefly : Axion-IA forme les étudiants en design à l'IA générative. Session 4h à 2 jours, intégrée à votre programme.",
      h2Variants: [
        "L'IA générative pour les designers : opportunité ou menace ?",
        "Programme type pour une école de design : IA créative en 2 jours",
        "Éthique IA et propriété intellectuelle : le cadre à enseigner",
      ],
    },
    variables: {
      process: "maîtrise outils IA créatifs (image, vidéo, 3D)",
      resultat: "×3 vitesse de prototypage pour les étudiants en design",
      chiffre: "3",
      unite: "× plus vite",
      delai: "dès la fin de la session",
    },
    urlCible: "/fr/interventions-formations/ecoles",
    canonicalParent: "/fr/interventions-formations/",
    secteur: "arts-creatif-design",
    source: "manuel",
    note: "D1 transactionnel sectoriel · école design · IA générative créative",
  },

  {
    keyword: "conférence IA pour étudiants en droit école privée",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Conférence IA pour étudiants en droit : enjeux, outils et métiers de demain",
      metaTitle: "Conférence IA étudiants droit école privée",
      metaDescription:
        "LegalTech, IA et droit, AI Act : Axion-IA intervient dans les écoles de droit pour sensibiliser les futurs juristes aux enjeux et outils IA. Demi-journée ou journée.",
      h2Variants: [
        "Comment l'IA transforme les métiers du droit",
        "AI Act et étudiants en droit : ce qu'ils doivent maîtriser avant de sortir diplômés",
        "Atelier pratique : analyser un contrat avec l'IA",
      ],
    },
    variables: {
      process: "sensibilisation IA juridique + ateliers LegalTech",
      resultat: "étudiants capables d'analyser un contrat avec l'IA en 4h",
      chiffre: "4",
      unite: "heures",
      delai: "maîtrise en 1 session",
    },
    urlCible: "/fr/interventions-formations/ecoles",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D1 transactionnel sectoriel · école droit · AI Act pédagogique",
  },

  {
    keyword: "intégrer l'IA dans l'enseignement du marketing digital en école",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA et marketing digital en école : guide pédagogique pour les responsables de formation",
      metaTitle: "IA dans cours marketing digital école — guide",
      metaDescription:
        "Comment intégrer ChatGPT, Gemini et les outils IA dans vos cours de marketing digital ? Exercices, évaluations et ressources pédagogiques 2026.",
      h2Variants: [
        "Les outils IA incontournables pour les étudiants en marketing 2026",
        "Exercices pédagogiques IA-marketing : 5 cas concrets prêts à l'emploi",
        "Comment évaluer les travaux IA sans encourager le copier-coller",
      ],
    },
    variables: {
      process: "intégration IA dans cours marketing digital",
      resultat: "étudiants employables sur les outils IA marketing dès la rentrée",
      chiffre: "1",
      unite: "rentrée",
      delai: "dès la rentrée suivante",
    },
    urlCible: "/fr/blog/ia-marketing-digital-ecole-guide-pedagogique",
    canonicalParent: "/fr/interventions-formations/ecoles",
    secteur: "communication-medias",
    source: "manuel",
    note: "D3 informationnel · blog · audience responsables pédagogiques · long-form",
  },

  {
    keyword: "pourquoi une école privée doit former ses étudiants à l'IA dès 2026 ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "ecole-privee",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Pourquoi former les étudiants à l'IA dès 2026 : réponse directe aux directeurs d'école",
      metaTitle: "Pourquoi former étudiants à l'IA dès 2026 ?",
      metaDescription:
        "L'AI Act impose une littératie IA aux utilisateurs de systèmes IA. 87 % des recruteurs attendent des compétences IA des jeunes diplômés. Réponse aux directions d'école.",
      h2Variants: [
        "Ce que l'AI Act impose aux étudiants utilisateurs de systèmes IA",
        "Ce que les recruteurs attendent en matière d'IA des jeunes diplômés 2026",
        "Comment différencier votre école en intégrant l'IA dans votre programme",
      ],
    },
    variables: {
      process: "positionnement IA école pour attractivité étudiants + recruteurs",
      resultat: "+15 % d'attractivité perçue vs concurrents non-IA-ready",
      chiffre: "15",
      unite: "%",
      delai: "dès la communication de rentrée",
    },
    urlCible: "/fr/faq/pourquoi-former-etudiants-ia-2026",
    canonicalParent: "/fr/interventions-formations/ecoles",
    source: "manuel",
    note: "D4 AEO · argument stratégique direction · schema.org FAQPage · AI Act art.4",
  },

  // ─────────────────────────────────────────────
  // SEEDS COMPLÉMENTAIRES — ORGANISME DE FORMATION (4 seeds)
  // ─────────────────────────────────────────────

  {
    keyword: "formation IA pour ingénieurs pédagogiques organisme formation",
    intent: "transactionnel",
    kbType: "intervention_module",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formez vos ingénieurs pédagogiques à l'IA — productivité ×2 sur la conception",
      metaTitle: "Formation IA ingénieurs pédagogiques OF — Axion-IA",
      metaDescription:
        "Axion-IA forme vos ingénieurs pédagogiques à l'IA : conception assistée, storyboards, quiz générés, personnalisation apprenants. Session 1 à 2 jours.",
      h2Variants: [
        "Ce que l'IA change dans le métier d'ingénieur pédagogique",
        "Programme 2 jours pour ingénieurs pédagogiques : cas réels de votre OF",
        "Livrables post-formation : bibliothèque de prompts pédagogiques",
      ],
    },
    variables: {
      process: "IA-assistance conception pédagogique (storyboard, quiz, éval)",
      resultat: "×2 vitesse de conception sans perte de qualité",
      chiffre: "2",
      unite: "× plus vite",
      delai: "dès la 1re conception post-formation",
    },
    urlCible: "/fr/interventions-formations/",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D1 transactionnel · cible ingénieur pédagogique OF · très opérationnel",
  },

  {
    keyword: "IA pour personnaliser les parcours de formation professionnelle",
    intent: "benefice",
    kbType: "automation_recipe",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Personnalisation des parcours de formation grâce à l'IA : le guide opérationnel",
      metaTitle: "IA personnalisation parcours formation OF — guide",
      metaDescription:
        "Recommandations d'apprentissage, quiz adaptatifs, feedback individualisé : comment les OF utilisent l'IA pour personnaliser les parcours à grande échelle.",
      h2Variants: [
        "La personnalisation par l'IA : ce que ça change pour l'apprenant",
        "Outils IA de recommandation disponibles pour les LMS en 2026",
        "Comment implémenter la personnalisation IA dans votre OF en 3 mois",
      ],
    },
    variables: {
      process: "personnalisation IA des parcours apprenants",
      resultat: "+30 % taux de complétion des formations",
      chiffre: "30",
      unite: "% complétion",
      delai: "après 3 mois d'IA personnalisée",
    },
    urlCible: "/fr/blog/ia-personnalisation-parcours-formation-of",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D2 bénéfice · angle LMS + personnalisation · fort pour OF digital-first",
  },

  {
    keyword: "comment l'IA peut aider un organisme de formation à développer son activité",
    intent: "informationnel",
    kbType: "guide",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "IA pour développer son activité de formation : guide stratégique OF 2026",
      metaTitle: "IA pour développer activité OF — guide stratégique",
      metaDescription:
        "Marketing IA, prospection automatisée, personnalisation client : comment un organisme de formation utilise l'IA pour croître sans embaucher. Guide 2026.",
      h2Variants: [
        "L'IA pour automatiser la prospection et le marketing de votre OF",
        "Personnalisation client par l'IA : fidélisation et upsell",
        "Réduire les coûts opérationnels tout en augmentant le volume de formation",
      ],
    },
    variables: {
      process: "IA marketing, prospection, fidélisation pour OF",
      resultat: "+40 % de prospects qualifiés avec la moitié du temps marketing",
      chiffre: "40",
      unite: "% de prospects",
      delai: "en 3 mois",
    },
    urlCible: "/fr/blog/ia-developper-activite-organisme-formation",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D3 informationnel · angle croissance OF · audience directeur OF · long-form",
  },

  {
    keyword: "quel est le coût d'une formation IA pour les formateurs d'un OF ?",
    intent: "aeo",
    kbType: "faq",
    module: "interventions-formations",
    cible: "organisme-formation",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Former les formateurs d'un OF à l'IA : quel investissement en 2026 ?",
      metaTitle: "Coût formation IA formateurs OF — réponse 2026",
      metaDescription:
        "Former 5 à 20 formateurs à l'IA : fourchette de coût et ROI attendu sur la conception pédagogique. Réponse directe.",
      h2Variants: [
        "Fourchette de tarifs pour former une équipe de formateurs à l'IA",
        "Options de financement pour les organismes de formation",
        "Calcul ROI : combien économise un OF en formant ses formateurs à l'IA ?",
      ],
    },
    variables: {
      process: "formation formateurs IA (coût et financement)",
      resultat: "ROI positif en moins de 2 mois pour un OF",
      chiffre: "2",
      unite: "mois",
      delai: "ROI positif en 2 mois",
    },
    urlCible: "/fr/faq/cout-formation-ia-formateurs-of",
    canonicalParent: "/fr/interventions-formations/",
    source: "manuel",
    note: "D4 AEO · question coût OF · schema.org FAQPage · financement angle",
  },
];
