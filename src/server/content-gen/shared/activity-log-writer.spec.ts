/**
 * Le journal `ActivityLog` a désormais DEUX appelants, et ce fichier vérifie que
 * le second n'a rien coûté au premier.
 *
 *  - la console passe par `logActivity` (`activity-log.ts`, `"use server"`), qui
 *    lit `headers()` puis délègue. Champs, troncatures et forme de `changes`
 *    doivent être ceux d'avant le 2026-09-16, à l'identique ;
 *  - le worker passe par `ecrireJournalActivite` directement, sans requête.
 *
 * 🔑 Le troisième cas est celui qui a fait le défaut : `headers()` qui LÈVE. La
 * ligne doit s'écrire quand même, sans IP ni navigateur.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const activityLogCreateMock = vi.fn();
const headersMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { activityLog: { create: (args: unknown) => activityLogCreateMock(args) } },
}));

vi.mock("next/headers", () => ({ headers: () => headersMock() }));

import { acteurSysteme, ecrireJournalActivite } from "./activity-log-writer";
import { logActivity } from "./activity-log";

const ADMIN = "7c1f9d88-2b55-4a0e-9a3c-1d6e4f0b7a92";
const CIBLE = "3f0e2a10-6c4b-4d2e-9f51-0b7a1c8d4e62";

/** Un `headers()` qui répond, comme sous une vraie requête. */
function entetes(map: Record<string, string>) {
  return Promise.resolve({ get: (k: string) => map[k] ?? null });
}

beforeEach(() => {
  vi.clearAllMocks();
  activityLogCreateMock.mockResolvedValue({ id: "log-1" });
});

/** Les données du dernier `create`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dernier = (): any => activityLogCreateMock.mock.calls.at(-1)?.[0]?.data;

describe("logActivity — la console journalise exactement comme avant", () => {
  it("porte l'administrateur, son IP et son navigateur, et `changes` inchangé", async () => {
    headersMock.mockReturnValue(
      entetes({
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "user-agent": "Mozilla/5.0 (console)",
      }),
    );

    await logActivity({
      session: { userId: ADMIN, email: "admin@axion-ia.com", role: "admin" },
      action: "content-gen.review.approve",
      targetType: "ReviewQueue",
      targetId: CIBLE,
      changes: { before: "pending", after: "approved" },
    });

    expect(dernier()).toEqual({
      adminUserId: ADMIN,
      action: "content-gen.review.approve",
      targetType: "ReviewQueue",
      targetId: CIBLE,
      changes: { before: "pending", after: "approved" },
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 (console)",
    });
    // 🔑 Aucune clé `origine` ajoutée à un acte humain : la forme de `changes`
    // lue par `/activity-logs` ne bouge pas d'un octet.
    expect(Object.keys(dernier().changes)).toEqual(["before", "after"]);
  });

  it("retombe sur `x-real-ip` puis `cf-connecting-ip`, comme avant", async () => {
    headersMock.mockReturnValue(entetes({ "cf-connecting-ip": "198.51.100.4" }));

    await logActivity({
      session: { userId: ADMIN, email: "a@b.c", role: "admin" },
      action: "content-gen.campaign.pause",
    });

    expect(dernier().ipAddress).toBe("198.51.100.4");
    expect(dernier().targetType).toBeNull();
    expect(dernier().targetId).toBeNull();
    expect(dernier().changes).toBeNull();
  });

  it("garde les troncatures : action 120, targetType 80, ip 64, navigateur 2000", async () => {
    headersMock.mockReturnValue(
      entetes({ "x-real-ip": "9".repeat(80), "user-agent": "U".repeat(2500) }),
    );

    await logActivity({
      session: { userId: ADMIN, email: "a@b.c", role: "admin" },
      action: "a".repeat(200),
      targetType: "T".repeat(120),
    });

    expect(dernier().action).toHaveLength(120);
    expect(dernier().targetType).toHaveLength(80);
    expect(dernier().ipAddress).toHaveLength(64);
    expect(dernier().userAgent).toHaveLength(2000);
  });

  it("🔴 `headers()` qui lève coûte l'IP et le navigateur — PLUS la ligne d'audit", async () => {
    headersMock.mockImplementation(() => {
      throw new Error("`headers` was called outside a request scope.");
    });

    await logActivity({
      session: { userId: ADMIN, email: "a@b.c", role: "admin" },
      action: "content-gen.review.approve",
      targetId: CIBLE,
    });

    expect(activityLogCreateMock).toHaveBeenCalledTimes(1);
    expect(dernier().adminUserId).toBe(ADMIN);
    expect(dernier().ipAddress).toBeNull();
    expect(dernier().userAgent).toBeNull();
  });
});

describe("ecrireJournalActivite — le chemin du système", () => {
  it("`acteurSysteme` écrit `adminUserId: null` et porte l'auteur dans `changes.origine`", async () => {
    await ecrireJournalActivite(acteurSysteme("content-gen-deadline-checker"), {
      action: "content-gen.campaign.auto-stopped",
      targetType: "CoverageCampaign",
      targetId: CIBLE,
      changes: { soc2: "CAMPAIGN_AUTO_STOPPED_DEADLINE" },
    });

    expect(dernier()).toEqual({
      adminUserId: null,
      action: "content-gen.campaign.auto-stopped",
      targetType: "CoverageCampaign",
      targetId: CIBLE,
      changes: { soc2: "CAMPAIGN_AUTO_STOPPED_DEADLINE", origine: "content-gen-deadline-checker" },
      ipAddress: null,
      userAgent: null,
    });
  });

  it("n'appelle JAMAIS `headers()` — c'est tout l'objet du module", async () => {
    headersMock.mockImplementation(() => {
      throw new Error("ne devrait pas être appelé");
    });

    await ecrireJournalActivite(acteurSysteme("content-gen-deadline-checker"), {
      action: "content-gen.campaign.auto-stopped",
      targetId: CIBLE,
    });

    expect(headersMock).not.toHaveBeenCalled();
    expect(activityLogCreateMock).toHaveBeenCalledTimes(1);
  });

  it("un échec Prisma ne remonte pas, mais ne se tait pas non plus", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    activityLogCreateMock.mockRejectedValueOnce(new Error("colonne absente"));

    await expect(
      ecrireJournalActivite(acteurSysteme("content-gen-deadline-checker"), {
        action: "content-gen.campaign.auto-stopped",
        targetId: CIBLE,
      }),
    ).resolves.toBeUndefined();

    // Avant le 2026-09-16 l'avertissement était gardé par
    // `NODE_ENV !== "production"` : muet exactement là où il comptait.
    expect(erreur).toHaveBeenCalledTimes(1);
    expect(String(erreur.mock.calls[0]?.[0])).toContain("content-gen.campaign.auto-stopped");
    erreur.mockRestore();
  });
});
