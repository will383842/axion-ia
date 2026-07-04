import { describe, it, expect } from "vitest";
import { buildSegmentedExport, type ExportRowWithRgpd } from "./generate";
import {
  buildSuppressionSets,
  emptySuppressionSets,
} from "@/server/prospection/rgpd/export-filter";

function row(over: Partial<ExportRowWithRgpd>): ExportRowWithRgpd {
  return {
    siren: "100000001",
    denomination: "ACME",
    naf: "41.20A",
    secteur: "btp",
    taille: "PME",
    departement: "38",
    commune: "Grenoble",
    emailPrincipal: "contact@acme.fr",
    telephonePrincipal: null,
    contactabilite: "exploitable",
    leadScore: 80,
    source: "stock_sirene",
    lastCollectedAt: null,
    statutDiffusion: "diffusible",
    optOut: false,
    emails: ["contact@acme.fr"],
    ...over,
  };
}

describe("buildSegmentedExport", () => {
  it("segmente en 3 fichiers", () => {
    const out = buildSegmentedExport(
      [
        row({ siren: "1", contactabilite: "exploitable" }),
        row({ siren: "2", contactabilite: "partiel" }),
        row({ siren: "3", contactabilite: "non_contactable" }),
      ],
      emptySuppressionSets(),
    );
    expect(out.counts).toEqual({ exploitables: 1, partiels: 1, a_completer: 1 });
    expect(out.exploitables.split("\r\n").length).toBe(2); // header + 1 ligne
  });

  it("exclut non-diffusible de TOUS les fichiers (#4)", () => {
    const out = buildSegmentedExport(
      [row({ siren: "1", statutDiffusion: "non_diffusible" })],
      emptySuppressionSets(),
    );
    expect(out.counts.exploitables).toBe(0);
    expect(out.excluded).toBe(1);
    expect(out.excludedByReason.non_diffusible).toBe(1);
  });

  it("exclut un opt-out post-collecte par SIREN (#5)", () => {
    const sets = buildSuppressionSets([{ type: "siren", valueNormalized: "1" }]);
    const out = buildSegmentedExport([row({ siren: "1" })], sets);
    expect(out.excluded).toBe(1);
    expect(out.excludedByReason.siren).toBe(1);
    expect(out.exploitables.split("\r\n").length).toBe(1); // header seul
  });

  it("exclut par domaine opposé", () => {
    const sets = buildSuppressionSets([{ type: "domaine", valueNormalized: "acme.fr" }]);
    const out = buildSegmentedExport([row({ siren: "1", emails: ["x@acme.fr"] })], sets);
    expect(out.excludedByReason.domaine).toBe(1);
  });
});
