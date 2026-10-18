/**
 * Écriture des seuils de l'indicateur 21 : réservée au droit `habiliter_formateur`.
 * Les autres clés (ex. ind. 27) restent écrivables comme avant par tout rôle d'écriture.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const role = vi.hoisted(() => ({ courant: "editor" }));
const ecrire = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u1", role: role.courant }),
}));
vi.mock("@/server/qualiopi/config/pages-publiques-du-reglage", () => ({
  pagesPubliquesDuReglage: () => [],
}));
vi.mock("@/server/qualiopi/config/site-settings", async () => {
  const { QUALIOPI_CONFIG_REGISTRY } = await import("@/server/qualiopi/config/registry");
  return { QUALIOPI_CONFIG_REGISTRY, setQualiopiConfig: ecrire };
});

import { setQualiopiConfigAction } from "./config";
import { BORNES_CLES_RESERVEES } from "@/server/qualiopi/config/cles-reservees-habilitation";
import { QUALIOPI_CONFIG_REGISTRY, acteRequisPourConfig } from "@/server/qualiopi/config/registry";

const SUSPENSION = "suivi_qualite_satisfaction_suspension_sous";
const CLE_AUTRE_DOMAINE = "sous_traitance_revue_complete_mois";

beforeEach(() => {
  ecrire.mockReset();
  ecrire.mockResolvedValue(undefined);
});

describe("clés réservées", () => {
  it("couvrent exactement les 16 clés evaluation_competences_* et suivi_qualite_*", () => {
    const cles = Object.keys(QUALIOPI_CONFIG_REGISTRY).filter(
      (k) => acteRequisPourConfig(k as never) !== null,
    );
    expect(cles).toHaveLength(16);
    expect(Object.keys(BORNES_CLES_RESERVEES).sort()).toEqual([...cles].sort());
  });
  it("aucune borne n'inclut la valeur qui rend une garde inopérante (≥ 2 pour les notes)", () => {
    for (const [cle, [min]] of Object.entries(BORNES_CLES_RESERVEES)) {
      if (/moyenne_min|note_|satisfaction_|texte_min/.test(cle))
        expect(min, cle).toBeGreaterThan(1);
    }
  });
});

describe("setQualiopiConfigAction — seuils de l'indicateur 21", () => {
  for (const r of ["editor", "secretaire", "reader"]) {
    it(`${r} : refusé, rien n'est écrit`, async () => {
      role.courant = r;
      const res = await setQualiopiConfigAction({ key: SUSPENSION, value: "2.5" });
      expect("error" in res).toBe(true);
      expect(ecrire).not.toHaveBeenCalled();
    });
  }

  for (const r of ["super_admin", "admin", "responsable_qualite"]) {
    it(`${r} (habiliter_formateur) : accepté`, async () => {
      role.courant = r;
      const res = await setQualiopiConfigAction({ key: SUSPENSION, value: "2.5" });
      expect(res).toEqual({ data: { key: SUSPENSION } });
      expect(ecrire).toHaveBeenCalledTimes(1);
    });
  }

  it("une valeur qui désactiverait la garde (suspension_sous = 1) est refusée", async () => {
    role.courant = "admin";
    const res = await setQualiopiConfigAction({ key: SUSPENSION, value: "1" });
    expect("error" in res).toBe(true);
    expect(ecrire).not.toHaveBeenCalled();
  });

  it("une clé d'un autre domaine reste écrivable par un editor, comme avant", async () => {
    role.courant = "editor";
    expect(CLE_AUTRE_DOMAINE in QUALIOPI_CONFIG_REGISTRY).toBe(true);
    const res = await setQualiopiConfigAction({ key: CLE_AUTRE_DOMAINE, value: "12" });
    expect(res).toEqual({ data: { key: CLE_AUTRE_DOMAINE } });
  });
});
