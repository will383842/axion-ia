// Tests DocuSeal client (Sprint X.3 — Booking V1)
//
// Tests purs : pas d'appel réseau (fetch mocké via vi). Couvre :
//   - isDocusealConfigured / isDocusealWebhookConfigured gates
//   - verifyWebhookSignature (HMAC-SHA256 timing-safe)
//   - parseWebhookPayload (parsing + idempotence id)
//   - createSubmission shape attendue (mock fetch)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  isDocusealConfigured,
  isDocusealWebhookConfigured,
  verifyWebhookSignature,
  parseWebhookPayload,
  createSubmission,
  DocusealApiError,
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

  it("retourne true pour signature valide", () => {
    const body = '{"event":"form.completed"}';
    const sig = createHmac("sha256", "test-secret-32chars-min-len-ok").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
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

  it("throw si event_id absent (idempotence impossible)", () => {
    const raw = JSON.stringify({ event_type: "form.completed" });
    expect(() => parseWebhookPayload(raw)).toThrow(/event_id/);
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

describe("docuseal — createSubmission (fetch mocké)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["DOCUSEAL_BASE_URL"] = "https://docuseal.example.com";
    process.env["DOCUSEAL_API_KEY"] = "test-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("POST /api/submissions avec body correct + retourne submissionId/embedUrl", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 1,
            submission_id: 42,
            embed_src: "https://docuseal.example.com/s/abc",
            email: "client@example.com",
            name: "John Doe",
            status: "pending",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await createSubmission({
      templateId: 1,
      signers: [{ email: "client@example.com", name: "John Doe" }],
      fields: [{ name: "amount", default_value: "1500 EUR" }],
      sendEmail: false,
      metadata: { bookingId: "uuid-1" },
    });

    expect(result.submissionId).toBe("42");
    expect(result.embedUrl).toBe("https://docuseal.example.com/s/abc");
    expect(result.status).toBe("pending");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://docuseal.example.com/api/submissions");
    const reqInit = init as RequestInit;
    expect(reqInit.method).toBe("POST");
    const headers = reqInit.headers as Record<string, string>;
    expect(headers["X-Auth-Token"]).toBe("test-key");
    const body = JSON.parse(reqInit.body as string);
    expect(body.template_id).toBe(1);
    expect(body.submitters).toHaveLength(1);
    expect(body.submitters[0].email).toBe("client@example.com");
  });

  it("throw DocusealApiError si 400 retourné", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Bad Request", { status: 400 }));
    await expect(
      createSubmission({
        templateId: 1,
        signers: [{ email: "x@y.z" }],
      }),
    ).rejects.toBeInstanceOf(DocusealApiError);
  });

  it("throw si tableau vide retourné", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await expect(
      createSubmission({
        templateId: 1,
        signers: [{ email: "x@y.z" }],
      }),
    ).rejects.toThrow(/empty submission/);
  });
});
