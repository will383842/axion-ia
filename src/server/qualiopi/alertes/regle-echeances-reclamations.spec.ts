/**
 * L09 — la règle des échéances de réclamation : muette éteinte, précise allumée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  etat: "eteint" as "eteint" | "essai" | "actif",
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { reclamation: { findMany: h.findMany } } }));
vi.mock("@/server/qualiopi/reclamations/interrupteur", () => ({
  lireInterrupteurReclamations: vi.fn(async () => h.etat),
  cycleActifPour: vi.fn(async () => h.etat !== "eteint"),
}));

import { regleEcheancesReclamations } from "./regle-echeances-reclamations";

const RECUE = new Date("2026-10-16T14:00:00.000Z");

beforeEach(() => {
  h.findMany.mockReset();
  h.findMany.mockResolvedValue([
    {
      id: "r1",
      numero: "AXI-REC-2026-001",
      enrollmentId: null,
      dateReception: RECUE,
      etapes: [{ etape: "reception", creeLe: RECUE }],
    },
  ]);
});

describe("regleEcheancesReclamations", () => {
  it("🔴 éteinte : ne lit même pas la table", async () => {
    h.etat = "eteint";
    expect(await regleEcheancesReclamations(new Date("2026-12-01T09:00:00Z"))).toEqual([]);
    expect(h.findMany).not.toHaveBeenCalled();
  });

  it("allumée : accusé et réponse en retard, sans nommer personne", async () => {
    h.etat = "actif";
    const alertes = await regleEcheancesReclamations(new Date("2026-11-09T09:00:00Z"));
    expect(alertes.map((a) => a.code)).toEqual([
      "reclamation_accuse_en_retard",
      "reclamation_reponse_en_retard",
    ]);
    expect(alertes[1]?.message).toContain("6 novembre 2026");
  });

  it("réponse proche : niveau important", async () => {
    h.etat = "actif";
    h.findMany.mockResolvedValue([
      {
        id: "r1",
        numero: "AXI-REC-2026-001",
        enrollmentId: null,
        dateReception: RECUE,
        etapes: [
          { etape: "reception", creeLe: RECUE },
          { etape: "accuse", creeLe: RECUE },
        ],
      },
    ]);
    const alertes = await regleEcheancesReclamations(new Date("2026-11-03T09:00:00Z"));
    expect(alertes).toEqual([
      expect.objectContaining({ code: "reclamation_reponse_echeance_proche", niveau: "important" }),
    ]);
  });

  it("une réclamation antérieure au cycle (sans étape) est laissée à l'alerte J+15", async () => {
    h.etat = "actif";
    h.findMany.mockResolvedValue([
      {
        id: "r0",
        numero: "AXI-REC-2026-000",
        enrollmentId: null,
        dateReception: RECUE,
        etapes: [],
      },
    ]);
    expect(await regleEcheancesReclamations(new Date("2026-12-01T09:00:00Z"))).toEqual([]);
  });
});
