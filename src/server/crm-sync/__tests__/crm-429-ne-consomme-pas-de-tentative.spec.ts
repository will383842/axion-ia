// @vitest-environment node

/**
 * SITE-429 — un 429 (ou un 503 « CRM éteint ») du CRM ne consomme AUCUNE tentative.
 *
 * Mesuré à l'audit du 11/11 : sur un post viral le CRM peut répondre 429 longtemps. Compté comme
 * une tentative, le 429 menait l'événement à `gave_up` après 8 réponses : la personne était perdue
 * pour le CRM alors qu'il suffisait d'attendre. Le 429 reporte donc l'événement (en-tête
 * `Retry-After` respecté, sinon délai borné croissant) ; les autres erreurs gardent le compteur.
 * Valeurs fictives uniquement ; aucune adresse n'est lue ni journalisée.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Ligne = Record<string, unknown>;
let ligneCourante: Ligne;
const updateMock = vi.fn(async (args: { data: Ligne }) => {
  ligneCourante = { ...ligneCourante, ...args.data };
  return ligneCourante;
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmSyncOutbox: {
      findUnique: async () => ligneCourante,
      update: (a: { data: Ligne }) => updateMock(a),
    },
  },
}));
const notifyMock = vi.fn(async () => ({ ok: true, channels: {} }));
vi.mock("@/server/notifications", () => ({ notify: () => notifyMock() }));

const { emitOutboxRow } = await import("../emit");

function ligne(over: Ligne = {}): Ligne {
  return {
    id: "outbox-1",
    eventType: "lead_magnet_requested",
    subjectRef: "site:guide-reseau:run_0001",
    payload: { schema_version: 3, event_id: "e1" },
    status: "pending",
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    responseStatus: null,
    ...over,
  };
}
function repondre(status: number, entetes: Record<string, string> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status, headers: entetes })),
  );
}
const SEC = 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-11T10:00:00.000Z"));
  ligneCourante = ligne();
  process.env.CRM_SYNC_URL = "https://crm.example.test/ingest";
  process.env.SITE_SYNC_HMAC_SECRET = "secret-de-test";
  process.env.CRM_SYNC_ENABLED = "true";
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("429 / 503 : on reporte, on ne compte pas", () => {
  it("🔴 un 429 répété 10 fois n'atteint jamais gave_up et ne consomme aucune tentative", async () => {
    ligneCourante = ligne({ attempts: 7 }); // à une tentative de l'abandon
    repondre(429);
    for (let i = 0; i < 10; i++) {
      const r = await emitOutboxRow("outbox-1");
      expect(r.status).toBe("failed");
      expect(ligneCourante["status"]).toBe("failed");
      expect(ligneCourante["attempts"]).toBe(7);
      vi.setSystemTime(new Date(ligneCourante["nextAttemptAt"] as Date));
    }
    expect(notifyMock, "aucune alerte d'abandon").not.toHaveBeenCalled();
  });

  it("🔴 Retry-After (secondes) est respecté", async () => {
    repondre(429, { "Retry-After": "120" });
    await emitOutboxRow("outbox-1");
    expect((ligneCourante["nextAttemptAt"] as Date).getTime()).toBe(Date.now() + 120 * SEC);
  });

  it("Retry-After (date HTTP) est respecté", async () => {
    repondre(429, { "Retry-After": new Date(Date.now() + 300 * SEC).toUTCString() });
    await emitOutboxRow("outbox-1");
    expect((ligneCourante["nextAttemptAt"] as Date).getTime()).toBe(Date.now() + 300 * SEC);
  });

  it("un Retry-After démesuré est plafonné (6 h)", async () => {
    repondre(429, { "Retry-After": String(30 * 24 * 3600) });
    await emitOutboxRow("outbox-1");
    expect((ligneCourante["nextAttemptAt"] as Date).getTime()).toBe(Date.now() + 6 * 3600 * SEC);
  });

  it("sans Retry-After : délai borné, croissant, plafonné", async () => {
    repondre(429);
    const ecarts: number[] = [];
    for (let i = 0; i < 12; i++) {
      await emitOutboxRow("outbox-1");
      const prochain = (ligneCourante["nextAttemptAt"] as Date).getTime();
      ecarts.push(prochain - Date.now());
      vi.setSystemTime(new Date(prochain));
    }
    expect(ecarts[0]).toBeGreaterThanOrEqual(60 * SEC);
    expect(ecarts[3]!).toBeGreaterThan(ecarts[0]!);
    expect(Math.max(...ecarts)).toBeLessThanOrEqual(30 * 60 * SEC);
    expect(ecarts[11]).toBe(30 * 60 * SEC);
  });

  it("🔴 un 503 (CRM éteint) se comporte comme un 429", async () => {
    ligneCourante = ligne({ attempts: 7 });
    repondre(503, { "Retry-After": "90" });
    for (let i = 0; i < 10; i++) {
      await emitOutboxRow("outbox-1");
      expect(ligneCourante["status"]).toBe("failed");
      expect(ligneCourante["attempts"]).toBe(7);
    }
    expect((ligneCourante["nextAttemptAt"] as Date).getTime()).toBe(Date.now() + 90 * SEC);
  });

  it("🔑 une autre erreur (500) compte toujours, jusqu'à gave_up", async () => {
    repondre(500);
    await emitOutboxRow("outbox-1");
    expect(ligneCourante["attempts"]).toBe(1);
    ligneCourante = ligne({ attempts: 7 });
    const r = await emitOutboxRow("outbox-1");
    expect(r.status).toBe("failed");
    expect(ligneCourante["status"]).toBe("gave_up");
    expect(ligneCourante["attempts"]).toBe(8);
  });

  it("🔑 une erreur réseau compte toujours", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("réseau coupé");
      }),
    );
    await emitOutboxRow("outbox-1");
    expect(ligneCourante["attempts"]).toBe(1);
  });
});
