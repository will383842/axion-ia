// Comparison articles — Sprint 14 fixtures, replaced by Prisma in Sprint 15.
// Honest decision tables, no FUD, no vendor complacency.

/** Paire FR/EN pour les champs structurés enrichis. */
export interface ComparisonI18n {
  fr: string;
  en: string;
}
/** Ligne du tableau comparatif : un critère, sa valeur pour chaque option. */
export interface ComparisonCriterion {
  label: ComparisonI18n;
  optionA: ComparisonI18n;
  optionB: ComparisonI18n;
}
/** Carte « quand choisir quoi » : une condition → une recommandation. */
export interface ComparisonVerdict {
  when: ComparisonI18n;
  choose: ComparisonI18n;
}
/** Question/réponse People-Also-Ask du comparatif (→ FAQPage). */
export interface ComparisonFaqItem {
  question: ComparisonI18n;
  answer: ComparisonI18n;
}

export interface Comparison {
  slug: string;
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
  // Refonte templates 2026-06-22 — champs structurés (rendu « parfait » :
  // answer-first + tableau comparatif + verdicts spécifiques + FAQPage).
  // Optionnels : un comparatif sans ces champs retombe sur le rendu prose simple.
  updatedAt?: string;
  optionA?: ComparisonI18n;
  optionB?: ComparisonI18n;
  directAnswer?: ComparisonI18n;
  criteria?: ReadonlyArray<ComparisonCriterion>;
  verdicts?: ReadonlyArray<ComparisonVerdict>;
  faq?: ReadonlyArray<ComparisonFaqItem>;
}

