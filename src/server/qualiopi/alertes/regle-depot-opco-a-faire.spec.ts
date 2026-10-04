/**
 * Alerte `depot_opco_a_faire` (chantier OPCO A6) : session planifiée financée
 * OPCO dont le dossier n'a pas de dépôt saisi, à J-7 de la date limite de dépôt
 * du référentiel (`dateLimiteDepotPourSession`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { trainingSession: { findMany: mockFindMany } } }));

import {
  candidatsDepotOpcoAFaire,
  regleDepotOpcoAFaire,
  SEUIL_ALERTE_DEPOT_JOURS,
} from "./regle-depot-opco-a-faire";
import { ALERTE_CATALOGUE } from "./catalogue";
import { guichetPourCode } from "./routage";

const J = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

// Constructys : dossier complet 15 jours avant le début. Début le 2026-11-20 →
// limite le 2026-11-05 → J-7 le 2026-10-29.
const CONSTRUCTYS = {
  id: "s-1",
  numero: "AXI-SES-001",
  dateDebut: J("2026-11-20"),
  client: { opco: "constructys" },
  dossiersFinancement: [] as { depotFaitLe: Date | null }[],
};

describe("candidatsDepotOpcoAFaire", () => {
  it("seuil de 7 jours", () => {
    expect(SEUIL_ALERTE_DEPOT_JOURS).toBe(7);
  });

  it("J-8 → rien", () => {
    expect(candidatsDepotOpcoAFaire([CONSTRUCTYS], J("2026-10-28"))).toEqual([]);
  });

  it("J-7 → alerte importante, ciblée sur la session, sans donnée personnelle", () => {
    const [a] = candidatsDepotOpcoAFaire([CONSTRUCTYS], J("2026-10-29"));
    expect(a?.code).toBe("depot_opco_a_faire");
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBe("TrainingSession");
    expect(a?.cibleId).toBe("s-1");
    expect(a?.message).toContain("AXI-SES-001");
    expect(a?.message).toContain("Constructys");
    expect(a?.message).toContain("05/11/2026");
  });

  it("le JOUR MÊME de la date limite, tard le soir à Paris → encore « important »", () => {
    const [a] = candidatsDepotOpcoAFaire([CONSTRUCTYS], new Date("2026-11-05T22:30:00.000Z"));
    expect(a?.niveau).toBe("important");
  });

  it("date limite dépassée → critique", () => {
    const [a] = candidatsDepotOpcoAFaire([CONSTRUCTYS], J("2026-11-06"));
    expect(a?.niveau).toBe("critique");
  });

  it("dépôt fait → rien, même date dépassée", () => {
    const fait = { ...CONSTRUCTYS, dossiersFinancement: [{ depotFaitLe: J("2026-10-30") }] };
    expect(candidatsDepotOpcoAFaire([fait], J("2026-11-10"))).toEqual([]);
  });

  it("OPCO au délai inconnu (AKTO) ou absent → rien", () => {
    expect(
      candidatsDepotOpcoAFaire(
        [
          { ...CONSTRUCTYS, client: { opco: "akto" } },
          { ...CONSTRUCTYS, client: { opco: null } },
          { ...CONSTRUCTYS, client: null },
        ],
        J("2026-11-19"),
      ),
    ).toEqual([]);
  });
});

describe("regleDepotOpcoAFaire — requête", () => {
  beforeEach(() => mockFindMany.mockReset());

  it("bornée, sessions planifiées financées OPCO sans dépôt saisi", async () => {
    mockFindMany.mockResolvedValue([CONSTRUCTYS]);
    const out = await regleDepotOpcoAFaire(J("2026-10-29"));
    expect(out).toHaveLength(1);
    const arg = mockFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      take: number;
    };
    expect(arg.take).toBeGreaterThan(0);
    expect(arg.take).toBeLessThanOrEqual(500);
    expect(arg.where["statut"]).toBe("planifiee");
    expect(arg.where["financementType"]).toEqual({ in: ["opco", "mixte"] });
    expect(JSON.stringify(arg.where["dossiersFinancement"])).toContain("depotFaitLe");
  });
});

describe("catalogue", () => {
  it("le code est au catalogue, auto-résolu, au guichet de la direction", () => {
    expect(ALERTE_CATALOGUE["depot_opco_a_faire"]?.resolutionAuto).toBe(true);
    expect(guichetPourCode("depot_opco_a_faire")).toBe("direction");
  });
});
