// Mise à l'écart (demande d'effacement) relue AU DÉPART par le worker d'e-mails — 11/11/2026.
//
//   - tout gabarit (convocation, facture…) en attente ou en réessai est retenu pour une adresse
//     écartée ; seul `gdpr-export-link` part ;
//   - `submission-reply` et `candidature-reponse` (mis en file avec `to = ""`) sont retenus en
//     relisant la marque sur l'adresse déchiffrée ;
//   - le motif de trace dit « effacement », jamais « désabonnement ».
import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  annuler: vi.fn(),
  ecarte: vi.fn(),
  opposition: vi.fn(),
  rebond: vi.fn(),
  abonne: vi.fn(),
  replyFind: vi.fn(),
  replyUpdate: vi.fn(),
  candFind: vi.fn(),
  candUpdate: vi.fn(),
}));

vi.mock("bullmq", () => ({
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
  decryptPii: (v: string | null) => (v === null ? null : String(v).replace(/^chiffre\(|\)$/g, "")),
  isDecryptedEmailUsable: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    emailLog: { findFirst: (...a: unknown[]) => d.rebond(...a) },
    emailOpposition: {
      findFirst: (...a: unknown[]) => d.ecarte(...a),
      findUnique: (...a: unknown[]) => d.opposition(...a),
    },
    newsletterSubscriber: { findUnique: (...a: unknown[]) => d.abonne(...a) },
    submissionReply: {
      findUnique: (...a: unknown[]) => d.replyFind(...a),
      update: (...a: unknown[]) => d.replyUpdate(...a),
    },
    jobApplicationReply: {
      findUnique: (...a: unknown[]) => d.candFind(...a),
      update: (...a: unknown[]) => d.candUpdate(...a),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: vi.fn().mockResolvedValue(undefined),
  noterTentativeEchouee: vi.fn(),
  marquerAnnule: (...a: unknown[]) => d.annuler(...a),
}));

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;
function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

function job(template: string, over: Record<string, unknown> = {}, to = "nadia@exemple.fr") {
  return {
    id: "job-1",
    name: template,
    data: { template, to, locale: "fr", payload: { replyId: "r-1" } },
    attemptsMade: 2, // en attente de réessai
    opts: { attempts: 5 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["PII_ENCRYPTION_KEY"] ??=
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "A" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.annuler.mockResolvedValue(1);
  d.ecarte.mockResolvedValue({ effacementDemandeLe: new Date("2026-11-11T10:00:00Z") });
  d.rebond.mockResolvedValue(null);
  d.opposition.mockResolvedValue(null);
  d.abonne.mockResolvedValue(null);
  d.replyFind.mockResolvedValue({
    id: "r-1",
    submissionId: "s-1",
    toEmail: "chiffre(nadia@exemple.fr)",
    subject: "Re",
    bodyHtml: "<p>x</p>",
    bodyText: "x",
    submission: { id: "s-1", firstRepliedAt: null },
  });
  d.candFind.mockResolvedValue({
    id: "c-1",
    toEmail: "chiffre(nadia@exemple.fr)",
    subject: "Re",
    bodyHtml: "<p>x</p>",
    bodyText: "x",
  });
  d.replyUpdate.mockResolvedValue({});
  d.candUpdate.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("🔴 adresse écartée : relue au départ pour TOUS les gabarits", () => {
  it.each(["session-convocation", "facture-envoyee", "attestation-envoyee"])(
    "%s (job en attente de réessai) ne part pas, trace « effacement »",
    async (template) => {
      await processeur()(job(template, {}));
      expect(d.sendEmail).not.toHaveBeenCalled();
      expect(d.render).not.toHaveBeenCalled();
      expect(d.annuler).toHaveBeenCalledWith("job-1", expect.stringMatching(/effacement/));
      expect(d.annuler).toHaveBeenCalledWith("job-1", expect.not.stringMatching(/désabonnement/));
    },
  );

  it("gdpr-export-link part malgré la mise à l'écart", async () => {
    await processeur()(job("gdpr-export-link"));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("personne écartée absente de la liste : le gabarit part", async () => {
    d.ecarte.mockResolvedValue(null);
    await processeur()(job("session-convocation"));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("une sollicitation retenue pour écart dit « effacement », pas « désabonnement »", async () => {
    const j = job("lead-apporteur-relance");
    (j["data"] as Record<string, unknown>)["payload"] = { etape: "j2" };
    await processeur()(j);
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledWith("job-1", expect.stringMatching(/effacement/));
  });
});

describe('🔴 submission-reply et candidature-reponse (mis en file avec to = "")', () => {
  it("submission-reply : adresse écartée → ne part pas, réponse marquée en échec lisible", async () => {
    await processeur()(job("submission-reply", {}, ""));
    expect(d.sendEmail).not.toHaveBeenCalled();
    const maj = d.replyUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(maj.data["deliveryStatus"]).toBe("failed");
    expect(String(maj.data["errorMsg"])).toMatch(/effacement/);
  });

  it("candidature-reponse : adresse écartée → ne part pas", async () => {
    await processeur()(job("candidature-reponse", {}, ""));
    expect(d.sendEmail).not.toHaveBeenCalled();
    const maj = d.candUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(maj.data["deliveryStatus"]).toBe("failed");
  });

  it("adresse non écartée : les deux réponses partent", async () => {
    d.ecarte.mockResolvedValue(null);
    await processeur()(job("submission-reply", {}, ""));
    await processeur()(job("candidature-reponse", {}, ""));
    expect(d.sendEmail).toHaveBeenCalledTimes(2);
  });
});
