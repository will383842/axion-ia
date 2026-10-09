import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.6, art. 3.1 (relecture de a1) : les candidats écartés sont prévenus par écrit, avec
// le motif ; l'apporteur choisi reçoit l'annonce « commande signée » (même clé que le passage).

const d = vi.hoisted(() => ({
  envoyer: vi.fn(async (): Promise<string> => "envoye"),
  alerte: vi.fn(async () => ({ enqueued: true })),
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => d.envoyer(...(a as [])) }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => d.alerte(...(a as [])),
}));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "contact@axion-ia.com",
}));
vi.mock("../etablissement-presentation", () => ({
  lireEtablissements: async (ids: readonly string[]) =>
    new Map(ids.map((id) => [id, { siret: "73282932000074", entreprise: false, exclus: [] }])),
}));
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

import { motifParDefaut, notifierDecisionAttribution } from "../notification-attribution";

beforeEach(() => {
  vi.clearAllMocks();
  d.envoyer.mockResolvedValue("envoye");
});

describe("notification de la décision", () => {
  it("écarté : e-mail motivé ; choisi : « commande signée » sous la clé du devis", async () => {
    await notifierDecisionAttribution({
      factureId: "F1",
      choisie: "p1",
      ecartes: ["p2"],
      motif: "Commande de l'agence de Lyon.",
      siretCommande: "73282932000041",
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

describe("relecture 3 de a1", () => {
  it("(1) un envoi en échec est réessayé, puis une alerte interne part", async () => {
    d.envoyer.mockResolvedValue("indisponible");
    await notifierDecisionAttribution({
      factureId: "F2",
      choisie: null,
      ecartes: ["p3"],
      motif: "Motif quelconque, assez long.",
      siretCommande: null,
    });
    expect(d.envoyer).toHaveBeenCalledTimes(2);
    expect(d.alerte).toHaveBeenCalledWith(
      "qualiopi-alerte-interne",
      expect.any(String),
      "fr",
      expect.objectContaining({ code: "apporteur_information_non_envoyee" }),
      expect.anything(),
    );
  });

  it("(2) motif par défaut EXACT selon le cas", () => {
    expect(
      motifParDefaut({ siretCommande: null, siretEcarte: "73282932000074", autreChoisi: false }),
    ).toContain("ne porte aucun numéro SIRET");
    expect(
      motifParDefaut({
        siretCommande: "73282932000041",
        siretEcarte: "73282932000074",
        autreChoisi: false,
      }),
    ).toContain("l'établissement SIRET 73282932000041, qui ne vous est pas attribué");
    expect(
      motifParDefaut({
        siretCommande: "73282932000074",
        siretEcarte: "73282932000074",
        autreChoisi: true,
      }),
    ).toContain("antérieure à la vôtre");
  });
});
