import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const creer = vi.fn((options: { cles: ReadonlyArray<string> }) => ({ faux: options.cles }));
vi.mock("../fournisseur/anthropic", () => ({
  creerFournisseurAnthropic: (o: { cles: ReadonlyArray<string> }) => creer(o),
}));

import { FournisseurNonBranche, obtenirFournisseur } from "../fournisseur";

const NOMS = [
  "RAPPORT_ANTHROPIC_KEY_1",
  "RAPPORT_ANTHROPIC_KEY_2",
  "RAPPORT_ANTHROPIC_KEY_3",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_API_KEY_2",
  "ANTHROPIC_API_KEY_3",
];
const MESSAGE =
  "Aucune clé Anthropic n'est posée pour le rapport avant audit (RAPPORT_ANTHROPIC_KEY_1).";

describe("obtenirFournisseur", () => {
  beforeEach(() => {
    creer.mockClear();
    for (const n of NOMS) vi.stubEnv(n, "");
    for (const n of NOMS) delete process.env[n];
  });
  afterEach(() => vi.unstubAllEnvs());

  it("aucune clé : FournisseurNonBranche avec le bon message", async () => {
    await expect(obtenirFournisseur()).rejects.toBeInstanceOf(FournisseurNonBranche);
    await expect(obtenirFournisseur()).rejects.toThrow(MESSAGE);
    expect(creer).not.toHaveBeenCalled();
  });

  it("une, deux, trois clés : créées dans l'ordre", async () => {
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_1", "a");
    await obtenirFournisseur();
    expect(creer).toHaveBeenLastCalledWith({ cles: ["a"] });
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_2", "b");
    await obtenirFournisseur();
    expect(creer).toHaveBeenLastCalledWith({ cles: ["a", "b"] });
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_3", "c");
    await obtenirFournisseur();
    expect(creer).toHaveBeenLastCalledWith({ cles: ["a", "b", "c"] });
  });

  it("ignore les clés vides et les doublons", async () => {
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_1", "a");
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_2", "  ");
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_3", "a");
    await obtenirFournisseur();
    expect(creer).toHaveBeenLastCalledWith({ cles: ["a"] });
  });

  it("à défaut, utilise les clés déjà posées (ANTHROPIC_API_KEY, _2, _3) dans l'ordre", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "x1");
    await obtenirFournisseur();
    expect(creer).toHaveBeenLastCalledWith({ cles: ["x1"] });
    vi.stubEnv("ANTHROPIC_API_KEY_2", "x2");
    vi.stubEnv("ANTHROPIC_API_KEY_3", "x3");
    await obtenirFournisseur();
    expect(creer).toHaveBeenLastCalledWith({ cles: ["x1", "x2", "x3"] });
  });

  it("les clés du rapport passent avant celles des autres usages, sans doublon", async () => {
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_1", "r1");
    vi.stubEnv("ANTHROPIC_API_KEY", "x1");
    vi.stubEnv("ANTHROPIC_API_KEY_2", "r1");
    await obtenirFournisseur();
    expect(creer).toHaveBeenLastCalledWith({ cles: ["r1", "x1"] });
  });

  it("ne laisse jamais fuiter une clé dans l'erreur ni les journaux", async () => {
    const espions = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const erreur = await obtenirFournisseur().catch((e: Error) => e);
    expect(String((erreur as Error).message)).not.toContain("sk-test-secret");
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_1", "sk-test-secret");
    vi.stubEnv("ANTHROPIC_API_KEY_2", "sk-test-secret-2");
    await obtenirFournisseur();
    for (const e of espions) {
      expect(JSON.stringify(e.mock.calls)).not.toContain("sk-test-secret");
    }
    espions.forEach((e) => e.mockRestore());
  });
});
