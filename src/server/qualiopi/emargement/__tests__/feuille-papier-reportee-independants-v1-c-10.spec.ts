/**
 * Vérification 1, V1-C-10 (décision : la feuille papier est REPORTÉE côté formateurs
 * indépendants). Un formateur indépendant (`sous_traitant`) ne peut pas contresigner
 * une demi-journée par `papier_scanne` : la contresignature est ce qui déclenche son
 * paiement, et la validation d'une feuille papier n'est pas livrée. Refus sans
 * écriture (ni image, ni ligne). Rien ne change pour un salarié ou un dirigeant, et
 * aucune donnée existante n'est touchée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn() },
    trainer: { findUnique: vi.fn() },
    emargementContresignature: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../storage", () => ({ storeSignatureImage: vi.fn(), supprimerImageSignature: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { storeSignatureImage } from "../storage";
import { contresignerDemiJournee } from "../contresignature-service";

const p = prisma as unknown as {
  trainingSession: { findUnique: ReturnType<typeof vi.fn> };
  trainer: { findUnique: ReturnType<typeof vi.fn> };
  emargementContresignature: { create: ReturnType<typeof vi.fn> };
};

const entree = {
  sessionId: "ses-1",
  date: "2026-06-10",
  demiJournee: "matin" as const,
  trainerId: "tr-1",
  methode: "papier_scanne" as const,
  imageDataUrl: "data:image/jpeg;base64,AAAA",
  maintenant: new Date("2026-06-10T08:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  p.trainingSession.findUnique.mockResolvedValue({
    id: "ses-1",
    statut: "en_cours",
    titreSession: "Session",
    jours: [
      {
        date: new Date("2026-06-10T00:00:00.000Z"),
        heureDebut: "09:00",
        heureFin: "17:00",
        modules: [],
      },
    ],
  });
});

describe("V1-C-10 — pas de feuille papier pour un formateur indépendant", () => {
  it("indépendant + papier_scanne : refusé, rien n'est écrit", async () => {
    p.trainer.findUnique.mockResolvedValue({
      nom: "Martin",
      prenom: "Iris",
      statut: "sous_traitant",
    });
    const r = await contresignerDemiJournee(entree);
    expect(r).toMatchObject({ ok: false, raison: "methode_non_admise" });
    expect(storeSignatureImage).not.toHaveBeenCalled();
    expect(p.emargementContresignature.create).not.toHaveBeenCalled();
  });

  it("salarié + papier_scanne : la règle d'avant ne change pas (pas de refus de méthode)", async () => {
    p.trainer.findUnique.mockResolvedValue({ nom: "Martin", prenom: "Iris", statut: "salarie" });
    const r = await contresignerDemiJournee(entree).catch(() => null);
    expect(r === null || r.ok || r.raison !== "methode_non_admise").toBe(true);
  });
});
