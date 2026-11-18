import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { documentGenere: { findMany: vi.fn() } } }));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T>(f: T) => f,
}));

import { prisma } from "@/lib/prisma";
import { idsPiecesDevisAContresigner } from "./pieces-en-attente";

const piece = (id: string, type: string, parties: string[]) => ({
  id,
  type,
  numero: id,
  statutSignature: parties.length ? "partielle" : "en_attente",
  updatedAt: new Date(),
  sessionId: null,
  trainerId: null,
  session: null,
  signatures: parties.map((partie) => ({ partie })),
});

describe("idsPiecesDevisAContresigner", () => {
  it("devis signé du client seul = oui ; aucune signature = non ; autre type = non", async () => {
    vi.mocked(prisma.documentGenere.findMany).mockResolvedValue([
      piece("d-client", "devis", ["client"]),
      piece("d-rien", "devis", []),
      piece("c-client", "convention", ["client"]),
    ] as never);
    expect([...(await idsPiecesDevisAContresigner())]).toEqual(["d-client"]);
  });
  it("lecture en échec → ensemble vide", async () => {
    vi.mocked(prisma.documentGenere.findMany).mockRejectedValue(new Error("stub"));
    expect((await idsPiecesDevisAContresigner()).size).toBe(0);
  });
});
