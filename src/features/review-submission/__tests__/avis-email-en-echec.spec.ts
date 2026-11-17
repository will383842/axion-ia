// L5i : l'avis est enregistré AVANT l'envoi du remerciement. Si l'envoi échoue,
// le visiteur ne doit PAS lire « Une erreur est survenue » (il réessaierait et
// créerait un doublon). Chemin normal inchangé.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  enqueueEmail: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: m.captureException }));
vi.mock("@/lib/prisma", () => ({
  prisma: { customerReview: { create: m.create }, city: { findFirst: vi.fn() } },
}));
vi.mock("@/server/crm-sync", () => ({ syncReviewToCrm: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (s: string) => `enc:${s}` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "h" }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: m.enqueueEmail }));
vi.mock("@/lib/admin-path", () => ({ adminPath: () => "/admin/avis" }));
vi.mock("@/server/careers/cv-storage", () => ({ storeCv: vi.fn() }));
vi.mock("@/lib/security/honeypot-observable", () => ({ signalerHoneypot: vi.fn() }));

import { submitReviewAction } from "../actions";

function formulaire(): FormData {
  const f = new FormData();
  f.set("firstName", "Camille");
  f.set("lastName", "Durand");
  f.set("email", "visiteur@example.com");
  f.set("rating", "5");
  f.set("comment", "Très bon accompagnement. ".repeat(10));
  f.set("consent", "true");
  f.set("locale", "fr");
  return f;
}

describe("submitReviewAction — échec de l'envoi du remerciement (L5i)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.create.mockResolvedValue({ id: "avis-1" });
  });

  it("chemin normal : ok, un seul enfilage, Sentry muet", async () => {
    m.enqueueEmail.mockResolvedValue(undefined);
    const r = await submitReviewAction({ ok: false, error: "" }, formulaire());
    expect(r).toEqual({ ok: true, reviewId: "avis-1" });
    expect(m.enqueueEmail).toHaveBeenCalledTimes(1);
    expect(m.captureException).not.toHaveBeenCalled();
  });

  it("enqueueEmail qui lève : ok: true, Sentry appelé, avis créé une seule fois", async () => {
    const panne = new Error("redis indisponible");
    m.enqueueEmail.mockRejectedValue(panne);
    const r = await submitReviewAction({ ok: false, error: "" }, formulaire());
    expect(r).toEqual({ ok: true, reviewId: "avis-1" });
    expect(m.captureException).toHaveBeenCalledWith(panne, expect.anything());
    expect(m.create).toHaveBeenCalledTimes(1);
  });
});
