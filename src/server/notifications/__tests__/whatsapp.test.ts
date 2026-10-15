// Tests canal WhatsApp (CallMeBot) — 2026-07-19.
//
// Couvre : (1) le sender bas niveau `sendWhatsAppRaw` (skip/sent/failed + URL),
// (2) le routing `shouldNotifyWhatsApp` (leads only), (3) l'inversion MarkdownV2
// `markdownV2ToPlain`, (4) l'intégration `notify()` (doublon Telegram + WhatsApp).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { sendWhatsAppRaw } from "../channels/whatsapp";
import { shouldNotifyWhatsApp, telegramGroupFor, ALL_NOTIFICATION_CATEGORIES } from "../routing";
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
    process.env.WHATSAPP_NOTIFY_PHONE = "+33 7 55 51 23 45"; // espaces volontaires
    fetchMock.mockResolvedValueOnce(new Response("Message queued", { status: 200 }));

    const status = await sendWhatsAppRaw({ text: "Nouveau lead *Marie*" });
    expect(status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledOnce();

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("api.callmebot.com/whatsapp.php");
    expect(url).toContain(`phone=${encodeURIComponent("+33755512345")}`); // espaces retirés
    expect(url).toContain("apikey=123456");
    expect(url).toContain(encodeURIComponent("Nouveau lead *Marie*"));
  });

  it('renvoie "failed" sur réponse non-2xx', async () => {
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    process.env.WHATSAPP_NOTIFY_PHONE = "+33755512345";
    fetchMock.mockResolvedValueOnce(new Response("APIKEY invalid", { status: 403 }));
    expect(await sendWhatsAppRaw({ text: "x" })).toBe("failed");
  });

  it('renvoie "failed" si fetch throw (réseau / timeout)', async () => {
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    process.env.WHATSAPP_NOTIFY_PHONE = "+33755512345";
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await sendWhatsAppRaw({ text: "x" })).toBe("failed");
  });
});

// ── 2. Routing : la sonnette des CLIENTS, et rien d'autre ─────────────────────
describe("shouldNotifyWhatsApp", () => {
  // Décision Will 15/10 : WhatsApp (CallMeBot, un seul fil) devient la SONNETTE
  // réservée aux clients. Tout le reste reste sur Telegram, dans son salon.
  const CLIENTS = [
    "CONTACT_FORM_SUBMITTED",
    "AUDIT_REQUEST_SUBMITTED",
    "INTERVENTION_REQUEST_SUBMITTED",
    "IMPLEMENTATION_REQUEST_SUBMITTED",
    "QUOTE_REQUEST_RECEIVED",
    "CUSTOMER_SUPPORT_REQUEST",
    "CHATBOT_LEAD_CAPTURED",
    "CHATBOT_ESCALATION",
    "CLIENT_CALL_BOOKED",
    "CLIENT_CALL_CANCELED",
    "CLIENT_CALL_RESCHEDULED",
  ] as const;

  it("vrai pour chaque demande de client (formulaires, chatbot, rendez-vous)", () => {
    for (const c of CLIENTS) expect(shouldNotifyWhatsApp(c), c).toBe(true);
  });

  it("🔴 la liste WhatsApp est EXACTEMENT celle du salon « Clients »", () => {
    const sonnent = ALL_NOTIFICATION_CATEGORIES.filter(shouldNotifyWhatsApp).sort();
    expect(sonnent).toEqual([...CLIENTS].sort());
    for (const c of sonnent) expect(telegramGroupFor(c), c).toBe("clients");
  });

  // 🔴 RETIRÉS le 15/10 (décision Will) — ce test ROUGIT si l'un revient.
  it("faux pour presse, investisseur, speaker, podcast, avis et candidatures", () => {
    for (const c of [
      "PRESS_REQUEST_SUBMITTED",
      "INVESTOR_INQUIRY_RECEIVED",
      "SPEAKER_INVITATION_RECEIVED",
      "PODCAST_REQUEST_SUBMITTED",
      "REVIEW_SUBMITTED",
      "VIDEO_EDITOR_APPLICATION_RECEIVED",
      "COMMERCIAL_APPLICATION_RECEIVED",
      "JOB_APPLICATION_RECEIVED",
      "RECRUITMENT_RECEIVED",
      "RGPD_REQUEST_SUBMITTED",
    ] as const) {
      expect(shouldNotifyWhatsApp(c), c).toBe(false);
    }
  });

  it("faux pour les rendez-vous des candidats apporteurs et des formateurs", () => {
    for (const c of [
      "CALENDLY_INVITEE_CREATED",
      "CALENDLY_INVITEE_CANCELED",
      "CALENDLY_INVITEE_RESCHEDULED",
    ] as const) {
      expect(shouldNotifyWhatsApp(c), c).toBe(false);
    }
  });

  it("AUCUNE catégorie du groupe Système ne part sur WhatsApp", () => {
    const systeme = ALL_NOTIFICATION_CATEGORIES.filter((c) => telegramGroupFor(c) === "system");
    expect(systeme.length).toBeGreaterThan(15);
    for (const c of systeme) {
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
    expect(text).toContain("Marie D.");
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
    process.env.WHATSAPP_NOTIFY_PHONE = "+33755512345";
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    // Demande de devis, et non plus `CONTACT_FORM_SUBMITTED` : ce dernier est
    // sorti du canal WhatsApp le 2026-08-09 (décision Will).
    const result = await notify({
      category: "QUOTE_REQUEST_RECEIVED",
      payload: {
        submissionId: "sub_1",
        contactName: "Marie",
        contactEmail: "marie@example.com",
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
      category: "QUOTE_REQUEST_RECEIVED",
      payload: {
        submissionId: "sub_2",
        contactName: "Jean",
        contactEmail: "jean@example.com",
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
    process.env.WHATSAPP_NOTIFY_PHONE = "+33755512345";
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
