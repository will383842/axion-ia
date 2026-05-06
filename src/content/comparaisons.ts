// Comparison articles — Sprint 14 fixtures, replaced by Prisma in Sprint 15.
// Honest decision tables, no FUD, no vendor complacency.

export interface Comparison {
  slug: string;
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
}

export const COMPARISONS: ReadonlyArray<Comparison> = [
  {
    slug: "cabinet-ia-vs-saas-generique",
    fr: {
      title: "Cabinet IA vs SaaS générique : quand choisir quoi ?",
      excerpt:
        "Le SaaS IA générique couvre 60-70 % des besoins standards. Le cabinet adresse les 30 % spécifiques métier.",
      body: "Le SaaS IA générique (ChatGPT Enterprise, Microsoft Copilot, Gemini for Workspace) couvre 60-70 % des besoins productivité standards : rédaction, résumés, traduction, analyse de documents génériques. Coût 20-30 €/user/mois. Le cabinet IA opérationnel comme AxionIA adresse les 30 % spécifiques métier non couverts : intégration aux process internes, RAG sur documents propriétaires, agents adaptés à votre stack outil. Coût ponctuel 5-50 k€ par projet, ROI mesurable sur 6-12 mois. Règle simple : commencez par le SaaS générique, escaladez au cabinet quand un besoin spécifique justifie un projet > 5 k€.",
    },
    en: {
      title: "AI consultancy vs generic SaaS: when to pick what?",
      excerpt:
        "Generic AI SaaS covers 60-70% of standard needs. Consultancy addresses the 30% domain-specific.",
      body: "Generic AI SaaS (ChatGPT Enterprise, Microsoft Copilot, Gemini for Workspace) covers 60-70% of standard productivity needs: writing, summaries, translation, generic document analysis. Cost €20-30/user/month. An operational AI consultancy like AxionIA addresses the 30% domain-specific not covered: internal process integration, RAG on proprietary documents, agents adapted to your tool stack. One-off cost €5-50k per project, measurable ROI over 6-12 months. Simple rule: start with generic SaaS, escalate to consultancy when a specific need justifies a > €5k project.",
    },
  },
  {
    slug: "fine-tuning-vs-rag",
    fr: {
      title: "Fine-tuning vs RAG : la décision technique en 2026",
      excerpt:
        "Le RAG couvre 80 % des cas. Le fine-tuning n'est justifié qu'au-delà de 10 k exemples métier.",
      body: "Le RAG (Retrieval-Augmented Generation) ancre les réponses IA sur vos documents via recherche vectorielle. Avantages : déploiement en 2-4 semaines, ~3-5 k€, mises à jour instantanées. Couvre 80 % des besoins B2B. Le fine-tuning spécialise un modèle sur vos données. Avantages : latence ultra-faible, style propriétaire, fonctionne offline. Inconvénients : 8-50 k€, 6-12 semaines, drift de qualité au fil des évolutions du modèle de base, mises à jour douloureuses. Règle : choisir le fine-tuning UNIQUEMENT si (1) volume de données métier > 10 k exemples, (2) latence sub-100 ms requise, (3) contraintes de souveraineté empêchant l'usage d'API externe.",
    },
    en: {
      title: "Fine-tuning vs RAG: the technical decision in 2026",
      excerpt: "RAG covers 80% of cases. Fine-tuning is only justified beyond 10k domain examples.",
      body: "RAG (Retrieval-Augmented Generation) grounds AI answers on your documents via vector search. Pros: 2-4 week deployment, ~€3-5k, instant updates. Covers 80% of B2B needs. Fine-tuning specialises a model on your data. Pros: ultra-low latency, proprietary style, works offline. Cons: €8-50k, 6-12 weeks, quality drift as base model evolves, painful updates. Rule: choose fine-tuning ONLY if (1) domain data volume > 10k examples, (2) sub-100ms latency required, (3) sovereignty constraints preventing external API usage.",
    },
  },
  {
    slug: "internalisation-vs-externalisation",
    fr: {
      title: "Internalisation vs externalisation IA : seuils de rentabilité",
      excerpt:
        "Externaliser sous 200 k€ de projets/an. Recruter au-dessus de 500 k€/an avec roadmap claire.",
      body: "Sous 200 k€ de projets IA/an, externaliser via cabinet est plus rentable : pas de coût fixe RH (data scientist 80-150 k€/an chargés), accès à plusieurs spécialisations (LLM, vision, RAG, agents), démarrage rapide. Entre 200-500 k€/an, mixer : 1 lead IA en interne pilotant cabinets externes au cas par cas. Au-dessus de 500 k€/an avec roadmap > 12 mois, recruter une équipe interne (2-4 personnes) devient rentable. Critère décisif : la prédictibilité du backlog. Sans roadmap claire à 6 mois, la flexibilité du cabinet bat l'équipe interne, même au-dessus du seuil.",
    },
    en: {
      title: "In-house vs outsourcing AI: profitability thresholds",
      excerpt: "Outsource below €200k projects/year. Hire above €500k/year with a clear roadmap.",
      body: "Below €200k AI projects/year, outsourcing via a consultancy is more profitable: no fixed HR cost (€80-150k/year loaded data scientist), access to multiple specialisations (LLM, vision, RAG, agents), fast start. Between €200-500k/year, mix: 1 internal AI lead piloting external consultancies case-by-case. Above €500k/year with > 12 month roadmap, hiring an internal team (2-4 people) becomes profitable. Decisive criterion: backlog predictability. Without a clear 6-month roadmap, consultancy flexibility beats the internal team, even above the threshold.",
    },
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}

export function getAllComparisonSlugs(): string[] {
  return COMPARISONS.map((c) => c.slug);
}
