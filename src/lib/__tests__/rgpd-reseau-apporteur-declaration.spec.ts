import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const presFindMany = vi.fn();
const appFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: { findUnique: (...a: unknown[]) => appFindUnique(...a) },
    presentationEntreprise: { findMany: (...a: unknown[]) => presFindMany(...a) },
    pieceApporteur: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v ? v.replace(/^enc:/, "") : null),
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "empreinte" }));

import { exporterReseauApporteurPour } from "../rgpd-reseau-apporteur";

describe("RGPD — export de la personne présentée par formulaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appFindUnique.mockResolvedValue(null);
  });

  it("restitue la fonction et la date du contact déclarées", async () => {
    const contact = new Date("2026-10-01T00:00:00Z");
    presFindMany.mockResolvedValue([
      {
        denomination: "Boulangerie Martin",
        personneNom: "enc:Claire Durand",
        personneFonction: "Gérante",
        personneTelephone: "enc:0612345678",
        dateEchange: contact,
        recueAt: new Date("2026-10-05T10:00:00Z"),
      },
    ]);
    const r = await exporterReseauApporteurPour("claire@exemple.fr");
    expect(r.presenteePar[0]).toMatchObject({
      nom: "Claire Durand",
      fonction: "Gérante",
      telephone: "0612345678",
      contactLe: contact,
    });
    // La requête demande bien la date du contact.
    expect(presFindMany.mock.calls[0]![0].select.dateEchange).toBe(true);
  });
});
