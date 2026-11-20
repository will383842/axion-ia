/**
 * @vitest-environment node
 *
 * Retrait : limité à source = score-ia-pme et à la ligne du code ; réponse
 * identique que le code existe ou non.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HASH_OK } from "./_commun";

const { deleteManyMock, rlMock, turnstileMock } = vi.hoisted(() => ({
  deleteManyMock: vi.fn(),
  rlMock: vi.fn(),
  turnstileMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { barometerResponse: { deleteMany: deleteManyMock } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: rlMock }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: turnstileMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { retirerReponsesScore } from "../retirer";

describe("retirerReponsesScore", () => {
  beforeEach(() => {
    deleteManyMock.mockReset();
    rlMock.mockReset();
    turnstileMock.mockReset();
    rlMock.mockResolvedValue({ allowed: true });
    turnstileMock.mockResolvedValue(true);
  });

  it("ne supprime que source = score-ia-pme ET la ligne du code", async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });
    await retirerReponsesScore({ empreinte: HASH_OK, turnstileToken: "j" });
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    expect(deleteManyMock.mock.calls[0]![0]).toEqual({
      where: { codeRetraitHash: HASH_OK, source: "score-ia-pme" },
    });
  });

  it("même réponse pour un code connu ou inconnu", async () => {
    deleteManyMock.mockResolvedValueOnce({ count: 1 });
    const a = await retirerReponsesScore({ empreinte: HASH_OK, turnstileToken: "j" });
    deleteManyMock.mockResolvedValueOnce({ count: 0 });
    const b = await retirerReponsesScore({ empreinte: "b".repeat(64), turnstileToken: "j" });
    expect(b).toEqual(a);
    expect(a.ok).toBe(true);
  });

  it("erreur serveur : ok false, message identique pour un code connu ou inconnu (art. 7.3)", async () => {
    deleteManyMock.mockRejectedValueOnce(new Error("db"));
    const c = await retirerReponsesScore({ empreinte: HASH_OK, turnstileToken: "j" });
    deleteManyMock.mockRejectedValueOnce(new Error("db"));
    const d = await retirerReponsesScore({ empreinte: "c".repeat(64), turnstileToken: "j" });
    expect(c.ok).toBe(false);
    expect(d).toEqual(c);
    expect((c as { error: string }).error).toBe(
      "Le retrait n'a pas pu être fait. Rien n'a changé : réessayez dans quelques minutes, avec le même code.",
    );
  });

  it("entrée invalide ou Turnstile refusé : aucune suppression", async () => {
    await retirerReponsesScore({ empreinte: "pas-un-hash", turnstileToken: "j" });
    await retirerReponsesScore({ empreinte: HASH_OK, turnstileToken: "j", extra: 1 });
    turnstileMock.mockResolvedValue(false);
    await retirerReponsesScore({ empreinte: HASH_OK, turnstileToken: "j" });
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("la clé de limite de débit ne contient pas l'IP", async () => {
    deleteManyMock.mockResolvedValue({ count: 0 });
    await retirerReponsesScore({ empreinte: HASH_OK, turnstileToken: "j" });
    expect(rlMock.mock.calls[0]![0]).not.toContain("203.0.113.7");
  });
});
