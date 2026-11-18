/**
 * B4 — la civilité, le prénom et le nom de famille du contact suivent la personne :
 * l'effacement (art. 17) les vide avec `contactNom`, l'export (art. 15) les rend.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  clientUpdate: vi.fn(),
  contactFindMany: vi.fn(),
}));

vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e}`,
  normalizeEmail: (e: string) => e,
}));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: async () => null,
  emettreFaitClient: async () => undefined,
}));
vi.mock("@/lib/prisma", () => {
  const vide = () => ({ findMany: async () => [], findFirst: async () => null });
  const base: Record<string, unknown> = {
    client: {
      findMany: async () => [{ id: "c1", type: "entreprise", _count: { facturesFormation: 0 } }],
      update: (...a: unknown[]) => m.clientUpdate(...a),
    },
    clientContactAdresse: { findMany: async () => [{ contactId: "p1" }] },
    clientContact: { findMany: (...a: unknown[]) => m.contactFindMany(...a) },
  };
  const prisma: unknown = new Proxy(base, {
    get: (cible, nom: string) => {
      if (nom === "$transaction") {
        return async (fn: (tx: unknown) => unknown) => fn(prisma);
      }
      return cible[nom] ?? vide();
    },
  });
  return { prisma };
});

import { eraseClientsForEmail } from "@/lib/rgpd-erase";
import { exporterDossierClientPour } from "@/lib/rgpd-dossier-client";

beforeEach(() => vi.clearAllMocks());

describe("effacement", () => {
  it("vide la civilité, le prénom et le nom de famille avec contactNom", async () => {
    await eraseClientsForEmail("lea@dupont.example");
    const data = m.clientUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).toMatchObject({
      contactNom: null,
      contactCivilite: null,
      contactPrenom: null,
      contactNomFamille: null,
    });
  });
});

describe("export", () => {
  it("rend la civilité, le prénom et le nom de famille de la personne", async () => {
    m.contactFindMany.mockResolvedValue([
      {
        id: "p1",
        nom: "Léa Dupont",
        civilite: "madame",
        prenom: "Léa",
        nomFamille: "Dupont",
        fonction: null,
        telephone: null,
        statut: "actif",
        partiLe: null,
        oppositionIaLe: null,
        clientId: "c1",
        client: { raisonSociale: "Fictive SA" },
        adresses: [
          { email: "lea@dupont.example", nature: "pro", emailHash: "h:lea@dupont.example" },
        ],
      },
    ]);
    const exp = await exporterDossierClientPour("lea@dupont.example");
    expect(exp.personnes[0]).toMatchObject({
      civilite: "madame",
      prenom: "Léa",
      nomFamille: "Dupont",
    });
  });
});
