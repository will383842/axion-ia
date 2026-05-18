// City Domination 2026-05-18 P1-9 (audit A10) — Tests writeAuditLog SOC2.
// Couvre les edge cases identifiés par l'audit indépendant 2026-05-18 :
//   - Best-effort failure swallow (Prisma down → no throw)
//   - Headers() context absent (workers BullMQ → no IP/UA capture)
//   - Truncation (action ≤ 64c, settingKey ≤ 128c, actorEmail ≤ 255c)
//   - Optionnels nullables vs undefined cohérents (exactOptionalPropertyTypes)

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() permet de déclarer les mocks BEFORE le bootstrap du module
// (sinon vi.mock factory throw "Cannot access X before initialization" car
// vi.mock est hoisted au top du fichier mais les `const` ne le sont pas).
const { createMock, headersMock } = vi.hoisted(() => {
  return {
    createMock: vi.fn<(args: { data: Record<string, unknown> }) => Promise<{ id: string }>>(
      async () => ({ id: "log-id-1" }),
    ),
    headersMock: vi.fn<() => Promise<Headers>>(async () => new Headers()),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenAuditLog: {
      create: createMock,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

import { writeAuditLog } from "../audit-log";

describe("writeAuditLog — P1-9 SOC2 append-only", () => {
  beforeEach(() => {
    createMock.mockClear();
    createMock.mockImplementation(async () => ({ id: "log-id-1" }));
    headersMock.mockClear();
    headersMock.mockImplementation(async () => new Headers());
  });

  it("écrit ligne audit log basique avec action + settingKey + diff", async () => {
    await writeAuditLog({
      action: "writeContentGenConfig",
      settingKey: "kill_switch",
      oldValue: { enabled: false },
      newValue: { enabled: true },
      actorUserId: "user-uuid-1",
      actorEmail: "will@axion-ia.com",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.action).toBe("writeContentGenConfig");
    expect(call.data.settingKey).toBe("kill_switch");
    expect(call.data.oldValue).toEqual({ enabled: false });
    expect(call.data.newValue).toEqual({ enabled: true });
    expect(call.data.actorUserId).toBe("user-uuid-1");
    expect(call.data.actorEmail).toBe("will@axion-ia.com");
  });

  it("tronque action > 64 caractères", async () => {
    const longAction = "a".repeat(100);
    await writeAuditLog({ action: longAction });
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect((call.data.action as string).length).toBe(64);
  });

  it("tronque settingKey > 128 caractères", async () => {
    const longKey = "k".repeat(200);
    await writeAuditLog({ action: "test", settingKey: longKey });
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect((call.data.settingKey as string).length).toBe(128);
  });

  it("tronque actorEmail > 255 caractères", async () => {
    const longEmail = "x".repeat(300);
    await writeAuditLog({ action: "test", actorEmail: longEmail });
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect((call.data.actorEmail as string).length).toBe(255);
  });

  it("capture User-Agent depuis headers() si dispo", async () => {
    headersMock.mockImplementation(
      async () =>
        new Headers({
          "user-agent": "Mozilla/5.0 Test Browser",
          "x-forwarded-for": "203.0.113.42, 10.0.0.1",
        }),
    );
    await writeAuditLog({ action: "test" });
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.actorUa).toBe("Mozilla/5.0 Test Browser");
    expect(call.data.actorIp).toBe("203.0.113.42"); // 1er hop X-Forwarded-For
  });

  it("fallback x-real-ip si pas de x-forwarded-for", async () => {
    headersMock.mockImplementation(async () => new Headers({ "x-real-ip": "198.51.100.7" }));
    await writeAuditLog({ action: "test" });
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.actorIp).toBe("198.51.100.7");
  });

  it("OK sans headers() context (workers BullMQ throw)", async () => {
    headersMock.mockImplementation(async () => {
      throw new Error("headers() called outside request context");
    });
    await expect(writeAuditLog({ action: "test" })).resolves.toBeUndefined();
    // Le log doit quand même être écrit (sans IP/UA)
    expect(createMock).toHaveBeenCalledTimes(1);
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.actorIp).toBeUndefined();
    expect(call.data.actorUa).toBeUndefined();
  });

  it("best-effort swallow si Prisma down (NE PAS throw)", async () => {
    createMock.mockImplementation(async () => {
      throw new Error("Prisma down");
    });
    // Ne doit PAS throw — SOC2 tolère perte partielle si tracée
    await expect(writeAuditLog({ action: "test" })).resolves.toBeUndefined();
  });

  it("écrit avec oldValue null (création initiale)", async () => {
    await writeAuditLog({
      action: "writeContentGenConfig",
      settingKey: "new_setting",
      oldValue: null,
      newValue: { enabled: true },
    });
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.oldValue).toBe(null);
    expect(call.data.newValue).toEqual({ enabled: true });
  });

  it("omet les champs optionnels undefined (compat exactOptionalPropertyTypes)", async () => {
    await writeAuditLog({ action: "test" });
    const call = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect("settingKey" in call.data).toBe(false);
    expect("oldValue" in call.data).toBe(false);
    expect("newValue" in call.data).toBe(false);
    expect("actorUserId" in call.data).toBe(false);
    expect("actorEmail" in call.data).toBe(false);
  });
});
