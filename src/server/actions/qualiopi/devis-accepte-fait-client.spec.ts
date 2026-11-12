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
  tx: { devis: { update: vi.fn(), findUnique: vi.fn() } },
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
vi.mock("@/server/qualiopi/legal/tva", () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
  h.habilitation.mockResolvedValue({ userId: "adm-1", role: "admin" });
  // Devis classique : aucune offre (le devis à formules a son test plus bas).
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
    expect(h.tx.devis.update.mock.invocationCallOrder[0]!).toBeLessThan(
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
    expect(h.tx.devis.update).toHaveBeenCalledOnce();
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
      expect(h.tx.devis.update).not.toHaveBeenCalled();
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
    expect(h.tx.devis.update).not.toHaveBeenCalled();
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.monter).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("devis à formules AVEC formule retenue : l'acceptation reste possible", async () => {
    h.tx.devis.findUnique.mockResolvedValue({
      statut: "envoye",
      offreSha256: "a".repeat(64),
      formuleRetenue: "abonnement",
    });
    expect(await acceptDevisAction(DEVIS)).toEqual({ data: { id: DEVIS } });
    expect(h.tx.devis.update).toHaveBeenCalledOnce();
  });

  it("identifiant invalide : rien n'est écrit, rien ne monte", async () => {
    expect(await acceptDevisAction("pas-un-uuid")).toEqual({ error: "Identifiant invalide" });
    expect(h.tx.devis.update).not.toHaveBeenCalled();
    expect(h.monter).not.toHaveBeenCalled();
  });
});
