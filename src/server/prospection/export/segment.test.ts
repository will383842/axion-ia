import { describe, it, expect } from "vitest";
import {
  segmentOfContactabilite,
  buildCsv,
  exportRowValues,
  EXPORT_COLUMNS,
  type ExportCompanyRow,
} from "./segment";

describe("segmentOfContactabilite", () => {
  it("mappe les 3 segments", () => {
    expect(segmentOfContactabilite("exploitable")).toBe("exploitables");
    expect(segmentOfContactabilite("partiel")).toBe("partiels");
    expect(segmentOfContactabilite("non_contactable")).toBe("a_completer");
    expect(segmentOfContactabilite(null)).toBe("a_completer");
  });
});

const ROW: ExportCompanyRow = {
  siren: "123456789",
  denomination: 'ACME "BTP", SAS',
  naf: "41.20A",
  secteur: "btp",
  taille: "PME",
  departement: "38",
  commune: "Grenoble",
  emailPrincipal: "contact@acme.fr",
  telephonePrincipal: "+33476001122",
  contactabilite: "exploitable",
  leadScore: 82,
  source: "stock_sirene",
  lastCollectedAt: new Date("2026-07-04T10:00:00Z"),
};

describe("export CSV", () => {
  it("colonnes de conformité présentes", () => {
    expect(EXPORT_COLUMNS).toContain("base_legale");
    expect(EXPORT_COLUMNS).toContain("date_collecte");
    expect(EXPORT_COLUMNS).toContain("source");
  });
  it("échappe les valeurs contenant des virgules/guillemets (RFC-4180)", () => {
    const values = exportRowValues(ROW);
    const csv = buildCsv([ROW]);
    expect(values[1]).toBe('ACME "BTP", SAS'); // valeur brute
    expect(csv).toContain('"ACME ""BTP"", SAS"'); // échappée dans le CSV
  });
  it("date au format ISO court + base légale", () => {
    const values = exportRowValues(ROW);
    expect(values).toContain("2026-07-04");
    expect(values[values.length - 1]).toMatch(/intérêt légitime/i);
  });
});
