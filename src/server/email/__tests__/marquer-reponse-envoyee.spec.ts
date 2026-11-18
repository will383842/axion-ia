// « Marquer comme envoyée » (W1-S3, 3b) : le fondateur clôt une réponse « issue inconnue »
// retrouvée dans ZeptoMail. Cas M1 à M7, pour les deux gabarits.
import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  appels: [] as string[],
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  submissionUpdate: vi.fn(),
  activityCreate: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  sentry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => d.sentry(...a) }));
vi.mock("@/lib/redis", () => ({
  redis: {
    get: (...a: unknown[]) => d.redisGet(...a),
    set: (...a: unknown[]) => {
      d.appels.push("redis.set");
      return d.redisSet(...a);
    },
  },
}));
vi.mock("@/lib/prisma", () => {
  const table = () => ({
    findUnique: (...a: unknown[]) => d.findUnique(...a),
    updateMany: (...a: unknown[]) => {
      d.appels.push("updateMany");
      return d.updateMany(...a);
    },
  });
  const tx = {
    submissionReply: table(),
    jobApplicationReply: table(),
    submission: { update: (...a: unknown[]) => d.submissionUpdate(...a) },
    activityLog: { create: (...a: unknown[]) => d.activityCreate(...a) },
  };
  return {
    prisma: {
      ...tx,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
        d.appels.push("transaction:debut");
        const r = await fn(tx);
        d.appels.push("transaction:fin");
        return r;
      },
    },
  };
});

import { marquerReponseEnvoyeeALaMain } from "../marquer-reponse-envoyee";
import { MOTIF_ISSUE_INCONNUE, PREFIXE_ISSUE_INCONNUE } from "@/lib/email/reponse-manuelle-etat";

const MAINTENANT = new Date("2026-11-18T10:00:00Z");
const NOTEE = new Date("2026-11-17T08:00:00Z");
const ADMIN = "11111111-1111-4111-8111-111111111111";
const PARENT = "22222222-2222-4222-8222-222222222222";

const GABARITS = [
  { gabarit: "submission-reply", cible: "submission", cle: "submissionId" },
  { gabarit: "candidature-reponse", cible: "job_application", cle: "applicationId" },
] as const;

function ligne(g: (typeof GABARITS)[number], over: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    [g.cle]: PARENT,
    deliveryStatus: "failed",
    sentAt: null,
    failedAt: NOTEE,
    errorMsg: MOTIF_ISSUE_INCONNUE,
    submission: { firstRepliedAt: null },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.appels.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MAINTENANT);
  d.updateMany.mockResolvedValue({ count: 1 });
  d.submissionUpdate.mockResolvedValue({});
  d.activityCreate.mockResolvedValue({});
  d.redisGet.mockResolvedValue(null);
  d.redisSet.mockResolvedValue("OK");
});

