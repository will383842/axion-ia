// @vitest-environment node
//
// Sentinelle quotidienne du guide (lot L2). Leçon du 16/09 : six jours d'arrêt
// « en vert », parce que personne ne comparait les demandes aux envois.

import { describe, it, expect, vi, beforeEach } from "vitest";

const guideCount = vi.fn();
const emailLogCount = vi.fn();
const abonneCount = vi.fn();
const outboxCount = vi.fn();
const lireCoupeCircuit = vi.fn();
const notify = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: { count: (...a: unknown[]) => guideCount(...a) },
    emailLog: { count: (...a: unknown[]) => emailLogCount(...a) },
    newsletterSubscriber: { count: (...a: unknown[]) => abonneCount(...a) },
    crmSyncOutbox: { count: (...a: unknown[]) => outboxCount(...a) },
  },
}));
vi.mock("../coupe-circuit", () => ({ lireCoupeCircuit: () => lireCoupeCircuit() }));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));

import { passerSentinelle, releverSentinelle } from "../sentinelle";

const MAINTENANT = new Date("2026-09-24T06:40:00Z");

/** demandes, en attente, clics : dans l'ordre des trois `guideRequest.count`. */
function releve(o: { demandes: number; envois: number; echecs?: number }): void {
  let n = 0;
  guideCount.mockImplementation(async () => [o.demandes, 0, 0][n++ % 3]);
  emailLogCount.mockImplementation(async (arg: { where: { status: string } }) =>
    arg.where.status === "sent" ? o.envois : (o.echecs ?? 0),
  );
}

beforeEach(() => {
  guideCount.mockReset();
  emailLogCount.mockReset();
  abonneCount.mockReset().mockResolvedValue(0);
  outboxCount.mockReset().mockResolvedValue(0);
  lireCoupeCircuit.mockReset().mockResolvedValue({ declenche: false });
  notify.mockReset().mockResolvedValue({ ok: true });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("releverSentinelle", () => {
  it("témoin : demandes ET envois → aucune anomalie", async () => {
    releve({ demandes: 4, envois: 4 });
    expect((await releverSentinelle(MAINTENANT)).anomalies).toEqual([]);
  });

  it("🔴 demandes > 0 et AUCUN envoi : la chaîne est coupée", async () => {
    releve({ demandes: 3, envois: 0 });
    const r = await releverSentinelle(MAINTENANT);
    expect(r.anomalies.join(" ")).toMatch(/AUCUN envoi/);
  });

  it("🔴 coupe-circuit déclenché depuis plus de 24 h", async () => {
    releve({ demandes: 0, envois: 0 });
    lireCoupeCircuit.mockResolvedValue({
      declenche: true,
      depuis: new Date("2026-09-22T06:00:00Z"),
    });
    const r = await releverSentinelle(MAINTENANT);
    expect(r.anomalies.join(" ")).toMatch(/plus de 24 h/);
  });

  it("coupe-circuit déclenché depuis 2 h seulement : pas encore d'alerte de durée", async () => {
    releve({ demandes: 0, envois: 0 });
    lireCoupeCircuit.mockResolvedValue({
      declenche: true,
      depuis: new Date("2026-09-24T04:40:00Z"),
    });
    expect((await releverSentinelle(MAINTENANT)).anomalies).toEqual([]);
  });

  it("synchro CRM de la lettre abandonnée (`gave_up`) : signalée", async () => {
    releve({ demandes: 0, envois: 0 });
    outboxCount.mockResolvedValue(2);
    expect((await releverSentinelle(MAINTENANT)).anomalies.join(" ")).toMatch(/abandonnée/);
  });
});

describe("passerSentinelle", () => {
  it("anomalie → alerte Telegram ; demandes → récapitulatif ; jamais une adresse", async () => {
    releve({ demandes: 3, envois: 0 });
    await passerSentinelle(MAINTENANT);
    const categories = notify.mock.calls.map((c) => (c[0] as { category: string }).category);
    expect(categories).toEqual(["MONITORING_ALERT", "GUIDE_RECAP"]);
    expect(JSON.stringify(notify.mock.calls)).not.toMatch(/@/);
  });

  it("journée sans rien : aucun message", async () => {
    releve({ demandes: 0, envois: 0 });
    await passerSentinelle(MAINTENANT);
    expect(notify).not.toHaveBeenCalled();
  });

  it("table absente (worker avant migration) : silence", async () => {
    guideCount.mockRejectedValue(Object.assign(new Error("x"), { code: "P2021" }));
    emailLogCount.mockResolvedValue(0);
    expect(await passerSentinelle(MAINTENANT)).toBeNull();
  });
});
