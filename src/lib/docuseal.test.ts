// Tests DocuSeal client (Sprint X.3 — Booking V1)
//
// Tests purs : pas d'appel réseau (fetch mocké via vi). Couvre :
//   - isDocusealConfigured / isDocusealWebhookConfigured gates
//   - verifyWebhookSignature (HMAC-SHA256 timing-safe)
//   - parseWebhookPayload (parsing + idempotence id)

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  isDocusealConfigured,
  isDocusealWebhookConfigured,
  verifyWebhookSignature,
  parseWebhookPayload,
} from "./docuseal";

describe("docuseal — gates de configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["DOCUSEAL_BASE_URL"];
    delete process.env["DOCUSEAL_API_KEY"];
    delete process.env["DOCUSEAL_WEBHOOK_SECRET"];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("isDocusealConfigured → false si BASE_URL absent", () => {
    process.env["DOCUSEAL_API_KEY"] = "test-key";
    expect(isDocusealConfigured()).toBe(false);
  });

  it("isDocusealConfigured → false si API_KEY absent", () => {
    process.env["DOCUSEAL_BASE_URL"] = "https://docuseal.example.com";
    expect(isDocusealConfigured()).toBe(false);
  });

  it("isDocusealConfigured → true si BASE_URL + API_KEY présents", () => {
    process.env["DOCUSEAL_BASE_URL"] = "https://docuseal.example.com";
    process.env["DOCUSEAL_API_KEY"] = "test-key";
    expect(isDocusealConfigured()).toBe(true);
  });

  it("isDocusealWebhookConfigured → true si WEBHOOK_SECRET présent", () => {
    process.env["DOCUSEAL_WEBHOOK_SECRET"] = "secret";
    expect(isDocusealWebhookConfigured()).toBe(true);
  });

  it("isDocusealWebhookConfigured → false sans secret", () => {
    expect(isDocusealWebhookConfigured()).toBe(false);
  });
});

describe("docuseal — verifyWebhookSignature", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["DOCUSEAL_WEBHOOK_SECRET"] = "test-secret-32chars-min-len-ok";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("refuse le format v1 hex64 nu, même parfaitement signé (rejouable : pas d'horodatage)", () => {
    const body = '{"event":"form.completed"}';
    const sig = createHmac("sha256", "test-secret-32chars-min-len-ok").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(false);
  });

  it("n'exporte plus le repli « secret en clair » ni le wrapper dual-mode", async () => {
    const mod = (await import("./docuseal")) as Record<string, unknown>;
    expect(mod["verifyWebhookSecret"]).toBeUndefined();
    expect(mod["verifyWebhookAuth"]).toBeUndefined();
  });

  it("retourne false pour signature corrompue", () => {
    const body = '{"event":"form.completed"}';
    const wrongSig = "0".repeat(64);
    expect(verifyWebhookSignature(body, wrongSig)).toBe(false);
  });

  it("retourne false pour signature null", () => {
    expect(verifyWebhookSignature("body", null)).toBe(false);
  });

  it("retourne false pour signature longueur invalide", () => {
    expect(verifyWebhookSignature("body", "tooshort")).toBe(false);
  });

  it("retourne false pour signature hex invalide (lettres non-hex)", () => {
    const fakeSig = "z".repeat(64); // 64 chars mais pas hex
    expect(verifyWebhookSignature("body", fakeSig)).toBe(false);
  });

  it("comparaison timing-safe — body différent → false", () => {
    const sig1 = createHmac("sha256", "test-secret-32chars-min-len-ok")
      .update("body1")
      .digest("hex");
    expect(verifyWebhookSignature("body2", sig1)).toBe(false);
  });
});

