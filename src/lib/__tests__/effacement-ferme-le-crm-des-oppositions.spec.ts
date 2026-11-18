// @vitest-environment node
// (7) L'effacement ferme la porte du CRM AVANT de vider la file, et ne supprime jamais une opposition.
import { describe, it, expect, vi, beforeEach } from "vitest";

const ordre: string[] = [];
const sentry = vi.fn();
const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  oppDelete: vi.fn(),
  oppDeleteMany: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => sentry(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {
      emailOpposition: {
        updateMany: (...a: unknown[]) => mocks.updateMany(...a),
        delete: (...a: unknown[]) => mocks.oppDelete(...a),
        deleteMany: (...a: unknown[]) => mocks.oppDeleteMany(...a),
      },
      crmSyncOutbox: { deleteMany: (...a: unknown[]) => mocks.deleteMany(...a) },
    },
    {},
  ),
}));

import { eraseCrmOutboxForEmail } from "../rgpd-erase";
import { hashEmailForLookup } from "../security/email-hash";

beforeEach(() => {
  ordre.length = 0;
  sentry.mockReset();
  mocks.updateMany
    .mockReset()
    .mockImplementation(async () => (ordre.push("updateMany"), { count: 1 }));
  mocks.deleteMany
    .mockReset()
    .mockImplementation(async () => (ordre.push("deleteMany"), { count: 2 }));
  mocks.oppDelete.mockReset();
  mocks.oppDeleteMany.mockReset();
});

describe("eraseCrmOutboxForEmail ferme la porte du CRM", () => {
  it("pose crm_interdit_le AVANT le deleteMany de la file, sans jamais supprimer l'opposition", async () => {
    const r = await eraseCrmOutboxForEmail("Jean@Client.test");
    expect(r).toEqual({ supprimees: 2 });
    expect(ordre).toEqual(["updateMany", "deleteMany"]);
    const arg = mocks.updateMany.mock.calls[0]![0] as {
      where: { emailHash: string };
      data: { crmInterditLe: unknown };
    };
    expect(arg.where.emailHash).toBe(hashEmailForLookup("Jean@Client.test"));
    expect(arg.data.crmInterditLe).toBeInstanceOf(Date);
    expect(mocks.oppDelete).not.toHaveBeenCalled();
    expect(mocks.oppDeleteMany).not.toHaveBeenCalled();
  });

  it("échec de la pose → Sentry {name} sans adresse, et l'effacement CONTINUE", async () => {
    mocks.updateMany.mockRejectedValue(new Error("base Jean@Client.test"));
    const r = await eraseCrmOutboxForEmail("Jean@Client.test");
    expect(r).toEqual({ supprimees: 2 });
    expect(mocks.deleteMany).toHaveBeenCalledTimes(1);
    expect(sentry.mock.calls[0]![0]).toEqual({ name: "Error" });
    expect(JSON.stringify(sentry.mock.calls).toLowerCase()).not.toContain("jean");
  });
});
