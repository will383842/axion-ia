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
    // 1er findMany = conversations rattachées par escalade (aucune) ; 2e = escalades.
    escalationFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "e1", question: "?" }]);

    const r = await exportChatDataForEmail("jean@acme.fr");

    expect(r.conversations).toHaveLength(1);
    expect(r.escalations).toHaveLength(1);
    // Conversations via OR (leads + escalades) ; ici leads seuls.
    expect(conversationFindMany.mock.calls[0]![0].where.OR).toContainEqual({
      submissionId: { in: ["sub-1"] },
    });
  });

  it("sans aucune ancre → aucune conversation, escalades quand même cherchées", async () => {
    submissionFindMany.mockResolvedValue([]);
    escalationFindMany.mockResolvedValue([]);

    const r = await exportChatDataForEmail("inconnu@acme.fr");

    expect(r.conversations).toEqual([]);
    expect(conversationFindMany).not.toHaveBeenCalled();
    // findMany escalades appelé 2× (ancres + export escalades).
    expect(escalationFindMany).toHaveBeenCalledTimes(2);
  });
});
