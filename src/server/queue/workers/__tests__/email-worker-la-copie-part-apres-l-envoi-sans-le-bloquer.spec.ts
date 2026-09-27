// Le worker d'e-mails garde la COPIE de ce qu'il vient d'envoyer (2026-09-27),
// et un échec de cette copie n'empêche jamais l'envoi.
//
// On capture le processeur passé au constructeur BullMQ et on l'exécute avec
// un job doublé, comme `email-worker-journal-et-objet.spec.ts`.
//
// Ce qui est gardé :
//   · la copie reçoit EXACTEMENT ce qui a été remis au relais (objet forcé
//     compris), et les noms des pièces jointes ;
//   · elle est écrite APRÈS l'envoi et la clôture du journal ;
//   · 🔴 si elle lève, le job ne lève pas — sinon BullMQ le rejouerait et
//     l'e-mail partirait deux fois ; le journal reste « envoyé ».

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  copie: vi.fn(),
  ordre: [] as string[],
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
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(), isDecryptedEmailUsable: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  getObjectBufferR2: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7")),
}));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
}));
vi.mock("@/server/email/copie-envoi", () => ({
  enregistrerCopieEnvoi: (...a: unknown[]) => d.copie(...a),
}));

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

function job(data: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "job-7",
    name: data["template"],
    data,
    attemptsMade: 0,
    opts: { attempts: 5 },
  };
}

const RENDU = {
  subject: "Objet du gabarit",
  html: "<p>Bonjour Camille</p>",
  text: "Bonjour Camille",
  famille: "A" as const,
};

const DEVIS = {
  template: "devis-envoi",
  to: "a@b.fr",
  locale: "fr",
  payload: {},
  sujet: "Devis AXI-2026-118",
  attachments: [{ r2Key: "devis/118.pdf", filename: "devis-AXI-2026-118.pdf" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  d.ordre.length = 0;
  d.render.mockResolvedValue(RENDU);
  d.sendEmail.mockImplementation(async () => {
    d.ordre.push("envoi");
    return { messageId: "<m1>" };
  });
  d.cloturer.mockImplementation(async () => {
    d.ordre.push("journal");
  });
  d.copie.mockImplementation(async () => {
    d.ordre.push("copie");
    return true;
  });
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe("la copie de l'envoi", () => {
  it("reçoit ce qui a été remis au relais — objet forcé, HTML, texte, noms des pièces jointes", async () => {
    await processeur()(job(DEVIS));
    expect(d.copie).toHaveBeenCalledWith({
      jobId: "job-7",
      subject: "Devis AXI-2026-118",
      html: RENDU.html,
      text: RENDU.text,
      attachmentNames: ["devis-AXI-2026-118.pdf"],
    });
    // Le binaire n'est jamais transmis à la copie.
    expect(JSON.stringify(d.copie.mock.calls[0])).not.toContain("PDF-1.7");
  });

  it("est écrite APRÈS l'envoi et la clôture du journal", async () => {
    await processeur()(job(DEVIS));
    expect(d.ordre).toEqual(["envoi", "journal", "copie"]);
  });

  it("n'est pas écrite quand l'envoi échoue", async () => {
    d.sendEmail.mockRejectedValue(new Error("SMTP 421"));
    await expect(processeur()(job(DEVIS))).rejects.toThrow("SMTP 421");
    expect(d.copie).not.toHaveBeenCalled();
  });
});

describe("🔴 un échec de la copie n'empêche pas l'envoi", () => {
  it("la copie lève : le job RÉUSSIT (pas de rejeu, donc pas de doublon), le journal dit « envoyé »", async () => {
    d.copie.mockRejectedValue(new Error("table email_log_contents absente"));
    await expect(processeur()(job(DEVIS))).resolves.toBeUndefined();
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.cloturer).toHaveBeenCalledTimes(1);
    expect(d.cloturer).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
    // Aucune trace de « tentative ratée » : l'envoi n'a pas raté.
    expect(d.noter).not.toHaveBeenCalled();
  });
});
