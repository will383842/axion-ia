// STOP-T1b — quatre suites de l'audit, dans le worker des e-mails.
//   1) un guide déjà servi par un autre job (parti après la mise en file de celui-ci) ne repart pas ;
//   2) aucune adresse en clair dans ce que le worker et le journal écrivent sur la console ;
//   3) le libellé du motif d'échec au départ ;
//   4) un job `marketing: true` relit l'opposition au départ.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  handlers: {} as Record<string, (...a: unknown[]) => void>,
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  annuler: vi.fn(),
  marquer: vi.fn(),
  demande: vi.fn(),
  opposition: vi.fn(),
  ecarte: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(evt: string, fn: (...a: unknown[]) => void): this {
      d.handlers[evt] = fn;
      return this;
    }
  },
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(), isDecryptedEmailUsable: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: { findUnique: (...a: unknown[]) => d.demande(...a) },
    emailLog: { findFirst: async () => null },
    emailOpposition: {
      findUnique: (...a: unknown[]) => d.opposition(...a),
      findFirst: (...a: unknown[]) => d.ecarte(...a),
    },
    newsletterSubscriber: { findUnique: async () => null },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
  marquerAnnule: (...a: unknown[]) => d.annuler(...a),
}));
vi.mock("@/server/guide-ia/journal", () => ({
  marquerGuideEnvoye: (...a: unknown[]) => d.marquer(...a),
}));

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

const ADRESSE = "nadia@exemple.fr";
const CREATION_JOB = Date.parse("2026-11-10T08:00:00Z");

function jobGuide(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "job-guide",
    name: "guide-ia-envoi",
    timestamp: CREATION_JOB,
    data: {
      template: "guide-ia-envoi",
      to: ADRESSE,
      locale: "fr",
      payload: { downloadToken: "a".repeat(64) },
      entityType: "GuideRequest",
      entityId: "demande-1",
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "B" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.annuler.mockResolvedValue(1);
  d.marquer.mockResolvedValue(undefined);
  d.demande.mockResolvedValue({ sentAt: null });
  d.opposition.mockResolvedValue(null);
  d.ecarte.mockResolvedValue(null);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("1) « Votre guide » : pas de second envoi d'une demande déjà servie", () => {
  it("1a) servie par un autre job APRÈS la mise en file de celui-ci : rien ne part, journal « annulé », pas de réessai", async () => {
    d.demande.mockResolvedValue({ sentAt: new Date(CREATION_JOB + 3_600_000) });
    await expect(processeur()(jobGuide())).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.marquer).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledTimes(1);
    const [id, trace] = d.annuler.mock.calls[0] as [string, string];
    expect(id).toBe("job-guide");
    expect(trace).toContain("guide déjà envoyé pour cette demande");
    expect(trace).not.toContain("@");
    expect(d.noter).not.toHaveBeenCalled();
    expect(d.cloturer).not.toHaveBeenCalled();
  });

  it("1b) premier envoi (demande jamais servie) : part normalement et clôt la demande", async () => {
    await processeur()(jobGuide());
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.cloturer).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
    expect(d.marquer).toHaveBeenCalledWith("demande-1");
  });

  it("1c) renvoi VOULU (nouveau job, mis en file après le premier envoi) : part", async () => {
    d.demande.mockResolvedValue({ sentAt: new Date(CREATION_JOB - 86_400_000) });
    await processeur()(jobGuide());
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.marquer).toHaveBeenCalledWith("demande-1");
  });

  it("1d) relecture de la demande en panne : rien ne part, tentative notée, erreur relancée (réessai)", async () => {
    d.demande.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(processeur()(jobGuide())).rejects.toThrow("ECONNREFUSED");
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.noter).toHaveBeenCalledTimes(1);
    expect(d.cloturer).not.toHaveBeenCalled();
  });

  it("1d bis) dernier essai : journal clos en échec, rien ne part", async () => {
    d.demande.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(processeur()(jobGuide({ attemptsMade: 4 }))).rejects.toThrow();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.cloturer).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("sans date de création lisible, le chemin d'avant : le guide part, sans relecture", async () => {
    await processeur()(jobGuide({ timestamp: undefined }));
    expect(d.demande).not.toHaveBeenCalled();
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("un autre gabarit ne relit jamais la demande du guide", async () => {
    await processeur()({
      id: "job-f",
      name: "devis-envoi",
      timestamp: CREATION_JOB,
      data: {
        template: "devis-envoi",
        to: ADRESSE,
        locale: "fr",
        payload: {},
        entityType: "Quote",
        entityId: "devis-1",
      },
      attemptsMade: 0,
      opts: { attempts: 5 },
    });
    expect(d.demande).not.toHaveBeenCalled();
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("2) aucune adresse en clair sur la console", () => {
  it("le gestionnaire `failed` n'écrit ni l'adresse du message d'erreur ni celle du job", () => {
    processeur();
    const err = Object.assign(new Error(`550 5.1.1 <${ADRESSE}> user unknown`), {
      code: "EENVELOPE",
    });
    d.handlers["failed"]?.({ name: "guide-ia-envoi", data: { to: ADRESSE } }, err);
    const ecrit = JSON.stringify((console.error as ReturnType<typeof vi.fn>).mock.calls);
    expect(ecrit).not.toContain(ADRESSE);
    expect(ecrit).not.toContain("nadia@");
    expect(ecrit).toContain("EENVELOPE");
  });
});

describe("3) libellé du motif d'échec au départ", () => {
  it("lecture de la mise à l'écart en panne (convocation) : « contrôle du départ illisible »", async () => {
    d.ecarte.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(
      processeur()({
        id: "job-c",
        name: "qualiopi-convocation",
        timestamp: CREATION_JOB,
        data: { template: "qualiopi-convocation", to: ADRESSE, locale: "fr", payload: {} },
        attemptsMade: 4,
        opts: { attempts: 5 },
      }),
    ).rejects.toThrow();
    const arg = d.cloturer.mock.calls[0]?.[0] as { error: string };
    expect(arg.error).toBe("contrôle du départ illisible : rien n'est parti");
  });
});

describe("4) job marketing : l'opposition arrivée après la mise en file est respectée", () => {
  function jobMarketing(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "job-m",
      name: "devis-envoi",
      timestamp: CREATION_JOB,
      data: {
        template: "devis-envoi",
        to: ADRESSE,
        locale: "fr",
        payload: {},
        marketing: true,
      },
      attemptsMade: 0,
      opts: { attempts: 5 },
      ...over,
    };
  }

  it("marketing: true + opposition arrivée après la mise en file => retenu, journal « annulé »", async () => {
    d.opposition.mockResolvedValue({ id: "opp-1" });
    await processeur()(jobMarketing());
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledTimes(1);
  });

  it("marketing: true sans opposition : part", async () => {
    await processeur()(jobMarketing());
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("un job NON marketing (facture) ne relit pas l'opposition : chemin inchangé", async () => {
    d.opposition.mockResolvedValue({ id: "opp-1" });
    const j = jobMarketing();
    (j["data"] as Record<string, unknown>)["marketing"] = false;
    await processeur()(j);
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
  });
});
