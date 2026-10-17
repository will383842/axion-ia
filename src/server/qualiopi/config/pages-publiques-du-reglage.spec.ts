/**
 * Un réglage affiché sur le site public revalide les pages qui le rendent.
 * Cas réel (L15, NC12) : « Référent handicap : » sans nom sur /fr/accessibilite.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { QUALIOPI_CONFIG_REGISTRY } from "./registry";
import { pagesPubliquesDuReglage } from "./pages-publiques-du-reglage";

const { revalidatePath, setQualiopiConfig, requireAdminWrite } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  setQualiopiConfig: vi.fn(),
  requireAdminWrite: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ requireAdminWrite }));
vi.mock("@/server/qualiopi/config/site-settings", async () => {
  const registry = await import("./registry");
  return { setQualiopiConfig, QUALIOPI_CONFIG_REGISTRY: registry.QUALIOPI_CONFIG_REGISTRY };
});

import { setQualiopiConfigAction } from "@/server/actions/qualiopi/config";

beforeEach(() => {
  revalidatePath.mockReset();
  setQualiopiConfig.mockReset().mockResolvedValue(undefined);
  requireAdminWrite.mockReset().mockResolvedValue({ userId: "admin-1" });
});

describe("pagesPubliquesDuReglage", () => {
  it("les deux réglages du référent handicap revalident la page d'accessibilité et les fiches", () => {
    for (const cle of ["referent_handicap_nom", "referent_handicap_email"]) {
      const chemins = pagesPubliquesDuReglage(cle).map((p) => p.chemin);
      expect(chemins, cle).toContain("/[locale]/accessibilite");
      expect(chemins, cle).toContain("/[locale]/formations/[slug]");
    }
  });

  it("🔑 toutes les clés `referent_handicap_*` du registre sont couvertes (aucune oubliée)", () => {
    const cles = Object.keys(QUALIOPI_CONFIG_REGISTRY).filter((k) =>
      k.startsWith("referent_handicap_"),
    );
    expect(cles.length).toBeGreaterThanOrEqual(2);
    for (const c of cles) expect(pagesPubliquesDuReglage(c).length, c).toBeGreaterThan(0);
  });

  it("un réglage que le site public ne rend pas ne revalide rien", () => {
    expect(pagesPubliquesDuReglage("tva_taux")).toEqual([]);
  });
});

describe("setQualiopiConfigAction — revalidation du site public", () => {
  it("🔴 enregistrer le nom du référent revalide /accessibilite et les fiches formation", async () => {
    const r = await setQualiopiConfigAction({ key: "referent_handicap_nom", value: "Camille" });
    expect(r).toEqual({ data: { key: "referent_handicap_nom" } });
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/accessibilite", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/formations/[slug]", "page");
  });

  it("un enregistrement REFUSÉ ne revalide rien", async () => {
    setQualiopiConfig.mockRejectedValue(new Error("refusé"));
    const r = await setQualiopiConfigAction({
      key: "referent_handicap_email",
      value: "pas-un-mail",
    });
    expect("error" in r).toBe(true);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un réglage sans page publique ne revalide rien", async () => {
    await setQualiopiConfigAction({ key: "nda_numero", value: "11755555555" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("une revalidation qui échoue ne fait pas échouer l'enregistrement (déjà fait en base)", async () => {
    revalidatePath.mockImplementation(() => {
      throw new Error("hors contexte de requête");
    });
    const r = await setQualiopiConfigAction({ key: "referent_handicap_nom", value: "Camille" });
    expect(r).toEqual({ data: { key: "referent_handicap_nom" } });
  });
});
