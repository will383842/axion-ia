/**
 * Le dépôt d'un questionnaire (`deposerQuestionnaire`) est rejoué si Postgres l'annule pour
 * interblocage (40P01) : la transaction n'écrit qu'en base, donc rien n'est doublé. Base SIMULÉE.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const bd = vi.hoisted(() => {
  const tx = {
    questionnaireAvantAudit: { findUnique: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return { tx, $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
});
vi.mock("@/lib/prisma", () => ({ prisma: bd }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("../completer-fiche", () => ({ completerFicheDepuisQuestionnaire: vi.fn() }));

import { deposerQuestionnaire } from "../serveur";

const RID = "33333333-3333-4333-8333-333333333333";
const HTML = `<!doctype html><html><head><title>Q</title></head><body>
<script>
"use strict";
const CONFIG = {
  marque: "Axion IA",
  client: "",
};
const payload = () => ({ schema: 3, mode: "main" });
</script></body></html>`;

const interblocage = () => Object.assign(new Error("deadlock detected"), { code: "40P01" });

beforeEach(() => {
  vi.clearAllMocks();
  bd.tx.questionnaireAvantAudit.findUnique.mockResolvedValue(null);
  bd.tx.questionnaireAvantAudit.create.mockResolvedValue({ id: "nouveau" });
});

describe("dépôt d'un questionnaire sur un rendez-vous", () => {
  it("rejoue la transaction après un interblocage, et ne crée qu'une ligne", async () => {
    bd.$transaction.mockImplementationOnce(async () => {
      throw interblocage();
    });
    const r = await deposerQuestionnaire(RID, HTML);
    expect(r.id).toBe("nouveau");
    expect(bd.$transaction).toHaveBeenCalledTimes(2);
    expect(bd.tx.questionnaireAvantAudit.create).toHaveBeenCalledTimes(1);
  });

  it("toute autre erreur remonte tout de suite, sans nouvel essai", async () => {
    bd.$transaction.mockImplementationOnce(async () => {
      throw new Error("connexion perdue");
    });
    await expect(deposerQuestionnaire(RID, HTML)).rejects.toThrow("connexion perdue");
    expect(bd.$transaction).toHaveBeenCalledTimes(1);
  });
});
