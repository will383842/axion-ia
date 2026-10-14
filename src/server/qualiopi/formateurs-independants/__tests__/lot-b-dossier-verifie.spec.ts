/**
 * Lot B, M15 — `marquerDossierVerifie` : statut « vérifié », date, et version d'accès
 * incrémentée (le lien du dossier ne vaut plus), en une écriture conditionnelle.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const updateMany = vi.fn();
const journaliser = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (f: (t: unknown) => unknown) =>
      f({ trainer: { updateMany: (...a: unknown[]) => updateMany(...a) } }),
  },
}));
vi.mock("@/server/journal/journaliser", () => ({
  journaliser: (...a: unknown[]) => journaliser(...a),
}));

import { marquerDossierVerifie } from "../dossier-verifie";

const T = "6f1b8a52-4a0e-4d4c-9f43-2f6a7d1c9e10";
const ADMIN = "a1b2c3d4-0000-4000-8000-000000000001";
const MAINTENANT = new Date("2026-10-12T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});

describe("marquerDossierVerifie", () => {
  it("passe le dossier À VÉRIFIER à « vérifié » et révoque son lien", async () => {
    expect(
      await marquerDossierVerifie({ trainerId: T, parId: ADMIN, maintenant: MAINTENANT }),
    ).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      // C4 — jamais un dossier en cours de saisie ou rouvert pour complément.
      where: { id: T, dossierStatut: "a_verifier" },
      data: {
        dossierStatut: "verifie",
        dossierVerifieAt: MAINTENANT,
        accesVersion: { increment: 1 },
      },
    });
    expect(journaliser.mock.calls[0]![1]).toMatchObject({
      action: "qualiopi.formateur.dossier_verifie",
      targetType: "Trainer",
      targetId: T,
      session: { userId: ADMIN },
    });
  });

  it("sans dossier ouvert (ou déjà vérifié) : rien n'est écrit au journal", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect(
      await marquerDossierVerifie({ trainerId: T, parId: ADMIN, maintenant: MAINTENANT }),
    ).toBe(false);
    expect(journaliser).not.toHaveBeenCalled();
  });
});
