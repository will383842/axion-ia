// @vitest-environment node

/**
 * Relecture sécurité 2026-10-17 — les seuils de l'indicateur 21 sont des VERROUS de
 * mission et d'habilitation : seuls les rôles qui ont `habiliter_formateur` les écrivent.
 * Un rôle d'écriture courant (`editor`, `secretaire`) est refusé AVANT toute écriture ;
 * les autres clés gardent la garde commune.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ role: "editor", set: vi.fn() }));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "u-1", role: h.role })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", async () => {
  const { QUALIOPI_CONFIG_REGISTRY } = await import("@/server/qualiopi/config/registry");
  return { QUALIOPI_CONFIG_REGISTRY, setQualiopiConfig: h.set };
});

import { acteRequisPourConfig, QUALIOPI_CONFIG_REGISTRY } from "@/server/qualiopi/config/registry";

import { setQualiopiConfigAction } from "./config";

beforeEach(() => {
  vi.clearAllMocks();
  h.set.mockResolvedValue(undefined);
});

describe("seuils ind. 21 : écriture réservée à `habiliter_formateur`", () => {
  it("chaque clé `evaluation_competences_*` et `suivi_qualite_*` exige l'acte, et elles seules", () => {
    for (const k of Object.keys(QUALIOPI_CONFIG_REGISTRY) as Array<
      keyof typeof QUALIOPI_CONFIG_REGISTRY
    >) {
      const verrou = k.startsWith("evaluation_competences_") || k.startsWith("suivi_qualite_");
      expect(acteRequisPourConfig(k), k).toBe(verrou ? "habiliter_formateur" : null);
    }
  });

  it.each(["editor", "secretaire"])(
    "%s : suspension réglée à 1 refusée, rien n'est écrit",
    async (role) => {
      h.role = role;
      const r = await setQualiopiConfigAction({
        key: "suivi_qualite_satisfaction_suspension_sous",
        value: "1",
      });
      expect(r).toEqual({ error: expect.stringContaining("Réglage réservé") });
      expect(h.set).not.toHaveBeenCalled();
      const e = await setQualiopiConfigAction({
        key: "evaluation_competences_entretien_moyenne_min",
        value: "1",
      });
      expect("error" in e).toBe(true);
      expect(h.set).not.toHaveBeenCalled();
    },
  );

  it.each(["super_admin", "admin", "responsable_qualite"])("%s : écrit", async (role) => {
    h.role = role;
    const r = await setQualiopiConfigAction({
      key: "suivi_qualite_satisfaction_suspension_sous",
      value: "2,5",
    });
    expect(r).toEqual({ data: { key: "suivi_qualite_satisfaction_suspension_sous" } });
    expect(h.set).toHaveBeenCalledWith(
      "suivi_qualite_satisfaction_suspension_sous",
      2.5,
      expect.anything(),
    );
  });

  it("une clé ordinaire garde la garde commune (editor écrit l'ind. 27)", async () => {
    h.role = "editor";
    const r = await setQualiopiConfigAction({
      key: "sous_traitance_delai_correction_jours",
      value: "20",
    });
    expect(r).toEqual({ data: { key: "sous_traitance_delai_correction_jours" } });
  });
});
