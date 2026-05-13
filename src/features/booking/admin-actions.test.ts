// Tests Server Actions admin booking — Sprint X.4
//
// Tests Zod input validation seulement (les Server Actions mockent l'auth
// + Prisma — tests intégration plus complets dans tests/integration/).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth + prisma + telegram pour tests purs Zod
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    booking: { findUnique: vi.fn(), update: vi.fn() },
    bookingTransition: { create: vi.fn() },
    calendarSlot: { update: vi.fn() },
  },
}));
vi.mock("@/lib/telegram", () => ({
  sendTelegram: vi.fn().mockResolvedValue(true),
}));

import {
  pauseBookingAction,
  resumeBookingAction,
  markCompletedAction,
  markNoShowAction,
  markForceMajeureAction,
} from "./admin-actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin-actions — Zod validation", () => {
  describe("pauseBookingAction", () => {
    it("rejette si bookingId pas UUID", async () => {
      const res = await pauseBookingAction({
        bookingId: "not-a-uuid",
        reason: "raison valide ici",
      });
      expect(res).toEqual({ ok: false, error: "invalid_input" });
    });

    it("rejette si reason trop courte (< 10 caractères)", async () => {
      const res = await pauseBookingAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        reason: "court",
      });
      expect(res).toEqual({ ok: false, error: "invalid_input" });
    });

    it("retourne unauthorized si pas de session admin", async () => {
      const res = await pauseBookingAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        reason: "raison de pause suffisamment longue pour passer",
      });
      // Auth fail (mock retourne null) → unauthorized
      expect(res.ok).toBe(false);
      expect(res.error).toBe("unauthorized");
    });

    it("accepte pausedUntil ISO datetime optionnel", async () => {
      const res = await pauseBookingAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        pausedUntil: "2026-06-15T09:00:00.000Z",
        reason: "raison de pause valide pour test ISO",
      });
      // L'input est valide ; on s'arrête à l'auth (unauthorized).
      expect(res.error).not.toBe("invalid_input");
    });

    it("rejette pausedUntil format invalide", async () => {
      const res = await pauseBookingAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        pausedUntil: "pas-une-date",
        reason: "raison de pause valide pour test ISO",
      });
      expect(res).toEqual({ ok: false, error: "invalid_input" });
    });
  });

  describe("resumeBookingAction", () => {
    it("rejette si bookingId pas UUID", async () => {
      const res = await resumeBookingAction({ bookingId: "x" });
      expect(res).toEqual({ ok: false, error: "invalid_input" });
    });

    it("accepte newSlotId optionnel", async () => {
      const res = await resumeBookingAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
      });
      expect(res.error).not.toBe("invalid_input");
    });

    it("rejette newSlotId pas UUID", async () => {
      const res = await resumeBookingAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        newSlotId: "pas-uuid",
      });
      expect(res).toEqual({ ok: false, error: "invalid_input" });
    });
  });

  describe("markCompletedAction", () => {
    it("accepte notes optionnelles", async () => {
      const res = await markCompletedAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
      });
      expect(res.error).not.toBe("invalid_input");
    });

    it("rejette notes > 2000 char", async () => {
      const res = await markCompletedAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        notes: "x".repeat(2001),
      });
      expect(res).toEqual({ ok: false, error: "invalid_input" });
    });
  });

  describe("markNoShowAction (super_admin only)", () => {
    it("rejette reason trop courte", async () => {
      const res = await markNoShowAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        reason: "court",
      });
      expect(res).toEqual({ ok: false, error: "invalid_input" });
    });

    it("auth fail → unauthorized (pas de bypass via input)", async () => {
      const res = await markNoShowAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        reason: "Client absent 30 min + injoignable téléphone et email",
      });
      expect(res.error).toBe("unauthorized");
    });
  });

  describe("markForceMajeureAction (super_admin only)", () => {
    it("rejette notes < 20 char", async () => {
      const res = await markForceMajeureAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        notes: "court",
      });
      expect(res).toEqual({ ok: false, error: "invalid_input" });
    });

    it("auth fail → unauthorized", async () => {
      const res = await markForceMajeureAction({
        bookingId: "00000000-0000-0000-0000-000000000001",
        notes:
          "Catastrophe naturelle empêchant le déplacement sur site (préfecture niveau alerte rouge)",
      });
      expect(res.error).toBe("unauthorized");
    });
  });
});
