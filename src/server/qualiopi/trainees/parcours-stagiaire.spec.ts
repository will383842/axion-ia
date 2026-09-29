/**
 * Le dossier d'une personne (audit du 2026-09-30) : la fiche stagiaire n'était
 * qu'un formulaire, et « montrez-moi le dossier de madame X » n'avait pas
 * d'écran. Ces tests figent ce que le bloc lit, et ce qu'il ne lit PAS.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findMany: vi.fn() },
    documentGenere: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getParcoursStagiaire } from "./parcours-stagiaire";

type MockFn = ReturnType<typeof vi.fn>;
const mockP = prisma as unknown as {
  enrollment: { findMany: MockFn };
  documentGenere: { findMany: MockFn };
};

const d = (s: string): Date => new Date(s);

describe("getParcoursStagiaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockP.documentGenere.findMany.mockResolvedValue([]);
  });

  it("rend chaque inscription avec sa session, sa présence, ses questionnaires et son attestation", async () => {
    mockP.enrollment.findMany.mockResolvedValue([
      {
        id: "e1",
        statut: "presente",
        tauxPresencePct: 100,
        emargementSigneAt: d("2026-09-06T14:47:00Z"),
        convocationEnvoyeeAt: d("2026-09-04T10:00:00Z"),
        attestationResultat: "complete",
        attestationDocument: { id: "doc-att", numero: "AXI-ATT-2026-001" },
        questionnaires: [
          {
            type: "positionnement",
            envoyeAt: d("2026-09-04T10:00:00Z"),
            reponduAt: d("2026-09-05T07:00:00Z"),
            noteGlobale: null,
          },
        ],
        evaluations: [{ dateEvaluation: d("2026-09-05T16:00:00Z") }],
        session: {
          id: "s1",
          numero: "AXI-SESS-2026-001",
          dateDebut: d("2026-09-05T07:00:00Z"),
          dateFin: d("2026-09-05T15:00:00Z"),
          statut: "realisee",
          formation: { titre: "IA pour bien commencer — journée complète" },
        },
      },
    ]);

    const p = await getParcoursStagiaire("t1");

    expect(p.inscriptions).toHaveLength(1);
    const i = p.inscriptions[0]!;
    expect(i.sessionNumero).toBe("AXI-SESS-2026-001");
    expect(i.formationTitre).toBe("IA pour bien commencer — journée complète");
    expect(i.attestation).toEqual({ numero: "AXI-ATT-2026-001", documentId: "doc-att" });
    expect(i.evaluationFinaleAt).toEqual(d("2026-09-05T16:00:00Z"));
    expect(i.questionnaires).toHaveLength(1);
  });

  it("ne demande jamais de donnée de santé ni de besoin d'adaptation", async () => {
    mockP.enrollment.findMany.mockResolvedValue([]);
    await getParcoursStagiaire("t1");

    const requete = JSON.stringify(mockP.enrollment.findMany.mock.calls[0]?.[0]);
    expect(requete).not.toMatch(/handicap|adaptation|besoin/i);
    expect(JSON.stringify(mockP.documentGenere.findMany.mock.calls[0]?.[0])).toContain(
      '"traineeId":"t1"',
    );
  });

  it("sans attestation ni évaluation, les champs valent null — pas undefined", async () => {
    mockP.enrollment.findMany.mockResolvedValue([
      {
        id: "e2",
        statut: "planifiee",
        tauxPresencePct: null,
        emargementSigneAt: null,
        convocationEnvoyeeAt: null,
        attestationResultat: null,
        attestationDocument: null,
        questionnaires: [],
        evaluations: [],
        session: {
          id: "s2",
          numero: "AXI-SESS-2026-002",
          dateDebut: d("2026-10-10T07:00:00Z"),
          dateFin: d("2026-10-10T15:00:00Z"),
          statut: "planifiee",
          formation: { titre: "IA pour les RH" },
        },
      },
    ]);
    const i = (await getParcoursStagiaire("t1")).inscriptions[0]!;
    expect(i.attestation).toBeNull();
    expect(i.evaluationFinaleAt).toBeNull();
  });
});
