import { beforeEach, describe, expect, it, vi } from "vitest";

const { aggregate } = vi.hoisted(() => ({ aggregate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { costLedger: { aggregate } } }));

import { coutCumuleJobUsd } from "../blog-claude-ledger";

describe("coutCumuleJobUsd", () => {
  beforeEach(() => aggregate.mockReset());

  it("somme les lignes du job (nombre)", async () => {
    aggregate.mockResolvedValue({ _sum: { costUsd: 1.25 } });
    await expect(coutCumuleJobUsd("j1")).resolves.toBe(1.25);
    expect(aggregate).toHaveBeenCalledWith({ where: { jobId: "j1" }, _sum: { costUsd: true } });
  });

  it("lit un Decimal et rend 0 sans ligne", async () => {
    aggregate.mockResolvedValue({ _sum: { costUsd: { toNumber: () => 2.5 } } });
    await expect(coutCumuleJobUsd("j1")).resolves.toBe(2.5);
    aggregate.mockResolvedValue({ _sum: { costUsd: null } });
    await expect(coutCumuleJobUsd("j2")).resolves.toBe(0);
  });

  it("lève si le total est illisible", async () => {
    aggregate.mockResolvedValue({ _sum: { costUsd: "abc" } });
    await expect(coutCumuleJobUsd("j1")).rejects.toThrow();
  });
});
