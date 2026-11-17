/**
 * « Remis en main propre » : un devis CLASSIQUE passe « envoye » sans jeton ni e-mail.
 * Mocks calqués sur `devis-envoi-rien-ne-part.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  txOptions: vi.fn(),
  txDevisFindUnique: vi.fn(),
  txDevisUpdateMany: vi.fn(),
  txDevisUpdate: vi.fn(),
  txDevisCount: vi.fn(),
  txClientUpdateMany: vi.fn(),
  txTokenUpdateMany: vi.fn(),
  txOutboxFindFirst: vi.fn(),
  generateDocument: vi.fn(),
  creerToken: vi.fn(),
  enqueueEmail: vi.fn(),
  emettre: vi.fn(),
  logActivity: vi.fn(),
  tx: {} as unknown,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (f: (t: unknown) => unknown, options?: unknown) => {
      h.txOptions(options);
      h.tx = {
        $queryRaw: (...a: unknown[]) => h.queryRaw(...a),
        devis: {
          findUnique: (...a: unknown[]) => h.txDevisFindUnique(...a),
          updateMany: (...a: unknown[]) => h.txDevisUpdateMany(...a),
          update: (...a: unknown[]) => h.txDevisUpdate(...a),
          count: (...a: unknown[]) => h.txDevisCount(...a),
        },
        client: { updateMany: (...a: unknown[]) => h.txClientUpdateMany(...a) },
        documentSignatureToken: { updateMany: (...a: unknown[]) => h.txTokenUpdateMany(...a) },
        emailOutbox: { findFirst: (...a: unknown[]) => h.txOutboxFindFirst(...a) },
      };
      return f(h.tx);
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1", role: "super_admin" })),
  logQualiopiActivity: (...a: unknown[]) => h.logActivity(...a),
}));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: vi.fn(async () => ({})),
  donneesPdfDevis: vi.fn(() => ({
    identite: { raisonSociale: "Axion", siret: "1", adresseSiege: "x", nda: "n", qualiopi: "q" },
    formules: undefined,
  })),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => h.generateDocument(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => h.creerToken(...a),
  revoquerTokensDocument: vi.fn(),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: (...a: unknown[]) => h.emettre(...a),
}));

import { marquerRemisEnMainPropreAction } from "./devis-remis-main-propre";

const ID = "11111111-1111-4111-8111-111111111111";
const MAJ = new Date("2026-11-01T10:00:00Z");

function devis(over: Record<string, unknown> = {}, clientOver: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "brouillon",
    updatedAt: MAJ,
    lignes: [],
    activite: null,
    refClient: null,
    replacesDevisId: null,
    offre: null,
    offreSha256: null,
    replacesDevis: null,
    financementSuggere: null,
    montantTotalHtCents: 150000,
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
      contactEmail: null,
      contactFonction: null,
      ...clientOver,
    },
    ...over,
  };
}

const appel = () => marquerRemisEnMainPropreAction({ id: ID, motif: "sans_email" });
const erreur = (r: unknown): string => {
  if (typeof r === "object" && r !== null && "error" in r) return (r as { error: string }).error;
  throw new Error("refus attendu, obtenu : " + JSON.stringify(r));
};
const actions = () => h.logActivity.mock.calls.map((c) => (c[0] as { action: string }).action);
const rienProduit = () => {
  expect(h.txDevisUpdateMany).not.toHaveBeenCalled();
  expect(h.creerToken).not.toHaveBeenCalled();
  expect(h.enqueueEmail).not.toHaveBeenCalled();
  expect(h.emettre).not.toHaveBeenCalled();
  expect(actions()).not.toContain("qualiopi.devis.remis_main_propre");
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.queryRaw.mockResolvedValue([{ locked: true }]);
  h.txDevisFindUnique.mockResolvedValue(devis());
  h.txDevisUpdateMany.mockResolvedValue({ count: 1 });
  h.txDevisCount.mockResolvedValue(1);
  h.txClientUpdateMany.mockResolvedValue({ count: 1 });
  h.txOutboxFindFirst.mockResolvedValue(null);
  h.generateDocument.mockResolvedValue({ id: "doc-1", numero: "AXI-DEV-2026-001" });
});

describe("marquerRemisEnMainPropreAction", () => {
  it("client sans e-mail : « envoye », pièce posée, ni jeton ni e-mail, événement émis dans tx", async () => {
    const r = await appel();
    expect(r).toEqual({ data: { id: ID } });
    expect(h.txDevisUpdateMany).toHaveBeenCalledWith({
      where: { id: ID, statut: "brouillon", updatedAt: MAJ },
      data: expect.objectContaining({
        statut: "envoye",
        documentGenereId: "doc-1",
        sentAt: expect.any(Date),
        fichierPdfUrl: expect.stringContaining("AXI-DEV-2026-001.pdf"),
      }),
    });
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    expect(h.emettre).toHaveBeenCalledWith(h.tx, ID);
    expect(h.txClientUpdateMany).toHaveBeenCalledOnce();
    expect(h.txOptions).toHaveBeenCalledWith({ maxWait: 5_000, timeout: 60_000 });
    const verrou = h.queryRaw.mock.calls[0]!;
    expect(JSON.stringify(verrou)).toContain("pg_try_advisory_xact_lock");
    expect(verrou.slice(1)).toEqual(["devis.envoi:" + ID]);
  });

  it("journal : motif, canal, aucun e-mail ni lien, aucune adresse", async () => {
    await appel();
    const j = h.logActivity.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "qualiopi.devis.remis_main_propre",
    );
    expect((j![0] as { changes: unknown }).changes).toEqual({
      statut: "envoye",
      canal: "main_propre",
      motif: "sans_email",
      documentGenereId: "doc-1",
      emailEnvoye: false,
      lienSignatureEmis: false,
    });
    expect(JSON.stringify(j)).not.toMatch(/@|portail\/signer/);
  });

  it("devis à formules : refus, rien produit", async () => {
    h.txDevisFindUnique.mockResolvedValue(devis({ offre: { x: 1 }, offreSha256: "a".repeat(64) }));
    expect(erreur(await appel())).toBe("Un devis à formules se signe uniquement en ligne.");
    expect(h.generateDocument).not.toHaveBeenCalled();
    rienProduit();
    expect(actions()).toContain("qualiopi.devis.remis_main_propre_refuse");
  });

  it.each([
    ["offre renseignée, empreinte absente", { offre: { x: 1 }, offreSha256: null }],
    ["offre absente, empreinte renseignée", { offre: null, offreSha256: "a".repeat(64) }],
  ])("devis à formules (%s) : refus, rien produit", async (_nom, over) => {
    h.txDevisFindUnique.mockResolvedValue(devis(over));
    expect(erreur(await appel())).toBe("Un devis à formules se signe uniquement en ligne.");
    expect(h.generateDocument).not.toHaveBeenCalled();
    rienProduit();
    expect(actions()).toContain("qualiopi.devis.remis_main_propre_refuse");
  });

  it("devis déjà « envoye » : refus, rien produit", async () => {
    h.txDevisFindUnique.mockResolvedValue(devis({ statut: "envoye" }));
    expect(erreur(await appel())).toContain("Seul un devis en brouillon");
    expect(h.generateDocument).not.toHaveBeenCalled();
    rienProduit();
  });

  it("verrou pris : refus, rien lu ni produit", async () => {
    h.queryRaw.mockResolvedValue([{ locked: false }]);
    expect(erreur(await appel())).toContain("déjà en cours");
    expect(h.txDevisFindUnique).not.toHaveBeenCalled();
    rienProduit();
  });

  it("updatedAt modifié : 0 ligne, échec, aucun journal de succès, rien d'émis", async () => {
    h.txDevisUpdateMany.mockResolvedValue({ count: 0 });
    await expect(appel()).rejects.toThrow(/0 ligne modifiée/);
    expect(h.txClientUpdateMany).not.toHaveBeenCalled();
    expect(h.emettre).not.toHaveBeenCalled();
    expect(actions()).not.toContain("qualiopi.devis.remis_main_propre");
  });

  it("échec du PDF : refus, le devis reste brouillon", async () => {
    h.generateDocument.mockRejectedValue(new Error("rendu KO"));
    expect(erreur(await appel())).toContain("le devis reste en brouillon");
    rienProduit();
  });

  it("ligne a_valider présente : refus, aucun PDF", async () => {
    h.txOutboxFindFirst.mockResolvedValue({ id: "ob-0" });
    expect(erreur(await appel())).toContain("attend déjà dans Emails → À valider");
    expect(h.txOutboxFindFirst).toHaveBeenCalledWith({
      where: { template: "devis-envoi", entityType: "Devis", entityId: ID, statut: "a_valider" },
      select: { id: true },
    });
    expect(h.generateDocument).not.toHaveBeenCalled();
    rienProduit();
  });

  it("total nul : refus, aucun PDF", async () => {
    h.txDevisFindUnique.mockResolvedValue(devis({ montantTotalHtCents: 0 }));
    expect(erreur(await appel())).toContain("0,00 € HT");
    expect(h.generateDocument).not.toHaveBeenCalled();
    rienProduit();
  });

  it("révision : version remplacée « expire », ses jetons sont révoqués", async () => {
    h.txDevisFindUnique.mockResolvedValue(
      devis({
        replacesDevisId: "ancien",
        replacesDevis: { statut: "envoye", documentGenereId: "doc-0" },
      }),
    );
    await appel();
    expect(h.txDevisUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "ancien", statut: "envoye" }),
      data: { statut: "expire" },
    });
    expect(h.txTokenUpdateMany).toHaveBeenCalledWith({
      where: { documentGenereId: "doc-0", revokedAt: null },
      data: expect.objectContaining({ revokedMotif: expect.stringContaining("AXI-DEV-2026-001") }),
    });
  });

  it("la relecture demande updatedAt et l'écriture gardée l'utilise dans son where", async () => {
    await appel();
    expect(h.txDevisFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ updatedAt: true }),
      }),
    );
    expect(h.txDevisUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID, statut: "brouillon", updatedAt: MAJ },
      }),
    );
  });
});

const ANCIEN = { replacesDevisId: "ancien" };
const avecAncien = (statut: string) =>
  devis({ ...ANCIEN, replacesDevis: { statut, documentGenereId: "doc-0" } });

describe("marquerRemisEnMainPropreAction — version remplacée signée ou acceptée", () => {
  it("version remplacée signée par le client : refus AVANT le PDF, rien d'écrit", async () => {
    h.txDevisFindUnique.mockResolvedValue(avecAncien("envoye"));
    h.txDevisCount.mockResolvedValue(0);
    const r = await appel();
    expect(erreur(r)).toBe(
      "La version précédente de ce devis a été acceptée ou signée : cette correction ne peut pas être envoyée.",
    );
    expect(h.generateDocument).not.toHaveBeenCalled();
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    expect(h.txDevisUpdateMany).not.toHaveBeenCalled();
  });

  it.each(["accepte", "transforme_convention"])(
    "version remplacée « %s » : refus avant le PDF",
    async (statut) => {
      h.txDevisFindUnique.mockResolvedValue(avecAncien(statut));
      const r = await appel();
      expect(erreur(r)).toContain("acceptée ou signée");
      expect(h.generateDocument).not.toHaveBeenCalled();
      expect(h.txDevisUpdateMany).not.toHaveBeenCalled();
    },
  );

  it("version remplacée « refuse » : laissée telle quelle, jetons révoqués comme avant", async () => {
    h.txDevisFindUnique.mockResolvedValue(avecAncien("refuse"));
    h.txDevisCount.mockResolvedValue(1);
    await appel();
    const cibles = h.txDevisUpdateMany.mock.calls.map(
      (c) => (c[0] as { where: { id: string } }).where.id,
    );
    expect(cibles).not.toContain("ancien");
    expect(h.txTokenUpdateMany).toHaveBeenCalled();
  });

  it("version remplacée « envoye » non signée : expirée par une écriture gardée", async () => {
    h.txDevisFindUnique.mockResolvedValue(avecAncien("envoye"));
    h.txDevisCount.mockResolvedValue(1);
    await appel();
    expect(h.txDevisUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "ancien", statut: "envoye", OR: expect.any(Array) }),
      data: { statut: "expire" },
    });
  });

  it("signature arrivée entre la relecture et l'écriture (0 ligne) : exception", async () => {
    h.txDevisFindUnique.mockResolvedValue(avecAncien("envoye"));
    h.txDevisCount.mockResolvedValue(1);
    h.txDevisUpdateMany.mockImplementation(async (a: { where: { id: string } }) => ({
      count: a.where.id === "ancien" ? 0 : 1,
    }));
    await expect(appel()).rejects.toThrow();
  });
});
