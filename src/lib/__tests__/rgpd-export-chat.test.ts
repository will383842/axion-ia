// RGPD art. 15 — export des données chatbot (chat_*). T-23.

import { describe, it, expect, vi, beforeEach } from "vitest";

const submissionFindMany = vi.fn();
const conversationFindMany = vi.fn();
const escalationFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (...a: unknown[]) => submissionFindMany(...a) },
    chatConversation: { findMany: (...a: unknown[]) => conversationFindMany(...a) },
    chatEscalation: { findMany: (...a: unknown[]) => escalationFindMany(...a) },
  },
}));

import { exportChatDataForEmail } from "@/lib/rgpd-export-chat";

beforeEach(() => {
  submissionFindMany.mockReset();
  conversationFindMany.mockReset();
  escalationFindMany.mockReset();
});

describe("exportChatDataForEmail", () => {
  it("exporte conversations (via leads) + escalades", async () => {
    submissionFindMany.mockResolvedValue([{ id: "sub-1" }]);
    conversationFindMany.mockResolvedValue([
      { id: "c1", sessionUuid: "s1", messages: [{ role: "user", contenu: "bonjour" }] },
    ]);
    escalationFindMany.mockResolvedValue([{ id: "e1", question: "?" }]);

    const r = await exportChatDataForEmail("jean@acme.fr");

    expect(r.conversations).toHaveLength(1);
    expect(r.escalations).toHaveLength(1);
    expect(conversationFindMany.mock.calls[0]![0].where.submissionId.in).toEqual(["sub-1"]);
    expect(escalationFindMany.mock.calls[0]![0].where.contactEmail).toBe("jean@acme.fr");
  });

  it("sans lead → aucune conversation, mais escalades quand même cherchées", async () => {
    submissionFindMany.mockResolvedValue([]);
    escalationFindMany.mockResolvedValue([]);

    const r = await exportChatDataForEmail("inconnu@acme.fr");

    expect(r.conversations).toEqual([]);
    expect(conversationFindMany).not.toHaveBeenCalled();
    expect(escalationFindMany).toHaveBeenCalledOnce();
  });
});
