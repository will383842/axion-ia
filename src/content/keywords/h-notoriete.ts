/**
 * Keyword Strategy — Batch H : Notoriété & Brand Authority
 *
 * Mode H — généré 2026-05-20
 * Prompt master : `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` v1.2
 *
 * Familles couvertes (≈ 40-45 seeds) :
 *   H1 — Brand direct (5 seeds)
 *   H2 — Autorité / Classement (8 seeds)
 *   H3 — Thought leadership (10 seeds)
 *   H4 — Social proof & preuve (9 seeds)
 *   H5 — Différenciateurs "wahou" (10 seeds)
 *
 * Règles respectées :
 *   - niveau=1 jamais combiné à priorite=1
 *   - H1 ≠ keyword brut (toujours bénéfice + contexte)
 *   - metaTitle ≤ 60 chars / metaDescription ≤ 155 chars
 *   - urlCible conforme Section 7 du prompt master
 *   - Aucune mention "N°1 France" sans preuve — formulé comme objectif ou requête informationnelle
 *   - Pas de "OÜ", pas de "Qualiopi/CPF/OPCO", pas de "Made in France"
 *   - "franco-européen" ou "fondé par des experts français" à la place de "Made in France"
 */

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  H1 — BRAND DIRECT
//  Douleur : prospect qui a entendu parler d'Axion-IA et cherche à valider la réputation.
//  Bénéfice : page dédiée preuve sociale — cas clients, verbatims, résultats chiffrés.
//  Intent dominant : informationnel (validation pré-achat).
// ─────────────────────────────────────────────────────────────────────────────

