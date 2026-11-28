import { describe, expect, it } from "vitest";

import { trousDeNumerotation } from "../journal-autofactures";

describe("trous de numérotation AXI-APP", () => {
  it("ne signale rien pour une série continue ou vide", () => {
    expect(trousDeNumerotation([])).toEqual([]);
    expect(
      trousDeNumerotation(["AXI-APP-2026-0001", "AXI-APP-2026-0002", "AXI-APP-2026-0003"]),
    ).toEqual([]);
  });

  it("signale chaque numéro manquant entre deux numéros présents", () => {
    expect(trousDeNumerotation(["AXI-APP-2026-0001", "AXI-APP-2026-0004"])).toEqual([
      "AXI-APP-2026-0002",
      "AXI-APP-2026-0003",
    ]);
  });

  it("traite chaque année à part et ignore l'ordre et les doublons", () => {
    expect(
      trousDeNumerotation([
        "AXI-APP-2027-0002",
        "AXI-APP-2026-0003",
        "AXI-APP-2026-0001",
        "AXI-APP-2026-0001",
        "AXI-APP-2027-0001",
      ]),
    ).toEqual(["AXI-APP-2026-0002"]);
  });

  it("ignore un numéro hors série", () => {
    expect(trousDeNumerotation(["XYZ-1", "AXI-APP-2026-0001"])).toEqual([]);
  });
});
