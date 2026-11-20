// Aides de test partagées (non collectées comme spec : pas de suffixe .spec).
export const REPONSES_VALIDES = {
  companySize: "PME",
  sector: "__SECTOR__",
  region: "__REGION__",
  respondentRole: "ceo_founder",
  maturityLevel: "poc",
  competitorsUseAi: "probably",
  hasStrategy: "in_progress",
  useCases: ["automation"],
  tools: ["chatgpt"],
  annualBudget: "k1_5",
  barriers: ["budget"],
  timeSavedPerDay: "lt_30min",
  rgpdConcern: "somewhat",
  teamTrained: "informal",
  investmentIntent: "stable",
} as const;

export const HASH_OK = "a".repeat(64);
