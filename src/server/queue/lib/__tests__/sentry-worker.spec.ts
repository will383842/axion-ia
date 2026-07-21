/**
 * Sprint S+4 action C — Tests helpers Sentry workers BullMQ (audit content-gen
 * deep 2026-05-18 gap P1-7).
 *
 * Couvre :
 *  - `captureWorkerError()` : appel Sentry avec tags + extras + fingerprint
 *  - `sanitizeJobData()` : redaction emails / tokens / secrets / PII
 *  - Fingerprint déterministe pour groupage Sentry dashboard
 *  - Fail-soft : un crash Sentry ne casse pas le worker (try/catch global)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted pour partager refs avec vi.mock factories) ──────────

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

// ─── Imports après mocks ───────────────────────────────────────────────────

import { captureWorkerError } from "../sentry-worker";
import { sanitizeJobData } from "../sanitize-job-data";

beforeEach(() => {
  captureExceptionMock.mockReset();
});

// ─── sanitizeJobData ───────────────────────────────────────────────────────

describe("sanitizeJobData", () => {
  it("returns null for non-object input", () => {
    expect(sanitizeJobData(null)).toBeNull();
    expect(sanitizeJobData(undefined)).toBeNull();
    expect(sanitizeJobData("string")).toBeNull();
    expect(sanitizeJobData(42)).toBeNull();
    expect(sanitizeJobData([1, 2, 3])).toBeNull();
  });

  it("redacts sensitive keys regardless of value type", () => {
    const out = sanitizeJobData({
      apiKey: "sk-prod-12345",
      password: "hunter2",
      DATABASE_URL: "postgres://u:p@h:5432/d",
      jobId: "publish-abc-123",
      campaignName: "Q3 RSS push",
    });
    expect(out).toMatchObject({
      apiKey: "[REDACTED]",
      password: "[REDACTED]",
      DATABASE_URL: "[REDACTED]",
      jobId: "publish-abc-123",
      campaignName: "Q3 RSS push",
    });
  });

  it("redacts emails on email-typed keys", () => {
    const out = sanitizeJobData({
      author_email: "jean.dupont@acme.com",
      contact_email: "jo@a.io",
      jobId: "x",
    });
    // Local ≥ 2 chars → `<first>****@<domain>`
    expect(out?.["author_email"]).toBe("j****@acme.com");
    expect(out?.["contact_email"]).toBe("j****@a.io");
  });

  it("redacts single-char local part to full mask via EMAIL_KEYS path", () => {
    const out = sanitizeJobData({ email: "x@a.io" });
    // EMAIL_KEYS path → redactEmailValue : single-char local → full mask
    expect(out?.["email"]).toBe("*@a.io");
  });

  it("redacts phones on phone-typed keys", () => {
    const out = sanitizeJobData({
      phone: "+33 6 12 34 56 78",
      contact_phone: "0612345678",
    });
    expect(out?.["phone"]).toContain("+33");
    expect(out?.["phone"]).toContain("5678");
    expect(out?.["contact_phone"]).toContain("5678");
  });

  it("redacts secrets inside free string values (filet de sécurité)", () => {
    const out = sanitizeJobData({
      log: "API call with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3O.signature_abcdefghijklmnop",
      promptExcerpt: "Contact us at jean.dupont@acme.com for details",
    });
    expect(out?.["log"]).toContain("[REDACTED]");
    expect(out?.["log"]).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(out?.["promptExcerpt"]).toContain("j****@acme.com");
    expect(out?.["promptExcerpt"]).not.toContain("jean.dupont@acme.com");
  });

  it("redacts OpenAI/Anthropic API key patterns", () => {
    const out = sanitizeJobData({
      providerErr: "401 from sk-proj-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa rejected by OpenAI",
      anthropicErr: "Invalid key: sk-ant-api03-xxxxxxxxxxxxxxxxxxxx",
    });
    expect(out?.["providerErr"]).toContain("[REDACTED]");
    expect(out?.["providerErr"]).not.toContain("sk-proj-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(out?.["anthropicErr"]).toContain("[REDACTED]");
  });

  it("preserves non-sensitive operational fields untouched", () => {
    const out = sanitizeJobData({
      jobId: "gen-abc-123",
      contentType: "blog_from_rss",
      campaignId: "uuid-xyz",
      attempts: 2,
      score: 78.5,
      isNews: true,
    });
    expect(out).toEqual({
      jobId: "gen-abc-123",
      contentType: "blog_from_rss",
      campaignId: "uuid-xyz",
      attempts: 2,
      score: 78.5,
      isNews: true,
    });
  });

  it("recursively sanitizes nested objects", () => {
    const out = sanitizeJobData({
      inputPayload: {
        author_email: "xavier@y.io",
        api_key: "sk-something-secret-abcdefghijklmnop",
        nested: {
          authorization: "Bearer abcdefghijklmnopqrstuvwx",
          campaignName: "OK keep",
        },
      },
    });
    const input = out?.["inputPayload"] as Record<string, unknown>;
    expect(input["author_email"]).toBe("x****@y.io");
    expect(input["api_key"]).toBe("[REDACTED]");
    const nested = input["nested"] as Record<string, unknown>;
    expect(nested["authorization"]).toBe("[REDACTED]");
    expect(nested["campaignName"]).toBe("OK keep");
  });

  it("caps recursion depth (no infinite loop on cyclic structures)", () => {
    type Recursive = { level: number; child?: Recursive };
    const cyclic: Recursive = { level: 1 };
    let cur = cyclic;
    for (let i = 2; i < 20; i++) {
      cur.child = { level: i };
      cur = cur.child;
    }
    const out = sanitizeJobData(cyclic);
    expect(out).toBeDefined();
    // Ne crash pas, et tronque quelque part avant niveau 20.
    expect(JSON.stringify(out)).toContain("MAX_DEPTH");
  });
});

// ─── captureWorkerError ────────────────────────────────────────────────────

describe("captureWorkerError", () => {
  it("calls Sentry.captureException with worker/queue tags + sanitized extras", () => {
    const fakeJob = {
      id: "publish-job-42",
      name: "publish",
      data: {
        reviewQueueId: "rq-uuid",
        password: "leak-attempt",
        contactEmail: "victor@w.io",
      },
      attemptsMade: 2,
      failedReason: "Prisma timeout",
      timestamp: 1700000000000,
    } as unknown as Parameters<typeof captureWorkerError>[2];

    const err = new Error("DB connection lost");
    err.name = "PrismaClientKnownRequestError";

    captureWorkerError("publish", "content-publish", fakeJob, err);

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [capturedErr, ctx] = captureExceptionMock.mock.calls[0]!;
    expect(capturedErr).toBe(err);

    // Tags
    expect(ctx.tags.worker).toBe("publish");
    expect(ctx.tags.queue).toBe("content-publish");
    expect(ctx.tags.jobId).toBe("publish-job-42");
    expect(ctx.tags.jobName).toBe("publish");

    // Extras avec sanitization
    expect(ctx.extra.jobId).toBe("publish-job-42");
    expect(ctx.extra.attemptsMade).toBe(2);
    expect(ctx.extra.failedReason).toBe("Prisma timeout");
    expect(ctx.extra.queueName).toBe("content-publish");
    const sanitized = ctx.extra.jobData as Record<string, unknown>;
    expect(sanitized.reviewQueueId).toBe("rq-uuid");
    expect(sanitized.password).toBe("[REDACTED]");
    // `contactEmail` (camelCase) → lowercased = `contactemail` ∈ EMAIL_KEYS,
    // donc redactEmailValue() est appliqué. Local ≥ 2 chars → `<first>****@<domain>`.
    expect(sanitized.contactEmail).toBe("v****@w.io");

    // Fingerprint
    expect(ctx.fingerprint).toEqual([
      "publish",
      "PrismaClientKnownRequestError",
      "DB connection lost",
    ]);
  });

  it("works when job is undefined (pre-pickup error)", () => {
    const err = new Error("Redis disconnected");
    captureWorkerError("gen", "content-gen", undefined, err);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [, ctx] = captureExceptionMock.mock.calls[0]!;
    expect(ctx.tags.worker).toBe("gen");
    expect(ctx.tags.queue).toBe("content-gen");
    expect(ctx.tags.jobId).toBeUndefined();
    expect(ctx.extra.jobId).toBeNull();
    expect(ctx.extra.jobData).toBeNull();
  });

  it("normalizes non-Error throwables", () => {
    captureWorkerError("indexnow", "content-indexnow", undefined, "boom string");
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [capturedErr] = captureExceptionMock.mock.calls[0]!;
    expect(capturedErr).toBeInstanceOf(Error);
    expect((capturedErr as Error).message).toBe("boom string");
  });

  it("fail-soft : a crash inside Sentry capture does not throw", () => {
    captureExceptionMock.mockImplementationOnce(() => {
      throw new Error("Sentry DSN unreachable");
    });
    // AUDIT 2026-07-21 — ce chemin logue désormais en `error`, plus en `warn` :
    // un helper d'observabilité qui échoue en silence est pire que pas
    // d'observabilité du tout (c'est ce qui a masqué la panne de quota OpenAI).
    // Le comportement fail-soft lui-même est inchangé : on ne cascade pas.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => {
      captureWorkerError("orchestrator", "content-orchestrator", undefined, new Error("inner"));
    }).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[sentry-worker] capture failed for orchestrator/content-orchestrator",
      ),
      expect.any(String),
    );
    errorSpy.mockRestore();
  });

  it("produces stable fingerprint for grouping (idempotent on same error)", () => {
    const err = new Error("Same error message");
    err.name = "TimeoutError";

    captureWorkerError("publish", "content-publish", undefined, err);
    captureWorkerError("publish", "content-publish", undefined, err);

    expect(captureExceptionMock).toHaveBeenCalledTimes(2);
    const fp1 = captureExceptionMock.mock.calls[0]![1].fingerprint;
    const fp2 = captureExceptionMock.mock.calls[1]![1].fingerprint;
    expect(fp1).toEqual(fp2);
  });

  it("truncates fingerprint message to 100 chars (anti cardinality explosion)", () => {
    const longMsg = "x".repeat(500);
    const err = new Error(longMsg);
    captureWorkerError("gen", "content-gen", undefined, err);
    const [, ctx] = captureExceptionMock.mock.calls[0]!;
    const msgInFp = (ctx.fingerprint as string[])[2]!;
    expect(msgInFp.length).toBeLessThanOrEqual(100);
  });
});