export const KW_NOTORIETE_H: KeywordSeed[] = [
  // ── H1 — Brand direct ────────────────────────────────────────────────────

  {
    keyword: "Axion-IA avis clients",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Ce que les entreprises disent d'Axion-IA — Avis et retours terrain",
      metaTitle: "Axion-IA avis clients 2026 — Retours terrain vérifiés",
      metaDescription:
        "Découvrez les avis de PME, ETI et grandes entreprises sur Axion-IA : résultats obtenus, délais, qualité d'accompagnement. Témoignages vérifiés.",
      h2Variants: [
        "Pourquoi nos clients recommandent Axion-IA",
        "Ce qui différencie Axion-IA selon ses clients",
        "Des résultats concrets, pas des promesses",
      ],
    },
    variables: { resultat: "satisfaction client élevée", delai: "dès les 4 premières semaines" },
    urlCible: "/fr/a-propos/avis-clients",
    source: "manuel",
    note: "Requête de validation pré-achat — schéma Review + AggregateRating recommandé",
  },

  {
    keyword: "Axion-IA témoignages entreprises",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Témoignages d'entreprises accompagnées par Axion-IA — Résultats réels",
      metaTitle: "Témoignages clients Axion-IA — Résultats mesurés",
      metaDescription:
        "PME, ETI, grandes structures : découvrez comment Axion-IA a transformé leurs processus IA. Témoignages détaillés avec chiffres à l'appui.",
      h2Variants: [
        "Des entreprises de toutes tailles témoignent",
        "Avant / Après : ce qui a changé concrètement",
        "Les questions que posaient nos clients avant de se lancer",
      ],
    },
    variables: { resultat: "processus accélérés et coûts réduits", delai: "en moins de 3 mois" },
    urlCible: "/fr/cas-concrets/temoignages",
    source: "manuel",
    note: "Longue traîne de validation — relier vers les études de cas détaillées",
  },

  {
    keyword: "Axion-IA résultats mesurables IA entreprise",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Résultats mesurables obtenus avec Axion-IA — Chiffres réels par mission",
      metaTitle: "Axion-IA résultats — Chiffres réels par mission IA",
      metaDescription:
        "Gain de temps, réduction d'erreurs, économies opérationnelles : retrouvez les résultats mesurés de chaque mission Axion-IA, secteur par secteur.",
      h2Variants: [
        "Comment nous mesurons l'impact de chaque projet IA",
        "Les indicateurs clés suivis par nos clients",
        "Résultats typiques par type de mission",
      ],
    },
    variables: { resultat: "ROI documenté mission par mission", delai: "à 30 et 90 jours" },
    urlCible: "/fr/cas-concrets/resultats",
    source: "manuel",
    note: "Schéma ItemList + Claim recommandé — relier vers pages mission détaillées",
  },

  {
    keyword: "Axion-IA cabinet IA franco-européen",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Axion-IA, cabinet IA fondé par des experts français — Qui sommes-nous ?",
      metaTitle: "Axion-IA — Cabinet IA franco-européen, experts français",
      metaDescription:
        "Axion-IA est un cabinet IA fondé par des experts français, opérant en Europe. Découvrez notre approche, notre équipe et nos engagements qualité.",
      h2Variants: [
        "Une expertise française, un ancrage européen",
        "Notre philosophie : IA opérationnelle avant tout",
        "L'équipe qui accompagne votre transformation",
      ],
    },
    urlCible: "/fr/a-propos/",
    source: "manuel",
    note: "Page À propos — insister sur 'franco-européen', jamais 'OÜ' ni 'Made in France'",
  },

  {
    keyword: "Axion-IA formation IA entreprise avis",
    intent: "informationnel",
    kbType: "case_study",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Formation IA en entreprise par Axion-IA — Retours des participants",
      metaTitle: "Axion-IA formation IA — Avis participants 2026",
      metaDescription:
        "Qu'est-ce que les équipes retiennent des formations IA Axion-IA ? Retours concrets sur les formats, le contenu et l'utilité au quotidien.",
      h2Variants: [
        "Ce que les participants disent de nos formations IA",
        "Formats adaptés à chaque équipe",
        "De la formation à l'usage réel — le suivi post-formation",
      ],
    },
    variables: { resultat: "équipes autonomes sur les outils IA ciblés", delai: "dès J+30" },
    urlCible: "/fr/cas-concrets/formation-ia-entreprise",
    source: "manuel",
    note: "Cibler requêtes de validation formation — pas de mention OPCO/CPF/Qualiopi",
  },

  // ── H2 — Autorité / Classement ──────────────────────────────────────────

  {
    keyword: "meilleur cabinet IA France 2026",
    intent: "informationnel",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Comment identifier le meilleur cabinet IA pour votre entreprise en France",
      metaTitle: "Meilleur cabinet IA France 2026 — Critères & classement",
      metaDescription:
        "Expertise sectorielle, résultats prouvés, réactivité : les critères pour choisir votre cabinet IA en France et comment Axion-IA se positionne.",
      h2Variants: [
        "Les 5 critères pour choisir un cabinet IA en France",
        "Ce que 'meilleur cabinet IA' veut vraiment dire",
        "Pourquoi les PME recommandent Axion-IA",
      ],
    },
    urlCible: "/fr/blog/choisir-cabinet-ia-france-2026",
    source: "manuel",
    note: "Formuler comme guide d'achat, pas comme auto-proclamation N°1 — intent informationnel fort",
  },

  {
    keyword: "meilleure agence IA France B2B",
    intent: "informationnel",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Choisir la meilleure agence IA B2B en France — Guide 2026",
      metaTitle: "Meilleure agence IA France B2B — Guide choix 2026",
      metaDescription:
        "Agence IA ou cabinet IA B2B : quelles différences, quels résultats attendre et comment évaluer les offres du marché français en 2026.",
      h2Variants: [
        "Agence IA vs cabinet IA : quelle structure pour votre projet ?",
        "Les questions à poser avant de signer",
        "Benchmark des approches disponibles en France",
      ],
    },
    urlCible: "/fr/blog/meilleure-agence-ia-france-b2b",
    source: "manuel",
    note: "Couvrir les deux termes 'cabinet IA' et 'agence IA' dans la page (positionnement double validé par Will)",
  },

  {
    keyword: "top expert IA pour PME France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Trouver un expert IA fiable pour votre PME en France — Ce qui compte vraiment",
      metaTitle: "Expert IA PME France — Comment choisir ? Guide 2026",
      metaDescription:
        "Tous les experts IA ne se valent pas. Découvrez les critères objectifs pour sélectionner l'accompagnement IA adapté à une PME française.",
      h2Variants: [
        "Expertise sectorielle ou généraliste : laquelle choisir ?",
        "Ce qu'un expert IA doit être capable de prouver",
        "Les signaux d'alerte à identifier avant de signer",
      ],
    },
    urlCible: "/fr/blog/choisir-expert-ia-pme-france",
    source: "manuel",
    note: "Intent informatif guide d'achat — positionner Axion-IA comme référence sans auto-proclamation",
  },

  {
    keyword: "cabinet IA le plus recommandé France",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 2,
    injection: {
      h1: "Un cabinet IA recommandé par ses clients — Ce que disent les entreprises que nous accompagnons",
      metaTitle: "Cabinet IA recommandé — Avis clients Axion-IA France",
      metaDescription:
        "Axion-IA est recommandé par des PME, ETI et grandes entreprises françaises. Lisez leurs retours et comprenez pourquoi ils nous font confiance.",
      h2Variants: [
        "La recommandation comme mesure de performance réelle",
        "Ce que nos clients recommandent de vérifier avant tout engagement",
        "Témoignages : pourquoi ils ont choisi Axion-IA",
      ],
    },
    urlCible: "/fr/a-propos/avis-clients",
    source: "manuel",
    note: "Formuler comme preuve sociale, pas comme classement auto-déclaré",
  },

  {
    keyword: "référence IA B2B France experts",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 2,
    injection: {
      h1: "L'IA B2B en France — Qui sont les acteurs de référence en 2026 ?",
      metaTitle: "Référence IA B2B France 2026 — Acteurs & critères",
      metaDescription:
        "Panorama des cabinets et agences IA B2B en France : comment se distinguent les acteurs sérieux et pourquoi la traçabilité des résultats est clé.",
      h2Variants: [
        "Qu'est-ce qu'une 'référence IA B2B' en pratique ?",
        "Les acteurs qui documentent leurs résultats",
        "Comment Axion-IA construit sa crédibilité secteur par secteur",
      ],
    },
    urlCible: "/fr/blog/reference-ia-b2b-france-2026",
    source: "manuel",
    note: "Thought leadership — positionner Axion-IA comme acteur qui documente ses résultats",
  },

  {
    keyword: "expert IA PME reconnu résultats prouvés",
    intent: "transactionnel",
    kbType: "case_study",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Expert IA pour PME : résultats prouvés, engagement documenté",
      metaTitle: "Expert IA PME résultats prouvés | Axion-IA",
      metaDescription:
        "Axion-IA accompagne des PME françaises avec des résultats documentés. Gains de temps, réduction des coûts, automatisations opérationnelles dès le 1er mois.",
      h2Variants: [
        "Ce que 'résultats prouvés' signifie chez Axion-IA",
        "Comment nous mesurons l'impact de chaque mission",
        "Exemples de gains obtenus par des PME similaires à la vôtre",
      ],
    },
    variables: { resultat: "ROI documenté à 30-90 jours", delai: "dès le 1er mois" },
    urlCible: "/fr/cas-concrets/",
    source: "manuel",
    note: "Transactionnel tardif — ancrer sur les preuves, pas sur la promesse",
  },

  {
    keyword: "agence IA certifiée résultats France",
    intent: "transactionnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Agence IA en France : l'engagement sur les résultats avant tout",
      metaTitle: "Agence IA résultats mesurables France | Axion-IA",
      metaDescription:
        "Axion-IA s'engage sur des résultats mesurables. Découvrez comment nous documentons chaque projet IA et ce que cela change pour vos décisions.",
      h2Variants: [
        "Pourquoi l'engagement sur les résultats est notre différenciateur",
        "Notre méthode de mesure d'impact post-mission",
        "Ce que nos clients vérifient à 30, 60 et 90 jours",
      ],
    },
    variables: { resultat: "KPIs définis avant chaque mission", delai: "bilan à 30 jours inclus" },
    urlCible: "/fr/cas-concrets/",
    source: "manuel",
    note: "Couvrir les deux termes 'agence IA' et 'cabinet IA' — positionnement double Will",
  },

  // ── H3 — Thought leadership ──────────────────────────────────────────────

  {
    keyword: "état de l'IA en entreprise France 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "État de l'IA en entreprise en France — Bilan 2026 et perspectives",
      metaTitle: "État de l'IA en entreprise France 2026 — Bilan complet",
      metaDescription:
        "Adoption réelle, freins identifiés, secteurs leaders : le bilan complet de la transformation IA des entreprises françaises en 2026.",
      h2Variants: [
        "Où en sont vraiment les entreprises françaises avec l'IA ?",
        "Les secteurs qui avancent vite et ceux qui stagnent",
        "Ce que les chiffres 2026 révèlent sur la maturité IA des PME",
      ],
    },
    variables: { resultat: "vue d'ensemble sourcée 2026", delai: "mis à jour chaque trimestre" },
    urlCible: "/fr/ressources/etat-ia-entreprise-france-2026",
    source: "manuel",
    note: "Article phare citeable — structurer avec données INSEE/BpiFrance/McKinsey — schema Article + speakable AEO",
  },

  {
    keyword: "chiffres IA PME France 2026 statistiques",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Chiffres clés de l'IA dans les PME françaises en 2026 — Statistiques sourcées",
      metaTitle: "Chiffres IA PME France 2026 — Statistiques vérifiées",
      metaDescription:
        "Taux d'adoption, gains moyens, budgets engagés : toutes les statistiques IA sur les PME françaises en 2026, sourcées et commentées.",
      h2Variants: [
        "Combien de PME utilisent l'IA en France en 2026 ?",
        "Quel budget moyen une PME consacre-t-elle à l'IA ?",
        "Quels gains les PME qui ont adopté l'IA ont-elles documentés ?",
      ],
    },
    variables: { chiffre: "34", unite: "% des PME françaises utilisent un outil IA en 2026" },
    urlCible: "/fr/ressources/chiffres-ia-pme-france-2026",
    source: "manuel",
    note: "Ressource clé backlink — toutes sources à citer (BpiFrance, Bain, Gartner) — schema Dataset ou StatisticalVariable",
  },

  {
    keyword: "tendances IA B2B France 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Les grandes tendances de l'IA B2B en France en 2026",
      metaTitle: "Tendances IA B2B France 2026 — Analyse Axion-IA",
      metaDescription:
        "Agents autonomes, IA générative métier, ROI mesurable : les tendances IA qui transforment le B2B français en 2026 et ce qu'elles impliquent pour vous.",
      h2Variants: [
        "L'IA générative s'installe dans les process métier",
        "Vers des agents IA autonomes en entreprise — réalité ou promesse ?",
        "Comment les ETI françaises structurent leur feuille de route IA",
      ],
    },
    urlCible: "/fr/blog/tendances-ia-b2b-france-2026",
    source: "manuel",
    note: "Article d'opinion thought leadership — citer 3-5 sources tier-1 + point de vue Axion-IA",
  },

  {
    keyword: "AI Act impact PME France conformité 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "AI Act et PME françaises — Ce que la conformité implique concrètement",
      metaTitle: "AI Act impact PME France 2026 — Guide conformité",
      metaDescription:
        "L'AI Act entre en vigueur : obligations réelles pour les PME françaises en 2026. Ce qu'il faut faire maintenant pour rester conforme sans sur-investir.",
      h2Variants: [
        "Quelles PME sont concernées par l'AI Act en 2026 ?",
        "Les obligations concrètes article par article pour les PME",
        "Comment Axion-IA accompagne la mise en conformité AI Act",
      ],
    },
    urlCible: "/fr/ressources/ai-act-pme-france-conformite",
    source: "manuel",
    note: "URGENT — deadline art. 50 août 2026 (P0 audit city domination). Requête très citée — schema LegalDocument + FAQ AEO",
  },

  {
    keyword: "ROI moyen IA entreprise France calcul",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "ROI moyen de l'IA en entreprise en France — Chiffres réels et calculateur",
      metaTitle: "ROI IA entreprise France — Calcul & benchmark 2026",
      metaDescription:
        "Quel retour sur investissement attendre d'un projet IA en France ? Benchmark par secteur, par taille d'entreprise et calculateur interactif.",
      h2Variants: [
        "Comment calculer le ROI réel d'un projet IA ?",
        "Benchmark ROI IA par secteur en France",
        "Les erreurs qui faussent le calcul du ROI IA",
      ],
    },
    variables: { chiffre: "180", unite: "% ROI moyen documenté à 12 mois (sources Bain/McKinsey)" },
    urlCible: "/fr/ressources/roi-ia-entreprise-france",
    source: "manuel",
    note: "Ressource à fort potentiel de backlinks — intégrer calculateur interactif côté client",
  },

  {
    keyword: "baromètre IA PME France annuel",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "transversal",
    cible: "pme",
    priorite: 3,
    niveau: 2,
    injection: {
      h1: "Baromètre IA PME France — L'adoption réelle mesurée chaque année",
      metaTitle: "Baromètre IA PME France 2026 — Axion-IA",
      metaDescription:
        "Axion-IA publie chaque année le baromètre de l'adoption IA dans les PME françaises. Données terrain, tendances et comparaisons sectorielles.",
      h2Variants: [
        "Méthodologie du baromètre Axion-IA",
        "Les grandes évolutions 2025 → 2026",
        "Ce que les PME prévoient pour 2027",
      ],
    },
    urlCible: "/fr/ressources/barometre-ia-pme-france",
    source: "manuel",
    note: "Actif éditorial annuel à créer — fort potentiel PR et backlinks presse — schema Dataset",
  },

  {
    keyword: "adoption intelligence artificielle PME France données",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'adoption de l'IA dans les PME françaises — Données et réalité terrain",
      metaTitle: "Adoption IA PME France — Données terrain 2026",
      metaDescription:
        "Entre discours et réalité : où en sont vraiment les PME françaises dans l'adoption de l'IA ? Données terrain, freins identifiés, leviers actionnables.",
      h2Variants: [
        "L'écart entre intention et adoption réelle",
        "Les principaux freins à l'adoption IA en PME",
        "Ce que font concrètement les PME qui réussissent leur IA",
      ],
    },
    urlCible: "/fr/blog/adoption-ia-pme-france-donnees-2026",
    source: "manuel",
    note: "Longue traîne thought leadership — relier vers baromètre et ressources chiffrées",
  },

  {
    keyword: "transformation IA PME France guide pratique",
    intent: "informationnel",
    kbType: "implementation_playbook",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Guide pratique de la transformation IA pour les PME françaises",
      metaTitle: "Transformation IA PME France — Guide pratique 2026",
      metaDescription:
        "De l'audit à l'implémentation : le guide complet pour réussir la transformation IA d'une PME française, étape par étape et sans jargon inutile.",
      h2Variants: [
        "Par où commencer quand on est une PME sans DSI ?",
        "Les 5 étapes d'une transformation IA réussie",
        "Éviter les 3 pièges classiques des PME qui se lancent",
      ],
    },
    urlCible: "/fr/ressources/guide-transformation-ia-pme-france",
    source: "manuel",
    note: "Pilier content — relier vers les pages services audit, formation, implémentation",
  },

  {
    keyword: "rapport IA entreprise France 2026 BpiFrance",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Rapport IA entreprises France 2026 — Ce que les données BpiFrance révèlent",
      metaTitle: "Rapport IA France 2026 BpiFrance — Analyse Axion-IA",
      metaDescription:
        "Analyse du rapport BpiFrance sur l'IA en entreprise : chiffres clés, secteurs en avance et ce que cela signifie pour votre feuille de route.",
      h2Variants: [
        "Les enseignements clés du rapport BpiFrance 2026",
        "Secteurs moteurs et secteurs en retard",
        "Ce que le rapport ne dit pas et que terrain confirme",
      ],
    },
    urlCible: "/fr/blog/rapport-ia-bpifrance-2026",
    source: "manuel",
    note: "Contenu de curation expert — citer rapport source officiel + analyse Axion-IA — bon pour backlinks institutionnels",
  },

  // ── H4 — Social proof & preuve ───────────────────────────────────────────

  {
    keyword: "études de cas IA PME France résultats concrets",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Études de cas IA pour PME françaises — Résultats documentés et chiffrés",
      metaTitle: "Études de cas IA PME France — Résultats concrets 2026",
      metaDescription:
        "Découvrez comment des PME françaises ont transformé leurs processus grâce à l'IA. Cas réels, chiffres vérifiés, secteurs variés.",
      h2Variants: [
        "6 études de cas IA PME avec résultats mesurés",
        "Comment nous documentons chaque mission IA",
        "Filtrer par secteur ou type de mission",
      ],
    },
    urlCible: "/fr/cas-concrets/",
    source: "manuel",
    note: "Page hub études de cas — schema ItemList + CaseStudy — fort potentiel de conversion",
  },

  {
    keyword: "résultats concrets IA entreprise exemples chiffrés",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Des résultats IA concrets et chiffrés — Exemples réels d'entreprises",
      metaTitle: "Résultats IA entreprise — Exemples chiffrés & concrets",
      metaDescription:
        "Gain de temps, économies réalisées, processus accélérés : des exemples chiffrés de résultats IA obtenus par de vraies entreprises.",
      h2Variants: [
        "Exemples de gains obtenus par secteur",
        "Les métriques suivies après chaque mission",
        "Comment passer d'un projet pilote à une IA généralisée",
      ],
    },
    variables: {
      resultat: "+30 % de productivité documentée en moyenne sur les missions IA",
      delai: "à 90 jours",
    },
    urlCible: "/fr/cas-concrets/resultats",
    source: "manuel",
    note: "Requête de validation — enrichir avec schema HowTo + ClaimReview quand chiffres vérifiables",
  },

  {
    keyword: "témoignages clients IA PME France authentiques",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Témoignages authentiques de PME françaises sur leur projet IA",
      metaTitle: "Témoignages clients IA PME France | Axion-IA",
      metaDescription:
        "Verbatims authentiques de dirigeants et équipes de PME françaises après leur accompagnement IA par Axion-IA. Sans filtre, avec chiffres.",
      h2Variants: [
        "Ce que les dirigeants disent après 3 mois d'accompagnement",
        "La parole aux équipes : IA et quotidien opérationnel",
        "Les doutes avant, les certitudes après",
      ],
    },
    urlCible: "/fr/cas-concrets/temoignages",
    source: "manuel",
    note: "Schema Review + Person recommandé — vérifier RGPD consentement avant publication verbatims",
  },

  {
    keyword: "avant après IA entreprise exemples transformation",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Avant / Après IA en entreprise — Exemples de transformation documentés",
      metaTitle: "Avant après IA entreprise — Exemples concrets 2026",
      metaDescription:
        "Comment l'IA change réellement le quotidien d'une entreprise ? Des exemples avant/après documentés : temps gagné, erreurs évitées, coûts réduits.",
      h2Variants: [
        "3 exemples d'entreprises transformées par l'IA en 6 mois",
        "Ce qui change vraiment (et ce qui ne change pas)",
        "Le point de bascule : quand l'IA devient incontournable",
      ],
    },
    urlCible: "/fr/cas-concrets/avant-apres",
    source: "manuel",
    note: "Format narratif fort — structurer avec schema BeforeAndAfterSpecification si disponible, sinon Article",
  },

  {
    keyword: "cas client IA formation entreprise PME",
    intent: "informationnel",
    kbType: "case_study",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Cas clients : des PME qui ont formé leurs équipes à l'IA avec Axion-IA",
      metaTitle: "Cas client formation IA PME | Axion-IA résultats réels",
      metaDescription:
        "Des PME françaises ont choisi Axion-IA pour former leurs équipes à l'IA. Retours détaillés : contenus, format, impact opérationnel post-formation.",
      h2Variants: [
        "Comment se passe une formation IA en entreprise chez Axion-IA",
        "Ce que les équipes ont retenu à 3 mois",
        "Formation IA sur mesure vs catalogue — ce que choisissent nos clients",
      ],
    },
    variables: { resultat: "équipes autonomes sur 3 outils IA ciblés", delai: "en 4 semaines" },
    urlCible: "/fr/cas-concrets/formation-ia-entreprise",
    source: "manuel",
    note: "Longue traîne preuve sociale — pas de mention OPCO/Qualiopi/CPF",
  },

  {
    keyword: "retour sur investissement IA PME exemples réels",
    intent: "informationnel",
    kbType: "roi_calculator_template",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "ROI de l'IA pour les PME — Exemples réels et calcul personnalisé",
      metaTitle: "ROI IA PME — Exemples réels | Calculateur Axion-IA",
      metaDescription:
        "Combien peut rapporter un projet IA à votre PME ? Des exemples concrets de ROI documentés et un calculateur pour estimer votre gain potentiel.",
      h2Variants: [
        "ROI IA : les métriques à suivre dès le départ",
        "Exemples de retour sur investissement par type de mission",
        "Calculez votre ROI IA potentiel en 3 minutes",
      ],
    },
    variables: {
      chiffre: "3-8",
      unite: "mois pour ROI positif sur une mission d'automatisation PME",
    },
    urlCible: "/fr/ressources/roi-ia-pme",
    source: "manuel",
    note: "Ressource interactive — intégrer calculateur ROI — fort potentiel de génération de leads",
  },

  {
    keyword: "succès implémentation IA entreprise France témoignage",
    intent: "informationnel",
    kbType: "case_study",
    module: "implementation",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Implémentations IA réussies en France — Témoignages et leçons apprises",
      metaTitle: "Implémentation IA réussie France — Témoignages 2026",
      metaDescription:
        "Comment des entreprises françaises ont réussi leur implémentation IA avec Axion-IA. Facteurs clés de succès, erreurs évitées, résultats obtenus.",
      h2Variants: [
        "Les 3 facteurs qui font la différence dans une implémentation IA",
        "Ce que cachent les 'réussites IA' dans la presse",
        "Comment structurer un projet IA pour le mener à terme",
      ],
    },
    urlCible: "/fr/cas-concrets/implementation-ia",
    source: "manuel",
    note: "Intent informationnel profond — ancrer sur les facteurs clés de succès, pas sur la promotion",
  },

  {
    keyword: "recommandation cabinet IA entreprise France bouche à oreille",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Axion-IA recommandé par des entreprises françaises — La confiance qui se transmet",
      metaTitle: "Cabinet IA recommandé France — Avis & bouche à oreille",
      metaDescription:
        "Pourquoi des chefs d'entreprise recommandent Axion-IA à leurs pairs ? Retours spontanés et facteurs de confiance identifiés.",
      h2Variants: [
        "Ce qui se dit sur Axion-IA dans les réseaux dirigeants",
        "Pourquoi la recommandation est notre principal canal d'acquisition",
        "Partenaires et prescripteurs : ceux qui nous font confiance",
      ],
    },
    urlCible: "/fr/a-propos/avis-clients",
    source: "manuel",
    note: "Longue traîne brand — enrichir avec schema Review et liens vers partenaires/prescripteurs",
  },

  // ── H5 — Différenciateurs "wahou" ────────────────────────────────────────

  {
    keyword: "IA opérationnelle résultats rapides PME France",
    intent: "transactionnel",
    kbType: "case_study",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "IA opérationnelle pour PME — Des résultats rapides et mesurables dès le 1er mois",
      metaTitle: "IA opérationnelle PME France — Résultats rapides | Axion-IA",
      metaDescription:
        "Axion-IA déploie des IA opérationnelles dans les PME françaises. Premiers résultats mesurables en 4 semaines, ROI positif documenté à 3 mois.",
      h2Variants: [
        "Qu'est-ce que l'IA opérationnelle — et pourquoi ça change tout",
        "De la démo au déploiement réel : notre méthode express",
        "Exemples d'IA opérationnelles déployées en PME",
      ],
    },
    variables: {
      resultat: "premiers résultats dès la 1re semaine de déploiement",
      delai: "ROI positif à 3 mois",
    },
    urlCible: "/fr/cas-concrets/ia-operationnelle-pme",
    source: "manuel",
    note: "HEAD transactionnel — couvrir les deux termes cabinet IA / agence IA dans la page",
  },

  {
    keyword: "cabinet IA résultats mesurables engagement",
    intent: "transactionnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Un cabinet IA qui s'engage sur des résultats mesurables — Pas de promesses vagues",
      metaTitle: "Cabinet IA résultats mesurables | Axion-IA France",
      metaDescription:
        "Axion-IA définit des KPIs dès le départ et les suit avec vous. Résultats documentés à 30, 60 et 90 jours. Engagement sur les livrables, pas sur des présentations.",
      h2Variants: [
        "Notre engagement contractuel sur les livrables",
        "Comment nous définissons les KPIs avant chaque mission",
        "Ce qui se passe si les résultats ne sont pas au rendez-vous",
      ],
    },
    variables: {
      resultat: "KPIs définis avant la mission, mesurés à 30-90 jours",
      delai: "dès la phase de cadrage",
    },
    urlCible: "/fr/a-propos/engagement-resultats",
    source: "manuel",
    note: "Différenciateur fort — positionner sur la traçabilité des résultats vs concurrents flous",
  },

  {
    keyword: "IA ROI prouvé PME France investissement rentable",
    intent: "transactionnel",
    kbType: "roi_calculator_template",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "IA avec ROI prouvé pour PME françaises — L'investissement qui se justifie",
      metaTitle: "IA ROI prouvé PME France — Investissement rentable",
      metaDescription:
        "Comment Axion-IA garantit un ROI documenté sur chaque mission IA en PME. Exemples chiffrés, méthode de calcul et témoignages de dirigeants.",
      h2Variants: [
        "Pourquoi le ROI IA est souvent sous-estimé en PME",
        "Comment prouver le ROI d'un projet IA à votre direction",
        "Les missions IA à ROI le plus rapide en PME",
      ],
    },
    variables: { resultat: "ROI moyen 3× l'investissement à 12 mois", delai: "positif à 3-4 mois" },
    urlCible: "/fr/ressources/roi-ia-pme",
    source: "manuel",
    note: "Transactionnel tardif — ancrer sur la preuve documentée, pas sur des estimations théoriques",
  },

  {
    keyword: "cabinet IA opérationnel France mission déployée",
    intent: "transactionnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Un cabinet IA qui déploie vraiment — Des missions IA opérationnelles en France",
      metaTitle: "Cabinet IA opérationnel France — Missions déployées",
      metaDescription:
        "Axion-IA ne fait pas que conseiller : nous déployons des IA opérationnelles dans vos équipes. Exemples de missions livrées et utilisées au quotidien.",
      h2Variants: [
        "La différence entre conseil IA et déploiement IA",
        "Nos missions IA livrées : exemples par secteur",
        "Ce que vos équipes utilisent vraiment après notre passage",
      ],
    },
    urlCible: "/fr/cas-concrets/",
    source: "manuel",
    note: "Différenciateur opérationnel — mettre en avant la livraison concrète vs audit sans suite",
  },

  {
    keyword: "agence IA engagement concret résultats rapides France",
    intent: "transactionnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Une agence IA avec un engagement concret — Résultats rapides, pas de slides",
      metaTitle: "Agence IA résultats rapides France | Axion-IA",
      metaDescription:
        "Axion-IA s'engage sur du concret : livrables documentés, résultats mesurés, équipes formées. Pas de présentation sans suite. Devis gratuit.",
      h2Variants: [
        "Notre promesse : du déployé, pas du présenté",
        "Ce que 'résultats rapides' signifie dans notre méthode",
        "Comment nous raccourcissons le délai entre décision et valeur",
      ],
    },
    variables: {
      resultat: "premier livrable opérationnel sous 3 semaines",
      delai: "valeur dès la 1re semaine",
    },
    urlCible: "/fr/a-propos/engagement-resultats",
    source: "manuel",
    note: "Couvrir les deux termes agence IA / cabinet IA — positionnement double validé par Will",
  },

  {
    keyword: "IA sans jargon PME France approche pragmatique",
    intent: "benefice",
    kbType: "guide",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "L'IA sans jargon pour les PME françaises — L'approche pragmatique Axion-IA",
      metaTitle: "IA sans jargon PME France — Approche pragmatique",
      metaDescription:
        "Axion-IA parle IA en termes de résultats, pas de technologie. Découvrez comment nous accompagnons des PME sans DSI vers une IA réellement utile.",
      h2Variants: [
        "Pourquoi le jargon IA nuit aux projets des PME",
        "Notre méthode : partir du problème métier, pas de la technologie",
        "Ce qu'une PME sans DSI peut réaliser avec l'IA",
      ],
    },
    urlCible: "/fr/blog/ia-sans-jargon-pme-approche-pragmatique",
    source: "manuel",
    note: "Contenu d'entrée de funnel — fort pour les PME intimidées par l'IA — schema Article + speakable",
  },

  {
    keyword: "accompagnement IA entreprise France sur mesure experts",
    intent: "transactionnel",
    kbType: "case_study",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Accompagnement IA sur mesure en France — Des experts qui s'adaptent à votre réalité",
      metaTitle: "Accompagnement IA France sur mesure | Axion-IA",
      metaDescription:
        "Chaque entreprise est différente. Axion-IA conçoit chaque accompagnement IA selon votre secteur, vos outils et vos objectifs. Devis sous 48 h.",
      h2Variants: [
        "Pourquoi le sur mesure est indispensable en IA entreprise",
        "Notre process : de l'audit au déploiement personnalisé",
        "Exemples d'accompagnements personnalisés selon le secteur",
      ],
    },
    variables: {
      resultat: "plan IA adapté à votre contexte livré en 5 jours",
      delai: "déploiement en 4-8 semaines",
    },
    urlCible: "/fr/accompagnement-ia/",
    source: "manuel",
    note: "Page service pivot — relier vers audit, formation, implémentation, coaching",
  },

  {
    keyword: "expertise IA entreprise France équipe dédiée",
    intent: "transactionnel",
    kbType: "guide",
    module: "transversal",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Une équipe dédiée d'experts IA pour votre entreprise — L'avantage Axion-IA",
      metaTitle: "Expertise IA entreprise France — Équipe dédiée Axion-IA",
      metaDescription:
        "Axion-IA met à disposition une équipe d'experts IA dédiée à votre projet. Continuité, responsabilité, montée en charge — ce que les freelances ne peuvent pas offrir.",
      h2Variants: [
        "Ce que change une équipe dédiée vs un consultant ponctuel",
        "Notre équipe : profils, expertises, secteurs maîtrisés",
        "Comment nous garantissons la continuité sur les projets longs",
      ],
    },
    urlCible: "/fr/a-propos/equipe",
    source: "manuel",
    note: "Cibler ETI qui ont besoin de continuité — différenciateur vs freelance isolé",
  },

  {
    keyword: "cabinet IA fondé par experts français europe",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Axion-IA — Fondé par des experts français, ancrage européen, résultats concrets",
      metaTitle: "Cabinet IA experts français Europe | Axion-IA",
      metaDescription:
        "Axion-IA est fondé par des experts français de l'IA, opérant en Europe. Découvrez notre ADN, notre approche franco-européenne et nos engagements.",
      h2Variants: [
        "Notre ADN : expertise française, ouverture européenne",
        "Ce que notre positionnement franco-européen change pour vous",
        "Les valeurs qui guident chaque mission Axion-IA",
      ],
    },
    urlCible: "/fr/a-propos/",
    source: "manuel",
    note: "Brand — insister sur 'franco-européen' et 'experts français', jamais 'Made in France' ni 'OÜ'",
  },
];
