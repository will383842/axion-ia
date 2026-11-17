/**
 * B1 — `sendDevisAction` ne passe JAMAIS un devis à « envoye » si rien n'est réellement parti.
 *
 * Le mock de `$transaction` exécute le rappel et propage les exceptions (comme Prisma : une
 * exception annule la transaction). `tx.$queryRaw` simule le verrou consultatif.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  txOptions: vi.fn(),
  txDevisFindUnique: vi.fn(),
  txDevisUpdateMany: vi.fn(),
  txDevisUpdate: vi.fn(),
  txClientUpdateMany: vi.fn(),
  txTokenUpdateMany: vi.fn(),
  txOutboxFindFirst: vi.fn(),
  outboxUpdateMany: vi.fn(),
  outboxFindUnique: vi.fn(),
  generateDocument: vi.fn(),
  creerToken: vi.fn(),
  revoquer: vi.fn(),
  enqueueEmail: vi.fn(),
  emettre: vi.fn(),
  logActivity: vi.fn(),
  sentry: vi.fn(),
  sentryMessage: vi.fn(),
  formules: vi.fn(),
  telegram: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      updateMany: (...a: unknown[]) => h.outboxUpdateMany(...a),
      findUnique: (...a: unknown[]) => h.outboxFindUnique(...a),
    },
    $transaction: async (f: (t: unknown) => unknown, options?: unknown) => {
      h.txOptions(options);
      return f({
        $queryRaw: (...a: unknown[]) => h.queryRaw(...a),
        devis: {
          findUnique: (...a: unknown[]) => h.txDevisFindUnique(...a),
          updateMany: (...a: unknown[]) => h.txDevisUpdateMany(...a),
          update: (...a: unknown[]) => h.txDevisUpdate(...a),
        },
        client: { updateMany: (...a: unknown[]) => h.txClientUpdateMany(...a) },
        documentSignatureToken: { updateMany: (...a: unknown[]) => h.txTokenUpdateMany(...a) },
        emailOutbox: { findFirst: (...a: unknown[]) => h.txOutboxFindFirst(...a) },
      });
    },
  },
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => h.sentry(...a),
  captureMessage: (...a: unknown[]) => h.sentryMessage(...a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1", role: "super_admin" })),
  requireHabilitation: vi.fn(async () => ({ userId: "adm-1", role: "super_admin" })),
  logQualiopiActivity: (...a: unknown[]) => h.logActivity(...a),
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => h.formules(),
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
  revoquerTokensDocument: (...a: unknown[]) => h.revoquer(...a),
  TokenDocumentError: class extends Error {
    motif = "x";
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: (...a: unknown[]) => h.emettre(...a),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
  devisConcernesPourEmission: vi.fn(async () => []),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => h.telegram(...a) }));

import { sendDevisAction } from "./devis";

const ID = "11111111-1111-4111-8111-111111111111";

function devis(over: Record<string, unknown> = {}, clientOver: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "brouillon",
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
      contactEmail: "client@example.test",
      contactFonction: null,
      ...clientOver,
    },
    ...over,
  };
}

const erreur = (r: unknown): string => {
  if (typeof r === "object" && r !== null && "error" in r) return (r as { error: string }).error;
  throw new Error("refus attendu, obtenu : " + JSON.stringify(r));
};
const aucuneEcritureEnvoye = () => expect(h.txDevisUpdateMany).not.toHaveBeenCalled();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.formules.mockReturnValue(false);
  h.queryRaw.mockResolvedValue([{ locked: true }]);
  h.txDevisFindUnique.mockResolvedValue(devis());
  h.txDevisUpdateMany.mockResolvedValue({ count: 1 });
  h.txClientUpdateMany.mockResolvedValue({ count: 1 });
  h.txOutboxFindFirst.mockResolvedValue(null);
  h.generateDocument.mockResolvedValue({ id: "doc-1", numero: "AXI-DEV-2026-001" });
  h.creerToken.mockResolvedValue({ token: "tok" });
  h.revoquer.mockResolvedValue(1);
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
  h.outboxUpdateMany.mockResolvedValue({ count: 1 });
  h.outboxFindUnique.mockResolvedValue({
    template: "devis-envoi",
    payload: { signatureUrl: "https://axion-ia.com/portail/signer/JETON-SECRET-123" },
  });
  h.telegram.mockResolvedValue(undefined);
});

describe("sendDevisAction — rien ne part, rien n'est « envoye »", () => {
  it("(1) client sans e-mail, devis classique : refus, aucun PDF, aucune écriture", async () => {
    h.txDevisFindUnique.mockResolvedValue(devis({}, { contactEmail: null }));
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("n'a pas d'adresse e-mail de contact");
    expect(erreur(r)).toContain("« Remis en main propre »");
    expect(h.generateDocument).not.toHaveBeenCalled();
    aucuneEcritureEnvoye();
  });

  it("(1b) client sans e-mail, devis à formules : pas de « Remis en main propre »", async () => {
    h.formules.mockReturnValue(true);
    h.txDevisFindUnique.mockResolvedValue(
      devis({ offre: { x: 1 }, offreSha256: "a".repeat(64) }, { contactEmail: null }),
    );
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("n'a pas d'adresse e-mail de contact");
    expect(erreur(r)).not.toContain("Remis en main propre");
  });

  it("(3b) adresse bloquée : « Remis en main propre » cité (classique seulement)", async () => {
    h.enqueueEmail.mockResolvedValue({ enqueued: false, retenu: "oppose" });
    expect(erreur(await sendDevisAction(ID))).toContain("« Remis en main propre »");
  });

  it("(2) generateDocument lève : refus, ni jeton ni courriel", async () => {
    h.generateDocument.mockRejectedValue(new Error("rendu KO"));
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("Le PDF du devis n'a pas pu être créé");
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    aucuneEcritureEnvoye();
  });

  it.each([
    [
      "(3) retenu",
      { enqueued: false, retenu: "desabonne" },
      "L'adresse du client est bloquée (désabonnement)",
    ],
    [
      "(4) corbeilleIndisponible",
      { enqueued: false, corbeilleIndisponible: true },
      "corbeille « E-mails à valider » est indisponible",
    ],
    ["(5) essaiBloque", { enqueued: false, essaiBloque: true }, "Session d'essai"],
    [
      "(6) enqueued:false sans motif",
      { enqueued: false },
      "file d'envoi des e-mails est indisponible",
    ],
  ])("%s : refus, aucune écriture « envoye », lien révoqué", async (_n, verdict, message) => {
    h.enqueueEmail.mockResolvedValue(verdict);
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain(message);
    aucuneEcritureEnvoye();
    expect(h.revoquer).toHaveBeenCalledWith(
      expect.objectContaining({
        documentGenereId: "doc-1",
        motif: "Envoi annulé : rien n'est parti",
      }),
    );
  });

  it("(7) enqueueEmail lève : refus, aucune écriture « envoye », lien révoqué", async () => {
    h.enqueueEmail.mockRejectedValue(new Error("redis down"));
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("file d'envoi des e-mails est indisponible");
    aucuneEcritureEnvoye();
    expect(h.revoquer).toHaveBeenCalledOnce();
  });

  it("(8) courriel garé : « envoye » écrit, garePourValidation:true, note conservée", async () => {
    h.enqueueEmail.mockResolvedValue({
      enqueued: false,
      garePourValidation: true,
      outboxId: "ob-1",
    });
    const r = await sendDevisAction(ID);
    expect(r).toMatchObject({ data: { garePourValidation: true, emailEnvoye: false } });
    expect(JSON.stringify(r)).toContain("Emails → À valider");
    expect(h.txDevisUpdateMany).toHaveBeenCalledWith({
      where: { id: ID, statut: "brouillon" },
      data: expect.objectContaining({ statut: "envoye", documentGenereId: "doc-1" }),
    });
    expect(h.emettre).toHaveBeenCalledOnce();
    expect(h.revoquer).not.toHaveBeenCalled();
  });

  it("(9) courriel enfilé : « envoye » écrit, l'appel n'ajoute pas clientId ni ne change le payload", async () => {
    const r = await sendDevisAction(ID);
    expect(r).toMatchObject({ data: { emailEnvoye: true, signatureCreee: true } });
    expect(JSON.stringify(r)).not.toContain("garePourValidation");
    expect(h.txDevisUpdateMany).toHaveBeenCalledOnce();
    const options = h.enqueueEmail.mock.calls[0]![4] as Record<string, unknown>;
    expect(Object.keys(options).sort()).toEqual(["attachments", "entityId", "entityType"]);
    expect(h.enqueueEmail.mock.calls[0]![0]).toBe("devis-envoi");
  });

  it("(10) verrou refusé : « en cours », rien produit", async () => {
    h.queryRaw.mockResolvedValue([{ locked: false }]);
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("Cet envoi est déjà en cours");
    expect(h.txDevisFindUnique).not.toHaveBeenCalled();
    expect(h.generateDocument).not.toHaveBeenCalled();
    aucuneEcritureEnvoye();
  });

  it("(11) statut relu « envoye » : « déjà envoyé », rien produit", async () => {
    h.txDevisFindUnique.mockResolvedValue(devis({ statut: "envoye" }));
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("Ce devis a déjà été envoyé : rien n'a été renvoyé");
    expect(h.generateDocument).not.toHaveBeenCalled();
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    aucuneEcritureEnvoye();
  });

  it("(12) une ligne a_valider existe déjà : refus, rien produit", async () => {
    h.txOutboxFindFirst.mockResolvedValue({ id: "ob-0" });
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("attend déjà dans Emails → À valider");
    expect(h.txOutboxFindFirst).toHaveBeenCalledWith({
      where: { template: "devis-envoi", entityType: "Devis", entityId: ID, statut: "a_valider" },
      select: { id: true },
    });
    expect(h.generateDocument).not.toHaveBeenCalled();
    aucuneEcritureEnvoye();
  });

  it("(13) updateMany à 0 après un courriel garé : la ligne passe à « refuse », Sentry appelé", async () => {
    h.enqueueEmail.mockResolvedValue({
      enqueued: false,
      garePourValidation: true,
      outboxId: "ob-1",
    });
    h.txDevisUpdateMany.mockResolvedValue({ count: 0 });
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("Ne le renvoyez pas");
    expect(h.outboxUpdateMany).toHaveBeenCalledWith({
      where: { id: "ob-1", statut: "a_valider" },
      data: expect.objectContaining({
        statut: "refuse",
        refuseMotif: "Devis non marqué envoyé (erreur base)",
      }),
    });
    // Le lien de signature ne reste pas en clair dans la ligne refusée (même écriture).
    const ecrit = JSON.stringify(h.outboxUpdateMany.mock.calls[0]?.[0].data);
    expect(ecrit).not.toContain("JETON-SECRET");
    expect(ecrit).not.toContain("/portail/signer/JETON");
    expect(ecrit).toContain("[masqué]");
    expect(h.sentry).toHaveBeenCalled();
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.revoquer).toHaveBeenCalledOnce();
    expect(h.revoquer).toHaveBeenCalledWith(expect.objectContaining({ documentGenereId: "doc-1" }));
  });

  it("(13e) relecture de la ligne en échec : le refus est écrit quand même", async () => {
    h.enqueueEmail.mockResolvedValue({
      enqueued: false,
      garePourValidation: true,
      outboxId: "ob-1",
    });
    h.txDevisUpdateMany.mockResolvedValue({ count: 0 });
    h.outboxFindUnique.mockRejectedValue(new Error("base indisponible"));
    await sendDevisAction(ID);
    expect(h.outboxUpdateMany).toHaveBeenCalledWith({
      where: { id: "ob-1", statut: "a_valider" },
      data: expect.objectContaining({ statut: "refuse" }),
    });
  });

  it("(13c) courriel garé SANS outboxId puis échec d'écriture : alerte, aucune exception", async () => {
    h.enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true });
    h.txDevisUpdateMany.mockResolvedValue({ count: 0 });
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("Ne le renvoyez pas");
    expect(h.outboxUpdateMany).not.toHaveBeenCalled();
    expect(h.sentry).toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalledOnce();
    expect(JSON.stringify(h.telegram.mock.calls)).not.toContain("example.test");
  });

  it("(13d) devis modifié pendant le PDF : écriture gardée sur updatedAt, count 0, échec traité", async () => {
    const maj = new Date("2026-11-01T10:00:00Z");
    h.txDevisFindUnique.mockResolvedValue(devis({ updatedAt: maj }));
    h.txDevisUpdateMany.mockResolvedValue({ count: 0 });
    h.enqueueEmail.mockResolvedValue({
      enqueued: false,
      garePourValidation: true,
      outboxId: "ob-9",
    });
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("Ne le renvoyez pas");
    expect(h.txDevisUpdateMany).toHaveBeenCalledOnce();
    expect(h.txDevisUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID, statut: "brouillon", updatedAt: maj } }),
    );
    expect(h.txClientUpdateMany).not.toHaveBeenCalled();
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.outboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ob-9", statut: "a_valider" },
        data: expect.objectContaining({ statut: "refuse" }),
      }),
    );
    expect(h.revoquer).toHaveBeenCalledOnce();
  });

  it("(13b) erreur après un courriel ENFILÉ : Sentry + alerte, lien NON révoqué", async () => {
    h.txDevisUpdateMany.mockResolvedValue({ count: 0 });
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("Ne le renvoyez pas");
    expect(h.sentry).toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalledOnce();
    expect(JSON.stringify(h.telegram.mock.calls)).not.toContain("example.test");
    expect(JSON.stringify(h.telegram.mock.calls)).toContain("renvoyer le devis depuis sa fiche");
    expect(JSON.stringify(h.telegram.mock.calls)).not.toContain("tok");
    expect(h.sentryMessage).toHaveBeenCalledOnce();
    expect(String(h.sentryMessage.mock.calls[0]?.[0])).toContain("ne retrouvera pas le devis");
    expect(h.outboxUpdateMany).not.toHaveBeenCalled();
    expect(h.revoquer).not.toHaveBeenCalled();
  });

  it("(14) jeton raté sur un devis classique : refus, aucun courriel, aucune écriture", async () => {
    h.creerToken.mockRejectedValue(new Error("panne"));
    const r = await sendDevisAction(ID);
    expect(erreur(r)).toContain("Le lien de signature n'a pas pu être créé");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    aucuneEcritureEnvoye();
  });

  it("le journal du refus porte le motif, sans adresse ni lien", async () => {
    h.enqueueEmail.mockResolvedValue({ enqueued: false, retenu: "oppose" });
    await sendDevisAction(ID);
    const appel = h.logActivity.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "qualiopi.devis.send_refuse",
    );
    expect(appel).toBeDefined();
    expect((appel![0] as { changes: unknown }).changes).toEqual({ motif: "retenu" });
    expect(JSON.stringify(appel)).not.toMatch(/example\.test|portail\/signer|tok/);
  });

  it("la transaction est ouverte avec maxWait 5 s et timeout 60 s", async () => {
    await sendDevisAction(ID);
    expect(h.txOptions).toHaveBeenCalledWith({ maxWait: 5_000, timeout: 60_000 });
  });
});
