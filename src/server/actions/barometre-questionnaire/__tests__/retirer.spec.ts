/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HASH_OK } from "@/lib/barometre-questionnaire/__tests__/_commun";

const { deleteMock, rlMock, tsMock, ouvertMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  rlMock: vi.fn(),
  tsMock: vi.fn(),
  ouvertMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { barometreQuestionnaireReponse: { deleteMany: deleteMock } },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: rlMock }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: tsMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/barometre-questionnaire/constantes", async (original) => ({
  ...(await original<typeof import("@/lib/barometre-questionnaire/constantes")>()),
  estOuvert: ouvertMock,
}));

import { retirerReponsesQuestionnaire } from "../retirer";

describe("retirerReponsesQuestionnaire", () => {
  beforeEach(() => {
    for (const m of [deleteMock, rlMock, tsMock, ouvertMock]) m.mockReset();
    rlMock.mockResolvedValue({ allowed: true });
    tsMock.mockResolvedValue(true);
    ouvertMock.mockReturnValue(false);
  });

  it("supprime par empreinte ET par campagne, rien d'autre", async () => {
    deleteMock.mockResolvedValue({ count: 1 });
    const r = await retirerReponsesQuestionnaire({ empreinte: HASH_OK, turnstileToken: "j" });
    expect(r.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({
      where: { codeRetraitHash: HASH_OK, campagne: "barometre-2027" },
    });
  });

  it("même message que le code existe ou non", async () => {
    deleteMock.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const a = await retirerReponsesQuestionnaire({ empreinte: HASH_OK, turnstileToken: "j" });
    const b = await retirerReponsesQuestionnaire({
      empreinte: "b".repeat(64),
      turnstileToken: "j",
    });
    expect(a).toEqual(b);
  });

  it("fonctionne quand le questionnaire est fermé", async () => {
    ouvertMock.mockReturnValue(false);
    deleteMock.mockResolvedValue({ count: 1 });
    const r = await retirerReponsesQuestionnaire({ empreinte: HASH_OK, turnstileToken: "j" });
    expect(r.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("empreinte mal formée ou clé en trop : refusé, aucune suppression", async () => {
    expect((await retirerReponsesQuestionnaire({ empreinte: "abc", turnstileToken: "j" })).ok).toBe(
      false,
    );
    expect(
      (
        await retirerReponsesQuestionnaire({
          empreinte: HASH_OK,
          turnstileToken: "j",
          campagne: "x",
        })
      ).ok,
    ).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("Turnstile refusé ou débit dépassé : aucune suppression", async () => {
    tsMock.mockResolvedValue(false);
    expect(
      (await retirerReponsesQuestionnaire({ empreinte: HASH_OK, turnstileToken: "j" })).ok,
    ).toBe(false);
    tsMock.mockResolvedValue(true);
    rlMock.mockResolvedValue({ allowed: false });
    expect(
      (await retirerReponsesQuestionnaire({ empreinte: HASH_OK, turnstileToken: "j" })).ok,
    ).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("panne de base : dite, pas masquée", async () => {
    deleteMock.mockRejectedValue(new Error("down"));
    const r = await retirerReponsesQuestionnaire({ empreinte: HASH_OK, turnstileToken: "j" });
    expect(r.ok).toBe(false);
  });
});
