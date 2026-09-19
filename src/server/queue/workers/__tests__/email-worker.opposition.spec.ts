// Le filet du worker d'e-mails — 2026-09-19.
//
// Les relances J+2 / J+7, l'invitation à l'échange et le kit du dossier
// commencé sont des jobs RETARDÉS : ils sont vérifiés à l'enfilage, puis
// dorment des heures ou des jours dans Redis. Une opposition exprimée entre-
// temps, ou un effacement RGPD, n'était relue par personne au moment du départ.
//
// Gardé ici, sur le VRAI processeur et le VRAI verdict (seules la base, la file
// et l'envoi sont doublés) :
//   - une opposition enregistrée APRÈS l'enfilage retient les trois
//     sollicitations au départ, clôt la ligne en « annulé » et n'envoie rien ;
//   - l'accusé d'une démarche (sans variante) part malgré l'opposition ;
//   - une fiche absente, en corbeille ou effacée (art. 17) n'est pas écrite ;
//   - un job sans identifiant ne touche pas au journal ;
//   - base en panne : l'envoi continue (échec ouvert assumé, et bruyant).

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
// L'adresse de la fiche est « chiffrée » en `chiffre(...)` dans la doublure.
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

const SUBMISSION_ID = "11111111-1111-4111-8111-111111111111";

function job(
  template: string,
  payload: Record<string, unknown> = {},
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "job-1",
    name: template,
    data: {
      template,
      to: "nadia@exemple.fr",
      locale: "fr",
      payload,
      entityType: "Submission",
      entityId: SUBMISSION_ID,
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
    ...over,
  };
}

const SOLLICITATIONS: Array<[string, Record<string, unknown>]> = [
  ["lead-apporteur-relance", { etape: "j2", dossierUrl: "https://axion-ia.com/fr/x" }],
  ["apporteur-invitation-appel", { calendlyUrl: "https://calendly.com/axion-ia/x" }],
  ["lead-apporteur-recu", { variante: "dossier-commence", dossierUrl: "https://axion-ia.com/x" }],
];

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "B" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.annuler.mockResolvedValue(1);
  d.submission.mockResolvedValue({ deletedAt: null, contactEmail: "chiffre(nadia@exemple.fr)" });
  d.rebond.mockResolvedValue(null);
  d.opposition.mockResolvedValue(null);
  d.abonne.mockResolvedValue(null);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("🔴 opposition exprimée APRÈS l'enfilage", () => {
  it.each(SOLLICITATIONS)(
    "%s ne part pas : ligne clôturée « annulé », aucun envoi",
    async (template, payload) => {
      d.opposition.mockResolvedValue({ id: "opp-1" });
      await expect(processeur()(job(template, payload))).resolves.toBeUndefined();
      expect(d.sendEmail).not.toHaveBeenCalled();
      expect(d.render).not.toHaveBeenCalled();
      expect(d.annuler).toHaveBeenCalledWith("job-1", expect.stringMatching(/^Retenu à l'envoi/));
      // « annulé », jamais « échec » : un échec compterait dans le seuil d'alerte.
      expect(d.cloturer).not.toHaveBeenCalled();
    },
  );

  it("l'accusé d'une démarche (sans variante) part malgré l'opposition", async () => {
    d.opposition.mockResolvedValue({ id: "opp-1" });
    await processeur()(job("lead-apporteur-recu", { dossierUrl: "https://axion-ia.com/x" }));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
    // Pas une sollicitation : ni verdict, ni lecture de la fiche au départ.
    expect(d.opposition).not.toHaveBeenCalled();
    expect(d.submission).not.toHaveBeenCalled();
  });

  it("sans opposition, la sollicitation part normalement", async () => {
    await processeur()(job("lead-apporteur-relance", { etape: "j7" }));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
  });
});

describe("🔴 fiche effacée entre l'enfilage et le départ", () => {
  it.each<[string, unknown]>([
    ["absente", null],
    ["en corbeille", { deletedAt: new Date(), contactEmail: "chiffre(nadia@exemple.fr)" }],
    ["effacée (art. 17)", { deletedAt: null, contactEmail: "chiffre(erased:abc@erased.local)" }],
  ])("fiche %s : rien ne part", async (_cas, ligne) => {
    d.submission.mockResolvedValue(ligne);
    await processeur()(job("lead-apporteur-relance", { etape: "j2" }));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledWith("job-1", expect.stringMatching(/^Retenu à l'envoi/));
    const lu = d.submission.mock.calls[0]?.[0] as { where: { id: string } };
    expect(lu.where.id).toBe(SUBMISSION_ID);
  });

  it("sans entité Submission, la fiche n'est pas lue", async () => {
    const j = job("lead-apporteur-relance", { etape: "j2" });
    const data = j["data"] as Record<string, unknown>;
    delete data["entityType"];
    delete data["entityId"];
    await processeur()(j);
    expect(d.submission).not.toHaveBeenCalled();
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("job sans identifiant", () => {
  it("retenu : aucun appel au journal, aucun envoi, un avertissement", async () => {
    d.opposition.mockResolvedValue({ id: "opp-1" });
    await processeur()(job("apporteur-invitation-appel", {}, { id: undefined }));
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("⚠️ base en panne : l'envoi continue (échec ouvert assumé)", () => {
  it("verdict et fiche illisibles → la sollicitation part, et c'est journalisé en erreur", async () => {
    d.rebond.mockRejectedValue(new Error("ECONNREFUSED"));
    d.opposition.mockRejectedValue(new Error("ECONNREFUSED"));
    d.submission.mockRejectedValue(new Error("ECONNREFUSED"));
    await processeur()(job("lead-apporteur-relance", { etape: "j2" }));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
