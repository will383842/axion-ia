/** P11 — éteint, la forme rendue par l'espace est celle d'avant ; allumé, elle porte l'id de la pièce. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    trainee: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(() => null) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: vi.fn().mockReturnValue(false),
  getSignedUrlR2: vi.fn(),
  signedDocumentPdfUrl: vi.fn().mockResolvedValue(null),
  TTL_LECTURE_NOMINATIVE_S: 900,
}));

import { prisma } from "@/lib/prisma";
import { oublierPresenceColonne } from "@/server/qualiopi/adaptation/colonne-declaration";
import { getEspaceStagiaire } from "../portail-service";

const p = prisma as unknown as {
  setting: { findUnique: ReturnType<typeof vi.fn> };
  trainee: { findUnique: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
};
// Seul l'interrupteur du lot P11 est posé : les autres lots (adaptation…) restent éteints.
const etat = (e: string | null) =>
  p.setting.findUnique.mockImplementation(async (a: { where: { key: string } }) =>
    e !== null && a.where.key === "qualiopi.dossier_session.actif" ? { value: { etat: e } } : null,
  );

const enrollment = (estTestInterne: boolean) => ({
  id: "e1",
  statut: "confirmee",
  estTestInterne,
  adaptationsRealisees: null,
  createdAt: new Date("2026-01-01"),
  attestationDocument: {
    id: "att-1",
    type: "attestation",
    numero: "AXI-ATT-1",
    pdfUrl: "https://signe.example/att.pdf",
    qrToken: null,
    createdAt: new Date("2026-02-02"),
  },
  questionnaires: [],
  session: {
    id: "s1",
    estTestInterne: false,
    titreSession: "IA",
    dateDebut: new Date("2026-02-01"),
    dateFin: new Date("2026-02-02"),
    statut: "realisee",
    formation: { objectifsPedagogiques: null },
    documents: [
      {
        id: "doc-1",
        type: "programme",
        numero: "AXI-PRG-1",
        pdfUrl: "https://signe.example/prg.pdf",
        qrToken: null,
        createdAt: new Date("2026-01-15"),
      },
    ],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  oublierPresenceColonne();
  p.$queryRaw.mockResolvedValue([{ existe: true }]);
});
const trainee = (...e: ReturnType<typeof enrollment>[]) => ({
  prenom: "A",
  nom: "B",
  situationHandicap: false,
  handicapDetailsChiffre: null,
  enrollments: e,
});

describe("getEspaceStagiaire — P11", () => {
  it.each([null, "eteint"])("%s : aucun ouvertureId, pdfUrl intacte", async (e) => {
    etat(e);
    p.trainee.findUnique.mockResolvedValue(trainee(enrollment(true)));
    const r = await getEspaceStagiaire("t1");
    expect(r.attestations[0]).toEqual({
      type: "attestation",
      numero: "AXI-ATT-1",
      pdfUrl: "https://signe.example/att.pdf",
      qrToken: null,
    });
    expect(Object.keys(r.pieces[0]!)).not.toContain("ouvertureId");
  });

  it("essai : une inscription réelle = comme éteint", async () => {
    etat("essai");
    p.trainee.findUnique.mockResolvedValue(trainee(enrollment(true), enrollment(false)));
    const r = await getEspaceStagiaire("t1");
    expect(Object.keys(r.attestations[0]!)).not.toContain("ouvertureId");
  });

  it("essai : toutes d'essai ; actif : pièces et attestations portent leur id", async () => {
    for (const [e, t] of [
      ["essai", true],
      ["actif", false],
    ] as const) {
      etat(e);
      p.trainee.findUnique.mockResolvedValue(trainee(enrollment(t)));
      const r = await getEspaceStagiaire("t1");
      expect(r.attestations[0]!.ouvertureId).toBe("att-1");
      expect(r.pieces[0]!.ouvertureId).toBe("doc-1");
    }
  });
});
