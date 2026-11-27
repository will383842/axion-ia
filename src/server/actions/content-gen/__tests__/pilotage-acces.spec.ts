import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const lire = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/seo-pilotage/ecran/lecture", () => ({
  lireModelePilotage: (...a: unknown[]) => lire(...a),
}));

import { chargerPilotageSeo } from "../pilotage";

describe("chargerPilotageSeo : accès", () => {
  beforeEach(() => {
    auth.mockReset();
    lire.mockReset().mockResolvedValue({ etat: "eteint" });
  });
  it("sans session : refus, aucune lecture", async () => {
    auth.mockResolvedValue(null);
    await expect(chargerPilotageSeo()).rejects.toThrow("unauthorized");
    expect(lire).not.toHaveBeenCalled();
  });
  it("rôle inconnu : refus, aucune lecture", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "visiteur" } });
    await expect(chargerPilotageSeo()).rejects.toThrow("forbidden");
    expect(lire).not.toHaveBeenCalled();
  });
  it("rôle admin : lecture", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "admin" } });
    await chargerPilotageSeo({ type: "ville" });
    expect(lire).toHaveBeenCalledOnce();
  });
});
