/**
 * W1-S2 — veille des réponses écrites à la main restées « en cours d'envoi ».
 *
 * Ce qui est éprouvé : la veille n'écrit JAMAIS sur une ligne dont un job s'occupe encore, ne
 * renvoie jamais rien, et ne conclut pas « perdue » sur une mesure douteuse (liste tronquée,
 * file illisible, job apparu entre deux lectures).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const subFindMany = vi.fn();
const subUpdateMany = vi.fn();
const candFindMany = vi.fn();
const candUpdateMany = vi.fn();
const getJobs = vi.fn();
const redisInfo = vi.fn();
const sendEmailSpy = vi.fn();
const enqueueEmailSpy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submissionReply: {
      findMany: (...a: unknown[]) => subFindMany(...a),
      updateMany: (...a: unknown[]) => subUpdateMany(...a),
    },
    jobApplicationReply: {
      findMany: (...a: unknown[]) => candFindMany(...a),
      updateMany: (...a: unknown[]) => candUpdateMany(...a),
    },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: { info: (...a: unknown[]) => redisInfo(...a) } }));
vi.mock("@/server/queue/queues", () => ({
  emailsQueue: { getJobs: (...a: unknown[]) => getJobs(...a) },
  enqueueEmail: (...a: unknown[]) => enqueueEmailSpy(...a),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: (...a: unknown[]) => sendEmailSpy(...a) }));

import { MOTIF_ISSUE_INCONNUE, PREFIXE_ISSUE_INCONNUE } from "@/lib/email/reponse-manuelle-etat";
import { lireConfigRedis, veillerReponsesEnCours } from "../veille-reponses-en-cours";

const MAINTENANT = new Date("2026-11-18T12:00:00.000Z");
const ilYa = (min: number) => new Date(MAINTENANT.getTime() - min * 60_000);
const SANS_ATTENTE = { attenteMs: 0 };

const ligne = (id: string, ageMin: number, errorMsg: string | null = null) => ({
  id,
  repliedAt: ilYa(ageMin),
  errorMsg,
});
const job = (replyId: string, ageMin: number, template = "submission-reply") => ({
  timestamp: ilYa(ageMin).getTime(),
  data: { template, payload: { replyId } },
});

const WHERE_PENDING = { deliveryStatus: "pending", sentAt: null };
const whereEcriture = (id: string) => ({
  id,
  deliveryStatus: "pending",
  sentAt: null,
  providerMessageId: null,
  OR: [{ errorMsg: null }, { NOT: { errorMsg: { startsWith: PREFIXE_ISSUE_INCONNUE } } }],
});

beforeEach(() => {
  vi.clearAllMocks();
  subFindMany.mockResolvedValue([]);
  candFindMany.mockResolvedValue([]);
  subUpdateMany.mockResolvedValue({ count: 1 });
  candUpdateMany.mockResolvedValue({ count: 1 });
  getJobs.mockResolvedValue([]);
  redisInfo.mockImplementation(async (section: string) =>
    section === "memory" ? "maxmemory_policy:noeviction\r\n" : "aof_enabled:1\r\n",
  );
});

describe("veillerReponsesEnCours", () => {
  it("V1 — aucune ligne en cours : la file n'est jamais lue", async () => {
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(getJobs).not.toHaveBeenCalled();
    expect(r.enFileDepuisTrop).toBe(0);
    expect(r.perduesCloses).toBe(0);
    expect(r.mesureImpossible).toBe(false);
  });

  it("lit les deux tables avec le filtre exact et sans colonne sensible", async () => {
    await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    for (const m of [subFindMany, candFindMany]) {
      expect(m).toHaveBeenCalledWith({
        where: WHERE_PENDING,
        select: { id: true, repliedAt: true, errorMsg: true },
      });
    }
  });

  it("V2 — job « delayed » vieux de 61 min : compté, aucune écriture", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    getJobs.mockResolvedValue([job("r1", 61)]);
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(r.enFileDepuisTrop).toBe(1);
    expect(r.perduesCloses).toBe(0);
    expect(subUpdateMany).not.toHaveBeenCalled();
    expect(candUpdateMany).not.toHaveBeenCalled();
  });

  it("V3 — job « waiting » vieux de 30 min : rien", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    getJobs.mockResolvedValue([job("r1", 30)]);
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(r.enFileDepuisTrop).toBe(0);
    expect(subUpdateMany).not.toHaveBeenCalled();
  });

  it("garde le job le plus récent quand deux jobs portent la même réponse", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 300)]);
    getJobs.mockResolvedValue([job("r1", 200), job("r1", 10)]);
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(r.enFileDepuisTrop).toBe(0);
  });

  it("V4 — aucun job aux deux lectures, ligne vieille de 2 h : clause exacte + motif", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    candFindMany.mockResolvedValue([ligne("c1", 120)]);
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(getJobs).toHaveBeenCalledTimes(2);
    expect(getJobs).toHaveBeenCalledWith(
      ["active", "waiting", "delayed", "prioritized", "paused"],
      0,
      999,
    );
    expect(subUpdateMany).toHaveBeenCalledTimes(1);
    expect(subUpdateMany).toHaveBeenCalledWith({
      where: whereEcriture("r1"),
      data: { deliveryStatus: "failed", failedAt: MAINTENANT, errorMsg: MOTIF_ISSUE_INCONNUE },
    });
    expect(candUpdateMany).toHaveBeenCalledWith({
      where: whereEcriture("c1"),
      data: { deliveryStatus: "failed", failedAt: MAINTENANT, errorMsg: MOTIF_ISSUE_INCONNUE },
    });
    expect(r.perduesCloses).toBe(2);
  });

  it("ligne perdue mais de moins d'une heure : intacte", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 59)]);
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).not.toHaveBeenCalled();
    expect(r.perduesCloses).toBe(0);
  });

  it("V5 — le job apparaît au 2ᵉ parcours (course avec « Réessayer ») : aucune écriture", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    getJobs.mockResolvedValueOnce([]).mockResolvedValueOnce([job("r1", 0)]);
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).not.toHaveBeenCalled();
    expect(r.perduesCloses).toBe(0);
  });

  it("V6 — getJobs lève : aucune écriture, mesure impossible", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    getJobs.mockRejectedValue(new Error("redis down"));
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).not.toHaveBeenCalled();
    expect(r.mesureImpossible).toBe(true);
  });

  it("V6b — getJobs lève au 2ᵉ parcours seulement : aucune écriture", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    getJobs.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("redis down"));
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).not.toHaveBeenCalled();
    expect(r.mesureImpossible).toBe(true);
  });

  it("V7 — 1000 jobs rendus (liste peut-être tronquée) : aucune écriture", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    getJobs.mockResolvedValue(Array.from({ length: 1000 }, (_, i) => job(`autre${i}`, 5)));
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).not.toHaveBeenCalled();
    expect(r.mesureImpossible).toBe(true);
  });

  it("V7b — 1000 jobs au 2ᵉ parcours seulement : aucune écriture", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    getJobs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, i) => job(`autre${i}`, 5)));
    await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).not.toHaveBeenCalled();
  });

  it("V8 — count 0 (la ligne a bougé) : non compté, rien n'est levé", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    subUpdateMany.mockResolvedValue({ count: 0 });
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(r.perduesCloses).toBe(0);
  });

  it("une erreur d'écriture sur une ligne n'empêche pas les suivantes", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120), ligne("r2", 120)]);
    subUpdateMany.mockRejectedValueOnce(new Error("db")).mockResolvedValueOnce({ count: 1 });
    const r = await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).toHaveBeenCalledTimes(2);
    expect(r.perduesCloses).toBe(1);
  });

  it("une réponse du gabarit candidature n'est pas confondue avec un message de même id", async () => {
    subFindMany.mockResolvedValue([ligne("x", 120)]);
    getJobs.mockResolvedValue([job("x", 5, "candidature-reponse")]);
    await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("un job d'un autre gabarit portant le même replyId n'est pas pris pour la réponse", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    getJobs.mockResolvedValue([job("r1", 5, "contact-confirmed")]);
    await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(subUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("V9 — jamais d'envoi ni de remise en file", async () => {
    subFindMany.mockResolvedValue([ligne("r1", 120)]);
    await veillerReponsesEnCours(MAINTENANT, SANS_ATTENTE);
    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(enqueueEmailSpy).not.toHaveBeenCalled();
  });

  it("V9b — le module n'importe ni sendEmail ni enqueueEmail", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/server/email/veille-reponses-en-cours.ts", "utf8");
    const imports = src
      .split("\n")
      .filter((l) => /^\s*(import|\} from)\b/.test(l) || /from "/.test(l));
    expect(imports.join("\n")).not.toMatch(
      /sendEmail|enqueueEmail|@\/server\/notifications|email\/client/,
    );
    // Aucun appel non plus, hors commentaires.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bsendEmail\b|\benqueueEmail\b/);
  });

  it("V11 — aucun texte ne contient d'adresse ni de mot interdit", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of [
      "src/server/email/veille-reponses-en-cours.ts",
      "src/server/email/health.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      const ajout = f.endsWith("health.ts") ? src.slice(src.indexOf("reponses_envoi_bloque")) : src;
      expect(ajout).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      if (!f.endsWith("health.ts")) {
        expect(ajout).not.toMatch(/qualiopi|opco|prise en charge|financeur/i);
      }
    }
  });
});

describe("lireConfigRedis", () => {
  it("V10 — allkeys-lru : signalé", async () => {
    redisInfo.mockImplementation(async (s: string) =>
      s === "memory" ? "maxmemory_policy:allkeys-lru\r\n" : "aof_enabled:1\r\n",
    );
    expect(await lireConfigRedis()).toEqual({ politique: "allkeys-lru", aof: true });
  });

  it("V10 — aof_enabled:0 : signalé", async () => {
    redisInfo.mockImplementation(async (s: string) =>
      s === "memory" ? "maxmemory_policy:noeviction\r\n" : "aof_enabled:0\r\n",
    );
    expect(await lireConfigRedis()).toEqual({ politique: "noeviction", aof: false });
  });

  it("V10 — noeviction + aof 1 : conforme", async () => {
    expect(await lireConfigRedis()).toEqual({ politique: "noeviction", aof: true });
  });

  it("V10 — INFO lève : null", async () => {
    redisInfo.mockRejectedValue(new Error("boom"));
    expect(await lireConfigRedis()).toBeNull();
  });

  it("V10 — champ absent : null (ne pas conclure « conforme »)", async () => {
    redisInfo.mockResolvedValue("# Memory\r\n");
    expect(await lireConfigRedis()).toBeNull();
  });
});
