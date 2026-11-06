// @vitest-environment node
/**
 * Webhook DocuSeal : la signature d'un devis fait passer la fiche en client, APRÈS le COMMIT
 * de l'acceptation (hors transaction). Un refus, un rejeu, un devis expiré ne font rien monter.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

const tg = vi.hoisted(() => ({ sendTelegram: vi.fn(async (_m: unknown) => undefined) }));
const h = vi.hoisted(() => ({
  tx: { devis: { update: vi.fn() } },
  monter: vi.fn(),
  emettre: vi.fn(),
  p: {
    devis: { findUnique: vi.fn(), update: vi.fn() },
    docusealWebhookEvent: { create: vi.fn(), update: vi.fn() },
  },
  event: { eventId: "e1", eventType: "form.completed", submissionId: "s1", metadata: {}, raw: {} },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/telegram", () => tg);
vi.mock("@/lib/docuseal", () => ({
  isDocusealWebhookConfigured: () => true,
  verifyWebhookSignature: () => true,
  parseWebhookPayload: () => h.event,
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisSigne: h.emettre,
  transactionDevisSigne: vi.fn(async (_p: unknown, fn: (tx: unknown) => Promise<void>) => fn(h.tx)),
}));
vi.mock("@/features/dossier-client/devis-signe-fait-client", () => ({
  faireMonterLesFichesDesDevisSignes: h.monter,
}));

import { POST } from "./route";

const requete = (body = "{}", headers: Record<string, string> = {}) =>
  new Request("http://x.test/api/docuseal/webhook", { method: "POST", body, headers }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.event.eventType = "form.completed";
  h.event.metadata = { kind: "devis", devisId: "dv-1" };
  h.p.docusealWebhookEvent.create.mockResolvedValue({ id: "w1" });
  h.p.docusealWebhookEvent.update.mockResolvedValue({});
  h.event.submissionId = "s1";
  h.p.devis.findUnique.mockResolvedValue({
    id: "dv-1",
    numero: "DEV-1",
    statut: "envoye",
    docusealSubmissionId: "s1",
  });
});

describe("webhook DocuSeal, devis", () => {
  it("signature complète : acceptation, émission, puis montée de la fiche par le client prisma", async () => {
    const r = await POST(requete());
    expect(r.status).toBe(200);
    expect(h.tx.devis.update).toHaveBeenCalledOnce();
    expect(h.monter).toHaveBeenCalledOnce();
    expect(h.monter).toHaveBeenCalledWith(h.p, ["dv-1"], { origine: "docuseal" });
    expect(h.tx.devis.update.mock.invocationCallOrder[0]!).toBeLessThan(
      h.emettre.mock.invocationCallOrder[0]!,
    );
    expect(h.emettre.mock.invocationCallOrder[0]!).toBeLessThan(
      h.monter.mock.invocationCallOrder[0]!,
    );
  });

  it("une erreur levée par la montée n'empêche jamais l'acceptation du devis", async () => {
    h.monter.mockRejectedValueOnce(new Error("montée"));
    const r = await POST(requete());
    expect(r.status).toBe(200);
    expect(h.tx.devis.update).toHaveBeenCalledOnce();
    expect(h.emettre).toHaveBeenCalledOnce();
    expect(h.p.docusealWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processedAt: expect.any(Date) }) }),
    );
    expect(sentry.captureException).toHaveBeenCalledOnce();
  });

  it("refus (form.declined) : rien ne monte", async () => {
    h.event.eventType = "form.declined";
    await POST(requete());
    expect(h.p.devis.update).toHaveBeenCalledOnce();
    expect(h.monter).not.toHaveBeenCalled();
  });

  it.each(["accepte", "transforme_convention", "expire"])(
    "rejeu ou devis %s : rien ne monte",
    async (statut) => {
      h.p.devis.findUnique.mockResolvedValue({
        id: "dv-1",
        numero: "DEV-1",
        statut,
        docusealSubmissionId: "s1",
      });
      await POST(requete());
      expect(h.tx.devis.update).not.toHaveBeenCalled();
      expect(h.monter).not.toHaveBeenCalled();
    },
  );
});

describe("webhook DocuSeal, durcissement", () => {
  it("submissionId différent de celui du devis : ignoré, aucune écriture, alerte sans donnée perso", async () => {
    h.event.submissionId = "autre";
    const r = await POST(requete());
    expect(r.status).toBe(200);
    expect(h.tx.devis.update).not.toHaveBeenCalled();
    expect(h.p.devis.update).not.toHaveBeenCalled();
    expect(h.monter).not.toHaveBeenCalled();
    expect(tg.sendTelegram).toHaveBeenCalledOnce();
    const msg = JSON.stringify(tg.sendTelegram.mock.calls[0]![0]);
    expect(msg).not.toContain("autre");
    expect(msg).not.toContain("s1");
  });

  it("devis sans docusealSubmissionId (maison) : un webhook DocuSeal ne le modifie pas", async () => {
    h.p.devis.findUnique.mockResolvedValue({
      id: "dv-1",
      numero: "DEV-1",
      statut: "envoye",
      docusealSubmissionId: null,
    });
    await POST(requete());
    expect(h.tx.devis.update).not.toHaveBeenCalled();
    expect(h.p.devis.update).not.toHaveBeenCalled();
  });

  it.each(["accepte", "transforme_convention"])(
    "un refus tardif ne rétrograde jamais un devis %s",
    async (statut) => {
      h.event.eventType = "form.declined";
      h.p.devis.findUnique.mockResolvedValue({
        id: "dv-1",
        numero: "DEV-1",
        statut,
        docusealSubmissionId: "s1",
      });
      await POST(requete());
      expect(h.p.devis.update).not.toHaveBeenCalled();
    },
  );

  it("corps annoncé au-delà de 256 Ko : 413 sans lire ni vérifier", async () => {
    const r = await POST(requete("{}", { "content-length": String(256 * 1024 + 1) }));
    expect(r.status).toBe(413);
    expect(h.p.docusealWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("corps réel au-delà de 256 Ko sans content-length fiable : 413", async () => {
    const r = await POST(requete("x".repeat(256 * 1024 + 1)));
    expect(r.status).toBe(413);
    expect(h.p.docusealWebhookEvent.create).not.toHaveBeenCalled();
  });
});
