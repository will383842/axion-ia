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
  statuts: {} as Record<string, string>,
  enAttente: {} as Record<string, string>,
  txClientUpdateMany: vi.fn(),
  txTokenUpdateMany: vi.fn(),
  txOutboxFindFirst: vi.fn(),
  generateDocument: vi.fn(),
  creerToken: vi.fn(),
  enqueueEmail: vi.fn(),
  emettre: vi.fn(),
  logActivity: vi.fn(),
  txLogCreate: vi.fn(),
  tx: {} as unknown,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (f: (t: unknown) => unknown, options?: unknown) => {
      h.txOptions(options);
      h.enAttente = {};
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
        activityLog: { create: (...a: unknown[]) => h.txLogCreate(...a) },
      };
      const resultat = await f(h.tx);
      // Validation : les statuts écrits n'existent qu'après un COMMIT (une exception les annule).
      Object.assign(h.statuts, h.enAttente);
      return resultat;
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1", role: "super_admin" })),
  logQualiopiActivity: (...a: unknown[]) => h.logActivity(...a),
  donneesJournalQualiopi: vi.fn(
    async (i: {
      session: { userId: string };
      action: string;
      targetType?: string;
      targetId?: string;
      changes: unknown;
    }) => ({
      adminUserId: i.session.userId,
      action: i.action,
      targetType: i.targetType ?? null,
      targetId: i.targetId ?? null,
      changes: i.changes,
      ipAddress: null,
      userAgent: null,
    }),
  ),
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