describe("docuseal — parseWebhookPayload", () => {
  it("parse un event form.completed standard", () => {
    const raw = JSON.stringify({
      event_id: "evt_abc123",
      event_type: "form.completed",
      timestamp: "2026-05-13T12:00:00Z",
      data: {
        submission_id: 42,
        metadata: { bookingId: "uuid-booking-1" },
      },
    });
    const parsed = parseWebhookPayload(raw);
    expect(parsed.eventId).toBe("evt_abc123");
    expect(parsed.eventType).toBe("form.completed");
    expect(parsed.submissionId).toBe("42");
    expect(parsed.metadata.bookingId).toBe("uuid-booking-1");
  });

  // 🔴 F4 : DocuSeal 2.5.3 n'envoie PAS `event_id` (corps = `{event_type,
  // timestamp, data}`) — l'ancienne exigence faisait répondre 400 à TOUS les
  // callbacks authentiques. On dérive une clé déterministe, et c'est ce
  // déterminisme qu'il faut verrouiller : `data` embarque des URLs signées
  // régénérées à chaque tentative, donc une clé calculée sur le bloc `data`
  // entier changerait à chaque retry et la contrainte UNIQUE ne dédupliquerait
  // plus rien.
  it("dérive une clé d'idempotence stable quand event_id est absent", () => {
    const commun = {
      event_type: "form.completed",
      timestamp: "2026-07-26T10:00:00.000Z",
    };
    const first = parseWebhookPayload(
      JSON.stringify({
        ...commun,
        data: {
          id: 7,
          submission_id: 42,
          metadata: { devisId: "d-1", kind: "devis" },
          audit_log_url: "https://ds.example.com/a?exp=111",
          documents: [{ url: "https://ds.example.com/d?exp=111" }],
          updated_at: "2026-07-26T10:00:00.000Z",
        },
      }),
    );
    expect(first.eventId).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Colonne docuseal_event_id = VarChar(120).
    expect(first.eventId.length).toBeLessThanOrEqual(120);
    expect(first.metadata.devisId).toBe("d-1");
    expect(first.submissionId).toBe("42");

    // Retry DocuSeal : mêmes identifiants, mais URLs signées REGÉNÉRÉES
    // (`expires_at` = 40 min à partir de maintenant) et `updated_at` bougé.
    const retry = parseWebhookPayload(
      JSON.stringify({
        ...commun,
        data: {
          id: 7,
          submission_id: 42,
          metadata: { devisId: "d-1", kind: "devis" },
          audit_log_url: "https://ds.example.com/a?exp=999",
          documents: [{ url: "https://ds.example.com/d?exp=999" }],
          updated_at: "2026-07-26T10:07:31.000Z",
        },
      }),
    );
    expect(retry.eventId).toBe(first.eventId);

    // Deux signataires du même document = deux data.id = deux clés distinctes.
    const contreSignataire = parseWebhookPayload(
      JSON.stringify({ ...commun, data: { id: 8, submission_id: 42 } }),
    );
    expect(contreSignataire.eventId).not.toBe(first.eventId);
  });

  it("utilise event_id verbatim quand DocuSeal en fournit un", () => {
    const raw = JSON.stringify({
      event_id: "evt_explicite",
      event_type: "form.completed",
      data: { id: 1 },
    });
    expect(parseWebhookPayload(raw).eventId).toBe("evt_explicite");
  });

  it("throw si event_type absent", () => {
    const raw = JSON.stringify({ event_id: "evt_1" });
    expect(() => parseWebhookPayload(raw)).toThrow(/event_type/);
  });

  it("fallback metadata vide si non fournie", () => {
    const raw = JSON.stringify({
      event_id: "evt_1",
      event_type: "form.started",
      data: { submission_id: "sub_1" },
    });
    const parsed = parseWebhookPayload(raw);
    expect(parsed.metadata).toEqual({});
  });

  it("supporte submission_id à la racine (variante DocuSeal)", () => {
    const raw = JSON.stringify({
      event_id: "evt_2",
      event_type: "form.viewed",
      submission_id: "sub_99",
    });
    const parsed = parseWebhookPayload(raw);
    expect(parsed.submissionId).toBe("sub_99");
  });
});

describe("docuseal — signature webhook v2 (format réellement émis par DocuSeal 2.5.3)", () => {
  const originalEnv = { ...process.env };
  const SECRET = "test-secret-32chars-min-len-ok";

  beforeEach(() => {
    process.env["DOCUSEAL_WEBHOOK_SECRET"] = SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  /** Réplique exacte de `WebhookUrls::Signatures.sign` (DocuSeal 2.5.3). */
  function signV2(body: string, ts: number): string {
    return `${ts}.${createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex")}`;
  }

  it("accepte `<timestamp>.<hex64>` signé sur `<ts>.<corps>`", () => {
    const body = '{"event_type":"form.completed"}';
    const ts = Math.floor(Date.now() / 1000);
    const header = signV2(body, ts);
    expect(header).toHaveLength(String(ts).length + 65);
    expect(verifyWebhookSignature(body, header)).toBe(true);
  });

  it("refuse un header v2 dont le HMAC porte sur le CORPS SEUL (l'ancien message)", () => {
    const body = '{"event_type":"form.completed"}';
    const ts = Math.floor(Date.now() / 1000);
    const digestSansTs = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, `${ts}.${digestSansTs}`)).toBe(false);
  });

  it("refuse un timestamp hors de la fenêtre de 300 s (alignée sur l'émetteur)", () => {
    const body = "{}";
    const now = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(body, signV2(body, now - 7200))).toBe(false);
    expect(verifyWebhookSignature(body, signV2(body, now + 7200))).toBe(false);
    expect(verifyWebhookSignature(body, signV2(body, now - 290))).toBe(true);
  });

  it("refuse un digest v2 non hexadécimal", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature("{}", `${ts}.${"z".repeat(64)}`)).toBe(false);
  });

  it("le format legacy hex64 nu est refusé", () => {
    const body = '{"event":"form.completed"}';
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(false);
  });
});
