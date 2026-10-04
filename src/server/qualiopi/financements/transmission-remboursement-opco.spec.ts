/**
 * Lot A8c — circuit REMBOURSEMENT : une fois sa facture intégralement réglée,
 * l'entreprise reçoit la facture acquittée et le(s) certificat(s) de
 * réalisation « pour sa demande de remboursement auprès de son OPCO ».
 *
 * Garanties : jamais en subrogation, jamais à l'OPCO, jamais deux fois,
 * TOUJOURS garé en validation (ordre permanent : rien ne part à un client sans
 * relecture), et l'encaissement réel déclenche bien la préparation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  facture: null as Record<string, unknown> | null,
  outboxCount: 0,
  logCount: 0,
  enqueue: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: { findUnique: vi.fn(async () => m.facture) },
    documentGenere: {
      findUnique: vi.fn(async () => ({
        type: "facture",
        numero: "AXI-FACT-2026-210",
        createdAt: new Date("2026-10-14T10:00:00Z"),
      })),
    },
    emailOutbox: { count: vi.fn(async () => m.outboxCount) },
    emailLog: { count: vi.fn(async () => m.logCount) },
  },
}));

vi.mock("@/server/queue/queues", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/queue/queues")>()),
  enqueueEmail: (...a: unknown[]) => m.enqueue(...a),
}));

import { preparerTransmissionRemboursementOpco } from "./transmission-remboursement-opco";

function facture(over: Record<string, unknown> = {}, session: Record<string, unknown> = {}) {
  return {
    id: "f-210",
    numero: "AXI-FACT-2026-210",
    statut: "payee",
    destinataire: "entreprise",
    destinataireNom: "Acme",
    subrogation: false,
    avoirDeId: null,
    numeroDossierOpco: null,
    montantTtcCents: 180000,
    montantHtCents: 150000,
    paidAt: new Date("2026-10-20T10:00:00Z"),
    clientId: "c-1",
    documentId: "doc-f",
    client: {
      raisonSociale: "Acme",
      contactNom: "Mme Martin",
      contactEmail: "compta@acme.test",
      opco: null,
      opcoIdentifie: "atlas",
    },
    session: {
      id: "s-1",
      numero: "AXI-SESS-2026-902",
      titreSession: "IA générative au quotidien",
      financementType: "opco",
      opcoSubrogation: false,
      documents: [
        {
          id: "d-c1",
          type: "certificat_realisation",
          numero: "AXI-DOC-2026-301",
          createdAt: new Date("2026-10-14T10:00:00Z"),
          annuleeAt: null,
          traineeId: "t1",
        },
      ],
      ...session,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.outboxCount = 0;
  m.logCount = 0;
  m.enqueue.mockResolvedValue({ enqueued: false, garePourValidation: true });
});

describe("preparerTransmissionRemboursementOpco", () => {
  it("remboursement, facture payée → e-mail à l'ENTREPRISE, garé, facture + certificat joints", async () => {
    m.facture = facture();
    const r = await preparerTransmissionRemboursementOpco("f-210");
    expect(r.statut).toBe("preparee");

    expect(m.enqueue).toHaveBeenCalledTimes(1);
    const [template, to, locale, payload, options] = m.enqueue.mock.calls[0]!;
    expect(template).toBe("facture-pieces-remboursement-opco");
    expect(to).toBe("compta@acme.test");
    expect(locale).toBe("fr");
    expect(payload).toMatchObject({
      numero: "AXI-FACT-2026-210",
      opcoNom: "Atlas",
      montantLabel: expect.stringMatching(/^1\s800,00\s€ TTC$/),
      pieces: ["Facture AXI-FACT-2026-210 (acquittée)", "Certificat de réalisation"],
    });
    expect(options).toMatchObject({
      exigerValidation: true,
      entityType: "FactureFormation",
      entityId: "f-210",
      clientId: "c-1",
    });
    const cles = (options as { attachments: Array<{ r2Key: string }> }).attachments.map(
      (a) => a.r2Key,
    );
    expect(cles).toEqual([
      "documents/2026/facture/AXI-FACT-2026-210.pdf",
      "documents/2026/certificat_realisation/AXI-DOC-2026-301.pdf",
    ]);
  });

  it("subrogation → rien (l'OPCO paie l'organisme, l'entreprise n'a rien à se faire rembourser)", async () => {
    m.facture = facture({}, { opcoSubrogation: true });
    expect((await preparerTransmissionRemboursementOpco("f-210")).statut).toBe("sans_objet");
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("facture adressée à l'OPCO → rien", async () => {
    m.facture = facture({ destinataire: "opco", subrogation: true });
    expect((await preparerTransmissionRemboursementOpco("f-210")).statut).toBe("sans_objet");
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("facture pas encore soldée → rien", async () => {
    m.facture = facture({ statut: "partiellement_payee" });
    expect((await preparerTransmissionRemboursementOpco("f-210")).statut).toBe("sans_objet");
  });

  it("déjà préparé une fois → jamais deux fois", async () => {
    m.facture = facture();
    m.outboxCount = 1;
    expect((await preparerTransmissionRemboursementOpco("f-210")).statut).toBe("sans_objet");
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("sans e-mail de contact → impossible, et dit pourquoi", async () => {
    m.facture = facture({
      client: {
        raisonSociale: "Acme",
        contactNom: null,
        contactEmail: null,
        opcoIdentifie: "atlas",
      },
    });
    const r = await preparerTransmissionRemboursementOpco("f-210");
    expect(r.statut).toBe("impossible");
    expect(m.enqueue).not.toHaveBeenCalled();
  });
});
