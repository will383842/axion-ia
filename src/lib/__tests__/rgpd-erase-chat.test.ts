// RGPD art. 17 — effacement des données chatbot (chat_*). T-23.

import { describe, it, expect, vi, beforeEach } from "vitest";

const submissionFindMany = vi.fn();
const conversationDeleteMany = vi.fn();
const escalationUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (...a: unknown[]) => submissionFindMany(...a) },
    chatConversation: { deleteMany: (...a: unknown[]) => conversationDeleteMany(...a) },
    chatEscalation: { updateMany: (...a: unknown[]) => escalationUpdateMany(...a) },
  },
}));

import { eraseChatDataForEmail } from "@/lib/rgpd-erase";

beforeEach(() => {
  submissionFindMany.mockReset();
  conversationDeleteMany.mockReset();
  escalationUpdateMany.mockReset();
});

describe("eraseChatDataForEmail", () => {
  it("supprime les conversations liées aux leads + anonymise les escalades", async () => {
    submissionFindMany.mockResolvedValue([{ id: "sub-1" }, { id: "sub-2" }]);
    conversationDeleteMany.mockResolvedValue({ count: 3 });
    escalationUpdateMany.mockResolvedValue({ count: 1 });

    const r = await eraseChatDataForEmail("jean@acme.fr");

    expect(r).toEqual({ conversationsDeleted: 3, escalationsAnonymized: 1 });
    // Conversations supprimées par submissionId des leads de la personne.
    expect(conversationDeleteMany.mock.calls[0]![0].where.submissionId.in).toEqual([
      "sub-1",
      "sub-2",
    ]);
    // Escalade : email anonymisé (hash), contexte vidé.
    const escData = escalationUpdateMany.mock.calls[0]![0];
    expect(escData.where.contactEmail).toBe("jean@acme.fr");
    expect(escData.data.contactEmail).toMatch(/^erased:.*@erased\.local$/);
    expect(escData.data.contexte).toBeNull();
  });

  it("sans lead → ne supprime aucune conversation mais traite quand même les escalades", async () => {
    submissionFindMany.mockResolvedValue([]);
    escalationUpdateMany.mockResolvedValue({ count: 0 });

    const r = await eraseChatDataForEmail("inconnu@acme.fr");

    expect(r).toEqual({ conversationsDeleted: 0, escalationsAnonymized: 0 });
    expect(conversationDeleteMany).not.toHaveBeenCalled();
  });
});
