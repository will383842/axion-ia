// @vitest-environment node
/**
 * Refus d'un devis depuis la console : garde de statut SERVEUR (envoyé ou expiré seulement) et
 * refus si le client a signé (il ne reste qu'à contresigner).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

const DEVIS = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  tx: { devis: { update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() } },
  p: {
    devis: { findUnique: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    emailOutbox: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  monter: vi.fn(),
  proposer: vi.fn(),
  emettre: vi.fn(),
  habilitation: vi.fn(),
  log: vi.fn(),
  revoquer: vi.fn(),
}));

vi.mock("react", () => ({ default: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "adm-1", role: "admin" }),
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
  revoquerTokensDocument: (...a: unknown[]) => h.revoquer(...a),
  TokenDocumentError: class extends Error {},
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));

import { declineDevisAction } from "./devis";

const lu = (statut: string, signatures: Array<{ partie: string }> = [], annuleeAt = null) => ({
  statut,
  documentGenereId: "doc-1",
  documentGenere: { annuleeAt, signatures },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.habilitation.mockResolvedValue({ userId: "adm-1", role: "admin" });
  h.p.devis.findUnique.mockResolvedValue(lu("envoye"));
  h.p.devis.updateMany.mockResolvedValue({ count: 1 });
  h.revoquer.mockResolvedValue(1);
  h.p.emailOutbox.findFirst.mockResolvedValue(null);
  h.p.devis.findFirst.mockResolvedValue(null);
  h.p.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(h.p));
});

describe("declineDevisAction — gardes serveur", () => {
  it.each(["envoye", "expire"])(
    "devis « %s » non signé : refus possible, lien révoqué",
    async (s) => {
      h.p.devis.findUnique.mockResolvedValue(lu(s));
      expect(await declineDevisAction(DEVIS)).toEqual({ data: { id: DEVIS } });
      expect(h.p.devis.updateMany).toHaveBeenCalledOnce();
      expect(h.revoquer).toHaveBeenCalledOnce();
    },
  );

  it.each(["brouillon", "accepte", "refuse", "transforme_convention"])(
    "🔴 devis « %s » : refus impossible, aucune écriture",
    async (s) => {
      h.p.devis.findUnique.mockResolvedValue(lu(s));
      const r = await declineDevisAction(DEVIS);
      expect(r).toMatchObject({ error: expect.stringContaining("envoyé") });
      expect(h.p.devis.updateMany).not.toHaveBeenCalled();
      expect(h.revoquer).not.toHaveBeenCalled();
    },
  );

  it("🔴 signé par le client : refus impossible, lien intact, rien d'écrit", async () => {
    h.p.devis.findUnique.mockResolvedValue(lu("envoye", [{ partie: "client" }]));
    expect(await declineDevisAction(DEVIS)).toEqual({
      error: "Le client a signé ce devis : il ne peut pas être marqué refusé.",
    });
    expect(h.p.devis.updateMany).not.toHaveBeenCalled();
    expect(h.revoquer).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("pièce annulée portant une signature client : refus possible (non signé)", async () => {
    h.p.devis.findUnique.mockResolvedValue(
      lu("envoye", [{ partie: "client" }], new Date() as never),
    );
    expect(await declineDevisAction(DEVIS)).toEqual({ data: { id: DEVIS } });
  });

  it("signature arrivée entre la lecture et l'écriture (0 ligne) : refus sans révocation", async () => {
    h.p.devis.updateMany.mockResolvedValue({ count: 0 });
    expect(await declineDevisAction(DEVIS)).toMatchObject({ error: expect.any(String) });
    expect(h.revoquer).not.toHaveBeenCalled();
  });

  it("🔴 un e-mail d'envoi de ce devis attend : refus, rien d'écrit, lien intact", async () => {
    h.p.emailOutbox.findFirst.mockResolvedValue({ id: "ob-1" });
    expect(await declineDevisAction(DEVIS)).toEqual({
      error:
        "Un e-mail de ce devis attend dans « E-mails à valider » ou est en cours d'envoi. S'il est encore à valider, approuvez-le ou refusez-le ; s'il est en cours d'envoi, patientez quelques minutes puis rechargez la page ; si rien ne change au bout d'une heure, voyez la page Ops & monitoring de la console.",
    });
    expect(h.p.devis.updateMany).not.toHaveBeenCalled();
    expect(h.revoquer).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("🔴 une version suivante est émise : refus « version plus récente », aucune écriture", async () => {
    h.p.devis.findFirst.mockResolvedValue({ id: "v2" });
    const r = await declineDevisAction(DEVIS);
    expect(r).toMatchObject({ error: expect.stringContaining("version plus récente") });
    expect(h.p.devis.findFirst).toHaveBeenCalledWith({
      where: { replacesDevisId: DEVIS, statut: { not: "brouillon" } },
      select: { id: true },
    });
    expect(h.p.$transaction).not.toHaveBeenCalled();
    expect(h.p.devis.updateMany).not.toHaveBeenCalled();
    expect(h.revoquer).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("🔴 version suivante validée pendant l'écriture : transaction annulée, lien intact", async () => {
    h.p.devis.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "v2" });
    const r = await declineDevisAction(DEVIS);
    expect(r).toMatchObject({ error: expect.stringContaining("version plus récente") });
    expect(h.p.$transaction).toHaveBeenCalledOnce();
    expect(h.revoquer).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("devis introuvable : erreur, rien d'écrit", async () => {
    h.p.devis.findUnique.mockResolvedValue(null);
    expect(await declineDevisAction(DEVIS)).toEqual({ error: "Devis introuvable" });
  });
});
