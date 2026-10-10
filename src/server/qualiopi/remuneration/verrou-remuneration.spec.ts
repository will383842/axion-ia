/**
 * Lot S3 (C3) — UNE seule fabrique de clés pour les verrous de rémunération.
 *
 * Deux écrivains qui verrouillent la même ressource avec deux orthographes de
 * clé ne se sérialisent pas : ils prennent deux verrous différents, et chacun
 * croit être seul. Deux écrivains qui prennent les mêmes verrous dans un ordre
 * différent s'interbloquent. D'où une fonction unique, et un ordre unique :
 * période(s) par mois croissant, puis formateur(s).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, it, expect, vi } from "vitest";

import { cleVerrouRemuneration, prendreVerrousRemuneration } from "./verrou-remuneration";

describe("cleVerrouRemuneration", () => {
  it("clé de période : `remuneration_run_<année>_<mois>` (mois sans zéro)", () => {
    expect(cleVerrouRemuneration({ periode: { year: 2026, month: 6 } })).toBe(
      "remuneration_run_2026_6",
    );
  });

  it("clé de formateur : `remuneration_trainer_<id>`", () => {
    expect(cleVerrouRemuneration({ trainerId: "abc" })).toBe("remuneration_trainer_abc");
  });
});

describe("prendreVerrousRemuneration — ordre fixe", () => {
  it("périodes par mois CROISSANT, dédoublonnées, puis formateurs triés", async () => {
    const tx = { $executeRawUnsafe: vi.fn().mockResolvedValue(0) };

    await prendreVerrousRemuneration(tx, {
      periodes: [
        { year: 2026, month: 2 },
        { year: 2025, month: 12 },
        { year: 2026, month: 2 },
      ],
      trainerIds: ["b", "a", "b"],
    });

    expect(tx.$executeRawUnsafe.mock.calls.map((c) => c[0])).toEqual([
      "SELECT pg_advisory_xact_lock(hashtext('remuneration_run_2025_12'))",
      "SELECT pg_advisory_xact_lock(hashtext('remuneration_run_2026_2'))",
      "SELECT pg_advisory_xact_lock(hashtext('remuneration_trainer_a'))",
      "SELECT pg_advisory_xact_lock(hashtext('remuneration_trainer_b'))",
    ]);
  });

  it("échappe une apostrophe (aucune clé ne doit pouvoir sortir de sa chaîne)", async () => {
    const tx = { $executeRawUnsafe: vi.fn().mockResolvedValue(0) };
    await prendreVerrousRemuneration(tx, { periodes: [], trainerIds: ["o'k"] });
    expect(tx.$executeRawUnsafe.mock.calls[0]?.[0]).toBe(
      "SELECT pg_advisory_xact_lock(hashtext('remuneration_trainer_o''k'))",
    );
  });
});

describe("garde statique — aucune autre construction de clé de verrou de rémunération", () => {
  const RACINE = join(__dirname, "..", "..", "..");
  const MODULE = join("server", "qualiopi", "remuneration", "verrou-remuneration.ts");

  function fichiers(dir: string): string[] {
    return readdirSync(dir).flatMap((nom) => {
      const p = join(dir, nom);
      if (statSync(p).isDirectory()) return fichiers(p);
      return /\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom) ? [p] : [];
    });
  }

  it("`remuneration_run_` / `remuneration_trainer_` n'apparaissent que dans le module", () => {
    const fautifs = fichiers(RACINE)
      .filter((p) => relative(RACINE, p) !== MODULE)
      .filter((p) => /remuneration_(run|trainer)_/.test(readFileSync(p, "utf8")))
      .map((p) => relative(RACINE, p).split(sep).join("/"));
    expect(fautifs).toEqual([]);
  });

  it("aucun `pg_advisory_xact_lock` en dur dans la rémunération hors du module", () => {
    const zone = [
      ...fichiers(join(RACINE, "server", "qualiopi", "remuneration")),
      join(RACINE, "server", "actions", "qualiopi", "trainer-remuneration.ts"),
    ];
    const fautifs = zone
      .filter((p) => relative(RACINE, p) !== MODULE)
      .filter((p) => /\bpg_advisory_xact_lock\b/.test(readFileSync(p, "utf8")))
      .map((p) => relative(RACINE, p).split(sep).join("/"));
    expect(fautifs).toEqual([]);
  });
});
