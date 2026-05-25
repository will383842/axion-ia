/**
 * Mapping secteurs B2B → opportunités IA génériques.
 *
 * Sprint A · Phase 4 (Will 2026-05-25) — alimente `VilleTissuEconomique`.
 * Chaque entrée fournit une phrase courte (≤ 140 chars) sur les leviers IA
 * pertinents pour le secteur, applicable à toute ville française. **Aucune
 * donnée chiffrée fabriquée** ; uniquement des catégories qualitatives
 * (« forte présence », « émergente »…) et des opportunités métiers vraies
 * pour TPE/PME/ETI/GE indépendamment du territoire.
 *
 * Le matching se fait par mot-clé (`includes` insensible aux accents/casse)
 * sur les libellés `VilleCopy.topSectorsNaf` (ex « Banque & Finance »,
 * « Tech & Édition logicielle »). Si aucun match → fallback générique.
 */

/** Opportunité IA générique attachée à un secteur (FR / EN). */
export interface SectorIaOpportunity {
  /** Libellé secteur canonique affiché en tableau (FR). */
  readonly labelFr: string;
  /** Libellé secteur canonique affiché en tableau (EN). */
  readonly labelEn: string;
  /** Mots-clés normalisés (sans accents, lowercase) déclenchant ce mapping. */
  readonly keywords: ReadonlyArray<string>;
  /** Phrase opportunité IA FR — 1 phrase, jamais chiffrée. */
  readonly opportunityFr: string;
  /** Phrase opportunité IA EN miroir. */
  readonly opportunityEn: string;
}

/**
 * Catalogue 16 secteurs B2B Axion-IA fréquents en France. L'ordre n'a pas
 * d'importance — le matcher prend la première entrée dont l'un des keywords
 * est inclus dans le libellé `topSectorsNaf`. Conserver des keywords génériques
 * pour matcher des libellés variés (« Banque & Finance », « Banque, Assurance
 * & Finance », « Finance & Assurance »…).
 */
