// /carrieres part TOUJOURS au CRM — le témoin de la coupure apporteur.
//
// ── Pourquoi ce test accompagne la décision B2 ────────────────────────────
// Le 19/09, l'envoi au CRM du dossier APPORTEUR est coupé. La famille
// `candidat_commercial` qu'il utilisait est pourtant partagée : `/carrieres`
// la produit aussi pour ses offres commerciales (`candidate-family.ts`). Une
// coupure trop large — un drapeau, une fonction d'émission neutralisée — ferait
// taire les candidatures aux offres, qui relèvent, elles, de la frontière de
// l'ADR 0047 (la console pilote, le CRM garde le vivier).
//
// Ce test prouve que la coupure est CHIRURGICALE : une candidature à une offre
// publiée appelle toujours `syncCandidateToCrm`.
//
// ⚠️ Il vit hors de `src/features/job-application/` exprès : l'unité P2 ne
// touche aucun fichier de ce dossier (critère d'arrêt).

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitConfig, RateLimitResult } from "@/lib/rate-limit";

const { creerCandidature, trouverOffre, emettreVersCrm } = vi.hoisted(() => ({
  creerCandidature: vi.fn(async (_a: unknown) => ({
    id: "app-offre-1",
    submittedAt: new Date("2026-09-19T09:00:00Z"),
  })),
  trouverOffre: vi.fn(async (_a: unknown) => ({
    id: "44444444-4444-4444-8444-444444444444",
    slug: "chargee-de-communication",
    titleFr: "Chargé(e) de communication (F/H)",
    category: "communication",
    status: "published",
    filledAt: null,
    validThrough: null,
  })),
  emettreVersCrm: vi.fn(async (_a: unknown) => undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (_cle: string, config: RateLimitConfig): Promise<RateLimitResult> => ({
    allowed: true,
    count: 1,
    remaining: config.limit - 1,
    resetAt: 0,
    panne: false,
  }),
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.20" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOffer: { findUnique: (a: unknown) => trouverOffre(a) },
    jobApplication: { create: (a: unknown) => creerCandidature(a) },
  },
}));
vi.mock("@/server/careers/cv-storage", () => ({
  storeCv: async () => "/var/data/cv/x/CV.pdf",
  CV_MAX_BYTES: 8 * 1024 * 1024,
  CV_ALLOWED_EXTENSIONS: [".pdf", ".doc", ".docx"] as const,
  CV_ALLOWED_MIME: ["application/pdf"] as const,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `enc:${v}` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/server/notifications", () => ({ notify: async () => ({ ok: true }) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: async () => undefined }));
vi.mock("@/server/crm-sync", () => ({
  syncCandidateToCrm: (a: unknown) => emettreVersCrm(a),
}));
vi.mock("@/lib/consents", () => ({
  recordConsentEvent: async () => true,
  CONSENT_FORM_REFS: {
    jobApplication: "job-application-form",
    jobApplicationVivier: "job-application-vivier",
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: () => "/admin" }));

import { submitJobApplicationAction } from "@/features/job-application/actions";

function candidatureAUneOffre(): FormData {
  const fd = new FormData();
  fd.set("offerId", "44444444-4444-4444-8444-444444444444");
  fd.set("firstName", "Camille");
  fd.set("lastName", "Roux");
  fd.set("email", "camille@example.com");
  fd.set("phone", "0600000001");
  fd.set("city", "Grenoble");
  fd.set("consent", "true");
  fd.set("locale", "fr");
  fd.set("cf-turnstile-response", "jeton");
  return fd;
}

describe("/carrieres part toujours au CRM après la coupure apporteur", () => {
  beforeEach(() => {
    creerCandidature.mockClear();
    trouverOffre.mockClear();
    emettreVersCrm.mockClear();
  });

  it("une candidature à une offre publiée appelle syncCandidateToCrm", async () => {
    const r = await submitJobApplicationAction({ ok: false, error: "" }, candidatureAUneOffre());

    // Contre-témoin : une candidature refusée n'appellerait rien, et le test
    // ci-dessous serait rouge pour une mauvaise raison.
    expect(r.ok, `refusée : ${"error" in r ? r.error : ""}`).toBe(true);
    expect(creerCandidature).toHaveBeenCalledTimes(1);

    expect(
      emettreVersCrm,
      "la coupure du 19/09 ne vise que le dossier apporteur, jamais /carrieres",
    ).toHaveBeenCalledTimes(1);
    const evenement = emettreVersCrm.mock.calls[0]?.[0] as {
      subjectRef: string;
      sourceSlug: string;
    };
    expect(evenement.subjectRef).toBe("site:job_application:app-offre-1");
    expect(evenement.sourceSlug).toBe("site-candidature-offre");
  });
});
