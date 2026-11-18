// @vitest-environment node
/**
 * Webhook DocuSeal — authentification, avec la VRAIE vérification (`@/lib/docuseal` non mocké).
 * Seuls Prisma et Telegram sont simulés : un refus 401 ne doit rien écrire ni rien alerter.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  telegram: vi.fn(async (_m: { tag: string; body: string }) => undefined),
  p: {
    devis: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    docusealWebhookEvent: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));

import { POST } from "./route";

const SECRET = "secret-de-test-webhook";

const corps = JSON.stringify({
  event_type: "submission.completed",
  timestamp: "2026-11-06T10:00:00Z",
  data: { id: 4242, metadata: { kind: "devis", devisId: "dv-interne-1" } },
});

const requete = (headers: Record<string, string> = {}, body: string = corps) =>
  new Request("http://x.test/api/docuseal/webhook", {
    method: "POST",
    body,
    headers,
  }) as never;

const signatureV2 = (body: string = corps, ts: number = Math.floor(Date.now() / 1000)) =>
  `${ts}.${createHmac("sha256", SECRET).update(`${ts}.${body}`, "utf8").digest("hex")}`;

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DOCUSEAL_WEBHOOK_SECRET"] = SECRET;
  h.p.docusealWebhookEvent.create.mockResolvedValue({ id: "w1" });
  h.p.docusealWebhookEvent.update.mockResolvedValue({});
  h.p.devis.findUnique.mockResolvedValue({ numero: "DEV-1" });
});

describe("authentification refusée : 401, aucune écriture, aucune alerte", () => {
  const refus: [string, Record<string, string>][] = [
    ["sans aucun en-tête", {}],
    [
      "ancien format v1 (HMAC nu, sans horodatage)",
      { "x-docuseal-signature": createHmac("sha256", SECRET).update(corps).digest("hex") },
    ],
    ["seul X-Docuseal-Secret (secret en clair)", { "x-docuseal-secret": SECRET }],
    ["v2 horodatage périmé", { "x-docuseal-signature": signatureV2(corps, 1_000_000) }],
    [
      "v2 signé avec un autre secret",
      { "x-docuseal-signature": `${Math.floor(Date.now() / 1000)}.${"a".repeat(64)}` },
    ],
  ];
  it.each(refus)("%s", async (_nom, headers) => {
    const r = await POST(requete(headers));
    expect(r.status).toBe(401);
    expect(h.p.docusealWebhookEvent.create).not.toHaveBeenCalled();
    expect(h.p.devis.findUnique).not.toHaveBeenCalled();
    expect(h.telegram).not.toHaveBeenCalled();
  });
});

describe("authentification v2 valide", () => {
  it("submission.completed : événement enregistré (id de soumission = data.id), aucune écriture sur le devis", async () => {
    h.p.devis.findUnique.mockResolvedValue({ numero: "DEV-1" });
    const r = await POST(requete({ "x-docuseal-signature": signatureV2() }));
    expect(r.status).toBe(200);
    expect(h.p.docusealWebhookEvent.create).toHaveBeenCalledOnce();
    const data = (
      h.p.docusealWebhookEvent.create.mock.calls[0]![0] as {
        data: { type: string; payload: { data: { id: number } } };
      }
    ).data;
    expect(data.type).toBe("submission.completed");
    expect(data.payload.data.id).toBe(4242);
    expect(h.p.devis.update).not.toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalledOnce();
    expect(h.telegram.mock.calls[0]![0].body).toContain("DEV-1");
  });

  it("devis introuvable : ni l'erreur stockée ni Telegram ne portent l'identifiant interne du devis", async () => {
    h.p.devis.findUnique.mockResolvedValue(null);
    const r = await POST(requete({ "x-docuseal-signature": signatureV2() }));
    expect(r.status).toBe(200);
    const stocke = JSON.stringify(h.p.docusealWebhookEvent.update.mock.calls);
    const alerte = JSON.stringify(h.telegram.mock.calls);
    expect(stocke).not.toContain("dv-interne-1");
    expect(alerte).not.toContain("dv-interne-1");
    expect(stocke).toContain("4242");
  });
});