export const SECTOR_IA_OPPORTUNITIES: ReadonlyArray<SectorIaOpportunity> = [
  {
    labelFr: "Banque, Finance & Assurance",
    labelEn: "Banking, Finance & Insurance",
    keywords: ["banque", "finance", "assurance"],
    opportunityFr:
      "Scoring documentaire, détection de fraude, conformité KYC/LCB-FT et synthèse de dossiers clients.",
    opportunityEn:
      "Document scoring, fraud detection, KYC/AML compliance and client file summarisation.",
  },
  {
    labelFr: "Conseil & Services aux entreprises",
    labelEn: "Consulting & Business services",
    keywords: ["conseil", "services aux entreprises", "business services"],
    opportunityFr:
      "Rédaction assistée, recherche multi-sources, génération de livrables et automatisation reporting client.",
    opportunityEn:
      "AI-assisted writing, multi-source research, deliverable drafting and client reporting automation.",
  },
  {
    labelFr: "Tech & Édition logicielle",
    labelEn: "Tech & Software publishing",
    keywords: ["tech", "edition logicielle", "numerique", "logiciel", "software", "saas"],
    opportunityFr:
      "Copilote développeur, tri tickets support, génération de tests et amélioration documentation produit.",
    opportunityEn:
      "Developer copilot, support ticket triage, test generation and product documentation improvement.",
  },
  {
    labelFr: "Industrie & Équipementiers",
    labelEn: "Industry & OEMs",
    keywords: ["industrie", "equipementier", "manufacturing", "fabrication", "metallurgie"],
    opportunityFr:
      "Maintenance prédictive, contrôle qualité par vision, optimisation supply chain et assistance documentation atelier.",
    opportunityEn:
      "Predictive maintenance, vision-based QC, supply chain optimisation and shop-floor documentation support.",
  },
  {
    labelFr: "Santé & Biotech",
    labelEn: "Healthcare & Biotech",
    keywords: ["sante", "biotech", "dispositif medical", "pharma", "medical"],
    opportunityFr:
      "Aide à la décision clinique (sous supervision), structuration de dossiers patients et recherche bibliographique accélérée.",
    opportunityEn:
      "Clinical decision support (under supervision), patient record structuring and accelerated literature review.",
  },
  {
    labelFr: "Édition, Médias & Communication",
    labelEn: "Publishing, Media & Communication",
    keywords: ["edition", "media", "communication", "presse", "marketing"],
    opportunityFr:
      "Aide à la rédaction éditoriale, transcription multilingue, optimisation SEO et personnalisation de campagnes.",
    opportunityEn:
      "Editorial writing support, multilingual transcription, SEO optimisation and campaign personalisation.",
  },
  {
    labelFr: "Mode, Luxe & Cosmétique",
    labelEn: "Fashion, Luxury & Cosmetics",
    keywords: ["mode", "luxe", "cosmetique", "textile", "habillement"],
    opportunityFr:
      "Recommandation produit, génération de fiches détaillées, modération visuelle et anticipation des stocks saisonniers.",
    opportunityEn:
      "Product recommendation, rich content generation, visual moderation and seasonal stock anticipation.",
  },
  {
    labelFr: "Tourisme & Hôtellerie",
    labelEn: "Tourism & Hospitality",
    keywords: ["tourisme", "hotellerie", "voyage", "hotel", "hospitalite"],
    opportunityFr:
      "Conciergerie multilingue, gestion des avis clients, personnalisation des séjours et automatisation des réponses.",
    opportunityEn:
      "Multilingual concierge, review management, stay personalisation and automated guest replies.",
  },
  {
    labelFr: "Commerce & Distribution",
    labelEn: "Retail & Distribution",
    keywords: ["commerce", "distribution", "retail", "vente"],
    opportunityFr:
      "Catégorisation produits, prévision de demande, chatbots service client et optimisation marges par segment.",
    opportunityEn:
      "Product categorisation, demand forecasting, customer-service chatbots and per-segment margin optimisation.",
  },
  {
    labelFr: "Logistique & Transport",
    labelEn: "Logistics & Transport",
    keywords: ["logistique", "transport", "supply", "fret", "entrepot"],
    opportunityFr:
      "Optimisation tournées, prévision de capacité, lecture automatique de documents et suivi des litiges.",
    opportunityEn:
      "Route optimisation, capacity forecasting, automated document reading and dispute tracking.",
  },
  {
    labelFr: "Agroalimentaire",
    labelEn: "Food & Beverage",
    keywords: ["agroalimentaire", "agro", "alimentaire", "food"],
    opportunityFr:
      "Traçabilité lots, contrôle visuel des chaînes, optimisation des recettes et gestion documentaire qualité.",
    opportunityEn:
      "Batch traceability, line vision QC, recipe optimisation and quality document management.",
  },
  {
    labelFr: "BTP & Construction",
    labelEn: "Construction & Civil engineering",
    keywords: ["btp", "construction", "batiment", "travaux publics"],
    opportunityFr:
      "Lecture automatique des CCTP, estimation rapide, suivi chantier par image et synthèse de comptes-rendus.",
    opportunityEn:
      "Automated tender reading, fast estimating, image-based site monitoring and minute summarisation.",
  },
  {
    labelFr: "Énergie & Environnement",
    labelEn: "Energy & Environment",
    keywords: ["energie", "environnement", "energetique", "renouvelable"],
    opportunityFr:
      "Prévision de consommation, détection d'anomalies réseau, reporting CSRD et conformité environnementale.",
    opportunityEn:
      "Consumption forecasting, grid anomaly detection, CSRD reporting and environmental compliance.",
  },
  {
    labelFr: "Chimie & Pharmacie",
    labelEn: "Chemistry & Pharma",
    keywords: ["chimie", "pharmacie", "pharma"],
    opportunityFr:
      "Optimisation des procédés, surveillance qualité en continu et assistance à la veille réglementaire.",
    opportunityEn:
      "Process optimisation, continuous quality monitoring and regulatory intelligence support.",
  },
  {
    labelFr: "Éducation, Formation & Recherche",
    labelEn: "Education, Training & Research",
    keywords: ["education", "formation", "recherche", "enseignement"],
    opportunityFr:
      "Personnalisation des parcours, génération d'exercices, synthèse documentaire et support aux apprenants.",
    opportunityEn:
      "Personalised learning paths, exercise generation, document summarisation and learner support.",
  },
  {
    labelFr: "Juridique & Comptabilité",
    labelEn: "Legal & Accounting",
    keywords: ["juridique", "droit", "comptabilite", "legal", "expert-comptable"],
    opportunityFr:
      "Analyse contractuelle, synthèse de pièces, automatisation des écritures et veille jurisprudentielle.",
    opportunityEn:
      "Contract analysis, evidence summarisation, accounting automation and case-law monitoring.",
  },
];

/**
 * Phrase d'opportunité IA générique pour secteur sans mapping spécifique.
 * Vrai pour la quasi-totalité des TPE/PME/ETI/GE françaises — pas de chiffres.
 */
export const SECTOR_IA_FALLBACK_FR =
  "Automatisation des tâches répétitives, gestion documentaire augmentée et accélération du support client.";
export const SECTOR_IA_FALLBACK_EN =
  "Repetitive task automation, augmented document management and customer support acceleration.";

/**
 * Normalise un libellé secteur pour matching (lowercase + diacritiques retirés).
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Match un libellé `topSectorsNaf` libre (ex « Banque, Assurance & Finance »)
 * vers une entrée du catalogue. Renvoie `undefined` si aucun keyword ne match
 * (le composant utilisera le fallback générique).
 */
export function resolveSectorOpportunity(
  label: string,
): SectorIaOpportunity | undefined {
  const haystack = normalize(label);
  return SECTOR_IA_OPPORTUNITIES.find((entry) =>
    entry.keywords.some((kw) => haystack.includes(kw)),
  );
}
