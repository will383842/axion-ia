/**
 * Tests — filtrage des lignes archivées dans les listes Qualiopi.
 *
 * L'enjeu : la console ne doit JAMAIS afficher d'archive par défaut, quelle que
 * soit la valeur reçue (paramètre absent, vide, dupliqué, ou forgé à la main).
 * Le paramètre `vue` n'est exposé nulle part dans l'interface — il ne sert que
 * d'échappatoire manuelle pour atteindre une ligne archivée encore engageante
 * (cas réel : une formation archivée portant une session en cours).
 */

import { describe, it, expect } from "vitest";

import { ARCHIVE_FILTER_PARAM, applyArchiveFilter, parseArchiveFilter } from "../archive-filter";

describe("parseArchiveFilter", () => {
  it("retombe sur « actives » quand le paramètre est absent", () => {
    expect(parseArchiveFilter(undefined)).toBe("actives");
  });

  it("reconnaît les deux vues explicites", () => {
    expect(parseArchiveFilter("archivees")).toBe("archivees");
    expect(parseArchiveFilter("toutes")).toBe("toutes");
  });

  it("accepte « actives » explicitement", () => {
    expect(parseArchiveFilter("actives")).toBe("actives");
  });

  it("retombe sur « actives » sur une valeur inattendue", () => {
    expect(parseArchiveFilter("")).toBe("actives");
    expect(parseArchiveFilter("ARCHIVEES")).toBe("actives");
    expect(parseArchiveFilter("archivée")).toBe("actives");
    expect(parseArchiveFilter("' OR 1=1--")).toBe("actives");
  });

  it("retombe sur « actives » quand le paramètre est dupliqué (tableau)", () => {
    // `?vue=archivees&vue=toutes` → Next fournit un tableau : on ne devine pas.
    expect(parseArchiveFilter(["archivees", "toutes"])).toBe("actives");
    expect(parseArchiveFilter([])).toBe("actives");
  });

  it("expose un nom de paramètre stable", () => {
    expect(ARCHIVE_FILTER_PARAM).toBe("vue");
  });
});

describe("applyArchiveFilter", () => {
  const vivantes = ["a1", "a2"];
  const archivees = ["z1", "z2", "z3"];

  it("ne renvoie que les vivantes par défaut", () => {
    expect(applyArchiveFilter("actives", vivantes, archivees)).toEqual(["a1", "a2"]);
  });

  it("renvoie les archivées seules sur la vue dédiée", () => {
    expect(applyArchiveFilter("archivees", vivantes, archivees)).toEqual(["z1", "z2", "z3"]);
  });

  it("concatène sur la vue « toutes », vivantes en tête", () => {
    expect(applyArchiveFilter("toutes", vivantes, archivees)).toEqual([
      "a1",
      "a2",
      "z1",
      "z2",
      "z3",
    ]);
  });

  it("ne mute pas les tableaux reçus", () => {
    applyArchiveFilter("toutes", vivantes, archivees);
    expect(vivantes).toEqual(["a1", "a2"]);
    expect(archivees).toEqual(["z1", "z2", "z3"]);
  });

  it("une valeur non normalisée ne peut pas fuiter d'archive", () => {
    // Défense en profondeur : même si un appelant contourne parseArchiveFilter,
    // seule une vue explicitement connue élargit le résultat.
    const forge = "toutes-les-archives" as unknown as Parameters<typeof applyArchiveFilter>[0];
    expect(applyArchiveFilter(forge, vivantes, archivees)).toEqual(["a1", "a2"]);
  });
});
