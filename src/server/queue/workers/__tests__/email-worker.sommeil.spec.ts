// L9b — un job d'e-mail en sommeil déjà en file ne part pas et n'échoue pas.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  annuler: vi.fn(),
  cloturer: vi.fn(),
  echec: vi.fn(),
  ecarte: vi.fn(),
  opposition: vi.fn(),
}));

vi.mock("bullmq", () => ({
  DelayedError: class extends Error {},
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(): this {
      return this;
    }
  },
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("../../lib/sanitize-job-data", () => ({ redactEmailValue: (v: string) => v }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => v,
  isDecryptedEmailUsable: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findFirst: vi.fn().mockResolvedValue(null) },
    emailOpposition: {
      findFirst: (...a: unknown[]) => d.ecarte(...a),
      findUnique: (...a: unknown[]) => d.opposition(...a),
    },
    newsletterSubscriber: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.echec(...a),
  marquerAnnule: (...a: unknown[]) => d.annuler(...a),
}));

import { startEmailWorker } from "../email-worker";
import {
  GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL,
  MESSAGE_EMAIL_EN_SOMMEIL,
} from "@/server/qualiopi/financements/sommeil";

type Processeur = (job: Record<string, unknown>, token?: string) => Promise<void>;
function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

const SOMMEIL = GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL[0];
const TRACE = "Retenu à l'envoi : e-mail en sommeil";

function job(template: string, over: Record<string, unknown> = {}) {
  return {
    id: "email-x",
    name: template,
    data: { template, to: "a@exemple.fr", locale: "fr", payload: {} },
    attemptsMade: 0,
    attemptsStarted: 1,
    opts: { attempts: 5 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "A" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.annuler.mockResolvedValue(1);
  d.ecarte.mockResolvedValue(null);
  d.opposition.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

function sansEnvoiNiEchec() {
  expect(d.sendEmail).not.toHaveBeenCalled();
  expect(d.render).not.toHaveBeenCalled();
  expect(d.cloturer).not.toHaveBeenCalled();
  expect(d.echec).not.toHaveBeenCalled();
  expect(d.ecarte).not.toHaveBeenCalled();
}

describe("worker — e-mail en sommeil", () => {
  it("job en file : terminé sans erreur, journal annulé une fois, rien d'envoyé", async () => {
    await expect(processeur()(job(SOMMEIL))).resolves.toBeUndefined();
    sansEnvoiNiEchec();
    expect(d.annuler).toHaveBeenCalledTimes(1);
    expect(d.annuler).toHaveBeenCalledWith("email-x", TRACE);
  });

  it("rejeu / nouvel essai (attemptsMade 3) : même résultat", async () => {
    await expect(processeur()(job(SOMMEIL, { attemptsMade: 3 }))).resolves.toBeUndefined();
    sansEnvoiNiEchec();
    expect(d.annuler).toHaveBeenCalledWith("email-x", TRACE);
  });

  it("job sans id : pas d'erreur, pas d'annulation, pas d'envoi", async () => {
    await expect(processeur()(job(SOMMEIL, { id: undefined }))).resolves.toBeUndefined();
    sansEnvoiNiEchec();
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("témoin : drapeau à « true » → le même job part", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    await processeur()(job(SOMMEIL));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("autre gabarit, drapeau éteint : chemin inchangé", async () => {
    await processeur()(job("contact-confirmed"));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("message et trace sans mot interdit", () => {
    const interdit = /qualiopi|opco|pris(e|es)?\s+en\s+charge|financeur|financ|certification/i;
    expect(MESSAGE_EMAIL_EN_SOMMEIL).not.toMatch(interdit);
    expect(TRACE).not.toMatch(interdit);
  });
});

describe("garde de source", () => {
  const racine = resolve(__dirname, "../../../../..");
  const fichiers = [
    "src/server/queue/workers/email-worker.ts",
    "src/server/actions/qualiopi/email-outbox.ts",
  ];
  const nomEnClair = new RegExp(GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL.join("|"));

  it.each(fichiers)("%s passe par gabaritEnSommeil et ne cite aucun nom", (f) => {
    const src = readFileSync(resolve(racine, f), "utf8");
    expect(src).toContain("financements/sommeil");
    expect(src).toContain("gabaritEnSommeil(");
    expect(src).not.toMatch(nomEnClair);
  });

  it("test du test : une chaîne qui cite un nom est repérée", () => {
    expect(`x "${SOMMEIL}" y`).toMatch(nomEnClair);
  });
});
