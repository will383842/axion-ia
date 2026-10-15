// @vitest-environment node

/**
 * L'accusé DIFFÉRÉ d'une demande avec pièces jointes (2026-10-15) : il part
 * avec le nombre de pièces REÇUES, vers l'adresse de la DEMANDE en base (jamais
 * une adresse fournie par le navigateur), une seule fois (clé d'idempotence),
 * et seulement si l'action l'a mis en attente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  count: vi.fn(),
  enqueueEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findUnique: h.findUnique },
    submissionAttachment: { count: h.count },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v ? v.replace(/^enc:/, "") : v),
  isDecryptedEmailUsable: (v: string | null) => Boolean(v && v.includes("@")),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueueEmail }));

import { envoyerAccuseDiffere } from "../accuse-contact";

const SUB = "11111111-1111-4111-8111-111111111111";
const demande = (details: Record<string, unknown>) => ({
  contactName: "enc:Camille Exemple",
  contactEmail: "enc:camille@example.invalid",
  locale: "fr",
  companyName: "—",
  sector: null,
  employeesCount: null,
  details: { unifiedType: "devis", ...details },
  deletedAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.count.mockResolvedValue(2);
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("accusé différé", () => {
  it("part avec le nombre de pièces reçues, vers l'adresse de la demande, une seule fois", async () => {
    h.findUnique.mockResolvedValue(demande({ accuseDiffere: "quote-request-received" }));
    expect(await envoyerAccuseDiffere(SUB)).toBe(true);
    const [gabarit, a, locale, payload, options] = h.enqueueEmail.mock.calls[0]!;
    expect(gabarit).toBe("quote-request-received");
    expect(a).toBe("camille@example.invalid");
    expect(locale).toBe("fr");
    expect(payload).toMatchObject({
      contactName: "Camille Exemple",
      submissionId: SUB,
      type: "devis",
      piecesJointesRecues: 2,
    });
    expect(payload).not.toHaveProperty("companyName");
    expect(options).toEqual({
      entityType: "Submission",
      entityId: SUB,
      jobId: `accuse-contact-${SUB}`,
    });
    expect(h.count).toHaveBeenCalledWith({ where: { submissionId: SUB, statut: "recue" } });
  });

  it("aucune pièce reçue : l'accusé part quand même, sans la phrase des pièces", async () => {
    h.count.mockResolvedValue(0);
    h.findUnique.mockResolvedValue(demande({ accuseDiffere: "contact-confirmed" }));
    await envoyerAccuseDiffere(SUB);
    expect(h.enqueueEmail.mock.calls[0]![3]).not.toHaveProperty("piecesJointesRecues");
  });

  it("rien si l'action ne l'a pas mis en attente, ou un gabarit inconnu", async () => {
    h.findUnique.mockResolvedValue(demande({}));
    expect(await envoyerAccuseDiffere(SUB)).toBe(false);
    h.findUnique.mockResolvedValue(demande({ accuseDiffere: "facture-envoi" }));
    expect(await envoyerAccuseDiffere(SUB)).toBe(false);
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("rien pour une demande à la corbeille", async () => {
    h.findUnique.mockResolvedValue({
      ...demande({ accuseDiffere: "contact-confirmed" }),
      deletedAt: new Date(),
    });
    expect(await envoyerAccuseDiffere(SUB)).toBe(false);
  });
});
