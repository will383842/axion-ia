// @vitest-environment node

/**
 * SITE-OUTBOX — un « stop » reçu APRÈS la mise en file d'un événement du guide réseau, mais
 * AVANT son envoi, l'emporte : aucun appel au CRM, la ligne est marquée (« bloquée par
 * opposition »), jamais supprimée, jamais retentée. Les autres types d'événements ne changent pas.
 * Valeurs fictives (example.test) ; aucune adresse dans les journaux.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Ligne = Record<string, unknown>;
let ligneCourante: Ligne;
let adressesOpposees: Set<string>;
const updateMock = vi.fn(async (args: { data: Ligne }) => {
  ligneCourante = { ...ligneCourante, ...args.data };
  return ligneCourante;
});
const deleteMock = vi.fn();
const deleteManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmSyncOutbox: {
      findUnique: async () => ligneCourante,
      update: (a: { data: Ligne }) => updateMock(a),
      delete: (...a: unknown[]) => deleteMock(...a),
      deleteMany: (...a: unknown[]) => deleteManyMock(...a),
    },
  },
}));
vi.mock("@/server/email/opposition", () => ({
  estOpposee: async (email: string) => adressesOpposees.has(email),
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn(async () => ({ ok: true })) }));

const { emitOutboxRow } = await import("../emit");
const { BLOQUEE_PAR_OPPOSITION } = await import("../opposition-avant-envoi");

const ADRESSE = "personne@example.test";

function ligne(over: Ligne = {}): Ligne {
  return {
    id: "outbox-1",
    eventType: "lead_magnet_requested",
    subjectRef: "site:guide_request:run_0001",
    payload: {
      schema_version: 3,
      event_id: "e1",
      source_slug: "guide-reseau",
      person: { person_key: "k", email: ADRESSE },
    },
    status: "pending",
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    responseStatus: null,
    ...over,
  };
}
const fetchMock = vi.fn(
  async () => new Response(JSON.stringify({ result: { status: "created" } })),
);

let journaux: string[];
beforeEach(() => {
  vi.clearAllMocks();
  ligneCourante = ligne();
  adressesOpposees = new Set();
  journaux = [];
  vi.stubGlobal("fetch", fetchMock);
  for (const m of ["log", "warn", "error", "info"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      journaux.push(a.map(String).join(" "));
    });
  }
  process.env.CRM_SYNC_URL = "https://crm.example.test/ingest";
  process.env.SITE_SYNC_HMAC_SECRET = "secret-de-test";
  process.env.CRM_SYNC_ENABLED = "true";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("opposition posée entre la mise en file et l'envoi", () => {
  it("🔴 aucun appel HTTP, ligne marquée « bloquée par opposition », conservée", async () => {
    adressesOpposees.add(ADRESSE);
    const r = await emitOutboxRow("outbox-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.status).toBe("skipped");
    expect(ligneCourante["status"]).toBe("gave_up");
    expect(ligneCourante["lastError"]).toBe(BLOQUEE_PAR_OPPOSITION);
    expect(ligneCourante["nextAttemptAt"]).toBeNull();
    expect(ligneCourante["attempts"]).toBe(0);
    // La ligne existe toujours en base (le mock `findUnique` la rend) et rien n'a été supprimé.
    expect(ligneCourante["id"]).toBe("outbox-1");
    expect(deleteMock).not.toHaveBeenCalled();
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("🔴 rejeu : la ligne bloquée reste bloquée, toujours sans appel HTTP", async () => {
    adressesOpposees.add(ADRESSE);
    await emitOutboxRow("outbox-1");
    adressesOpposees.clear(); // même une levée de l'opposition ne la rejoue pas
    const r = await emitOutboxRow("outbox-1");
    expect(r.status).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ligneCourante["lastError"]).toBe(BLOQUEE_PAR_OPPOSITION);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("une ligne en échec rejouable (failed) est bloquée aussi si l'opposition arrive", async () => {
    ligneCourante = ligne({ status: "failed", attempts: 3 });
    adressesOpposees.add(ADRESSE);
    await emitOutboxRow("outbox-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ligneCourante["status"]).toBe("gave_up");
    expect(ligneCourante["attempts"]).toBe(3);
  });

  it("adresse non opposée : l'envoi est inchangé", async () => {
    const r = await emitOutboxRow("outbox-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("sent");
    expect(ligneCourante["status"]).toBe("sent");
  });

  it("un autre type d'événement n'est pas relu : envoyé même si l'adresse est opposée", async () => {
    adressesOpposees.add(ADRESSE);
    ligneCourante = ligne({
      eventType: "form_submission",
      subjectRef: "site:submission:run_0002",
      payload: { schema_version: 1, event_id: "e2", person: { person_key: "k", email: ADRESSE } },
    });
    const r = await emitOutboxRow("outbox-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("sent");
  });

  it("aucune adresse dans les journaux ni dans le motif posé sur la ligne", async () => {
    adressesOpposees.add(ADRESSE);
    await emitOutboxRow("outbox-1");
    expect(journaux.join("\n")).not.toContain("example.test");
    expect(String(ligneCourante["lastError"])).not.toContain("example.test");
  });
});
