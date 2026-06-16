/**
 * Observatoire IA 2026 — garde anti-régression : le questionnaire DOIT rester
 * aligné sur les enums Prisma et les SSOT (secteurs/régions/tailles). Si un
 * enum change sans mise à jour du questionnaire, ce test échoue.
 */

import { describe, it, expect } from "vitest";
import {
  CompanySize,
  RespondentRole,
  MaturityLevel,
  CompetitorsUseAi,
  HasStrategy,
  AnnualBudget,
  TimeSavedPerDay,
  RgpdConcern,
  TeamTrained,
  Satisfaction,
  InvestmentIntent,
} from "../../../../prisma/generated/client";
import { BAROMETER_QUESTIONS, COMPANY_SIZE_VALUES, SECTOR_SLUGS, REGION_SLUGS } from "../questions";
import {
  STUDY_SECTOR_COUNT,
  STUDY_REGION_COUNT,
  STUDY_COMPANY_SIZE_COUNT,
  STUDY_QUESTION_COUNT,
} from "../study";

function sorted(a: ReadonlyArray<string>): string[] {
  return [...a].sort();
}

describe("Observatoire — alignement questionnaire ↔ schéma", () => {
  it("expose exactement 16 questions", () => {
    expect(BAROMETER_QUESTIONS).toHaveLength(16);
    expect(STUDY_QUESTION_COUNT).toBe(16);
  });

  it("compte des dimensions dérivé des SSOT (jamais figé)", () => {
    expect(STUDY_SECTOR_COUNT).toBe(SECTOR_SLUGS.length);
    expect(STUDY_REGION_COUNT).toBe(REGION_SLUGS.length);
    expect(STUDY_REGION_COUNT).toBe(13);
    expect(STUDY_COMPANY_SIZE_COUNT).toBe(4);
  });

  it("companySize == enum Prisma CompanySize", () => {
    expect(sorted(COMPANY_SIZE_VALUES)).toEqual(sorted(Object.values(CompanySize)));
  });

  const ID_TO_ENUM: Record<string, Record<string, string>> = {
    respondentRole: RespondentRole,
    maturityLevel: MaturityLevel,
    competitorsUseAi: CompetitorsUseAi,
    hasStrategy: HasStrategy,
    annualBudget: AnnualBudget,
    timeSavedPerDay: TimeSavedPerDay,
    rgpdConcern: RgpdConcern,
    teamTrained: TeamTrained,
    satisfaction: Satisfaction,
    investmentIntent: InvestmentIntent,
  };

  it.each(Object.keys(ID_TO_ENUM))(
    "options de la question '%s' == valeurs de l'enum Prisma",
    (id) => {
      const q = BAROMETER_QUESTIONS.find((x) => x.id === id);
      expect(q, `question ${id} absente`).toBeDefined();
      expect(sorted(q!.options ?? [])).toEqual(sorted(Object.values(ID_TO_ENUM[id]!)));
    },
  );

  it("toutes les options single/multi sont non vides et uniques", () => {
    for (const q of BAROMETER_QUESTIONS) {
      if (q.source === "sector" || q.source === "region") continue;
      const opts = q.options ?? [];
      expect(opts.length, `${q.id} sans options`).toBeGreaterThan(0);
      expect(new Set(opts).size, `${q.id} options dupliquées`).toBe(opts.length);
    }
  });
});
