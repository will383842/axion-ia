/**
 * Alerte `delai_facturation_opco` (chantier OPCO A3) : session terminée,
 * subrogée, sans facture émise à l'OPCO, à J-15 de la date limite de
 * facturation du référentiel (`dateLimiteFacturation`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { trainingSession: { findMany: mockFindMany } } }));

import {
  candidatsDelaiFacturationOpco,
  regleDelaiFacturationOpco,
  SEUIL_ALERTE_FACTURATION_JOURS,
} from "./delai-facturation-opco";
import { ALERTE_CATALOGUE } from "./catalogue";

const J = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

// Atlas : 90 jours après la fin. Fin le 2026-10-01 → limite le 2026-12-30.
const ATLAS = {
  id: "s-1",
  numero: "AXI-SES-001",
  dateFin: J("2026-10-01"),
  client: { opco: "atlas" },
};

describe("candidatsDelaiFacturationOpco", () => {
  it("seuil de 15 jours", () => {
    expect(SEUIL_ALERTE_FACTURATION_JOURS).toBe(15);
  });

  it("J-16 → rien", () => {
    expect(candidatsDelaiFacturationOpco([ATLAS], J("2026-12-14"))).toEqual([]);
  });

  it("J-15 → alerte importante, ciblée sur la session", () => {
    const [a] = candidatsDelaiFacturationOpco([ATLAS], J("2026-12-15"));
    expect(a?.code).toBe("delai_facturation_opco");
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBe("TrainingSession");
    expect(a?.cibleId).toBe("s-1");
    expect(a?.message).toContain("AXI-SES-001");
    expect(a?.message).toContain("30/12/2026");
  });

  it("limite dépassée → critique", () => {
    const [a] = candidatsDelaiFacturationOpco([ATLAS], J("2026-12-31"));
    expect(a?.niveau).toBe("critique");
  });

  it("OPCO au délai inconnu (AKTO) ou absent → rien", () => {
    expect(
      candidatsDelaiFacturationOpco(
        [
          { ...ATLAS, client: { opco: "akto" } },
          { ...ATLAS, client: null },
        ],
        J("2027-06-01"),
      ),
    ).toEqual([]);
  });

  it("aucune donnée personnelle : ni raison sociale ni nom dans le texte", () => {
    const [a] = candidatsDelaiFacturationOpco(
      [{ ...ATLAS, client: { opco: "atlas", raisonSociale: "Dupont SARL" } }],
      J("2026-12-20"),
    );
    expect(`${a?.titre} ${a?.message}`).not.toContain("Dupont");
  });
});

describe("regleDelaiFacturationOpco — requête bornée", () => {
  beforeEach(() => mockFindMany.mockReset().mockResolvedValue([]));

  it("subrogation, OPCO, terminée, sans facture OPCO émise, fenêtre et plafond", async () => {
    await regleDelaiFacturationOpco(J("2026-12-15"));
    const arg = mockFindMany.mock.calls[0]![0];
    expect(arg.where.opcoSubrogation).toBe(true);
    expect(arg.where.financementType).toEqual({ in: ["opco", "mixte"] });
    expect(arg.where.statut).toEqual({ in: ["en_cours", "realisee"] });
    expect(arg.where.dateFin.lte).toEqual(J("2026-12-15"));
    expect(arg.where.dateFin.gte).toBeInstanceOf(Date);
    expect(arg.where.facturesFormation).toEqual({
      none: { destinataire: "opco", statut: { notIn: ["brouillon", "annulee"] } },
    });
    expect(arg.take).toBeGreaterThan(0);
    expect(arg.select.client.select).toEqual({ opco: true });
  });
});

describe("catalogue", () => {
  it("le code est au catalogue, auto-résolu, guichet direction", () => {
    const e = ALERTE_CATALOGUE["delai_facturation_opco"];
    expect(e?.resolutionAuto).toBe(true);
    expect(e?.guichet).toBe("direction");
  });
});
