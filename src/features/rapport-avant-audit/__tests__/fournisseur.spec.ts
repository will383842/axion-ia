import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const creer = vi.fn((options: { cles: ReadonlyArray<string> }) => ({ faux: options.cles }));
vi.mock("../fournisseur/anthropic", () => ({
  creerFournisseurAnthropic: (o: { cles: ReadonlyArray<string> }) => creer(o),
}));

import { FournisseurNonBranche, obtenirFournisseur } from "../fournisseur";

const NOMS = ["RAPPORT_ANTHROPIC_KEY_1", "RAPPORT_ANTHROPIC_KEY_2", "RAPPORT_ANTHROPIC_KEY_3"];
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

  it("n'utilise pas ANTHROPIC_API_KEY", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-secret");
    await expect(obtenirFournisseur()).rejects.toBeInstanceOf(FournisseurNonBranche);
  });

  it("ne laisse jamais fuiter une clé dans l'erreur ni les journaux", async () => {
    const espions = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-secret");
    const erreur = await obtenirFournisseur().catch((e: Error) => e);
    expect(String((erreur as Error).message)).not.toContain("sk-test-secret");
    vi.stubEnv("RAPPORT_ANTHROPIC_KEY_1", "sk-test-secret");
    await obtenirFournisseur();
    for (const e of espions) expect(JSON.stringify(e.mock.calls)).not.toContain("sk-test-secret");
    espions.forEach((e) => e.mockRestore());
  });
});
