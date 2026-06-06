/**
 * Tests — withNumberRetry (R7 audit E2E 2026-06-06).
 */

import { describe, it, expect, vi } from "vitest";
import { withNumberRetry } from "./retry";

const p2002 = { code: "P2002" };

describe("withNumberRetry", () => {
  it("retourne le résultat au premier succès", async () => {
    const op = vi.fn().mockResolvedValue("ok");
    expect(await withNumberRetry(op)).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("réessaie sur P2002 puis réussit", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(p2002)
      .mockRejectedValueOnce(p2002)
      .mockResolvedValue("ok");
    expect(await withNumberRetry(op, 5)).toBe("ok");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("abandonne après N tentatives (relance le dernier P2002)", async () => {
    const op = vi.fn().mockRejectedValue(p2002);
    await expect(withNumberRetry(op, 3)).rejects.toBe(p2002);
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("relance immédiatement une erreur non-P2002 (pas de retry)", async () => {
    const other = new Error("boom");
    const op = vi.fn().mockRejectedValue(other);
    await expect(withNumberRetry(op, 5)).rejects.toBe(other);
    expect(op).toHaveBeenCalledTimes(1);
  });
});
