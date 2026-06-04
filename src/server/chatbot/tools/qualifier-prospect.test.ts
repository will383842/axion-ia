// T-13 — Tool qualifier_prospect (capture non-intrusive + merge du profil).

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatConversation: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

import {
  qualifierProspect,
  QualifierProspectInputSchema,
} from "@/server/chatbot/tools/qualifier-prospect";

const ctx = { tenantId: "t1", conversationId: "conv-1" };

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
});

describe("T-13 qualifier_prospect", () => {
  it("refuse une valeur d'enum invalide", () => {
    expect(() => QualifierProspectInputSchema.parse({ type_structure: "startup" })).toThrow();
  });

  it("accepte un profil partiel (tous champs optionnels)", () => {
    expect(() => QualifierProspectInputSchema.parse({ secteur: "industrie" })).not.toThrow();
    expect(() => QualifierProspectInputSchema.parse({})).not.toThrow();
  });

  it("merge le nouveau profil avec l'existant (n'écrase pas les champs connus)", async () => {
    findUnique.mockResolvedValue({ prospectProfile: { type_structure: "pme", secteur: "btp" } });
    update.mockResolvedValue({});
    const r = await qualifierProspect({ besoin: "audit", urgence: "forte" }, ctx);
    expect(r).toEqual({
      type_structure: "pme",
      secteur: "btp",
      besoin: "audit",
      urgence: "forte",
    });
    expect(update.mock.calls[0]![0].data.prospectProfile).toEqual(r);
  });

  it("exige un conversationId", async () => {
    await expect(qualifierProspect({ secteur: "x" }, { tenantId: "t1" })).rejects.toThrow(
      /conversationId/,
    );
  });
});
