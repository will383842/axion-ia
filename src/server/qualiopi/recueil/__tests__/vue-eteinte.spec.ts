/** Chantier QNC, L03 — éteint, l'écran de la session n'affiche rien et ne lit presque rien. */
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  p: {
    setting: { findUnique: vi.fn() },
    trainingSession: { findUnique: vi.fn() },
    projet: { findMany: vi.fn() },
    questionnaireCadrage: { findFirst: vi.fn(), findMany: vi.fn() },
    activityLog: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));

import { lireVueRecueil } from "../vue";

describe("lireVueRecueil", () => {
  it("ÉTEINT (clé absente) : null, et aucune autre table n'est lue", async () => {
    h.p.setting.findUnique.mockResolvedValue(null);
    expect(await lireVueRecueil("s")).toBeNull();
    expect(h.p.trainingSession.findUnique).not.toHaveBeenCalled();
    expect(h.p.questionnaireCadrage.findFirst).not.toHaveBeenCalled();
  });

  it("EN ESSAI, une session réelle : null", async () => {
    h.p.setting.findUnique.mockResolvedValue({ value: { etat: "essai" } });
    h.p.trainingSession.findUnique.mockResolvedValue({
      estTestInterne: false,
      projetId: null,
      devis: null,
    });
    expect(await lireVueRecueil("s")).toBeNull();
  });
});
