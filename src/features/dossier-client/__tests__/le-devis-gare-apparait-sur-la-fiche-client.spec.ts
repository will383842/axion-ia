/**
 * Un e-mail de devis garé « à valider » porte `clientId` (lot 1 de l'aperçu de l'e-mail) : la
 * fiche du client le montre « En attente de votre validation », avec l'objet choisi.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  rencontre: { findMany: vi.fn() },
  emailLog: { findMany: vi.fn() },
  emailOutbox: { findMany: vi.fn() },
  questionnaireAvantAuditCourrier: { findMany: vi.fn() },
  clientFusion: { findMany: vi.fn(async () => []) },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/features/admin-emails/rattachement-client", () => ({
  idsLiesAuClient: vi.fn(async () => []),
}));

import { lireFilDesEchanges } from "../fil-des-echanges";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.clientFusion.findMany.mockResolvedValue([]);
  prismaMock.rencontre.findMany.mockResolvedValue([]);
  prismaMock.emailLog.findMany.mockResolvedValue([]);
  prismaMock.questionnaireAvantAuditCourrier.findMany.mockResolvedValue([]);
});

describe("fil de la fiche client — e-mail de devis garé", () => {
  it("une ligne garée avec clientId apparaît « En attente de votre validation »", async () => {
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      {
        id: "o-devis",
        sujet: "Votre devis sur mesure",
        statut: "a_valider",
        createdAt: new Date("2026-11-19T09:00:00Z"),
      },
    ]);
    const { fil } = await lireFilDesEchanges("client-1", "adm");
    expect(prismaMock.emailOutbox.findMany.mock.calls[0]![0].where).toEqual({
      clientId: "client-1",
      statut: { in: ["a_valider", "refuse"] },
    });
    const ligne = fil.find((x) => x.cle === "outbox:o-devis");
    expect(ligne).toMatchObject({
      genre: "email_en_attente",
      titre: "Votre devis sur mesure",
      etat: "En attente de votre validation",
    });
  });
});
