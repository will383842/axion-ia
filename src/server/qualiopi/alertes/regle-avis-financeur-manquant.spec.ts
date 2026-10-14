/**
 * Lot 8B — décision du dirigeant (b) : l'avis du financeur (indicateur 30) reste saisi
 * à la main, mais une ALERTE prévient quand il manque, 30 jours après la fin d'une
 * session qu'un tiers finance (même délai que l'enquête « entreprise » automatique).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ sessions: vi.fn(), avis: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: h.sessions },
    appreciation: { findMany: h.avis },
  },
}));

import { ALERTE_CATALOGUE } from "./catalogue";
import {
  BORNE_BASSE_AVIS_FINANCEUR_JOURS,
  DELAI_AVIS_FINANCEUR_JOURS,
  regleAvisFinanceurManquant,
} from "./regle-avis-financeur-manquant";

const NOW = new Date("2026-12-20T07:00:00Z");
const J = 86_400_000;

function session(
  id: string,
  financementType: string | null,
  enrollments: Array<{ id: string; financementType: string | null }>,
) {
  return {
    id,
    numero: `AXI-SESS-${id}`,
    clientId: `c-${id}`,
    dateDebut: new Date("2026-11-02T08:00:00Z"),
    financementType,
    enrollments,
  };
}

beforeEach(() => {
  h.sessions.mockReset();
  h.avis.mockReset().mockResolvedValue([]);
});

describe("avis_financeur_manquant", () => {
  it("session financée par un tiers, sans avis du financeur : une alerte par session", async () => {
    h.sessions.mockResolvedValue([session("s1", "opco", [{ id: "e1", financementType: null }])]);
    const a = await regleAvisFinanceurManquant(NOW);
    expect(a).toEqual([
      expect.objectContaining({
        code: "avis_financeur_manquant",
        cibleType: "TrainingSession",
        cibleId: "s1",
        niveau: ALERTE_CATALOGUE["avis_financeur_manquant"]!.niveau,
      }),
    ]);
    expect(a[0]!.message).toMatch(/AXI-SESS-s1/);
    const where = h.sessions.mock.calls[0]![0].where;
    expect(where.statut).toBe("realisee");
    expect(where.dateFin.lte).toEqual(new Date(NOW.getTime() - DELAI_AVIS_FINANCEUR_JOURS * J));
    expect(where.dateFin.gte).toEqual(
      new Date(NOW.getTime() - BORNE_BASSE_AVIS_FINANCEUR_JOURS * J),
    );
  });

  it("financement direct (aucun tiers) : rien ; un participant financé par un tiers suffit", async () => {
    h.sessions.mockResolvedValue([
      session("s1", "direct", [{ id: "e1", financementType: null }]),
      session("s2", "direct", [
        { id: "e2", financementType: null },
        { id: "e3", financementType: "cpf" },
      ]),
      session("s3", null, [{ id: "e4", financementType: null }]),
    ]);
    const a = await regleAvisFinanceurManquant(NOW);
    expect(a.map((x) => x.cibleId)).toEqual(["s2"]);
  });

  it("avis saisi sur une inscription de la session, ou pour son client depuis le début : rien", async () => {
    h.sessions.mockResolvedValue([
      session("s1", "opco", [{ id: "e1", financementType: null }]),
      session("s2", "france_travail", [{ id: "e2", financementType: null }]),
      session("s3", "mixte", [{ id: "e3", financementType: null }]),
    ]);
    h.avis.mockResolvedValue([
      { enrollmentId: "e1", clientId: null, dateAppreciation: new Date("2026-11-20") },
      { enrollmentId: null, clientId: "c-s2", dateAppreciation: new Date("2026-11-20") },
      // Avis pour le client de s3, mais ANTÉRIEUR à la session : il ne la couvre pas.
      { enrollmentId: null, clientId: "c-s3", dateAppreciation: new Date("2026-10-01") },
    ]);
    const a = await regleAvisFinanceurManquant(NOW);
    expect(a.map((x) => x.cibleId)).toEqual(["s3"]);
    expect(h.avis.mock.calls[0]![0].where.source).toBe("financeur");
  });

  it("aucune session à examiner : aucune lecture des avis", async () => {
    h.sessions.mockResolvedValue([]);
    expect(await regleAvisFinanceurManquant(NOW)).toEqual([]);
    expect(h.avis).not.toHaveBeenCalled();
  });

  it("se referme seule dès que l'avis est saisi (résolution automatique)", () => {
    expect(ALERTE_CATALOGUE["avis_financeur_manquant"]!.resolutionAuto).toBe(true);
    expect(DELAI_AVIS_FINANCEUR_JOURS).toBe(30);
  });
});
