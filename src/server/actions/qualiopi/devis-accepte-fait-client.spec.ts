// @vitest-environment node
/**
 * Acceptation d'un devis depuis la console : la fiche passe en client APRÈS le COMMIT de
 * l'acceptation (hors transaction, par le client prisma), après l'émission Partners, avec l'administrateur nommé dans la trace.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

const DEVIS = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  tx: { devis: { updateMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() } },
  p: {},
  monter: vi.fn(),
  proposer: vi.fn(),
  emettre: vi.fn(),
  habilitation: vi.fn(),
  log: vi.fn(),
}));

vi.mock("react", () => ({ default: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: h.habilitation,
  logQualiopiActivity: h.log,
}));
vi.mock("@/server/qualiopi/numbering/allocate", () => ({ nextNumero: vi.fn() }));
vi.mock("@/server/qualiopi/numbering/retry", () => ({ withNumberRetry: vi.fn() }));
vi.mock("@/server/qualiopi/crm/devis", () => ({
  dateDeReferenceDevis: vi.fn(),
  estimateOpcoCoverage: vi.fn(),
}));
vi.mock("@/server/qualiopi/financements/consommation-opco", () => ({
  anneeParis: vi.fn(),
  consommationOpcoAnnee: vi.fn(),
}));
vi.mock("@/server/qualiopi/financements/opco-referentiel", () => ({ opcoDuClient: vi.fn() }));
vi.mock("@/server/qualiopi/financements/bareme-opco-branche", () => ({
  effectifDuClient: vi.fn(),
  idccValide: vi.fn(),
}));
vi.mock("@/server/qualiopi/crm/devis-projet", () => ({
  lierDevisAuProjet: vi.fn(),
  projetOuvrableDuClient: vi.fn(),
  recopierLienProjet: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/legal/legal-mentions", () => ({ LEGAL_MENTIONS: {} }));
vi.mock("@/server/qualiopi/legal/tva", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/legal/tva")>()),
  regimeTvaDepuisConfig: vi.fn(),
  mentionTva: vi.fn(),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: vi.fn(),
  emettreDevisSigne: h.emettre,
  transactionDevisSigne: vi.fn(async (_p: unknown, fn: (tx: unknown) => Promise<void>) => fn(h.tx)),
}));
vi.mock("@/features/dossier-client/devis-signe-fait-client", () => ({
  faireMonterLesFichesDesDevisSignes: h.monter,
}));
vi.mock("@/server/qualiopi/devis/proposer-plans", () => ({
  proposerPlansApresAcceptation: h.proposer,
}));
vi.mock("@/server/partners/client-attributions", () => ({ bandeauPourLeRole: vi.fn() }));
vi.mock("@/lib/siret", () => ({ sirenDuClient: vi.fn() }));
vi.mock("@/server/qualiopi/documents/templates/devis", () => ({ DevisPdf: {} }));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", () => ({
  donneesPdfDevis: vi.fn(),
  lireContextePdfDevis: vi.fn(),
  OffreDevisInvalideError: class extends Error {},
}));
vi.mock("@/lib/public-url", () => ({ publicUrl: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: vi.fn(),
  revoquerTokensDocument: vi.fn(),
  TokenDocumentError: class extends Error {},
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));

import { acceptDevisAction } from "./devis";
import { pasSigneParLeClient } from "@/server/qualiopi/devis/pas-signe-par-le-client";

beforeEach(() => {
  vi.clearAllMocks();
  h.habilitation.mockResolvedValue({ userId: "adm-1", role: "admin" });
  // Devis classique : aucune offre (le devis à formules a son test plus bas).
  h.tx.devis.findFirst.mockResolvedValue(null);
  h.tx.devis.updateMany.mockResolvedValue({ count: 1 });
  h.tx.devis.findUnique.mockResolvedValue({
    statut: "envoye",
    offreSha256: null,
    formuleRetenue: null,
  });
});

describe("acceptDevisAction", () => {
  it("accepte, émet, puis fait monter la fiche, l'administrateur nommé", async () => {
    const r = await acceptDevisAction(DEVIS);
    expect(r).toEqual({ data: { id: DEVIS } });
    expect(h.monter).toHaveBeenCalledOnce();
    expect(h.monter).toHaveBeenCalledWith(h.p, [DEVIS], {
      origine: "console",
      adminUserId: "adm-1",
    });
    expect(h.tx.devis.updateMany.mock.invocationCallOrder[0]!).toBeLessThan(
      h.emettre.mock.invocationCallOrder[0]!,
    );
    expect(h.emettre.mock.invocationCallOrder[0]!).toBeLessThan(
      h.monter.mock.invocationCallOrder[0]!,
    );
  });

  it("propose les plans récurrents du devis APRÈS le commit (hors transaction), même si la montée échoue", async () => {
    h.monter.mockRejectedValueOnce(new Error("montée"));
    await acceptDevisAction(DEVIS);
    expect(h.proposer).toHaveBeenCalledOnce();
    expect(h.proposer).toHaveBeenCalledWith(DEVIS, "console");
    expect(h.emettre.mock.invocationCallOrder[0]!).toBeLessThan(
      h.proposer.mock.invocationCallOrder[0]!,
    );
  });

  it("🔴 code d'échec de la proposition des plans : journalisé, jamais ignoré, acceptation intacte", async () => {
    h.proposer.mockResolvedValueOnce("offre_illisible");
    const r = await acceptDevisAction(DEVIS);
    expect(r).toEqual({ data: { id: DEVIS } });
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tags: expect.objectContaining({ code: "offre_illisible" }) }),
    );
  });

  it("une erreur levée par la montée n'empêche jamais l'acceptation du devis", async () => {
    h.monter.mockRejectedValueOnce(new Error("montée"));
    const r = await acceptDevisAction(DEVIS);
    expect(r).toEqual({ data: { id: DEVIS } });
    expect(h.tx.devis.updateMany).toHaveBeenCalledOnce();
    expect(h.emettre).toHaveBeenCalledOnce();
    expect(h.log).toHaveBeenCalledOnce();
    expect(sentry.captureException).toHaveBeenCalledOnce();
  });

  it.each(["accepte", "transforme_convention", "brouillon", "refuse"])(
    "🔴 devis au statut %s : refusé côté serveur, aucune écriture ni émission",
    async (statut) => {
      h.tx.devis.findUnique.mockResolvedValue({ statut, offreSha256: null, formuleRetenue: null });
      const r = await acceptDevisAction(DEVIS);
      expect(r).toMatchObject({ error: expect.stringContaining("envoyé") });
      expect(h.tx.devis.updateMany).not.toHaveBeenCalled();
      expect(h.emettre).not.toHaveBeenCalled();
      expect(h.monter).not.toHaveBeenCalled();
      expect(h.proposer).not.toHaveBeenCalled();
      expect(h.log).not.toHaveBeenCalled();
    },
  );

  it("un devis expiré peut encore être accepté (signature tardive)", async () => {
    h.tx.devis.findUnique.mockResolvedValue({
      statut: "expire",
      offreSha256: null,
      formuleRetenue: null,
    });
    expect(await acceptDevisAction(DEVIS)).toEqual({ data: { id: DEVIS } });
  });

  it("🔴 devis À FORMULES sans formule retenue : l'acceptation manuelle est refusée, rien n'est écrit", async () => {
    h.tx.devis.findUnique.mockResolvedValue({
      statut: "envoye",
      offreSha256: "a".repeat(64),
      formuleRetenue: null,
    });
    const r = await acceptDevisAction(DEVIS);
    expect(r).toMatchObject({ error: expect.stringContaining("formules") });
    expect(h.tx.devis.updateMany).not.toHaveBeenCalled();
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.monter).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("devis à formules dont la formule est retenue, sans pièce signée en ligne : l'acceptation reste possible", async () => {
    h.tx.devis.findUnique.mockResolvedValue({
      statut: "envoye",
      offreSha256: "a".repeat(64),
      formuleRetenue: "abonnement",
    });
    expect(await acceptDevisAction(DEVIS)).toEqual({ data: { id: DEVIS } });
    expect(h.tx.devis.updateMany).toHaveBeenCalledOnce();
  });

  it("identifiant invalide : rien n'est écrit, rien ne monte", async () => {
    expect(await acceptDevisAction("pas-un-uuid")).toEqual({ error: "Identifiant invalide" });
    expect(h.tx.devis.updateMany).not.toHaveBeenCalled();
    expect(h.monter).not.toHaveBeenCalled();
  });
});

describe("acceptDevisAction — version remplacée par une version émise", () => {
  const MSG =
    "Ce devis a été remplacé par une version plus récente : acceptez la version en cours.";

  it("expiré parce qu'une version émise l'a remplacé : refus, rien d'écrit, rien d'émis", async () => {
    h.tx.devis.findUnique.mockResolvedValue({
      statut: "expire",
      offreSha256: null,
      formuleRetenue: null,
    });
    h.tx.devis.findFirst.mockResolvedValue({ id: "successeur" });
    const r = await acceptDevisAction(DEVIS);
    expect(r).toEqual({ error: MSG });
    // Le successeur cherché : un devis qui remplace celui-ci et n'est pas un brouillon.
    expect(h.tx.devis.findFirst).toHaveBeenCalledWith({
      where: { replacesDevisId: DEVIS, statut: { not: "brouillon" } },
      select: { id: true },
    });
    expect(h.tx.devis.updateMany).not.toHaveBeenCalled();
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.monter).not.toHaveBeenCalled();
  });

  it("expiré par simple dépassement de date (aucun successeur émis) : reste acceptable", async () => {
    h.tx.devis.findUnique.mockResolvedValue({
      statut: "expire",
      offreSha256: null,
      formuleRetenue: null,
    });
    h.tx.devis.findFirst.mockResolvedValue(null);
    const r = await acceptDevisAction(DEVIS);
    expect(r).toEqual({ data: { id: DEVIS } });
    expect(h.tx.devis.updateMany).toHaveBeenCalledOnce();
  });

  it("devis à formules sans formule retenue : toujours le refus propre aux formules", async () => {
    h.tx.devis.findUnique.mockResolvedValue({
      statut: "envoye",
      offreSha256: "a".repeat(64),
      formuleRetenue: null,
    });
    const r = await acceptDevisAction(DEVIS);
    expect(r).toMatchObject({ error: expect.stringContaining("propose des formules") });
  });

  describe("🔴 devis signé par le client en ligne (contresignature manquante)", () => {
    const signe = (signatures: Array<{ partie: string }>, annuleeAt: Date | null = null) => ({
      statut: "envoye",
      offreSha256: null,
      formuleRetenue: null,
      documentGenere: { annuleeAt, signatures },
    });

    it("refusé côté serveur : ni écriture, ni émission, ni confirmation de commande", async () => {
      h.tx.devis.findUnique.mockResolvedValue(signe([{ partie: "client" }]));
      const r = await acceptDevisAction(DEVIS);
      expect(r).toEqual({
        error: "Le client a signé ce devis en ligne : contresignez-le pour le conclure.",
      });
      expect(h.tx.devis.updateMany).not.toHaveBeenCalled();
      expect(h.emettre).not.toHaveBeenCalled();
      expect(h.monter).not.toHaveBeenCalled();
      expect(h.log).not.toHaveBeenCalled();
    });

    it("🔴 devis classique envoyé, signé par le client ET contresigné (non révoquées) : l'acceptation aboutit", async () => {
      h.tx.devis.findUnique.mockResolvedValue(signe([{ partie: "client" }, { partie: "axionia" }]));
      expect(await acceptDevisAction(DEVIS)).toEqual({ data: { id: DEVIS } });
      expect(h.tx.devis.updateMany).toHaveBeenCalledOnce();
    });

    it("contre-témoins : pièce annulée, ou aucune signature client → l'acceptation à la main reste possible", async () => {
      h.tx.devis.findUnique.mockResolvedValue(signe([{ partie: "client" }], new Date()));
      expect(await acceptDevisAction(DEVIS)).toEqual({ data: { id: DEVIS } });
      h.tx.devis.findUnique.mockResolvedValue(signe([]));
      expect(await acceptDevisAction(DEVIS)).toEqual({ data: { id: DEVIS } });
    });
  });
});

describe("acceptDevisAction — écriture CONDITIONNELLE (signature entre la lecture et l'écriture)", () => {
  it("🔴 l'écriture porte le statut admis et la condition « pas signé par le client OU contresigné »", async () => {
    await acceptDevisAction(DEVIS);
    expect(h.tx.devis.updateMany).toHaveBeenCalledWith({
      where: {
        id: DEVIS,
        statut: { in: ["envoye", "expire"] },
        OR: [
          ...pasSigneParLeClient.OR,
          { documentGenere: { signatures: { some: { partie: "axionia", revokedAt: null } } } },
        ],
      },
      data: { statut: "accepte", acceptedAt: expect.any(Date) },
    });
  });

  it("🔴 le client signe entre la lecture et l'écriture (0 ligne) : message « contresignez-le », aucun effet", async () => {
    h.tx.devis.updateMany.mockResolvedValue({ count: 0 });
    // 1re lecture : envoyé ; relecture après l'échec : toujours envoyé.
    const r = await acceptDevisAction(DEVIS);
    expect(r).toEqual({
      error: "Le client a signé ce devis en ligne : contresignez-le pour le conclure.",
    });
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.monter).not.toHaveBeenCalled();
    expect(h.proposer).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("0 ligne parce que le statut a changé entre-temps : message de statut, pas de contresignature", async () => {
    h.tx.devis.updateMany.mockResolvedValue({ count: 0 });
    h.tx.devis.findUnique
      .mockResolvedValueOnce({ statut: "envoye", offreSha256: null, formuleRetenue: null })
      .mockResolvedValueOnce({ statut: "accepte" });
    const r = await acceptDevisAction(DEVIS);
    expect(r).toMatchObject({ error: expect.stringContaining("envoyé") });
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.monter).not.toHaveBeenCalled();
  });
});
