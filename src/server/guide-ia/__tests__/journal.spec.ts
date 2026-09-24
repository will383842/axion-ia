// @vitest-environment node
//
// `marquerGuideEnvoye` — la clôture d'une demande après l'envoi réel (lot L2).
// Seul endroit qui pose `sent_at` et `send_count` ; chargé par le worker.

import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      update: (...a: unknown[]) => update(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));

import { marquerGuideEnvoye } from "../journal";

beforeEach(() => {
  update.mockReset().mockResolvedValue({ id: "demande-1" });
  updateMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("marquerGuideEnvoye", () => {
  it("incrémente le compteur à CHAQUE envoi", async () => {
    await marquerGuideEnvoye("demande-1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "demande-1" },
      data: { sendCount: { increment: 1 } },
      select: { id: true },
    });
  });

  it("🔴 pose `sent_at` UNE seule fois : le filtre `sentAt: null` protège le premier envoi", async () => {
    const quand = new Date("2026-09-24T10:00:00Z");
    await marquerGuideEnvoye("demande-1", quand);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "demande-1", sentAt: null },
      data: { sentAt: quand },
    });
  });

  it("🔴 ne lève JAMAIS : l'e-mail est déjà parti, un rejeu l'enverrait deux fois", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    update.mockRejectedValue(new Error("base indisponible"));
    await expect(marquerGuideEnvoye("demande-1")).resolves.toBeUndefined();
    expect(erreur).toHaveBeenCalled();
    erreur.mockRestore();
  });
});
