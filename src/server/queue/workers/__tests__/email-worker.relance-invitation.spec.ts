// Le filet du DÉPART pour les rappels de l'invitation à l'échange (2026-09-27).
//
// Le passage quotidien pose des jobs immédiats ; le worker relit l'état de la
// personne juste avant d'envoyer. Gardé ici sur le VRAI processeur et le VRAI
// module d'état (seules la base, la file et l'envoi sont doublés) :
//   - sans rien de neuf, le rappel part ;
//   - une réservation (même annulée), une réponse, un classement arrivés depuis
//     le passage le retiennent : ligne « annulé », aucun envoi ;
//   - base muette : on RETIENT (un rappel perdu ne coûte rien) ;
//   - un rappel sans fiche liée est retenu ;
//   - les autres sollicitations ne paient pas cette lecture.

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  annuler: vi.fn(),
  submission: vi.fn(),
  submissions: vi.fn(),
  rebond: vi.fn(),
  invitation: vi.fn(),
  opposition: vi.fn(),
  abonne: vi.fn(),
  calendly: vi.fn(),
  reponses: vi.fn(),
  journal: vi.fn(),
  corbeille: vi.fn(),
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
  decryptPii: (v: string | null) => v,
  isDecryptedEmailUsable: (v: string | null) => !!v && v.includes("@"),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: (...a: unknown[]) => d.submission(...a),
      findMany: (...a: unknown[]) => d.submissions(...a),
    },
    emailLog: {
      // Deux lecteurs : le verdict (rebond, sans gabarit) et le filet (l'invitation).
      findFirst: (a: { where?: { template?: string } }) =>
        a.where?.template === "apporteur-invitation-appel" ? d.invitation(a) : d.rebond(a),
      findMany: (...a: unknown[]) => d.journal(...a),
    },
    emailOutbox: { findMany: (...a: unknown[]) => d.corbeille(...a) },
    emailOpposition: { findUnique: (...a: unknown[]) => d.opposition(...a) },
    newsletterSubscriber: { findUnique: (...a: unknown[]) => d.abonne(...a) },
    calendlyEvent: { findMany: (...a: unknown[]) => d.calendly(...a) },
    submissionReply: { findMany: (...a: unknown[]) => d.reponses(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: vi.fn(),
  marquerAnnule: (...a: unknown[]) => d.annuler(...a),
}));

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

const LIGNE_ID = "11111111-1111-4111-8111-111111111111";
const INVITATION = new Date("2026-09-27T19:30:00Z");

const LIGNE = {
  id: LIGNE_ID,
  contactEmailHash: "empreinte-a",
  contactEmail: "camille@exemple.fr",
  contactName: "Camille",
  locale: "fr",
  deletedAt: null,
  archivedAt: null,
  status: "new",
  details: {},
};

function job(
  template = "apporteur-invitation-relance",
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "job-relance",
    name: template,
    data: {
      template,
      to: "camille@exemple.fr",
      locale: "fr",
      payload: { calendlyUrl: "https://calendly.com/axion-ia/x", etape: "j3" },
      entityType: "Submission",
      entityId: LIGNE_ID,
      ...over,
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "B" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.annuler.mockResolvedValue(1);
  d.submission.mockResolvedValue(LIGNE);
  d.submissions.mockResolvedValue([LIGNE]);
  d.rebond.mockResolvedValue(null);
  d.invitation.mockResolvedValue({ id: "inv-1", createdAt: INVITATION });
  d.opposition.mockResolvedValue(null);
  d.abonne.mockResolvedValue(null);
  d.calendly.mockResolvedValue([]);
  d.reponses.mockResolvedValue([]);
  d.journal.mockResolvedValue([]);
  d.corbeille.mockResolvedValue([]);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function attendRetenu(motif: RegExp) {
  expect(d.sendEmail).not.toHaveBeenCalled();
  expect(d.render).not.toHaveBeenCalled();
  expect(d.annuler).toHaveBeenCalledWith("job-relance", expect.stringMatching(motif));
  expect(d.cloturer).not.toHaveBeenCalled();
}

describe("le rappel de l'invitation au départ", () => {
  it("rien de neuf depuis le passage : il part", async () => {
    await processeur()(job());
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
    // L'état a bien été relu, pour la bonne personne.
    expect(d.calendly).toHaveBeenCalledTimes(1);
  });

  it("🔴 une réservation arrivée entre-temps le retient", async () => {
    d.calendly.mockResolvedValue([{ linkedSubmissionId: LIGNE_ID, inviteeEmail: null }]);
    await processeur()(job());
    attendRetenu(/^Retenu à l'envoi : la personne a réservé son échange/);
  });

  it("🔴 une réservation pas encore rattachée, reconnue par l'adresse de l'invité", async () => {
    d.calendly.mockResolvedValue([
      { linkedSubmissionId: null, inviteeEmail: "CAMILLE@exemple.fr" },
    ]);
    await processeur()(job());
    attendRetenu(/réservé son échange/);
  });

  it("🔴 une réponse faite depuis l'invitation le retient", async () => {
    d.reponses.mockResolvedValue([
      { submissionId: LIGNE_ID, repliedAt: new Date("2026-09-29T10:00:00Z") },
    ]);
    await processeur()(job());
    attendRetenu(/une réponse lui a été faite/);
  });

  it("🔴 une fiche archivée entre-temps le retient", async () => {
    const archivee = { ...LIGNE, archivedAt: new Date(0), status: "archived" };
    d.submission.mockResolvedValue(archivee);
    d.submissions.mockResolvedValue([archivee]);
    await processeur()(job());
    attendRetenu(/archivée ou classée sans suite/);
  });

  it("aucune invitation partie retrouvée : retenu", async () => {
    d.invitation.mockResolvedValue(null);
    await processeur()(job());
    attendRetenu(/aucune invitation/);
  });

  it("base muette pendant la relecture : retenu, pas envoyé", async () => {
    d.calendly.mockRejectedValue(new Error("ECONNREFUSED"));
    await processeur()(job());
    attendRetenu(/état illisible/);
  });

  it("sans fiche liée : retenu", async () => {
    await processeur()(job("apporteur-invitation-relance", { entityId: undefined }));
    attendRetenu(/sans fiche liée/);
  });

  it("les autres sollicitations ne relisent pas cet état", async () => {
    await processeur()(job("lead-apporteur-relance", { payload: { etape: "j2" } }));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.calendly).not.toHaveBeenCalled();
  });
});
