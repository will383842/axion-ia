// Lot S3 — gabarit d'e-mail inconnu du worker (application mise en ligne avant lui, D8b).
// Reporté (jusqu'à 9 fois), puis repli `gabaritRepli` s'il est connu, sinon échec franc.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  annule: vi.fn(),
  oppose: false,
  connus: new Set<string>(["contact-confirmed"]),
}));

vi.mock("bullmq", async () => {
  class DelayedError extends Error {}
  class UnrecoverableError extends Error {}
  return {
    DelayedError,
    UnrecoverableError,
    Worker: class {
      constructor(...args: unknown[]) {
        d.ctor(...args);
      }
      on(): this {
        return this;
      }
    },
  };
});
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("../../lib/sanitize-job-data", () => ({ redactEmailValue: (v: string) => v }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
  estGabaritConnu: (nom: string) => d.connus.has(nom),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(), isDecryptedEmailUsable: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOpposition: {
      findFirst: async () => null,
      findUnique: async () => (d.oppose ? { id: "opp" } : null),
    },
    emailLog: { findFirst: async () => null },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
  marquerAnnule: (...a: unknown[]) => d.annule(...a),
}));

import { DelayedError, UnrecoverableError } from "bullmq";
import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>, token?: string) => Promise<void>;

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

function job(data: Record<string, unknown>) {
  return {
    id: "job-1",
    name: data["template"],
    data,
    attemptsMade: 0,
    opts: { attempts: 5 },
    updateData: vi.fn().mockResolvedValue(undefined),
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  };
}

const RENDU = { subject: "Objet", html: "<p>x</p>", text: "x", famille: "A" as const };

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue(RENDU);
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.noter.mockResolvedValue(undefined);
  d.annule.mockResolvedValue(1);
  d.oppose = false;
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

const base = { to: "a@b.fr", locale: "fr", payload: { gabaritRepli: "contact-confirmed" } };

describe("lot S3 — gabarit inconnu", () => {
  it("🔴 moins de 9 reports : job reporté, DelayedError, rien n'est envoyé, journal « en attente »", async () => {
    const j = job({ ...base, template: "accuse-nouveau", reportsGabaritInconnu: 3 });
    const avant = Date.now();
    await expect(processeur()(j, "tok")).rejects.toBeInstanceOf(DelayedError);
    expect(j.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ reportsGabaritInconnu: 4, template: "accuse-nouveau" }),
    );
    expect(j.moveToDelayed).toHaveBeenCalledWith(expect.any(Number), "tok");
    const ts = j.moveToDelayed.mock.calls[0]?.[0] as number;
    expect(ts - avant).toBeGreaterThanOrEqual(10 * 60_000 - 1000);
    expect(d.render).not.toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.cloturer).not.toHaveBeenCalled(); // la ligne reste « en attente »
    expect(d.noter).not.toHaveBeenCalled(); // aucune tentative comptée
  });

  it("premier passage : compteur absent = 0, devient 1", async () => {
    const j = job({ ...base, template: "accuse-nouveau" });
    await expect(processeur()(j, "t")).rejects.toBeInstanceOf(DelayedError);
    expect(j.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ reportsGabaritInconnu: 1 }),
    );
  });

  it("🔴 9 reports faits + `gabaritRepli` connu : le repli est rendu et envoyé", async () => {
    const j = job({ ...base, template: "accuse-nouveau", reportsGabaritInconnu: 9 });
    await processeur()(j, "t");
    expect(j.moveToDelayed).not.toHaveBeenCalled();
    expect(d.render.mock.calls[0]?.[0]).toBe("contact-confirmed");
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("charge passée au repli : la charge d'origine, et le journal note le repli", async () => {
    const payload = { gabaritRepli: "contact-confirmed", nom: "Dupont" };
    const j = job({
      to: "a@b.fr",
      locale: "fr",
      payload,
      template: "accuse-nouveau",
      reportsGabaritInconnu: 9,
    });
    await processeur()(j, "t");
    expect(d.render.mock.calls[0]?.[0]).toBe("contact-confirmed");
    expect(d.render.mock.calls[0]?.[2]).toEqual(payload);
    expect(d.cloturer).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "contact-confirmed",
        status: "sent",
        error: "rendu par le gabarit de repli contact-confirmed",
      }),
    );
  });

  it("gabarit connu : le journal ne porte aucune note de repli", async () => {
    await processeur()(job({ ...base, template: "contact-confirmed" }), "t");
    expect(d.cloturer.mock.calls[0]?.[0]).not.toHaveProperty("error");
  });

  it("🔴 repli = sollicitation soumise à opposition, destinataire opposé : rien ne part, « retenu »", async () => {
    d.connus.add("lead-apporteur-relance");
    d.oppose = true;
    const j = job({
      to: "a@b.fr",
      locale: "fr",
      payload: { gabaritRepli: "lead-apporteur-relance" },
      template: "accuse-nouveau",
      reportsGabaritInconnu: 9,
    });
    await processeur()(j, "t");
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.render).not.toHaveBeenCalled();
    expect(d.annule).toHaveBeenCalledWith(
      "job-1",
      expect.stringContaining("Retenu à l'envoi : la personne s'est opposée"),
    );
  });

  it("🔴 9 reports faits, repli absent : UnrecoverableError, journal en échec avec motif", async () => {
    const j = job({
      to: "a@b.fr",
      locale: "fr",
      payload: {},
      template: "accuse-nouveau",
      reportsGabaritInconnu: 9,
    });
    await expect(processeur()(j, "t")).rejects.toBeInstanceOf(UnrecoverableError);
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.cloturer).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: expect.stringContaining("gabarit inconnu de ce worker"),
      }),
    );
  });

  it("repli lui-même inconnu : échec franc", async () => {
    const j = job({
      to: "a@b.fr",
      locale: "fr",
      payload: { gabaritRepli: "autre-inconnu" },
      template: "accuse-nouveau",
      reportsGabaritInconnu: 9,
    });
    await expect(processeur()(j, "t")).rejects.toBeInstanceOf(UnrecoverableError);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("gabarit connu : chemin inchangé (ni report, ni repli)", async () => {
    const j = job({ ...base, template: "contact-confirmed" });
    await processeur()(j, "t");
    expect(j.updateData).not.toHaveBeenCalled();
    expect(j.moveToDelayed).not.toHaveBeenCalled();
    expect(d.render.mock.calls[0]?.[0]).toBe("contact-confirmed");
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });
});
