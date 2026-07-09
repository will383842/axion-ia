/**
 * Tests — session-formateurs.ts (P0 normalisation coFormateurs → SessionFormateur).
 *
 * Cœur du backfill + dual-write : la dérivation doit être déterministe,
 * idempotente, dédupliquée, et faire primer la FK `formateurPrincipalId`.
 */

import { describe, it, expect } from "vitest";
import {
  parseCoFormateurs,
  buildSessionFormateurRows,
  resolvePrincipalTrainerId,
} from "./session-formateurs";

describe("parseCoFormateurs", () => {
  it("retourne [] pour une valeur non tableau", () => {
    expect(parseCoFormateurs(null)).toEqual([]);
    expect(parseCoFormateurs(undefined)).toEqual([]);
    expect(parseCoFormateurs({})).toEqual([]);
    expect(parseCoFormateurs("x")).toEqual([]);
  });

  it("ignore les items sans trainerId string valide", () => {
    expect(parseCoFormateurs([{}, { trainerId: 42 }, { trainerId: "" }, null, "x"])).toEqual([]);
  });

  it("extrait trainerId, role et heuresAnimees valides", () => {
    expect(parseCoFormateurs([{ trainerId: "t1", role: "principal", heuresAnimees: 7 }])).toEqual([
      { trainerId: "t1", role: "principal", heuresAnimees: 7 },
    ]);
  });

  it("ignore heuresAnimees non finies / non numériques", () => {
    const [row] = parseCoFormateurs([{ trainerId: "t1", heuresAnimees: "7" }]);
    expect(row?.heuresAnimees).toBeUndefined();
  });
});

describe("resolvePrincipalTrainerId", () => {
  it("préfère la FK formateurPrincipalId", () => {
    expect(
      resolvePrincipalTrainerId({
        formateurPrincipalId: "t1",
        coFormateurs: [{ trainerId: "t2", role: "principal" }],
      }),
    ).toBe("t1");
  });

  it("sans FK, prend l'entrée JSON déclarée principal", () => {
    expect(
      resolvePrincipalTrainerId({
        formateurPrincipalId: null,
        coFormateurs: [
          { trainerId: "t2", role: "co_formateur" },
          { trainerId: "t3", role: "principal" },
        ],
      }),
    ).toBe("t3");
  });

  it("sans FK ni rôle principal, prend la 1ʳᵉ entrée (compat lecteurs legacy)", () => {
    expect(
      resolvePrincipalTrainerId({
        formateurPrincipalId: null,
        coFormateurs: [{ trainerId: "t2" }],
      }),
    ).toBe("t2");
  });

  it("retourne null si aucun formateur", () => {
    expect(resolvePrincipalTrainerId({ formateurPrincipalId: null, coFormateurs: [] })).toBeNull();
  });
});

describe("buildSessionFormateurRows", () => {
  it("retourne [] quand aucun formateur", () => {
    expect(buildSessionFormateurRows({ formateurPrincipalId: null, coFormateurs: [] })).toEqual([]);
  });

  it("marque le formateurPrincipalId (FK) comme principal", () => {
    const rows = buildSessionFormateurRows({ formateurPrincipalId: "t1", coFormateurs: [] });
    expect(rows).toEqual([{ trainerId: "t1", role: "principal", heuresAnimees: null }]);
  });

  it("dérive les co-formateurs du Json en rôle co_formateur par défaut", () => {
    const rows = buildSessionFormateurRows({
      formateurPrincipalId: null,
      coFormateurs: [{ trainerId: "t2", heuresAnimees: 3.5 }],
    });
    expect(rows).toEqual([{ trainerId: "t2", role: "co_formateur", heuresAnimees: 3.5 }]);
  });

  it("la FK principal écrase le rôle d'une entrée JSON homonyme mais garde ses heures", () => {
    const rows = buildSessionFormateurRows({
      formateurPrincipalId: "t1",
      coFormateurs: [{ trainerId: "t1", role: "co_formateur", heuresAnimees: 14 }],
    });
    expect(rows).toEqual([{ trainerId: "t1", role: "principal", heuresAnimees: 14 }]);
  });

  it("dédup : un formateur = une seule ligne", () => {
    const rows = buildSessionFormateurRows({
      formateurPrincipalId: "t1",
      coFormateurs: [
        { trainerId: "t1", role: "principal" },
        { trainerId: "t2", role: "co_formateur", heuresAnimees: 4 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.trainerId === "t1")).toHaveLength(1);
  });

  it("un seul rôle principal même avec plusieurs entrées", () => {
    const rows = buildSessionFormateurRows({
      formateurPrincipalId: "t1",
      coFormateurs: [
        { trainerId: "t2", role: "principal" },
        { trainerId: "t3", role: "assistant" },
      ],
    });
    expect(rows.filter((r) => r.role === "principal")).toHaveLength(1);
    expect(rows.find((r) => r.role === "principal")?.trainerId).toBe("t1");
  });

  it("legacy : sans FK, la 1ʳᵉ entrée JSON déclarée principal devient principal", () => {
    const rows = buildSessionFormateurRows({
      formateurPrincipalId: null,
      coFormateurs: [
        { trainerId: "t2", role: "principal", heuresAnimees: 7 },
        { trainerId: "t3", role: "principal" },
      ],
    });
    expect(rows.filter((r) => r.role === "principal")).toHaveLength(1);
    expect(rows.find((r) => r.role === "principal")?.trainerId).toBe("t2");
    expect(rows.find((r) => r.trainerId === "t3")?.role).toBe("co_formateur");
  });

  it("normalise un rôle inconnu vers co_formateur", () => {
    const rows = buildSessionFormateurRows({
      formateurPrincipalId: null,
      coFormateurs: [{ trainerId: "t2", role: "n_importe_quoi" }],
    });
    expect(rows[0]?.role).toBe("co_formateur");
  });

  it("est idempotent : ré-appliquer sa propre sortie donne le même résultat", () => {
    const input = {
      formateurPrincipalId: "t1",
      coFormateurs: [
        { trainerId: "t1", role: "principal", heuresAnimees: 14 },
        { trainerId: "t2", role: "co_formateur", heuresAnimees: 4 },
      ],
    };
    const once = buildSessionFormateurRows(input);
    const twice = buildSessionFormateurRows({ formateurPrincipalId: "t1", coFormateurs: once });
    expect(twice).toEqual(once);
  });
});