describe.each(GABARITS)("$gabarit : marquer comme envoyée", (g) => {
  const appeler = () =>
    marquerReponseEnvoyeeALaMain({ gabarit: g.gabarit, replyId: "r-1", adminUserId: ADMIN });

  it("M1 : issue inconnue → écriture conditionnelle exacte, trace, puis marqueur NX APRÈS la transaction", async () => {
    d.findUnique.mockResolvedValue(ligne(g));
    const r = await appeler();
    expect(r).toEqual({ ok: true });
    expect(d.updateMany).toHaveBeenCalledTimes(1);
    expect(d.updateMany.mock.calls[0]?.[0]).toEqual({
      where: {
        id: "r-1",
        deliveryStatus: "failed",
        sentAt: null,
        errorMsg: { startsWith: PREFIXE_ISSUE_INCONNUE },
      },
      data: {
        deliveryStatus: "sent",
        sentAt: MAINTENANT,
        providerMessageId: null,
        failedAt: null,
        errorMsg: null,
      },
    });
    expect(d.activityCreate).toHaveBeenCalledTimes(1);
    const trace = d.activityCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(trace.data).toMatchObject({
      adminUserId: ADMIN,
      action: "reponse.marquee_envoyee_a_la_main",
      targetType: g.cible,
      targetId: PARENT,
      changes: {
        replyId: "r-1",
        gabarit: g.gabarit,
        marqueurRedis: "absent",
        issueNotéeLe: NOTEE.toISOString(),
      },
    });
    expect(JSON.stringify(trace.data)).not.toMatch(/@/);
    expect(d.redisSet).toHaveBeenCalledWith(
      `envoye:envoi-reponse:${g.gabarit}:r-1`,
      "marquee-envoyee-a-la-main",
      "EX",
      2_592_000,
      "NX",
    );
    // Ordre : le marqueur n'est posé qu'une fois la transaction validée.
    expect(d.appels).toEqual(["transaction:debut", "updateMany", "transaction:fin", "redis.set"]);
  });

  it("M2 : failed sans le préfixe machine → refus, aucune écriture, aucun marqueur", async () => {
    d.findUnique.mockResolvedValue(ligne(g, { errorMsg: "Envoi non abouti" }));
    expect(await appeler()).toEqual({ ok: false, error: "pas_issue_inconnue" });
    expect(d.updateMany).not.toHaveBeenCalled();
    expect(d.activityCreate).not.toHaveBeenCalled();
    expect(d.redisSet).not.toHaveBeenCalled();
  });

  it.each(["pending", "sent", "bounced"])("M3 : statut %s → refus", async (statut) => {
    d.findUnique.mockResolvedValue(ligne(g, { deliveryStatus: statut }));
    expect(await appeler()).toEqual({ ok: false, error: "pas_issue_inconnue" });
    expect(d.updateMany).not.toHaveBeenCalled();
    expect(d.redisSet).not.toHaveBeenCalled();
  });

  it("refuse une réponse introuvable", async () => {
    d.findUnique.mockResolvedValue(null);
    expect(await appeler()).toEqual({ ok: false, error: "not_found" });
    expect(d.redisSet).not.toHaveBeenCalled();
  });

  it("M4 : l'écriture ne touche aucune ligne → transaction annulée, pas de trace, AUCUN marqueur", async () => {
    d.findUnique.mockResolvedValue(ligne(g));
    d.updateMany.mockResolvedValue({ count: 0 });
    expect(await appeler()).toEqual({ ok: false, error: "etat_change" });
    expect(d.activityCreate).not.toHaveBeenCalled();
    expect(d.submissionUpdate).not.toHaveBeenCalled();
    expect(d.redisSet).not.toHaveBeenCalled();
  });

  it("M5 : le marqueur ne peut pas être posé → ok quand même, erreur relevée", async () => {
    d.findUnique.mockResolvedValue(ligne(g));
    d.redisSet.mockRejectedValue(new Error("redis indisponible"));
    expect(await appeler()).toEqual({ ok: true });
    expect(d.sentry).toHaveBeenCalledTimes(1);
  });

  it("M6 : marqueur présent → son identifiant devient providerMessageId", async () => {
    d.findUnique.mockResolvedValue(ligne(g));
    d.redisGet.mockResolvedValue("<m42>");
    expect(await appeler()).toEqual({ ok: true });
    expect(d.updateMany.mock.calls[0]?.[0]).toMatchObject({
      data: { providerMessageId: "<m42>" },
    });
    expect(d.redisSet).toHaveBeenCalledWith(expect.any(String), "<m42>", "EX", 2_592_000, "NX");
    const trace = d.activityCreate.mock.calls[0]?.[0] as { data: { changes: unknown } };
    expect(trace.data.changes).toMatchObject({ marqueurRedis: "present" });
  });

  it("lecture du marqueur en erreur → trace « illisible », l'opération continue", async () => {
    d.findUnique.mockResolvedValue(ligne(g));
    d.redisGet.mockRejectedValue(new Error("redis lecture"));
    expect(await appeler()).toEqual({ ok: true });
    const trace = d.activityCreate.mock.calls[0]?.[0] as { data: { changes: unknown } };
    expect(trace.data.changes).toMatchObject({ marqueurRedis: "illisible" });
  });

  it("M7 : firstRepliedAt / lastRepliedAt posés dans la même transaction (message seulement)", async () => {
    d.findUnique.mockResolvedValue(ligne(g));
    await appeler();
    if (g.gabarit === "submission-reply") {
      expect(d.submissionUpdate).toHaveBeenCalledWith({
        where: { id: PARENT },
        data: { firstRepliedAt: MAINTENANT, lastRepliedAt: MAINTENANT },
      });
    } else {
      expect(d.submissionUpdate).not.toHaveBeenCalled();
    }
  });

  it("M7 : un firstRepliedAt déjà posé est conservé", async () => {
    if (g.gabarit !== "submission-reply") return;
    const avant = new Date("2026-11-01T00:00:00Z");
    d.findUnique.mockResolvedValue(ligne(g, { submission: { firstRepliedAt: avant } }));
    await appeler();
    expect(d.submissionUpdate).toHaveBeenCalledWith({
      where: { id: PARENT },
      data: { firstRepliedAt: avant, lastRepliedAt: MAINTENANT },
    });
  });
});
