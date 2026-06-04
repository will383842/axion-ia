/**
 * T-17 — Tool capturer_lead (idempotent → Submission, source=chatbot).
 *
 * Couvre : consentement RGPD requis · Submission créée avec source=chatbot ·
 * retry idempotent (pas de doublon) · conversationId requis · atomicité
 * transactionnelle + course concurrente (conflit P2002 → 0 doublon).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "../../../../prisma/generated/client";

const findUnique = vi.fn();
const submissionCreate = vi.fn();
const idemCreate = vi.fn();
const convUpdate = vi.fn();

// Transaction interactive : exécute le callback avec un client `tx` exposant les
// mêmes mocks (submission.create + chatActionIdempotency.create + conv.update).
const transaction = vi.fn(
  (fn: (tx: unknown) => unknown) =>
    fn({
      submission: { create: (...a: unknown[]) => submissionCreate(...a) },
      chatActionIdempotency: { create: (...a: unknown[]) => idemCreate(...a) },
      chatConversation: { update: (...a: unknown[]) => convUpdate(...a) },
    }) as unknown,
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatActionIdempotency: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => idemCreate(...a),
    },
    submission: { create: (...a: unknown[]) => submissionCreate(...a) },
    $transaction: (...a: unknown[]) => transaction(...(a as [(tx: unknown) => unknown])),
  },
}));

import { capturerLead, CapturerLeadInputSchema } from "@/server/chatbot/tools/capturer-lead";

const ctx = { tenantId: "t1", conversationId: "conv-1" };
const validInput = {
  nom: "Jean Dupont",
  email: "jean@acme.fr",
  besoin_resume: "Audit IA pour ma PME",
  consentement_rgpd: true as const,
};

beforeEach(() => {
  findUnique.mockReset();
  submissionCreate.mockReset();
  idemCreate.mockReset();
  convUpdate.mockReset();
  transaction.mockClear();
});

describe("T-17 capturer_lead", () => {
  it("refuse sans consentement RGPD (Zod literal true)", () => {
    expect(() =>
      CapturerLeadInputSchema.parse({ ...validInput, consentement_rgpd: false }),
    ).toThrow();
  });

  it("crée un Submission avec source=chatbot (dans une transaction)", async () => {
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({ id: "sub-1" });
    idemCreate.mockResolvedValue({});
    const r = await capturerLead(validInput, ctx);
    expect(r).toEqual({ submissionId: "sub-1", idempotent: false });
    expect(transaction).toHaveBeenCalledOnce();
    const data = submissionCreate.mock.calls[0]![0].data;
    expect(data.source).toBe("chatbot");
    expect(data.contactEmail).toBe("jean@acme.fr");
    expect(data.type).toBe("contact");
    // La clé d'idempotence est créée (pas upsert) dans la même transaction.
    expect(idemCreate).toHaveBeenCalledOnce();
    expect(idemCreate.mock.calls[0]![0].data.resultat).toEqual({ submissionId: "sub-1" });
    // Backlink conversation → lead (RGPD : rattachement export/erase).
    expect(convUpdate).toHaveBeenCalledOnce();
    expect(convUpdate.mock.calls[0]![0]).toEqual({
      where: { id: "conv-1" },
      data: { submissionId: "sub-1" },
    });
  });

  it("retry idempotent → renvoie le lead mémorisé, AUCUNE transaction", async () => {
    findUnique.mockResolvedValue({ cle: "k", resultat: { submissionId: "sub-1" } });
    const r = await capturerLead(validInput, ctx);
    expect(r).toEqual({ submissionId: "sub-1", idempotent: true });
    expect(transaction).not.toHaveBeenCalled();
    expect(submissionCreate).not.toHaveBeenCalled();
  });

  it("course concurrente (P2002 sur la clé) → 0 doublon, renvoie le gagnant", async () => {
    // 1er findUnique (pré-check) = rien → on entre en transaction.
    // La création de la clé conflicte (un appel concurrent a gagné) → P2002.
    // 2e findUnique (relecture post-conflit) = résultat du gagnant.
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ cle: "k", resultat: { submissionId: "sub-winner" } });
    submissionCreate.mockResolvedValue({ id: "sub-loser" });
    idemCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "x",
      }),
    );
    const r = await capturerLead(validInput, ctx);
    expect(r).toEqual({ submissionId: "sub-winner", idempotent: true });
  });

  it("exige un conversationId (idempotence impossible sinon)", async () => {
    await expect(capturerLead(validInput, { tenantId: "t1" })).rejects.toThrow(/conversationId/);
  });

  it("propage l'ipHash si fourni", async () => {
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({ id: "sub-2" });
    idemCreate.mockResolvedValue({});
    await capturerLead(validInput, { ...ctx, ipHash: "abcdef" });
    expect(submissionCreate.mock.calls[0]![0].data.ipHash).toBe("abcdef");
  });
});