import { ACTION_REMIS_MAIN_PROPRE } from "@/server/qualiopi/devis/canal-emission";
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
const actions = () => [
  ...h.logActivity.mock.calls.map((c) => (c[0] as { action: string }).action),
  ...h.txLogCreate.mock.calls.map((c) => (c[0] as { data: { action: string } }).data.action),
];
const rienProduit = () => {
  expect(h.txDevisUpdateMany).not.toHaveBeenCalled();
  expect(h.creerToken).not.toHaveBeenCalled();
  expect(h.enqueueEmail).not.toHaveBeenCalled();
  expect(h.emettre).not.toHaveBeenCalled();
  expect(actions()).not.toContain("qualiopi.devis.remis_main_propre");
  expect(h.txLogCreate).not.toHaveBeenCalled();
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
  describe("trace du canal d'émission (I1)", () => {
    it("trace écrite dans la transaction, après l'événement, sans doublon après commit", async () => {
      await appel();
      expect(h.txLogCreate).toHaveBeenCalledOnce();
      const data = (h.txLogCreate.mock.calls[0]![0] as { data: { action: string } }).data;
      expect(data.action).toBe(ACTION_REMIS_MAIN_PROPRE);
      expect(h.emettre.mock.invocationCallOrder[0]!).toBeLessThan(
        h.txLogCreate.mock.invocationCallOrder[0]!,
      );
      const apresCommit = h.logActivity.mock.calls.map((c) => (c[0] as { action: string }).action);
      expect(apresCommit).not.toContain(ACTION_REMIS_MAIN_PROPRE);
    });

    it("changes inchangé, sans adresse ni lien", async () => {
      await appel();
      const data = (h.txLogCreate.mock.calls[0]![0] as { data: { changes: unknown } }).data;
      expect(data.changes).toEqual({
        statut: "envoye",
        canal: "main_propre",
        motif: "sans_email",
        documentGenereId: "doc-1",
        emailEnvoye: false,
        lienSignatureEmis: false,
      });
      const json = JSON.stringify(data);
      expect(json).not.toContain("@");
      expect(json).not.toContain("portail/signer");
    });

    it("la trace échoue → tout est annulé, le devis n'est pas « envoye »", async () => {
      h.txLogCreate.mockRejectedValueOnce(new Error("log KO"));
      await expect(appel()).rejects.toThrow("log KO");
      expect(h.statuts[ID]).not.toBe("envoye");
      expect(h.logActivity).not.toHaveBeenCalled();
    });
  });

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

  describe("échéancier de l'assistant (B1)", () => {
    const donnees = async (cond: string | undefined) => {
      const m = await import("@/server/qualiopi/documents/donnees-pdf-devis");
      vi.mocked(m.donneesPdfDevis).mockReturnValueOnce({
        identite: {
          raisonSociale: "Axion",
          siret: "1",
          adresseSiege: "x",
          nda: "n",
          qualiopi: "q",
        },
        formules: undefined,
        lignes: [{ quantite: 1, prixUnitaireHtCents: 100000 }],
        regimeTva: "assujetti",
        tauxTvaStandardPercent: 10,
        conditionsParticulieres: cond,
      } as never);
    };
    const TEXTE =
      "Échéancier de paiement\n1. Acompte, à la signature : 30 %, soit 360,00 € TTC\n2. Étape, à la livraison : 30 %, soit 360,00 € TTC\n3. Solde, à la livraison : 40 %, soit 480,00 € TTC";

    it("échéancier qui ne suit plus le total (TVA 20 % → 10 %) : refus, aucune pièce, statut inchangé", async () => {
      await donnees(TEXTE);
      expect(erreur(await appel())).toMatch(/échéancier de paiement ne correspond plus au total/i);
      expect(h.generateDocument).not.toHaveBeenCalled();
      rienProduit();
    });

    it("échéancier cohérent (330 / 330 / 440) : remise acceptée", async () => {
      await donnees(TEXTE.replace(/360,00/g, "330,00").replace("480,00", "440,00"));
      expect(await appel()).toEqual({ data: { id: ID } });
    });

    it("sans échéancier : comportement inchangé", async () => {
      await donnees("Clause libre.");
      expect(await appel()).toEqual({ data: { id: ID } });
      expect(h.generateDocument).toHaveBeenCalledOnce();
    });
  });

  it("journal : motif, canal, aucun e-mail ni lien, aucune adresse", async () => {
    await appel();
    const j = h.txLogCreate.mock.calls.find(
      (c) =>
        (c[0] as { data: { action: string } }).data.action === "qualiopi.devis.remis_main_propre",
    );
    expect((j![0] as { data: { changes: unknown } }).data.changes).toEqual({
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

  it("ligne a_valider ou approuve présente : refus, aucun PDF", async () => {
    h.txOutboxFindFirst.mockResolvedValue({ id: "ob-0" });
    expect(erreur(await appel())).toContain(
      "attend dans « E-mails à valider » ou est en cours d'envoi",
    );
    expect(h.txOutboxFindFirst).toHaveBeenCalledWith({
      where: {
        template: "devis-envoi",
        entityType: "Devis",
        entityId: ID,
        statut: { in: ["a_valider", "approuve"] },
      },
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

  it("signature arrivée entre la relecture et l'écriture (0 ligne) : message lisible, rien d'émis", async () => {
    h.txDevisFindUnique.mockResolvedValue(avecAncien("envoye"));
    h.txDevisCount.mockResolvedValue(1);
    h.statuts = { ancien: "envoye", [ID]: "brouillon" };
    h.txDevisUpdateMany.mockImplementation(
      async (a: { where: { id: string }; data: { statut?: string } }) => {
        const touche = a.where.id !== "ancien"; // la signature client a gagné la course sur l'ancienne
        if (touche && a.data.statut !== undefined) h.enAttente[a.where.id] = a.data.statut;
        return { count: touche ? 1 : 0 };
      },
    );
    const r = await appel();
    // Message lisible, pas d'exception brute ; la transaction est annulée (rien n'est émis).
    expect(erreur(r)).toBe(
      "Le client vient de signer la version précédente de ce devis : cette correction n'a pas été émise. Ouvrez la version signée pour la contresigner.",
    );
    expect(h.emettre).not.toHaveBeenCalled();
    // Rien n'est validé : le nouveau devis reste brouillon, l'ancien reste « envoye ».
    expect(h.statuts).toEqual({ ancien: "envoye", [ID]: "brouillon" });
    expect(h.logActivity).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "qualiopi.devis.remis_main_propre" }),
    );
  });
});
