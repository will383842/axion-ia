// T-20 — prompt versionné + rollback.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatPromptVersion: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      create: (...a: unknown[]) => create(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      findMany: vi.fn(),
    },
    $transaction: (...a: unknown[]) => transaction(...(a as [unknown[]])),
  },
}));

import {
  getActivePromptContent,
  createPromptVersion,
  activatePromptVersion,
} from "@/server/chatbot/generation/prompt-version";

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
  updateMany.mockReset();
  transaction.mockClear();
});

describe("getActivePromptContent", () => {
  it("renvoie le contenu de la version active", async () => {
    findFirst.mockResolvedValue({ contenu: "Prompt v2 custom" });
    expect(await getActivePromptContent("t1")).toBe("Prompt v2 custom");
    expect(findFirst.mock.calls[0]![0].where).toEqual({ tenantId: "t1", actif: true });
  });
  it("renvoie null si aucune version active (→ fallback codé)", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getActivePromptContent("t1")).toBeNull();
  });
});

describe("createPromptVersion", () => {
  it("incrémente le numéro de version (inactive par défaut)", async () => {
    findFirst.mockResolvedValue({ version: 4 });
    create.mockResolvedValue({});
    const r = await createPromptVersion("t1", "nouveau prompt", "essai");
    expect(r).toEqual({ version: 5 });
    const data = create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ tenantId: "t1", version: 5, actif: false, note: "essai" });
  });
  it("première version = 1", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({});
    expect(await createPromptVersion("t1", "p")).toEqual({ version: 1 });
  });
});

describe("activatePromptVersion (rollback)", () => {
  it("désactive l'actuelle puis active la cible dans UNE transaction", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await activatePromptVersion("t1", 3);
    expect(transaction).toHaveBeenCalledOnce();
    // 2 updateMany : désactivation globale + activation de la version 3.
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[0]![0].data).toEqual({ actif: false });
    expect(updateMany.mock.calls[1]![0]).toEqual({
      where: { tenantId: "t1", version: 3 },
      data: { actif: true },
    });
  });
});
