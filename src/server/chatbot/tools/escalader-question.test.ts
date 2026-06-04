// T-14 — Tool escalader_question (ChatEscalation + ping équipe best-effort).

import { describe, it, expect, vi, beforeEach } from "vitest";

const escalationCreate = vi.fn();
const sendTelegram = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { chatEscalation: { create: (...a: unknown[]) => escalationCreate(...a) } },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => sendTelegram(...a) }));

import {
  escaladerQuestion,
  EscaladerQuestionInputSchema,
} from "@/server/chatbot/tools/escalader-question";

const ctx = { tenantId: "t1", conversationId: "conv-1" };

beforeEach(() => {
  escalationCreate.mockReset();
  sendTelegram.mockReset();
});

describe("T-14 escalader_question", () => {
  it("refuse un email invalide", () => {
    expect(() =>
      EscaladerQuestionInputSchema.parse({ question: "?", contact_email: "pas-un-email" }),
    ).toThrow();
  });

  it("crée une ChatEscalation ouverte et notifie l'équipe", async () => {
    escalationCreate.mockResolvedValue({ id: "esc-1", statut: "ouverte" });
    sendTelegram.mockResolvedValue(true);
    const r = await escaladerQuestion(
      { question: "Faites-vous du conseil RGPD ?", contact_email: "jean@acme.fr" },
      ctx,
    );
    expect(r).toEqual({ escalationId: "esc-1", statut: "ouverte", notified: true });
    const data = escalationCreate.mock.calls[0]![0].data;
    expect(data.tenantId).toBe("t1");
    expect(data.conversationId).toBe("conv-1");
    expect(data.statut).toBe("ouverte");
    expect(data.contactEmail).toBe("jean@acme.fr");
    expect(sendTelegram).toHaveBeenCalledOnce();
  });

  it("fonctionne sans contact ni Telegram configuré (fail-soft → notified=false)", async () => {
    escalationCreate.mockResolvedValue({ id: "esc-2", statut: "ouverte" });
    sendTelegram.mockResolvedValue(false);
    const r = await escaladerQuestion({ question: "Question sans contact" }, { tenantId: "t1" });
    expect(r).toEqual({ escalationId: "esc-2", statut: "ouverte", notified: false });
    // Pas de conversationId ni de contactEmail dans le payload.
    const data = escalationCreate.mock.calls[0]![0].data;
    expect(data.conversationId).toBeUndefined();
    expect(data.contactEmail).toBeUndefined();
  });
});
