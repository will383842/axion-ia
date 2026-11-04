// @vitest-environment node
/**
 * Webhook DocuSeal : la signature d'un devis fait passer la fiche en client, dans la transaction
 * de l'acceptation. Un refus, un rejeu, un devis expiré ne font rien monter.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => undefined) }));
vi.mock("@/lib/docuseal", () => ({
  isDocusealWebhookConfigured: () => true,
  verifyWebhookAuth: () => true,
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

const requete = () =>
  new Request("http://x.test/api/docuseal/webhook", { method: "POST", body: "{}" }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.event.eventType = "form.completed";
  h.event.metadata = { kind: "devis", devisId: "dv-1" };
  h.p.docusealWebhookEvent.create.mockResolvedValue({ id: "w1" });
  h.p.docusealWebhookEvent.update.mockResolvedValue({});
  h.p.devis.findUnique.mockResolvedValue({ id: "dv-1", numero: "DEV-1", statut: "envoye" });
});

describe("webhook DocuSeal, devis", () => {
  it("signature complète : acceptation, émission, puis montée de la fiche, dans le même tx", async () => {
    const r = await POST(requete());
    expect(r.status).toBe(200);
    expect(h.tx.devis.update).toHaveBeenCalledOnce();
    expect(h.monter).toHaveBeenCalledOnce();
    expect(h.monter).toHaveBeenCalledWith(h.tx, ["dv-1"], { origine: "docuseal" });
    expect(h.tx.devis.update.mock.invocationCallOrder[0]!).toBeLessThan(
      h.emettre.mock.invocationCallOrder[0]!,
    );
    expect(h.emettre.mock.invocationCallOrder[0]!).toBeLessThan(
      h.monter.mock.invocationCallOrder[0]!,
    );
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
      h.p.devis.findUnique.mockResolvedValue({ id: "dv-1", numero: "DEV-1", statut });
      await POST(requete());
      expect(h.tx.devis.update).not.toHaveBeenCalled();
      expect(h.monter).not.toHaveBeenCalled();
    },
  );
});
