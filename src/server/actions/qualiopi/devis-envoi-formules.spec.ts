/**
 * sendDevisAction — devis à formules : l'envoi est possible (interrupteur allumé, offre valide),
 * mais jamais sans pièce à signer, ni pour une formule à 0 € sans mensualité.
 * Devis classique : comportement inchangé (refus à 0,00 € HT).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";

const findUnique = vi.fn();
const transaction = vi.fn();
const txDevisUpdate = vi.fn();
const generateDocument = vi.fn();
const creerToken = vi.fn();
const enqueueEmail = vi.fn();
const formulesActives = vi.fn();
const logActivity = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: (...a: unknown[]) => findUnique(...a) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      transaction();
      return fn({
        devis: { update: (...a: unknown[]) => txDevisUpdate(...a) },
        client: { updateMany: vi.fn() },
        documentSignatureToken: { updateMany: vi.fn() },
      });
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
  requireHabilitation: vi.fn(async () => ({ userId: "adm-1" })),
  logQualiopiActivity: (...a: unknown[]) => logActivity(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: () => formulesActives(),
}));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: async () => ({
    identite: { raisonSociale: "Axion", site: "https://axion-ia.com" },
    regimeTva: "assujetti",
    tauxStandard: 20,
    certificationObtenue: false,
    formulesActives: await formulesActives(),
  }),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => generateDocument(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => creerToken(...a),
  revoquerTokensDocument: vi.fn(),
  TokenDocumentError: class extends Error {
    motif = "x";
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: vi.fn(),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => undefined) }));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));

import { sendDevisAction } from "./devis";

const ID = "11111111-1111-4111-8111-111111111111";

function devis(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "brouillon",
    lignes: [],
    activite: null,
    refClient: null,
    replacesDevisId: null,
    offre: offreFictive(),
    replacesDevis: null,
    financementSuggere: null,
    montantTotalHtCents: 0,
    montantOpcoEstimeCents: null,
    resteAChargeCents: null,
    dateValidite: new Date("2026-12-31T00:00:00Z"),
    client: {
      type: "entreprise",
      raisonSociale: "Client SA",
      siret: null,
      adresse: null,
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      contactNom: "Camille",
      contactEmail: "client@example.test",
      contactFonction: null,
    },
    ...over,
  };
}

/** Offre à une seule formule « achat », à 0 € HT, sans abonnement donc sans mensualité. */
function offreAchatAZero() {
  const o = offreFictive();
  const { abonnement: _a, ...reste } = o;
  return {
    ...reste,
    formulesProposees: ["achat"],
    achat: {
      ...o.achat,
      lignes: [{ libelle: "Ligne offerte", quantite: 1, prixHtCents: 0, tauxTvaBps: 2000 }],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  formulesActives.mockResolvedValue(true);
  findUnique.mockResolvedValue(devis());
  generateDocument.mockResolvedValue({ id: "doc-1", numero: "AXI-DEV-2026-001" });
  creerToken.mockResolvedValue({ token: "tok" });
  enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("sendDevisAction — devis à formules", () => {
  it("interrupteur éteint + offre : refus, aucune écriture ni rendu", async () => {
    formulesActives.mockResolvedValue(false);
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("2 formules, total de lignes à 0 : l'envoi passe (envoyé, pièce posée, lien émis)", async () => {
    const r = await sendDevisAction(ID);
    expect("data" in r).toBe(true);
    expect(txDevisUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: "envoye", documentGenereId: "doc-1" }),
      }),
    );
    expect(creerToken).toHaveBeenCalledOnce();
    if ("data" in r) expect(r.data.signatureCreee).toBe(true);
  });

  it("formule à 0 € HT sans mensualité : refus avant tout rendu", async () => {
    findUnique.mockResolvedValue(devis({ offre: offreAchatAZero() }));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("échec du rendu PDF : refus, aucune transaction, aucun e-mail", async () => {
    generateDocument.mockRejectedValue(new Error("rendu KO"));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(transaction).not.toHaveBeenCalled();
    expect(creerToken).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("pièce sans identifiant : refus, aucune transaction, aucun e-mail", async () => {
    generateDocument.mockResolvedValue({ id: null, numero: "AXI-DEV-2026-001" });
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(transaction).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("sendDevisAction — devis classique (inchangé)", () => {
  it("à 0,00 € HT : refus", async () => {
    findUnique.mockResolvedValue(devis({ offre: null, montantTotalHtCents: 0 }));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("0,00");
    expect(generateDocument).not.toHaveBeenCalled();
  });

  it("échec du rendu PDF : reste fail-soft (envoyé sans pièce)", async () => {
    findUnique.mockResolvedValue(
      devis({
        offre: null,
        montantTotalHtCents: 1000,
        lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 1000 }],
      }),
    );
    generateDocument.mockRejectedValue(new Error("rendu KO"));
    const r = await sendDevisAction(ID);
    expect("data" in r).toBe(true);
    expect(transaction).toHaveBeenCalledOnce();
  });
});
