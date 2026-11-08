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

/** Offre abonnement seul, mise en service à 0 € : le total est 0, seules les périodes comptent. */
function offreAboSeul(periodes: { mois: number; remiseBps: number }[]) {
  const o = offreFictive();
  const { achat: _a, ...reste } = o;
  return {
    ...reste,
    formulesProposees: ["abonnement"],
    abonnement: {
      ...o.abonnement!,
      miseEnServiceLignes: [
        { libelle: "Mise en service offerte", quantite: 1, prixHtCents: 0, tauxTvaBps: 2000 },
      ],
      periodes,
    },
  };
}

describe("sendDevisAction — devis à formules : gardes complémentaires", () => {
  it("lien de signature non créé : refus avant la transaction, aucun e-mail", async () => {
    creerToken.mockRejectedValue(new Error("panne"));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("lien de signature");
    expect(transaction).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("sans e-mail de contact : refus avant tout rendu", async () => {
    const d0 = devis();
    findUnique.mockResolvedValue({ ...d0, client: { ...d0.client, contactEmail: null } });
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("formules absentes du PDF (interrupteur éteint à la 2e lecture) : refus", async () => {
    formulesActives.mockReset();
    formulesActives.mockResolvedValueOnce(true).mockResolvedValue(false);
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("n'ont pas pu être construites");
    expect(generateDocument).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rendu PDF en échec : message dédié « n'a pas pu être généré »", async () => {
    generateDocument.mockRejectedValue(new Error("rendu KO"));
    const r = await sendDevisAction(ID);
    if ("error" in r) expect(r.error).toContain("n'a pas pu être généré");
    else throw new Error("refus attendu");
  });

  it("pièce sans identifiant : message dédié « Aucune pièce à signer »", async () => {
    generateDocument.mockResolvedValue({ id: null, numero: "AXI-DEV-2026-001" });
    const r = await sendDevisAction(ID);
    if ("error" in r) expect(r.error).toContain("Aucune pièce à signer");
    else throw new Error("refus attendu");
  });

  it("offre illisible : le message de l'offre remonte, pas « PDF non généré »", async () => {
    findUnique.mockResolvedValue(devis({ offre: { v: 99 } }));
    const r = await sendDevisAction(ID);
    if ("error" in r) {
      expect(r.error).toContain("Offre du devis invalide");
      expect(r.error).not.toContain("PDF");
    } else throw new Error("refus attendu");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("remise 100 % : une période à 0 €/mois parmi des périodes payantes est refusée", async () => {
    findUnique.mockResolvedValue(
      devis({
        offre: offreAboSeul([
          { mois: 1, remiseBps: 10000 },
          { mois: 12, remiseBps: 0 },
        ]),
      }),
    );
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("total 0 et toutes périodes payantes : l'envoi passe", async () => {
    findUnique.mockResolvedValue(devis({ offre: offreAboSeul([{ mois: 12, remiseBps: 0 }]) }));
    const r = await sendDevisAction(ID);
    expect("data" in r).toBe(true);
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
