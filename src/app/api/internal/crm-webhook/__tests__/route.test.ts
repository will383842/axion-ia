import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contrat HTTP du webhook entrant (lot L5).
 *
 * Les modules sous-jacents sont déjà testés unitairement
 * (`src/server/crm-sync/__tests__/crm-sync-l5.test.ts`). Ce fichier vérifie le
 * CÂBLAGE, qui est précisément ce qu'un test unitaire ne voit pas : quel code
 * HTTP sort, dans quel ordre les contrôles s'enchaînent, et — le point qui
 * compte — qu'un `event_id` déjà traité répond 200 et non une erreur.
 */

const { inbound, subscriber } = vi.hoisted(() => ({
  inbound: { findUnique: vi.fn(), create: vi.fn() },
  subscriber: { findMany: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { crmInboundEvent: inbound, newsletterSubscriber: subscriber },
}));

import { POST } from "../route";
import { signInboundBody } from "@/server/crm-sync/inbound";

const SECRET = "secret-de-test-route";
const OLD_ENV = { ...process.env };

const CORPS = {
  event_id: "crm-evt-route-1",
  event_type: "consent_optout",
  email_hash: "a".repeat(64),
  scope: "business",
  origin: "crm",
  occurred_at: "2026-08-14T09:00:00.000Z",
};

function requete(corps: unknown, options: { signe?: boolean; secret?: string } = {}): Request {
  const body = typeof corps === "string" ? corps : JSON.stringify(corps);
  const ts = Math.floor(Date.now() / 1000).toString();
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (options.signe !== false) {
    headers["x-crm-timestamp"] = ts;
    headers["x-crm-signature"] = signInboundBody(options.secret ?? SECRET, ts, body);
  }

  return new Request("https://axion-ia.com/api/internal/crm-webhook", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SITE_SYNC_HMAC_SECRET = SECRET;
  inbound.findUnique.mockResolvedValue(null);
  inbound.create.mockResolvedValue({ id: "inb-1" });
  subscriber.findMany.mockResolvedValue([]);
  subscriber.update.mockResolvedValue({});
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("POST /api/internal/crm-webhook", () => {
  it("200 sur un événement signé et conforme", async () => {
    const res = await POST(requete(CORPS));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, outcome: "no_match" });
  });

  it("200 sur un event_id DÉJÀ traité (idempotence, pas une erreur)", async () => {
    inbound.findUnique.mockResolvedValue({ id: "inb-deja" });

    const res = await POST(requete(CORPS));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, outcome: "duplicate" });
    expect(inbound.create).not.toHaveBeenCalled();
  });

  it("401 sans en-têtes de signature", async () => {
    const res = await POST(requete(CORPS, { signe: false }));
    expect(res.status).toBe(401);
  });

  it("401 avec une signature calculée avec un autre secret", async () => {
    const res = await POST(requete(CORPS, { secret: "mauvais-secret" }));
    expect(res.status).toBe(401);
  });

  it("422 sur un corps qui viole le contrat", async () => {
    const res = await POST(requete({ ...CORPS, event_type: "consent_peut_etre" }));
    expect(res.status).toBe(422);
    expect(inbound.create).not.toHaveBeenCalled();
  });

  it("422 sur un corps qui n'est pas du JSON", async () => {
    const res = await POST(requete("ceci n'est pas du json"));
    expect(res.status).toBe(422);
  });

  it("500 — et rien d'écrit — quand le secret serveur est absent (inertie)", async () => {
    delete process.env.SITE_SYNC_HMAC_SECRET;

    const res = await POST(requete(CORPS, { secret: SECRET }));

    expect(res.status).toBe(500);
    expect(inbound.findUnique).not.toHaveBeenCalled();
    expect(inbound.create).not.toHaveBeenCalled();
  });
});
