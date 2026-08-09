// Tests notify() — API publique hub (Sprint Notif Infra 2026-05-26).
//
// On mocke `fetch` + `@/lib/redis` pour tester sans dépendance externe.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Flake fix 2026-06-15 — `notify`/`flushPendingDispatches` étaient importés via
// `await import("../index")` DANS chaque test. Le 1er import à froid déclenche la
// transformation Vite de tout le graphe du module (~15-23 s en local) ATTRIBUÉE
// au corps du test → timeout 5 s dépassé (flake intermittent : vert en CI cache
// chaud, rouge à froid/isolé). On hisse l'import au niveau module : la transfo se
// fait en phase de collecte (hors testTimeout), les corps de test restent triviaux.
// Sûr : `vi.mock("@/lib/redis")` est hoisté (s'applique à cet import), et `notify`
// lit `process.env` à l'APPEL (pas à l'import) → les overrides de `beforeEach` valent.
import { notify, flushPendingDispatches } from "../index";

const fetchMock = vi.fn();
const redisSetMock = vi.fn();
const redisIncrMock = vi.fn();
const redisExpireMock = vi.fn();

vi.mock("@/lib/redis", () => ({
  redis: {
    set: (...args: unknown[]) => redisSetMock(...args),
    incr: (...args: unknown[]) => redisIncrMock(...args),
    expire: (...args: unknown[]) => redisExpireMock(...args),
  },
}));

describe("notify()", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    fetchMock.mockReset();
    redisSetMock.mockReset();
    redisIncrMock.mockReset();
    redisExpireMock.mockReset();
    // Par défaut : Redis répond "pas dupliqué" + sous quota.
    redisSetMock.mockResolvedValue("OK");
    redisIncrMock.mockResolvedValue(1);
    redisExpireMock.mockResolvedValue(1);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat";
    // Important : valeur explicite, pas stub.invalid.
    process.env.REDIS_URL = "redis://localhost:6381";
  });

  afterEach(async () => {
    // Attend la fin des dispatches fire-and-forget (severity critical/error →
    // Promise détachée) du test courant AVANT de restaurer les mocks : sinon leur
    // fetch asynchrone se résout pendant un test ultérieur et fausse son compteur
    // d'appels → flake d'isolation inter-tests (ordre-dépendant).
    await flushPendingDispatches();
    globalThis.fetch = originalFetch;
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_CHAT_ID = originalChatId;
    process.env.REDIS_URL = originalRedisUrl;
  });

  it("envoie en sync sur Telegram pour severity info", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const result = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: {
        submissionId: "sub_1",
        contactName: "Test",
        contactEmail: "test@example.com",
        formType: "contact",
        locale: "fr",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.channels.telegram).toBe("sent");
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(String(call?.[0])).toContain("api.telegram.org");
  });

  it("dispatche async (fire-and-forget) pour severity critical", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const result = await notify({
      category: "BACKUP_FAILED",
      payload: { type: "db", error: "disk full" },
    });
    // Async : marqué "queued" sans attendre le fetch.
    expect(result.ok).toBe(true);
    expect(result.channels.telegram).toBe("queued");
  });

  it("skip envoi quand dédup hit", async () => {
    // 2e appel SET NX retourne null → doublon
    redisSetMock.mockResolvedValueOnce(null);
    const result = await notify({
      category: "CALENDLY_INVITEE_CREATED",
      payload: {
        eventUri: "evt_1",
        inviteeEmail: "x@y.com",
        inviteeName: "X",
        eventStartTime: "now",
        eventName: "appel",
      },
      dedupKey: "evt_1",
    });
    expect(result.deduped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // « skipped » et non « failed » depuis le 2026-08-09 : l'absence de jeton est
  // une CONFIGURATION manquante, pas un envoi qui a échoué. Les confondre
  // faisait chercher une panne réseau dans les logs là où il manquait une
  // variable d'environnement. `ok` reste faux dans les deux cas.
  it("fail-soft si TELEGRAM_BOT_TOKEN manquant", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const result = await notify({
      category: "NEWSLETTER_CONFIRMED",
      payload: { email: "x@y.com" },
    });
    expect(result.channels.telegram).toBe("skipped");
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fail-soft si fetch Telegram throw", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const result = await notify({
      category: "NEWSLETTER_PENDING",
      payload: { email: "x@y.com" },
    });
    expect(result.channels.telegram).toBe("failed");
  });

  it("force=true bypass le rate-limit", async () => {
    // Simule rate-limit dépassé (count=999)
    redisIncrMock.mockResolvedValueOnce(999);
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const result = await notify({
      category: "SECURITY_ALERT",
      payload: { kind: "csrf", details: {} },
      force: true,
    });
    expect(result.rateLimited).toBeUndefined();
  });

  it("rate-limit hit pour SECURITY_ALERT au-dessus du quota", async () => {
    // Simule rate-limit dépassé
    redisIncrMock.mockResolvedValueOnce(999);
    const result = await notify({
      category: "SECURITY_ALERT",
      payload: { kind: "csrf", details: {} },
    });
    expect(result.rateLimited).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
