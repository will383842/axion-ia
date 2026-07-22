// Tests canal WhatsApp (CallMeBot) — 2026-07-19.
//
// Couvre : (1) le sender bas niveau `sendWhatsAppRaw` (skip/sent/failed + URL),
// (2) le routing `shouldNotifyWhatsApp` (leads only), (3) l'inversion MarkdownV2
// `markdownV2ToPlain`, (4) l'intégration `notify()` (doublon Telegram + WhatsApp).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { sendWhatsAppRaw } from "../channels/whatsapp";
import { shouldNotifyWhatsApp } from "../routing";
import { escapeMarkdownV2, markdownV2ToPlain, formatNotificationPlain } from "../format";
import { notify, flushPendingDispatches } from "../index";

const redisSetMock = vi.fn();
const redisIncrMock = vi.fn();
const redisExpireMock = vi.fn();
vi.mock("@/lib/redis", () => ({
  redis: {
    set: (...a: unknown[]) => redisSetMock(...a),
    incr: (...a: unknown[]) => redisIncrMock(...a),
    expire: (...a: unknown[]) => redisExpireMock(...a),
  },
}));

// ── 1. sendWhatsAppRaw ───────────────────────────────────────────────────────
describe("sendWhatsAppRaw", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...savedEnv };
  });

  it('renvoie "skipped" sans clé ni numéro (aucun fetch)', async () => {
    delete process.env.WHATSAPP_CALLMEBOT_APIKEY;
    delete process.env.WHATSAPP_NOTIFY_PHONE;
    const status = await sendWhatsAppRaw({ text: "hello" });
    expect(status).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renvoie "skipped" si seulement la clé est présente', async () => {
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    delete process.env.WHATSAPP_NOTIFY_PHONE;
    expect(await sendWhatsAppRaw({ text: "x" })).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renvoie "sent" et construit la bonne URL CallMeBot', async () => {
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    process.env.WHATSAPP_NOTIFY_PHONE = "+33 7 43 33 12 01"; // espaces volontaires
    fetchMock.mockResolvedValueOnce(new Response("Message queued", { status: 200 }));

    const status = await sendWhatsAppRaw({ text: "Nouveau lead *Marie*" });
    expect(status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledOnce();

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("api.callmebot.com/whatsapp.php");
    expect(url).toContain(`phone=${encodeURIComponent("+33743331201")}`); // espaces retirés
    expect(url).toContain("apikey=123456");
    expect(url).toContain(encodeURIComponent("Nouveau lead *Marie*"));
  });

  it('renvoie "failed" sur réponse non-2xx', async () => {
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    process.env.WHATSAPP_NOTIFY_PHONE = "+33743331201";
    fetchMock.mockResolvedValueOnce(new Response("APIKEY invalid", { status: 403 }));
    expect(await sendWhatsAppRaw({ text: "x" })).toBe("failed");
  });

  it('renvoie "failed" si fetch throw (réseau / timeout)', async () => {
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    process.env.WHATSAPP_NOTIFY_PHONE = "+33743331201";
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await sendWhatsAppRaw({ text: "x" })).toBe("failed");
  });
});

// ── 2. Routing leads-only ────────────────────────────────────────────────────
describe("shouldNotifyWhatsApp", () => {
  it("vrai pour les leads humains (contact/devis/RDV/candidature)", () => {
    for (const c of [
      "CONTACT_FORM_SUBMITTED",
      "QUOTE_REQUEST_RECEIVED",
      "AUDIT_REQUEST_SUBMITTED",
      "JOB_APPLICATION_RECEIVED",
      "BOOKING_CREATED",
      "CALENDLY_INVITEE_CREATED",
      "PODCAST_REQUEST_SUBMITTED",
    ] as const) {
      expect(shouldNotifyWhatsApp(c), c).toBe(true);
    }
  });

  it("faux pour système / newsletter / avis / ops", () => {
    for (const c of [
      "NEWSLETTER_CONFIRMED",
      "REVIEW_SUBMITTED",
      "SECURITY_ALERT",
      "BACKUP_FAILED",
      "DEPLOY_SUCCESS",
      "BOOKING_CANCELLED",
    ] as const) {
      expect(shouldNotifyWhatsApp(c), c).toBe(false);
    }
  });
});

