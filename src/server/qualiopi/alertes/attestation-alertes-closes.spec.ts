/**
 * 🔴 3e relecture A09 (audit initial 2026-09-14) — une alerte d'attestation que
 * le geste prescrit ne peut pas faire disparaître doit rester FERMÉE une fois
 * fermée à la main.
 *
 * `attestation_non_emise_automatiquement` prescrit, pour un exclu sans taux, une
 * attestation établie HORS logiciel ; pour un inscrit à 0 h, la décision peut
 * être de ne rien remettre. Aucun de ces gestes ne change une colonne : la règle
 * produit toujours le candidat. En `resolutionAuto: true`, `creerOuDedup` ne
 * regardait que les alertes non résolues et RECRÉAIT la fermeture au balayage
 * suivant. Même défaut pour `attestation_sans_evaluation_evaluee_depuis`.
 *
 * Le catalogue est RÉEL ici (contrairement à `alertes-service.spec.ts`) : c'est
 * précisément sa valeur qui décide.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerteSysteme: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("./evaluateur", () => ({
  evaluerAlertes: vi.fn(async () => []),
  evaluerAlertesDetaille: vi.fn(async () => ({
    candidates: [],
    reglesEnEchec: [],
    reglesTronquees: [],
  })),
}));

import { prisma } from "@/lib/prisma";
import { creerOuDedup } from "./alertes-service";

const mp = prisma as unknown as {
  alerteSysteme: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

const CODES = [
  "attestation_non_emise_automatiquement",
  "attestation_sans_evaluation_evaluee_depuis",
] as const;

describe("🔴 alertes d'attestation fermées à la main : non relevées au balayage suivant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.create.mockResolvedValue({ id: "nouvelle" });
  });

  it.each(CODES)("%s — fermée (même message) : pas recréée", async (code) => {
    mp.alerteSysteme.findFirst.mockImplementation(async (args: { where: { resolue: boolean } }) =>
      args.where.resolue ? { id: "fermee-a-la-main" } : null,
    );

    const r = await creerOuDedup({
      code,
      niveau: "important",
      titre: "Attestation",
      message: "Même message qu'à la fermeture",
      cibleType: "Enrollment",
      cibleId: "enr-1",
    });

    expect(r).toBeNull();
    expect(mp.alerteSysteme.create).not.toHaveBeenCalled();
  });

  it.each(CODES)("%s — contre-témoin : jamais fermée, elle est créée", async (code) => {
    mp.alerteSysteme.findFirst.mockResolvedValue(null);

    await creerOuDedup({
      code,
      niveau: "important",
      titre: "Attestation",
      message: "Situation nouvelle",
      cibleType: "Enrollment",
      cibleId: "enr-2",
    });

    expect(mp.alerteSysteme.create).toHaveBeenCalledOnce();
  });
});
