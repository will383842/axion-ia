// Tests Server Action — Sprint X.5bis (parcours B devis qualifié).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks pour rester en tests purs Zod (la persistance Prisma est testée
// en intégration séparément).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      create: vi.fn().mockResolvedValue({ id: "00000000-0000-0000-0000-000000000aaa" }),
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2 }),
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/telegram", () => ({
  sendTelegram: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn().mockResolvedValue("203.0.113.42"),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: (k: string) =>
      k === "user-agent" ? "Mozilla/5.0 test" : k === "referer" ? "https://axion-ia.com/" : null,
  }),
}));

import { submitQuoteRequestAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

function validFormData(overrides: Partial<Record<string, string>> = {}): FormData {
  const base: Record<string, string> = {
    companyName: "Acme Corp",
    companySize: "pme",
    companySector: "Tech / SaaS",
    contactName: "Jean Dupont",
    contactEmail: "jean@acme.com",
    contactPhone: "+33612345678",
    contextBusiness:
      "Nous sommes une PME de 50 salariés dans le SaaS B2B. Nous voulons automatiser notre support client niveau 1 via un agent IA + accompagner nos équipes commerciales sur la qualification de leads. Budget évolutif selon ROI, timing flexible mais idéalement avant fin Q3 pour anticiper la rentrée commerciale.",
    city: "Lyon",
    willingToTravel: "true",
    consentTerms: "true",
    consentGdpr: "true",
    locale: "fr",
    "cf-turnstile-response": "test-token",
  };
  const merged: Record<string, string> = { ...base, ...overrides } as Record<string, string>;
  const fd = new FormData();
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === "string") fd.set(k, v);
  }
  return fd;
}

describe("submitQuoteRequestAction — Sprint X.5bis", () => {
  it("happy path : submit valide retourne { ok:true, submissionId }", async () => {
    const result = await submitQuoteRequestAction({ ok: false, error: "" }, validFormData());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submissionId).toBe("00000000-0000-0000-0000-000000000aaa");
    }
  });

  it("rejette si rate-limit atteint", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
    });
    const result = await submitQuoteRequestAction({ ok: false, error: "" }, validFormData());
    expect(result).toEqual({ ok: false, error: "Trop de demandes. Réessayez plus tard." });
  });

  it("rejette si Turnstile fail", async () => {
    const { verifyTurnstile } = await import("@/lib/turnstile");
    (verifyTurnstile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const result = await submitQuoteRequestAction({ ok: false, error: "" }, validFormData());
    expect(result).toEqual({ ok: false, error: "Captcha échoué." });
  });

  it("honeypot rempli retourne OK silencieusement", async () => {
    const fd = validFormData();
    fd.set("website", "https://spam.example.com");
    const result = await submitQuoteRequestAction({ ok: false, error: "" }, fd);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.submissionId).toBe("honeypot");
  });

  it("rejette si contextBusiness < 200 chars", async () => {
    const result = await submitQuoteRequestAction(
      { ok: false, error: "" },
      validFormData({ contextBusiness: "Trop court." }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/200 caractères/);
  });

  it("rejette si companySize hors enum INSEE", async () => {
    const result = await submitQuoteRequestAction(
      { ok: false, error: "" },
      validFormData({ companySize: "moyenne-entreprise" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Taille INSEE/);
  });

  it("rejette si consentement CGV absent", async () => {
    const result = await submitQuoteRequestAction(
      { ok: false, error: "" },
      validFormData({ consentTerms: "false" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/CGV/i);
  });

  it("rejette email invalide", async () => {
    const result = await submitQuoteRequestAction(
      { ok: false, error: "" },
      validFormData({ contactEmail: "pas-un-email" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Email/i);
  });
});
