/**
 * Lot E (M14) — F46 : la révocation du mandat d'autofacturation, enregistrée en
 * console, est confirmée au formateur indépendant avec la date d'effet (un mois après).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ trainer: { findUnique: vi.fn() } }));
const allume = vi.hoisted(() => vi.fn());
const envoyer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: allume,
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer }));

import {
  annoncerFinAutofacturation,
  dateFinAutofacturation,
} from "@/server/qualiopi/formateurs-independants/fin-autofacturation";

const ID = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
const REVOQUE = new Date("2026-10-12T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  allume.mockResolvedValue(true);
  envoyer.mockResolvedValue("envoye");
  db.trainer.findUnique.mockResolvedValue({
    statut: "sous_traitant",
    prenom: "Camille",
    email: "camille@example.test",
  });
});

describe("F46 — fin de l'autofacturation", () => {
  it("un mois de préavis", () => {
    expect(dateFinAutofacturation(REVOQUE).toISOString().slice(0, 10)).toBe("2026-11-12");
  });

  it("interrupteur coupé : rien n'est lu ni envoyé", async () => {
    allume.mockResolvedValue(false);
    expect(await annoncerFinAutofacturation({ trainerId: ID, revoqueAt: REVOQUE })).toBe("coupe");
    expect(db.trainer.findUnique).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("salarié : rien", async () => {
    db.trainer.findUnique.mockResolvedValue({ statut: "salarie", prenom: "A", email: "a@b.c" });
    expect(await annoncerFinAutofacturation({ trainerId: ID, revoqueAt: REVOQUE })).toBe(
      "hors_perimetre",
    );
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("indépendant : F46 avec la date d'effet, une clé par révocation", async () => {
    await annoncerFinAutofacturation({ trainerId: ID, revoqueAt: REVOQUE });
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-fin-autofacturation",
        entityId: ID,
        jobId: `fi-fin-autofacturation-${ID}-20261012`,
        payload: { prenom: "Camille", valeurs: { "date, un mois après": "12 novembre 2026" } },
      }),
    );
  });
});
