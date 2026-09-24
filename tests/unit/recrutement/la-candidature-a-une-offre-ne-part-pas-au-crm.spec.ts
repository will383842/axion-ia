// /carrieres ne part PLUS au CRM — l'action, appelée pour de vrai.
//
// ── Pourquoi ce test a été inversé ────────────────────────────────────────
// Il prouvait, à la coupure du tunnel apporteurs, qu'une candidature à une
// offre partait TOUJOURS au CRM : la coupure devait rester chirurgicale. Par
// décision de Will, plus aucune candidature ne franchit la frontière (ADR 0047,
// révision) : le vivier est tenu par la console du site.
//
// Même `FormData`, mêmes simulations : seule l'attente change de sens. Et le
// test vérifie que RIEN D'AUTRE n'a été coupé — la ligne est créée, l'accusé de
// réception et la notification partent toujours.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitConfig, RateLimitResult } from "@/lib/rate-limit";

const { creerCandidature, trouverOffre, emettreVersCrm, notifier, mettreEnFile } = vi.hoisted(
  () => ({
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
    notifier: vi.fn(async (_a: unknown) => ({ ok: true })),
    mettreEnFile: vi.fn(async (..._a: unknown[]) => undefined),
  }),
);

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
vi.mock("@/server/notifications", () => ({ notify: (a: unknown) => notifier(a) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => mettreEnFile(...a),
}));
// Simulé quand même : si l'import revenait, le test verrait l'appel au lieu
// d'écrire en base ou de lever.
vi.mock("@/server/crm-sync", () => ({
  syncCandidateToCrm: (a: unknown) => emettreVersCrm(a),
  syncFormSubmissionToCrm: (a: unknown) => emettreVersCrm(a),
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
  fd.set("email", "camille@example.invalid");
  // Numéro de la plage réservée à la fiction par l'ARCEP (06 39 98) : attribuable à personne.
  fd.set("phone", "0639980001");
  fd.set("city", "Grenoble");
  fd.set("consent", "true");
  fd.set("locale", "fr");
  fd.set("cf-turnstile-response", "jeton");
  return fd;
}

describe("/carrieres ne part plus au CRM (ADR 0047, révision)", () => {
  beforeEach(() => {
    creerCandidature.mockClear();
    trouverOffre.mockClear();
    emettreVersCrm.mockClear();
    notifier.mockClear();
    mettreEnFile.mockClear();
  });

  it("une candidature à une offre publiée n'appelle pas la synchro CRM", async () => {
    const r = await submitJobApplicationAction({ ok: false, error: "" }, candidatureAUneOffre());

    // Contre-témoin : une candidature refusée n'appellerait rien, et le test
    // ci-dessous serait vert pour une mauvaise raison.
    expect(r.ok, `refusée : ${"error" in r ? r.error : ""}`).toBe(true);
    expect(creerCandidature).toHaveBeenCalledTimes(1);
    expect(trouverOffre).toHaveBeenCalled();

    expect(
      emettreVersCrm,
      "aucune candidature ne franchit la frontière vers le CRM (ADR 0047, révision)",
    ).not.toHaveBeenCalled();
  });

  it("rien d'autre n'est coupé : accusé de réception et notification partent", async () => {
    const r = await submitJobApplicationAction({ ok: false, error: "" }, candidatureAUneOffre());

    expect(r.ok).toBe(true);
    expect(notifier).toHaveBeenCalledTimes(1);
    expect(mettreEnFile).toHaveBeenCalledTimes(1);
    expect(mettreEnFile.mock.calls[0]?.[0]).toBe("candidature-recue");
    expect(mettreEnFile.mock.calls[0]?.[1]).toBe("camille@example.invalid");
  });
});
