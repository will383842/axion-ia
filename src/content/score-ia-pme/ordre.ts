// Score IA TPE-PME — ordre des 15 écrans (amendement C / revue experte B3).
// Faits d'abord, opinions ensuite, profil à la fin ; « concurrents » APRÈS les faits (désirabilité sociale).

export const ORDRE_QUESTIONS = [
  "companySize",
  "maturityLevel",
  "useCases",
  "tools",
  "timeSavedPerDay",
  "teamTrained",
  "hasStrategy",
  "annualBudget",
  "barriers",
  "rgpdConcern",
  "competitorsUseAi",
  "investmentIntent",
  "sector",
  "region",
  "respondentRole",
] as const;

export type CleQuestion = (typeof ORDRE_QUESTIONS)[number];
