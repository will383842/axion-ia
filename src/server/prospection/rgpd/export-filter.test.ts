import { describe, it, expect } from "vitest";
import {
  buildSuppressionSets,
  exportExclusionReason,
  isExcludedFromExport,
  emptySuppressionSets,
  type ExportCandidate,
} from "./export-filter";

const OK: ExportCandidate = {
  siren: "123456789",
  statutDiffusion: "diffusible",
  optOut: false,
  emails: ["jean@acme.fr"],
};

describe("exportExclusionReason", () => {
  it("entreprise propre → non exclue", () => {
    expect(exportExclusionReason(OK, emptySuppressionSets())).toBeNull();
  });

  it("non-diffusible → exclu (#4, jamais exporté)", () => {
    expect(
      exportExclusionReason({ ...OK, statutDiffusion: "non_diffusible" }, emptySuppressionSets()),
    ).toBe("non_diffusible");
  });

  it("optOut sur l'entreprise → exclu", () => {
    expect(exportExclusionReason({ ...OK, optOut: true }, emptySuppressionSets())).toBe("opt_out");
  });

  it("opt-out post-collecte par SIREN (SuppressionEntry) → exclu (#5)", () => {
    const sets = buildSuppressionSets([{ type: "siren", valueNormalized: "123456789" }]);
    expect(exportExclusionReason(OK, sets)).toBe("siren");
  });

  it("opt-out par email → exclu", () => {
    const sets = buildSuppressionSets([{ type: "email", valueNormalized: "jean@acme.fr" }]);
    expect(exportExclusionReason(OK, sets)).toBe("email");
  });

  it("opt-out par domaine → exclu", () => {
    const sets = buildSuppressionSets([{ type: "domaine", valueNormalized: "acme.fr" }]);
    expect(exportExclusionReason(OK, sets)).toBe("domaine");
  });

  it("isExcludedFromExport = booléen", () => {
    expect(isExcludedFromExport(OK, emptySuppressionSets())).toBe(false);
    expect(isExcludedFromExport({ ...OK, optOut: true }, emptySuppressionSets())).toBe(true);
  });
});
