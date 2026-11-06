// @vitest-environment node
/**
 * Webhook DocuSeal (CGV art. 5.1, 6.2, 6.3) : une signature DocuSeal n'est PAS une acceptation.
 * Le webhook n'écrit jamais Devis.statut, n'émet pas devis.signe, ne fait pas monter les fiches ;
 * il enregistre l'événement (idempotence) et alerte Telegram avec le seul numéro de devis.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  telegram: vi.fn(async (_m: { tag: string; body: string }) => undefined),
  p: {
    devis: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    docusealWebhookEvent: { create: vi.fn(), update: vi.fn() },
  },
  event: {
    eventId: "e1",
    eventType: "form.completed",
    submissionId: "s1",
    metadata: {} as Record<string, string>,
    raw: {},
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));
vi.mock("@/lib/docuseal", () => ({
  isDocusealWebhookConfigured: () => true,
  verifyWebhookAuth: () => true,
  parseWebhookPayload: () => h.event,
}));

import { POST } from "./route";

const requete = () =>
  new Request("http://x.test/api/docuseal/webhook", { method: "POST", body: "{}" }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.event.metadata = { kind: "devis", devisId: "dv-1", clientEmail: "secret@client.fr" };
  h.p.docusealWebhookEvent.create.mockResolvedValue({ id: "w1" });
  h.p.docusealWebhookEvent.update.mockResolvedValue({});
});

describe.each(["brouillon", "envoye", "accepte"])("devis au statut %s", (statut) => {
  beforeEach(() => {
    h.p.devis.findUnique.mockResolvedValue({ numero: "DEV-1", statut });
  });
  it.each(["form.completed", "submission.completed", "form.declined", "submission.expired"])(
    "%s : aucune écriture sur le devis, événement enregistré et marqué traité",
    async (type) => {
      h.event.eventType = type;
      const r = await POST(requete());
      expect(r.status).toBe(200);
      expect(h.p.devis.update).not.toHaveBeenCalled();
      expect(h.p.devis.updateMany).not.toHaveBeenCalled();
      expect(h.p.docusealWebhookEvent.create).toHaveBeenCalledOnce();
      expect(h.p.docusealWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ processedAt: expect.any(Date) }) }),
      );
    },
  );
});

describe("alertes Telegram", () => {
  beforeEach(() => {
    h.p.devis.findUnique.mockResolvedValue({ numero: "DEV-1" });
  });
  it("devis signé : alerte avec le numéro seulement, aucune donnée client", async () => {
    h.event.eventType = "form.completed";
    await POST(requete());
    expect(h.telegram).toHaveBeenCalledOnce();
    const body = h.telegram.mock.calls[0]![0].body;
    expect(body).toContain("DEV-1");
    expect(body).not.toContain("secret@client.fr");
    expect(body).not.toContain("dv-1");
  });
  it("hors devis : ne transmet jamais les métadonnées", async () => {
    h.event.eventType = "form.completed";
    h.event.metadata = { kind: "autre", clientEmail: "secret@client.fr" };
    await POST(requete());
    expect(h.telegram.mock.calls[0]![0].body).not.toContain("secret@client.fr");
    h.event.eventType = "form.declined";
    await POST(requete());
    expect(h.telegram.mock.calls[1]![0].body).not.toContain("secret@client.fr");
  });
  it("doublon (P2002) : 200 sans alerte", async () => {
    h.p.docusealWebhookEvent.create.mockRejectedValue({ code: "P2002" });
    const r = await POST(requete());
    expect(r.status).toBe(200);
    expect(h.telegram).not.toHaveBeenCalled();
  });
});