// ── 3. Inversion MarkdownV2 → plain ──────────────────────────────────────────
describe("markdownV2ToPlain", () => {
  it("inverse exactement escapeMarkdownV2", () => {
    const raw = "Budget: 1.900€ (HT) — a+b_c #ok!";
    expect(markdownV2ToPlain(escapeMarkdownV2(raw))).toBe(raw);
  });

  it("conserve les marqueurs de gras *label* (rendus par WhatsApp)", () => {
    const plain = markdownV2ToPlain(
      `• *${escapeMarkdownV2("Nom")}* : ${escapeMarkdownV2("Marie D.")}`,
    );
    expect(plain).toBe("• *Nom* : Marie D.");
  });

  it("formatNotificationPlain ne contient aucun backslash d'échappement", () => {
    const { text } = formatNotificationPlain(
      {
        category: "CONTACT_FORM_SUBMITTED",
        payload: {
          submissionId: "sub_1",
          contactName: "Marie Dupont",
          contactEmail: "marie@example.com",
          formType: "contact",
          ville: "Grenoble",
          locale: "fr",
        },
      },
      "info",
    );
    expect(text).not.toContain("\\");
    expect(text).toContain("Marie Dupont");
    expect(text).toContain("Grenoble");
  });
});

// ── 4. Intégration notify() ──────────────────────────────────────────────────
describe("notify() → doublon WhatsApp pour les leads", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    fetchMock.mockReset();
    redisSetMock.mockReset().mockResolvedValue("OK");
    redisIncrMock.mockReset().mockResolvedValue(1);
    redisExpireMock.mockReset().mockResolvedValue(1);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat";
    process.env.REDIS_URL = "redis://localhost:6381";
  });
  afterEach(async () => {
    await flushPendingDispatches();
    globalThis.fetch = originalFetch;
    process.env = { ...savedEnv };
  });

  it("envoie Telegram + WhatsApp quand la clé CallMeBot est configurée", async () => {
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    process.env.WHATSAPP_NOTIFY_PHONE = "+33743331201";
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const result = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: {
        submissionId: "sub_1",
        contactName: "Marie",
        contactEmail: "marie@example.com",
        formType: "contact",
        locale: "fr",
      },
    });

    expect(result.channels.telegram).toBe("sent");
    expect(result.channels.whatsapp).toBe("sent");
    const hosts = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(hosts.some((u) => u.includes("api.telegram.org"))).toBe(true);
    expect(hosts.some((u) => u.includes("api.callmebot.com"))).toBe(true);
  });

  it('WhatsApp "skipped" (aucun fetch CallMeBot) tant que la clé est absente', async () => {
    delete process.env.WHATSAPP_CALLMEBOT_APIKEY;
    delete process.env.WHATSAPP_NOTIFY_PHONE;
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const result = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: {
        submissionId: "sub_2",
        contactName: "Jean",
        contactEmail: "jean@example.com",
        formType: "contact",
        locale: "fr",
      },
    });

    expect(result.channels.telegram).toBe("sent");
    expect(result.channels.whatsapp).toBe("skipped");
    const hosts = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(hosts.some((u) => u.includes("api.callmebot.com"))).toBe(false);
  });

  it("PAS de WhatsApp pour une catégorie système (newsletter)", async () => {
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    process.env.WHATSAPP_NOTIFY_PHONE = "+33743331201";
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const result = await notify({
      category: "NEWSLETTER_CONFIRMED",
      payload: { email: "x@y.com" },
    });

    expect(result.channels.whatsapp).toBeUndefined();
    const hosts = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(hosts.some((u) => u.includes("api.callmebot.com"))).toBe(false);
  });
});
