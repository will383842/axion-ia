// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  throw new Error("Prisma ne doit pas être chargé quand le suivi est éteint");
});

import { runChaineSuiviJob } from "../content-suivi-worker";

afterEach(() => vi.unstubAllEnvs());

describe("worker du suivi des résultats", () => {
  it("éteint par défaut : sort avant toute lecture de base", async () => {
    vi.stubEnv("CONTENT_CHAINE_SUIVI", "");
    expect(await runChaineSuiviJob({ data: { tache: "suivi-resultats" } })).toEqual({
      issue: "saute",
      motif: "interrupteur_eteint",
    });
  });
  it("« 1 » ou « TRUE » n'allument pas", async () => {
    for (const v of ["1", "TRUE", "true "]) {
      vi.stubEnv("CONTENT_CHAINE_SUIVI", v);
      const r = await runChaineSuiviJob({ data: { tache: "suivi-resultats" } });
      expect(r).toEqual({ issue: "saute", motif: "interrupteur_eteint" });
    }
  });
  it("une tâche inconnue est ignorée, jamais exécutée", async () => {
    vi.stubEnv("CONTENT_CHAINE_SUIVI", "true");
    expect(await runChaineSuiviJob({ data: { tache: "autre-chose" } })).toEqual({
      issue: "ignoree",
    });
  });
});
