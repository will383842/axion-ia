// L-INV — l'invitation F1 posée À LA MAIN par « Ajouter un candidat formateur » (L0c-3,
// clé `fi-f1-<id>`, candidature `origine = console`) garde au départ EXACTEMENT la
// relecture d'avant L-INV : texte validé, opposition, fiche effacée. Les interrupteurs de
// l'invitation AUTOMATIQUE (`invitation_auto`, `suivi_echange`), coupés ou allumés, n'y
// changent rien. L'invitation du balayage, elle, reste jugée par son lecteur strict.
//
// Sur le VRAI processeur (base, file et envoi doublés).

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  annuler: vi.fn(),
  submission: vi.fn(),
  rebond: vi.fn(),
  opposition: vi.fn(),
  abonne: vi.fn(),
  settings: vi.fn(),
  trainer: vi.fn(),
  application: vi.fn(),
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
  isDecryptedEmailUsable: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findUnique: (...a: unknown[]) => d.submission(...a) },
    emailLog: { findFirst: (...a: unknown[]) => d.rebond(...a) },
    emailOpposition: { findUnique: (...a: unknown[]) => d.opposition(...a) },
    newsletterSubscriber: { findUnique: (...a: unknown[]) => d.abonne(...a) },
    setting: { findMany: (...a: unknown[]) => d.settings(...a) },
    trainer: { findUnique: (...a: unknown[]) => d.trainer(...a) },
    jobApplication: { findUnique: (...a: unknown[]) => d.application(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
  marquerAnnule: (...a: unknown[]) => d.annuler(...a),
}));

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;
function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

const CANDIDATURE = "33333333-3333-4333-8333-333333333333";
const F1 = "formateur-invitation-echange";

function job(jobId: string): Record<string, unknown> {
  return {
    id: jobId,
    name: F1,
    data: {
      template: F1,
      to: "claire@exemple.fr",
      locale: "fr",
      payload: { prenom: "Claire", lien: "https://exemple.fr/formateur?depuis=fa-x" },
      entityType: "JobApplication",
      entityId: CANDIDATURE,
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
  };
}

/** Le texte de F1 validé ; l'invitation automatique allumée ou non (ses DEUX clés). */
function reglages(o: { texteValide: boolean; invitationAuto: boolean }) {
  d.settings.mockImplementation(
    async (q: { where: { key: { startsWith?: string; in?: string[] } } }) => {
      const auto = [
        { key: "formateurs.invitation_auto", value: { actif: o.invitationAuto } },
        { key: "formateurs.suivi_echange", value: { actif: o.invitationAuto } },
        { key: "formateurs.echange_ouvert", value: { actif: o.invitationAuto } },
      ];
      if (q.where.key.in) return auto.filter((l) => q.where.key.in!.includes(l.key));
      if (q.where.key.startsWith === "formateurs.") {
        return [{ key: "formateurs.textes_valides", value: { actif: true } }, ...auto];
      }
      return o.texteValide ? [{ key: `textes_valides.${F1}`, value: { valide: true } }] : [];
    },
  );
}

function candidature(origine: "console" | "formulaire") {
  d.application.mockResolvedValue({ email: "chiffre(claire@exemple.fr)", origine });
}

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "A" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.annuler.mockResolvedValue(1);
  d.rebond.mockResolvedValue(null);
  d.opposition.mockResolvedValue(null);
  d.abonne.mockResolvedValue(null);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("l'invitation posée par la console part comme avant L-INV", () => {
  it.each([
    ["coupés", false],
    ["allumés", true],
  ])(
    "interrupteurs de l'invitation automatique %s : texte validé → elle part",
    async (_l, invitationAuto) => {
      reglages({ texteValide: true, invitationAuto });
      candidature("console");
      await processeur()(job(`fi-f1-${CANDIDATURE}`));
      expect(d.sendEmail).toHaveBeenCalledTimes(1);
      expect(d.annuler).not.toHaveBeenCalled();
    },
  );
  it("sortie de la corbeille (sans sa clé) : elle part aussi", async () => {
    reglages({ texteValide: true, invitationAuto: false });
    candidature("console");
    await processeur()(job("12345"));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });
  it("texte de F1 non validé : retenue, comme avant", async () => {
    reglages({ texteValide: false, invitationAuto: false });
    candidature("console");
    await processeur()(job(`fi-f1-${CANDIDATURE}`));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledWith(
      `fi-f1-${CANDIDATURE}`,
      expect.stringMatching(/non validé/),
    );
  });
  it("opposition : retenue, comme avant", async () => {
    reglages({ texteValide: true, invitationAuto: false });
    candidature("console");
    d.opposition.mockResolvedValue({ id: "o1" });
    await processeur()(job(`fi-f1-${CANDIDATURE}`));
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
});

describe("l'invitation du balayage garde son lecteur strict", () => {
  it("candidature du formulaire, invitation automatique coupée : retenue", async () => {
    reglages({ texteValide: true, invitationAuto: false });
    candidature("formulaire");
    await processeur()(job("fi-invit-p1"));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledWith(
      "fi-invit-p1",
      expect.stringMatching(/invitation automatique ou suivi de l'échange coupé/),
    );
  });
  it("une clé `fi-f1-` ne suffit pas : candidature du formulaire = lecteur strict", async () => {
    reglages({ texteValide: true, invitationAuto: false });
    candidature("formulaire");
    await processeur()(job(`fi-f1-${CANDIDATURE}`));
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
  it("origine illisible (base muette) : retenue", async () => {
    reglages({ texteValide: true, invitationAuto: true });
    d.application.mockRejectedValue(new Error("base"));
    await processeur()(job(`fi-f1-${CANDIDATURE}`));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledTimes(1);
  });
});
