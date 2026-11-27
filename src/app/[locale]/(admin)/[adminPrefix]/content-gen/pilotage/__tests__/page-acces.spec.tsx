import { beforeEach, describe, expect, it, vi } from "vitest";

const gardePage = vi.fn();
const chargerPilotageSeo = vi.fn();
vi.mock("@/server/auth/garde-page", () => ({ gardePage: (...a: unknown[]) => gardePage(...a) }));
vi.mock("@/server/actions/content-gen/pilotage", () => ({
  chargerPilotageSeo: () => chargerPilotageSeo(),
}));

import PilotageSeoPage from "../page";

const props = {
  params: Promise.resolve({ locale: "fr", adminPrefix: "admin" }),
  searchParams: Promise.resolve({}),
};

describe("page Pilotage SEO & IA : accès", () => {
  beforeEach(() => {
    gardePage.mockReset();
    chargerPilotageSeo.mockReset();
  });

  it("passe par la garde de la console avant toute lecture", async () => {
    gardePage.mockResolvedValue({ autorise: false, motif: "role" });
    await PilotageSeoPage(props);
    expect(gardePage).toHaveBeenCalledWith("consultation", "/fr/admin/login");
    expect(chargerPilotageSeo).not.toHaveBeenCalled();
  });

  it("si la garde redirige (pas de session), aucune lecture n'a lieu", async () => {
    gardePage.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(PilotageSeoPage(props)).rejects.toThrow("NEXT_REDIRECT");
    expect(chargerPilotageSeo).not.toHaveBeenCalled();
  });

  it("accès accordé : charge le modèle", async () => {
    gardePage.mockResolvedValue({ autorise: true, role: "admin", peutEcrire: true });
    chargerPilotageSeo.mockResolvedValue({ etat: "eteint" });
    await PilotageSeoPage(props);
    expect(chargerPilotageSeo).toHaveBeenCalledOnce();
  });
});
