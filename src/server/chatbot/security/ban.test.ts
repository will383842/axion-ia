// T-29 — bannissement temporaire (seuil de violations → ban Redis).

import { describe, it, expect, vi, beforeEach } from "vitest";

const exists = vi.fn();
const incr = vi.fn();
const expire = vi.fn();
const set = vi.fn();
const del = vi.fn();
vi.mock("@/lib/redis", () => ({
  redis: {
    exists: (...a: unknown[]) => exists(...a),
    incr: (...a: unknown[]) => incr(...a),
    expire: (...a: unknown[]) => expire(...a),
    set: (...a: unknown[]) => set(...a),
    del: (...a: unknown[]) => del(...a),
  },
}));

import { isBanned, recordViolation, BAN_VIOLATION_THRESHOLD } from "@/server/chatbot/security/ban";

beforeEach(() => {
  exists.mockReset();
  incr.mockReset();
  expire.mockReset();
  set.mockReset();
  del.mockReset();
});

describe("isBanned", () => {
  it("true si la clé de ban existe", async () => {
    exists.mockResolvedValue(1);
    expect(await isBanned("ip1")).toBe(true);
  });
  it("false sinon, et fail-open si Redis throw", async () => {
    exists.mockResolvedValue(0);
    expect(await isBanned("ip1")).toBe(false);
    exists.mockRejectedValue(new Error("redis down"));
    expect(await isBanned("ip1")).toBe(false);
  });
});

describe("recordViolation", () => {
  it("première violation → pose un TTL sur le compteur, pas de ban", async () => {
    incr.mockResolvedValue(1);
    const banned = await recordViolation("ip1");
    expect(banned).toBe(false);
    expect(expire).toHaveBeenCalledOnce();
    expect(set).not.toHaveBeenCalled();
  });
  it("au seuil → pose le ban et retourne true", async () => {
    incr.mockResolvedValue(BAN_VIOLATION_THRESHOLD);
    set.mockResolvedValue("OK");
    del.mockResolvedValue(1);
    const banned = await recordViolation("ip1");
    expect(banned).toBe(true);
    expect(set.mock.calls[0]![0]).toContain("chatbot:ban:ip1");
  });
  it("fail-open si Redis throw", async () => {
    incr.mockRejectedValue(new Error("down"));
    expect(await recordViolation("ip1")).toBe(false);
  });
});
