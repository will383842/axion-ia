// RGPD art. 17 — effacement des données chatbot (chat_*). T-23.

import { describe, it, expect, vi, beforeEach } from "vitest";

const submissionFindMany = vi.fn();
const conversationDeleteMany = vi.fn();
const escalationFindMany = vi.fn();
const escalationUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (...a: unknown[]) => submissionFindMany(...a) },
    chatConversation: { deleteMany: (...a: unknown[]) => conversationDeleteMany(...a) },
    chatEscalation: {
      findMany: (...a: unknown[]) => escalationFindMany(...a),
      updateMany: (...a: unknown[]) => escalationUpdateMany(...a),
    },
  },
}));

import { eraseChatDataForEmail } from "@/lib/rgpd-erase";

beforeEach(() => {
  submissionFindMany.mockReset();
  conversationDeleteMany.mockReset();
  escalationFindMany.mockReset();
  escalationUpdateMany.mockReset();
});

describe("eraseChatDataForEmail", () => {
  it("supprime les conversations liées aux leads + anonymise les escalades", async () => {
    submissionFindMany.mockResolvedValue([{ id: "sub-1" }, { id: "sub-2" }]);
    escalationFindMany.mockResolvedValue([]); // pas de conversation rattachée par escalade
    conversationDeleteMany.mockResolvedValue({ count: 3 });
    escalationUpdateMany.mockResolvedValue({ count: 1 });

    const r = await eraseChatDataForEmail("jean@acme.fr");

    expect(r).toEqual({ conversationsDeleted: 3, escalationsAnonymized: 1 });
    // Conversations supprimées via OR (leads + escalades). Ici : leads seuls.
    const orClauses = conversationDeleteMany.mock.calls[0]![0].where.OR;
    expect(orClauses).toContainEqual({ submissionId: { in: ["sub-1", "sub-2"] } });
    // Escalade : email anonymisé (hash), contexte vidé.
    const escData = escalationUpdateMany.mock.calls[0]![0];
    expect(escData.where.contactEmail).toBe("jean@acme.fr");
    expect(escData.data.contactEmail).toMatch(/^erased:.*@erased\.local$/);
    expect(escData.data.contexte).toBeNull();
  });

  it("rattache aussi les conversations référencées par une escalade de cet email", async () => {
    submissionFindMany.mockResolvedValue([]);
    escalationFindMany.mockResolvedValue([{ conversationId: "conv-9" }]);
    conversationDeleteMany.mockResolvedValue({ count: 1 });
    escalationUpdateMany.mockResolvedValue({ count: 1 });

    await eraseChatDataForEmail("jean@acme.fr");

    const orClauses = conversationDeleteMany.mock.calls[0]![0].where.OR;
    expect(orClauses).toContainEqual({ id: { in: ["conv-9"] } });
  });

  it("sans aucune ancre → ne supprime aucune conversation, traite les escalades", async () => {
    submissionFindMany.mockResolvedValue([]);
    escalationFindMany.mockResolvedValue([]);
    escalationUpdateMany.mockResolvedValue({ count: 0 });

    const r = await eraseChatDataForEmail("inconnu@acme.fr");

    expect(r).toEqual({ conversationsDeleted: 0, escalationsAnonymized: 0 });
    expect(conversationDeleteMany).not.toHaveBeenCalled();
  });
});
