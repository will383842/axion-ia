/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HASH_OK,
  NON_UTILISATEUR,
  UTILISATEUR,
} from "@/lib/barometre-questionnaire/__tests__/_commun";

const { createMock, rlMock, tsMock, ouvertMock, sentryMock, ipMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  rlMock: vi.fn(),
  tsMock: vi.fn(),
  ouvertMock: vi.fn(),
  sentryMock: vi.fn(),
  ipMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { barometreQuestionnaireReponse: { create: createMock } },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: rlMock }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: ipMock }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: tsMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: sentryMock }));
vi.mock("@/lib/barometre-questionnaire/constantes", async (original) => ({
  ...(await original<typeof import("@/lib/barometre-questionnaire/constantes")>()),
  estOuvert: ouvertMock,
}));

import { envoyerReponsesBarometre } from "../envoyer";

const IP = "203.0.113.9";
const lent = { startedAt: Date.now() - 60_000 };

describe("envoyerReponsesBarometre", () => {
  beforeEach(() => {
    for (const m of [createMock, rlMock, tsMock, ouvertMock, sentryMock, ipMock]) m.mockReset();
    rlMock.mockResolvedValue({ allowed: true });
    tsMock.mockResolvedValue(true);
    ouvertMock.mockReturnValue(true);
    ipMock.mockResolvedValue(IP);
    createMock.mockResolvedValue({});
  });
  afterEach(() => vi.useRealTimers());

  it("écrit une ligne pour une réponse valide", async () => {
    const r = await envoyerReponsesBarometre({
      ...UTILISATEUR,
      ...lent,
      q15: "  Mes devis ",
      q16: "RGPD ?",
    });
    expect(r).toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledTimes(1);
    const { data } = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.campagne).toBe("barometre-2027");
    expect(data.questionnaireVersion).toBe("q-v5");
    expect(data.consentVersion).toBe("barometre-q-v2");
    expect(data.codeRetraitHash).toBe(HASH_OK);
    expect(data.texteUsage).toBe("Mes devis");
    expect(data.texteQuestion).toBe("RGPD ?");
  });

  it("sans consentement : aucun create", async () => {
    const r = await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent, consentement: false });
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
    const r2 = await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent, consentement: undefined });
    expect(r2.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("questionnaire fermé : message dédié, aucun create, rien d'autre appelé", async () => {
    ouvertMock.mockReturnValue(false);
    const r = await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent });
    expect(r).toEqual({ ok: false, error: "Le questionnaire est fermé." });
    expect(createMock).not.toHaveBeenCalled();
    expect(rlMock).not.toHaveBeenCalled();
    expect(tsMock).not.toHaveBeenCalled();
  });

  it("pot de miel rempli : succès silencieux, aucun create", async () => {
    const r = await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent, website: "http://spam" });
    expect(r).toEqual({ ok: true });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("envoi trop rapide (< 3 s) : succès silencieux, aucun create", async () => {
    const r = await envoyerReponsesBarometre({ ...UTILISATEUR, startedAt: Date.now() - 500 });
    expect(r).toEqual({ ok: true });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("Turnstile refusé : aucun create", async () => {
    tsMock.mockResolvedValue(false);
    const r = await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent });
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("limite de débit dépassée : aucun create, clé sans IP en clair", async () => {
    rlMock.mockResolvedValue({ allowed: false });
    const r = await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent });
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
    const cle = rlMock.mock.calls[0]![0] as string;
    expect(cle.startsWith("barometre-q:")).toBe(true);
    expect(cle).not.toContain(IP);
  });

  it("filtre rejoué côté serveur : q5 envoyé avec q4 « non » refusé", async () => {
    const r = await envoyerReponsesBarometre({ ...NON_UTILISATEUR, ...lent, q5: ["autre"] });
    expect(r).toEqual({ ok: false, error: "Réponses invalides." });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("clé inconnue (email) refusée", async () => {
    const r = await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent, email: "a@b.fr" });
    expect(r.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("aucune clé ni valeur IP / e-mail / agent en base, même si l'IP est 203.0.113.9", async () => {
    await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent, q15: "texte" });
    const { data } = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    const cles = Object.keys(data).join(" ").toLowerCase();
    for (const interdit of [
      "ip",
      "mail",
      "agent",
      "createdat",
      "turnstile",
      "website",
      "startedat",
    ]) {
      expect(cles, interdit).not.toContain(interdit);
    }
    const brut = JSON.stringify(data);
    expect(brut).not.toContain(IP);
    expect(brut).not.toMatch(/@/);
    expect(Object.keys(data.reponses as object).every((k) => /^q\d+$/.test(k))).toBe(true);
  });

  it("q5 à q9 absents de `reponses` pour un non-utilisateur", async () => {
    await envoyerReponsesBarometre({ ...NON_UTILISATEUR, ...lent });
    const { data } = createMock.mock.calls[0]![0] as {
      data: { reponses: Record<string, unknown> };
    };
    for (const k of ["q5", "q6", "q7", "q8", "q9", "q14"])
      expect(data.reponses).not.toHaveProperty(k);
  });

  it("jour tronqué à minuit UTC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-05T17:42:11.123Z"));
    await envoyerReponsesBarometre({ ...UTILISATEUR, startedAt: Date.now() - 60_000 });
    const { data } = createMock.mock.calls[0]![0] as { data: { jour: Date } };
    expect(data.jour.toISOString()).toBe("2026-12-05T00:00:00.000Z");
  });

  it("panne de base : message neutre, Sentry avec un tag seulement, jamais d'extra", async () => {
    createMock.mockRejectedValue(new Error("boom"));
    const r = await envoyerReponsesBarometre({ ...UTILISATEUR, ...lent, q15: "secret libre" });
    expect(r.ok).toBe(false);
    expect(sentryMock).toHaveBeenCalledTimes(1);
    const opts = sentryMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(opts)).toEqual(["tags"]);
    expect(JSON.stringify(sentryMock.mock.calls)).not.toContain("secret libre");
  });
});
