/**
 * T-17 — Tool capturer_lead (idempotent → Submission, source=chatbot).
 *
 * Couvre : consentement RGPD requis · Submission créée avec source=chatbot ·
 * retry idempotent (pas de doublon) · conversationId requis.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const submissionCreate = vi.fn();
const idemUpsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatActionIdempotency: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      upsert: (...a: unknown[]) => idemUpsert(...a),
    },
    submission: { create: (...a: unknown[]) => submissionCreate(...a) },
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
  idemUpsert.mockReset();
});

describe("T-17 capturer_lead", () => {
  it("refuse sans consentement RGPD (Zod literal true)", () => {
    expect(() =>
      CapturerLeadInputSchema.parse({ ...validInput, consentement_rgpd: false }),
    ).toThrow();
  });

  it("crée un Submission avec source=chatbot", async () => {
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({ id: "sub-1" });
    idemUpsert.mockResolvedValue({});
    const r = await capturerLead(validInput, ctx);
    expect(r).toEqual({ submissionId: "sub-1", idempotent: false });
    const data = submissionCreate.mock.calls[0]![0].data;
    expect(data.source).toBe("chatbot");
    expect(data.contactEmail).toBe("jean@acme.fr");
    expect(data.type).toBe("contact");
  });

  it("retry idempotent → renvoie le lead mémorisé, AUCUN nouveau Submission", async () => {
    findUnique.mockResolvedValue({ cle: "k", resultat: { submissionId: "sub-1" } });
    const r = await capturerLead(validInput, ctx);
    expect(r).toEqual({ submissionId: "sub-1", idempotent: true });
    expect(submissionCreate).not.toHaveBeenCalled();
  });

  it("exige un conversationId (idempotence impossible sinon)", async () => {
    await expect(capturerLead(validInput, { tenantId: "t1" })).rejects.toThrow(/conversationId/);
  });

  it("propage l'ipHash si fourni", async () => {
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({ id: "sub-2" });
    idemUpsert.mockResolvedValue({});
    await capturerLead(validInput, { ...ctx, ipHash: "abcdef" });
    expect(submissionCreate.mock.calls[0]![0].data.ipHash).toBe("abcdef");
  });
});
