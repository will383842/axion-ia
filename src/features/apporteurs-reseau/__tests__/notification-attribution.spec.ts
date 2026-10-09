import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.6, art. 3.1 (relecture de a1) : les candidats écartés sont prévenus par écrit, avec
// le motif ; l'apporteur choisi reçoit l'annonce « commande signée » (même clé que le passage).

const d = vi.hoisted(() => ({ envoyer: vi.fn(async () => "envoye") }));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => d.envoyer(...(a as [])) }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        denomination: "ACME",
        apporteurId: `app-${where.id}`,
        apporteur: { prenom: "Paul", nom: "Martin", email: `${where.id}@exemple.fr` },
      })),
    },
    factureFormation: { findUnique: vi.fn(async () => ({ devisId: "D1" })) },
  },
}));

import { notifierDecisionAttribution } from "../notification-attribution";

beforeEach(() => vi.clearAllMocks());

describe("notification de la décision", () => {
  it("écarté : e-mail motivé ; choisi : « commande signée » sous la clé du devis", async () => {
    await notifierDecisionAttribution({
      factureId: "F1",
      choisie: "p1",
      ecartes: ["p2"],
      motif: "Commande de l'agence de Lyon.",
    });
    const appels = d.envoyer.mock.calls as unknown as Array<[Record<string, unknown>]>;
    expect(appels[0]![0]).toMatchObject({
      gabarit: "apporteur-commande-non-attribuee",
      destinataire: "p2@exemple.fr",
      payload: expect.objectContaining({
        motif: "Commande de l'agence de Lyon.",
        entreprise: "ACME",
      }),
      jobId: "apporteur-commande-non-attribuee-F1-p2",
    });
    expect(appels[1]![0]).toMatchObject({
      gabarit: "apporteur-commande-signee",
      destinataire: "p1@exemple.fr",
      jobId: "apporteur-commande-signee-D1-app-p1",
    });
    // Jamais l'identité d'un autre apporteur dans l'e-mail de l'écarté.
    expect(JSON.stringify(appels[0]![0].payload)).not.toContain("p1");
  });
});
