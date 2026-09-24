// @vitest-environment node
//
// Coupe-circuit du guide (lot L2) : au-delà de N rebonds DURS en une heure,
// l'envoi est suspendu, Telegram est prévenu, et il ne se ré-arme JAMAIS seul.

import { describe, it, expect, vi, beforeEach } from "vitest";

const settingFindUnique = vi.fn();
const settingUpsert = vi.fn();
const emailLogCount = vi.fn();
const notify = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findUnique: (...a: unknown[]) => settingFindUnique(...a),
      upsert: (...a: unknown[]) => settingUpsert(...a),
    },
    emailLog: { count: (...a: unknown[]) => emailLogCount(...a) },
  },
}));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));

import { coupeCircuitDeclenche, lireCoupeCircuit } from "../coupe-circuit";
import { CLE_COUPE_CIRCUIT, GABARIT_GUIDE, SEUIL_REBONDS_DURS_PAR_HEURE } from "../config";

const MAINTENANT = new Date("2026-09-24T10:00:00Z");

beforeEach(() => {
  settingFindUnique.mockReset().mockResolvedValue(null);
  settingUpsert.mockReset().mockResolvedValue({});
  emailLogCount.mockReset().mockResolvedValue(0);
  notify.mockReset().mockResolvedValue({ ok: true });
});

describe("coupeCircuitDeclenche", () => {
  it("témoin : sous le seuil, l'envoi continue et rien n'est écrit", async () => {
    emailLogCount.mockResolvedValue(SEUIL_REBONDS_DURS_PAR_HEURE - 1);
    expect(await coupeCircuitDeclenche(MAINTENANT)).toBe(false);
    expect(settingUpsert).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("ne compte que les rebonds DURS du guide, sur la dernière heure", async () => {
    await coupeCircuitDeclenche(MAINTENANT);
    expect(emailLogCount).toHaveBeenCalledWith({
      where: {
        template: GABARIT_GUIDE,
        status: "bounced",
        bounceType: "hard",
        bouncedAt: { gte: new Date("2026-09-24T09:00:00Z") },
      },
    });
  });

  it("🔴 au seuil : suspension ÉCRITE en base (réglage) et Telegram prévenu, sans adresse", async () => {
    emailLogCount.mockResolvedValue(SEUIL_REBONDS_DURS_PAR_HEURE);
    expect(await coupeCircuitDeclenche(MAINTENANT)).toBe(true);
    expect(settingUpsert).toHaveBeenCalledTimes(1);
    const arg = settingUpsert.mock.calls[0]?.[0] as {
      where: { key: string };
      create: { value: { depuis: string } };
      update: object;
    };
    expect(arg.where.key).toBe(CLE_COUPE_CIRCUIT);
    expect(arg.create.value.depuis).toBe(MAINTENANT.toISOString());
    // La date de déclenchement ne bouge plus une fois posée.
    expect(arg.update).toEqual({});
    expect(notify).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(notify.mock.calls[0]?.[0])).not.toMatch(/@/);
  });

  it("🔴 une fois déclenché, il le RESTE — même quand les rebonds ont vieilli (aucun ré-armement seul)", async () => {
    settingFindUnique.mockResolvedValue({ value: { depuis: "2026-09-20T08:00:00.000Z" } });
    emailLogCount.mockResolvedValue(0);
    expect(await coupeCircuitDeclenche(MAINTENANT)).toBe(true);
    expect(emailLogCount).not.toHaveBeenCalled();
  });

  it("base muette : considéré non déclenché (et dit), l'envoi n'est pas bloqué par un hoquet", async () => {
    settingFindUnique.mockRejectedValue(new Error("connexion perdue"));
    emailLogCount.mockRejectedValue(new Error("connexion perdue"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await coupeCircuitDeclenche(MAINTENANT)).toBe(false);
  });
});

describe("lireCoupeCircuit", () => {
  it("rend la date de déclenchement", async () => {
    settingFindUnique.mockResolvedValue({ value: { depuis: "2026-09-20T08:00:00.000Z" } });
    const etat = await lireCoupeCircuit();
    expect(etat.declenche).toBe(true);
    expect(etat.declenche && etat.depuis?.toISOString()).toBe("2026-09-20T08:00:00.000Z");
  });
});