export const COMPARISONS: ReadonlyArray<Comparison> = [
  {
    slug: "cabinet-ia-vs-saas-generique",
    fr: {
      title: "Cabinet IA vs SaaS générique : quand choisir quoi ?",
      excerpt:
        "Le SaaS IA générique couvre 60-70 % des besoins standards. Le cabinet adresse les 30 % spécifiques métier.",
      body: "Le SaaS IA générique (ChatGPT Enterprise, Microsoft Copilot, Gemini for Workspace) couvre 60-70 % des besoins productivité standards : rédaction, résumés, traduction, analyse de documents génériques. Coût 20-30 €/user/mois. Le cabinet IA opérationnel comme Axion-IA adresse les 30 % spécifiques métier non couverts : intégration aux process internes, RAG sur documents propriétaires, agents adaptés à votre stack outil. Coût ponctuel 5-50 k€ par projet, ROI mesurable sur 6-12 mois. Règle simple : commencez par le SaaS générique, escaladez au cabinet quand un besoin spécifique justifie un projet > 5 k€.",
    },
    en: {
      title: "AI consultancy vs generic SaaS: when to pick what?",
      excerpt:
        "Generic AI SaaS covers 60-70% of standard needs. Consultancy addresses the 30% domain-specific.",
      body: "Generic AI SaaS (ChatGPT Enterprise, Microsoft Copilot, Gemini for Workspace) covers 60-70% of standard productivity needs: writing, summaries, translation, generic document analysis. Cost €20-30/user/month. An operational AI consultancy like Axion-IA addresses the 30% domain-specific not covered: internal process integration, RAG on proprietary documents, agents adapted to your tool stack. One-off cost €5-50k per project, measurable ROI over 6-12 months. Simple rule: start with generic SaaS, escalate to consultancy when a specific need justifies a > €5k project.",
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

/**
 * Refonte templates 2026-06-22 — données structurées par comparatif
 * (restructuration FIDÈLE des body existants, zéro chiffre inventé). Fusionnées
 * dans `getComparison` pour ne pas alourdir le tableau `COMPARISONS` de base.
 */
type ComparisonEnrichment = Pick<
  Comparison,
  "updatedAt" | "optionA" | "optionB" | "directAnswer" | "criteria" | "verdicts" | "faq"
>;

const ENRICHED: Record<string, ComparisonEnrichment> = {
  "cabinet-ia-vs-saas-generique": {
    updatedAt: "2026-06-22",
    optionA: { fr: "Cabinet IA", en: "AI consultancy" },
    optionB: { fr: "SaaS générique", en: "Generic SaaS" },
    directAnswer: {
      fr: "Commencez par le SaaS IA générique, qui couvre 60-70 % des besoins productivité standards pour 20-30 €/user/mois ; escaladez vers un cabinet IA opérationnel uniquement quand un besoin spécifique métier justifie un projet de plus de 5 k€.",
      en: "Start with generic AI SaaS, which covers 60-70% of standard productivity needs for €20-30/user/month; escalate to an operational AI consultancy only when a domain-specific need justifies a project above €5k.",
    },
    criteria: [
      {
        label: { fr: "Couverture des besoins", en: "Needs coverage" },
        optionA: {
          fr: "30 % spécifiques métier non couverts par le SaaS",
          en: "The 30% domain-specific not covered by SaaS",
        },
        optionB: {
          fr: "60-70 % des besoins productivité standards",
          en: "60-70% of standard productivity needs",
        },
      },
      {
        label: { fr: "Coût", en: "Cost" },
        optionA: { fr: "5-50 k€ ponctuel par projet", en: "€5-50k one-off per project" },
        optionB: { fr: "20-30 €/user/mois", en: "€20-30/user/month" },
      },
      {
        label: { fr: "Cas d'usage", en: "Use cases" },
        optionA: {
          fr: "Intégration aux process, RAG sur documents propriétaires, agents adaptés à votre stack",
          en: "Process integration, RAG on proprietary documents, agents adapted to your stack",
        },
        optionB: {
          fr: "Rédaction, résumés, traduction, analyse de documents génériques",
          en: "Writing, summaries, translation, generic document analysis",
        },
      },
      {
        label: { fr: "Modèle de facturation", en: "Billing model" },
        optionA: { fr: "Ponctuel par projet", en: "One-off per project" },
        optionB: { fr: "Abonnement par utilisateur", en: "Per-user subscription" },
      },
      {
        label: { fr: "ROI", en: "ROI" },
        optionA: { fr: "Mesurable sur 6-12 mois", en: "Measurable over 6-12 months" },
        optionB: { fr: "Immédiat sur besoins standards", en: "Immediate on standard needs" },
      },
      {
        label: { fr: "Exemples", en: "Examples" },
        optionA: {
          fr: "Cabinet IA opérationnel (ex. Axion-IA)",
          en: "Operational AI consultancy (e.g. Axion-IA)",
        },
        optionB: {
          fr: "ChatGPT Enterprise, Microsoft Copilot, Gemini for Workspace",
          en: "ChatGPT Enterprise, Microsoft Copilot, Gemini for Workspace",
        },
      },
    ],
    verdicts: [
      {
        when: {
          fr: "Vos besoins sont des tâches productivité standards (rédaction, résumés, traduction, analyse de documents génériques)",
          en: "Your needs are standard productivity tasks (writing, summaries, translation, generic document analysis)",
        },
        choose: {
          fr: "Le SaaS IA générique, à 20-30 €/user/mois, qui couvre 60-70 % de ces besoins",
          en: "Generic AI SaaS, at €20-30/user/month, which covers 60-70% of these needs",
        },
      },
      {
        when: {
          fr: "Un besoin spécifique métier justifie un projet de plus de 5 k€",
          en: "A domain-specific need justifies a project above €5k",
        },
        choose: {
          fr: "Le cabinet IA opérationnel, projet ponctuel 5-50 k€ avec ROI mesurable sur 6-12 mois",
          en: "The operational AI consultancy, a €5-50k one-off project with measurable ROI over 6-12 months",
        },
      },
      {
        when: {
          fr: "Vous démarrez et n'avez pas encore identifié de besoin spécifique au-delà des 30 % métier",
          en: "You are starting out and have not yet identified a specific need beyond the 30% domain-specific",
        },
        choose: {
          fr: "Commencez par le SaaS générique, puis escaladez au cabinet quand un besoin dépasse 5 k€",
          en: "Start with generic SaaS, then escalate to a consultancy when a need exceeds €5k",
        },
      },
    ],
    faq: [
      {
        question: {
          fr: "Un SaaS IA générique suffit-il pour mon entreprise ?",
          en: "Is a generic AI SaaS enough for my company?",
        },
        answer: {
          fr: "Il suffit pour les besoins productivité standards, qu'il couvre à 60-70 % (rédaction, résumés, traduction, analyse de documents génériques) pour 20-30 €/user/mois. Il ne couvre pas les 30 % spécifiques métier comme l'intégration à vos process internes ou le RAG sur vos documents propriétaires.",
          en: "It is enough for standard productivity needs, which it covers at 60-70% (writing, summaries, translation, generic document analysis) for €20-30/user/month. It does not cover the 30% domain-specific such as integration with your internal processes or RAG on your proprietary documents.",
        },
      },
      {
        question: {
          fr: "Quand passer d'un SaaS générique à un cabinet IA ?",
          en: "When should you move from a generic SaaS to an AI consultancy?",
        },
        answer: {
          fr: "La règle simple : commencez par le SaaS générique et escaladez vers un cabinet quand un besoin spécifique justifie un projet de plus de 5 k€, par exemple des agents adaptés à votre stack outil ou l'intégration à vos process internes.",
          en: "The simple rule: start with generic SaaS and escalate to a consultancy when a specific need justifies a project above €5k, for example agents adapted to your tool stack or integration with your internal processes.",
        },
      },
      {
        question: {
          fr: "Combien coûte un projet de cabinet IA opérationnel ?",
          en: "How much does an operational AI consultancy project cost?",
        },
        answer: {
          fr: "Un projet est un coût ponctuel de 5 à 50 k€, avec un ROI mesurable sur 6 à 12 mois, contre un abonnement récurrent de 20-30 €/user/mois pour un SaaS générique.",
          en: "A project is a one-off cost of €5-50k, with measurable ROI over 6-12 months, versus a recurring subscription of €20-30/user/month for a generic SaaS.",
        },
      },
      {
        question: {
          fr: "Cabinet IA et SaaS générique sont-ils complémentaires ?",
          en: "Are an AI consultancy and a generic SaaS complementary?",
        },
        answer: {
          fr: "Oui : le SaaS générique couvre les 60-70 % de besoins productivité standards, tandis que le cabinet adresse les 30 % spécifiques métier non couverts, comme le RAG sur documents propriétaires ou les agents adaptés à votre stack outil.",
          en: "Yes: the generic SaaS covers the 60-70% of standard productivity needs, while the consultancy addresses the 30% domain-specific not covered, such as RAG on proprietary documents or agents adapted to your tool stack.",
        },
      },
    ],
  },
  "fine-tuning-vs-rag": {
    updatedAt: "2026-06-22",
    optionA: { fr: "Fine-tuning", en: "Fine-tuning" },
    optionB: { fr: "RAG", en: "RAG" },
    directAnswer: {
      fr: "Optez pour le RAG par défaut : il couvre 80 % des besoins B2B, se déploie en 2-4 semaines pour ~3-5 k€ avec mises à jour instantanées. Ne choisissez le fine-tuning que si vos données métier dépassent 10 k exemples, qu'une latence sub-100 ms est requise, ou que des contraintes de souveraineté interdisent toute API externe.",
      en: "Default to RAG: it covers 80% of B2B needs, deploys in 2-4 weeks for ~€3-5k with instant updates. Only choose fine-tuning if your domain data exceeds 10k examples, sub-100ms latency is required, or sovereignty constraints rule out any external API.",
    },
    criteria: [
      {
        label: { fr: "Coût", en: "Cost" },
        optionA: { fr: "8-50 k€", en: "€8-50k" },
        optionB: { fr: "~3-5 k€", en: "~€3-5k" },
      },
      {
        label: { fr: "Délai de déploiement", en: "Deployment time" },
        optionA: { fr: "6-12 semaines", en: "6-12 weeks" },
        optionB: { fr: "2-4 semaines", en: "2-4 weeks" },
      },
      {
        label: { fr: "Mises à jour", en: "Updates" },
        optionA: { fr: "Douloureuses, drift de qualité", en: "Painful, quality drift" },
        optionB: { fr: "Instantanées", en: "Instant" },
      },
      {
        label: { fr: "Couverture besoins B2B", en: "B2B needs coverage" },
        optionA: { fr: "Cas spécifiques uniquement", en: "Specific cases only" },
        optionB: { fr: "80 % des besoins", en: "80% of needs" },
      },
      {
        label: { fr: "Atouts clés", en: "Key strengths" },
        optionA: {
          fr: "Latence ultra-faible, style propriétaire, offline",
          en: "Ultra-low latency, proprietary style, offline",
        },
        optionB: {
          fr: "Ancrage sur vos documents (recherche vectorielle)",
          en: "Grounded on your documents (vector search)",
        },
      },
      {
        label: { fr: "Seuil de bascule", en: "Switch threshold" },
        optionA: {
          fr: "Plus de 10 k exemples, sub-100 ms, ou souveraineté",
          en: "Over 10k examples, sub-100ms, or sovereignty",
        },
        optionB: { fr: "Choix par défaut", en: "Default choice" },
      },
    ],
    verdicts: [
      {
        when: {
          fr: "Vous démarrez un projet IA B2B ancré sur vos documents, budget et délai serrés, contenus qui évoluent souvent",
          en: "You are starting a B2B AI project grounded on your documents, tight budget and timeline, frequently changing content",
        },
        choose: {
          fr: "RAG — 2-4 semaines, ~3-5 k€, mises à jour instantanées, couvre 80 % des besoins B2B",
          en: "RAG — 2-4 weeks, ~€3-5k, instant updates, covers 80% of B2B needs",
        },
      },
      {
        when: {
          fr: "Vous dépassez 10 k exemples de données métier ET avez besoin d'une latence sub-100 ms ou d'un fonctionnement offline",
          en: "You exceed 10k domain-data examples AND need sub-100ms latency or offline operation",
        },
        choose: {
          fr: "Fine-tuning — latence ultra-faible et style propriétaire justifient le coût de 8-50 k€ et les 6-12 semaines",
          en: "Fine-tuning — ultra-low latency and proprietary style justify the €8-50k cost and 6-12 weeks",
        },
      },
      {
        when: {
          fr: "Des contraintes de souveraineté vous empêchent d'utiliser une API externe",
          en: "Sovereignty constraints prevent you from using an external API",
        },
        choose: {
          fr: "Fine-tuning — il fonctionne offline, à l'inverse d'un RAG dépendant d'API externes",
          en: "Fine-tuning — it works offline, unlike a RAG reliant on external APIs",
        },
      },
    ],
    faq: [
      {
        question: {
          fr: "RAG ou fine-tuning : que choisir par défaut ?",
          en: "RAG or fine-tuning: which should be the default choice?",
        },
        answer: {
          fr: "Le RAG est le choix par défaut : il couvre 80 % des besoins B2B, se déploie en 2-4 semaines pour ~3-5 k€ et offre des mises à jour instantanées. Réservez le fine-tuning aux cas qui remplissent au moins un des trois critères de bascule.",
          en: "RAG is the default choice: it covers 80% of B2B needs, deploys in 2-4 weeks for ~€3-5k and offers instant updates. Reserve fine-tuning for cases meeting at least one of the three switch criteria.",
        },
      },
      {
        question: {
          fr: "Combien coûte le fine-tuning par rapport au RAG ?",
          en: "How much does fine-tuning cost compared to RAG?",
        },
        answer: {
          fr: "Le fine-tuning coûte entre 8 et 50 k€ pour 6-12 semaines, contre ~3-5 k€ et 2-4 semaines pour un RAG. L'écart de coût et de délai explique pourquoi le RAG reste le point de départ recommandé.",
          en: "Fine-tuning costs €8-50k over 6-12 weeks, versus ~€3-5k and 2-4 weeks for RAG. This cost and timeline gap is why RAG remains the recommended starting point.",
        },
      },
      {
        question: {
          fr: "Quand le fine-tuning est-il réellement justifié ?",
          en: "When is fine-tuning actually justified?",
        },
        answer: {
          fr: "Uniquement si l'un des trois critères est rempli : volume de données métier supérieur à 10 k exemples, latence sub-100 ms requise, ou contraintes de souveraineté empêchant l'usage d'une API externe. En dehors de ces cas, le RAG suffit.",
          en: "Only if one of three criteria is met: domain data volume above 10k examples, sub-100ms latency required, or sovereignty constraints preventing external API usage. Outside these cases, RAG is sufficient.",
        },
      },
      {
        question: {
          fr: "Le fine-tuning se dégrade-t-il dans le temps ?",
          en: "Does fine-tuning degrade over time?",
        },
        answer: {
          fr: "Oui : le fine-tuning subit un drift de qualité au fil des évolutions du modèle de base, et ses mises à jour sont douloureuses. Le RAG, lui, met à jour ses réponses instantanément en réindexant vos documents.",
          en: "Yes: fine-tuning suffers quality drift as the base model evolves, and its updates are painful. RAG, by contrast, updates its answers instantly by re-indexing your documents.",
        },
      },
    ],
  },
  "internalisation-vs-externalisation": {
    updatedAt: "2026-06-22",
    optionA: { fr: "Internalisation", en: "In-house" },
    optionB: { fr: "Externalisation", en: "Outsourcing" },
    directAnswer: {
      fr: "Sous 200 k€ de projets IA/an, externaliser via cabinet est plus rentable ; au-dessus de 500 k€/an avec une roadmap supérieure à 12 mois, une équipe interne (2-4 personnes) devient rentable. Entre les deux, mixez 1 lead interne pilotant des cabinets. Critère décisif : sans roadmap claire à 6 mois, la flexibilité du cabinet l'emporte, même au-dessus du seuil.",
      en: "Below €200k AI projects/year, outsourcing via a consultancy is more profitable; above €500k/year with a 12-month-plus roadmap, an internal team (2-4 people) becomes profitable. In between, mix 1 internal lead piloting consultancies. Decisive criterion: without a clear 6-month roadmap, consultancy flexibility wins, even above the threshold.",
    },
    criteria: [
      {
        label: { fr: "Seuil de rentabilité", en: "Profitability threshold" },
        optionA: { fr: "Plus de 500 k€/an de projets IA", en: "Over €500k/year AI projects" },
        optionB: { fr: "Moins de 200 k€/an de projets IA", en: "Under €200k/year AI projects" },
      },
      {
        label: { fr: "Coût fixe RH", en: "Fixed HR cost" },
        optionA: {
          fr: "Data scientist 80-150 k€/an chargés",
          en: "Loaded data scientist €80-150k/year",
        },
        optionB: { fr: "Aucun coût fixe RH", en: "No fixed HR cost" },
      },
      {
        label: { fr: "Démarrage", en: "Start-up time" },
        optionA: { fr: "Recrutement d'une équipe (2-4 pers.)", en: "Hiring a team (2-4 people)" },
        optionB: { fr: "Démarrage rapide", en: "Fast start" },
      },
      {
        label: { fr: "Couverture des spécialisations", en: "Specialisation coverage" },
        optionA: { fr: "Limitée à l'équipe recrutée", en: "Limited to the hired team" },
        optionB: {
          fr: "Plusieurs spé. (LLM, vision, RAG, agents)",
          en: "Multiple (LLM, vision, RAG, agents)",
        },
      },
      {
        label: { fr: "Condition roadmap", en: "Roadmap condition" },
        optionA: {
          fr: "Roadmap supérieure à 12 mois requise",
          en: "12-month-plus roadmap required",
        },
        optionB: { fr: "Flexible sans roadmap à 6 mois", en: "Flexible without 6-month roadmap" },
      },
      {
        label: { fr: "Cas d'usage idéal", en: "Ideal use case" },
        optionA: {
          fr: "Backlog prédictible, volume élevé",
          en: "Predictable backlog, high volume",
        },
        optionB: { fr: "Backlog incertain, volume faible", en: "Uncertain backlog, low volume" },
      },
    ],
    verdicts: [
      {
        when: {
          fr: "Vos projets IA dépassent 500 k€/an avec une roadmap claire à plus de 12 mois",
          en: "Your AI projects exceed €500k/year with a clear roadmap beyond 12 months",
        },
        choose: {
          fr: "Internalisation : recrutez une équipe interne de 2-4 personnes",
          en: "Internalisation: hire an internal team of 2-4 people",
        },
      },
      {
        when: {
          fr: "Vos projets IA restent sous 200 k€/an, ou votre backlog n'a pas de roadmap claire à 6 mois",
          en: "Your AI projects stay below €200k/year, or your backlog lacks a clear 6-month roadmap",
        },
        choose: {
          fr: "Externalisation : la flexibilité du cabinet l'emporte, même au-dessus du seuil",
          en: "Outsourcing: consultancy flexibility wins, even above the threshold",
        },
      },
      {
        when: {
          fr: "Vos projets IA se situent entre 200 et 500 k€/an",
          en: "Your AI projects sit between €200k and €500k/year",
        },
        choose: {
          fr: "Modèle mixte : 1 lead IA interne pilotant des cabinets au cas par cas",
          en: "Mixed model: 1 internal AI lead piloting consultancies case-by-case",
        },
      },
    ],
    faq: [
      {
        question: {
          fr: "À partir de quel budget faut-il internaliser l'IA ?",
          en: "From what budget should you internalise AI?",
        },
        answer: {
          fr: "Au-dessus de 500 k€/an de projets IA avec une roadmap supérieure à 12 mois, recruter une équipe interne de 2 à 4 personnes devient rentable. En dessous de 200 k€/an, l'externalisation via un cabinet reste plus avantageuse.",
          en: "Above €500k/year in AI projects with a roadmap longer than 12 months, hiring an internal team of 2 to 4 people becomes profitable. Below €200k/year, outsourcing via a consultancy remains more advantageous.",
        },
      },
      {
        question: {
          fr: "Combien coûte un data scientist en interne ?",
          en: "How much does an in-house data scientist cost?",
        },
        answer: {
          fr: "Un data scientist représente un coût fixe RH de 80 à 150 k€/an chargés. Ce coût fixe est l'une des raisons pour lesquelles l'externalisation est plus rentable sous 200 k€/an de projets.",
          en: "A data scientist represents a fixed HR cost of €80-150k/year loaded. This fixed cost is one reason outsourcing is more profitable below €200k/year in projects.",
        },
      },
      {
        question: {
          fr: "Quel est le critère décisif entre internaliser et externaliser ?",
          en: "What is the decisive criterion between internalising and outsourcing?",
        },
        answer: {
          fr: "Le critère décisif est la prédictibilité du backlog. Sans roadmap claire à 6 mois, la flexibilité du cabinet bat l'équipe interne, même au-dessus du seuil de 500 k€/an.",
          en: "The decisive criterion is backlog predictability. Without a clear 6-month roadmap, consultancy flexibility beats the internal team, even above the €500k/year threshold.",
        },
      },
      {
        question: {
          fr: "Existe-t-il un modèle intermédiaire entre interne et externe ?",
          en: "Is there a middle-ground model between in-house and outsourcing?",
        },
        answer: {
          fr: "Oui : entre 200 et 500 k€/an de projets IA, le modèle mixte consiste à avoir 1 lead IA en interne pilotant des cabinets externes au cas par cas.",
          en: "Yes: between €200k and €500k/year in AI projects, the mixed model means having 1 internal AI lead piloting external consultancies case-by-case.",
        },
      },
    ],
  },
};

export function getComparison(slug: string): Comparison | undefined {
  const base = COMPARISONS.find((c) => c.slug === slug);
  if (!base) return undefined;
  const enrichment = ENRICHED[slug];
  return enrichment ? { ...base, ...enrichment } : base;
}

export function getAllComparisonSlugs(): string[] {
  return COMPARISONS.map((c) => c.slug);
}
