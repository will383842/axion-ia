// Relecture de la PR #2255 (I2, I3, I4) — une pièce FACULTATIVE ne fait jamais échouer l'e-mail.
//
// L'e-mail « contrat signé » promet le contrat ; la fiche des commissions et le livret s'y
// ajoutent quand ils existent. Une annexe retirée ou remplacée entre la mise en file et l'envoi
// faisait échouer TOUT l'e-mail (cinq essais, puis échec) : le contrat ne partait pas à cause
// d'une annexe.
//
// Ce qui est gardé :
//   · pièce facultative introuvable, illisible ou trop lourde : l'e-mail part sans elle ;
//   · c'est journalisé SANS la clé R2 et signalé (Sentry) ;
//   · une pièce EXIGÉE introuvable arrête toujours l'envoi (comportement d'avant) ;
//   · la copie de l'envoi porte les pièces RÉELLEMENT parties, et le journal note chaque pièce
//     facultative avec l'empreinte du fichier joint (quelle version est partie).

import { createHash } from "node:crypto";

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  copie: vi.fn(),
  lire: vi.fn(),
  sentry: vi.fn(),
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
vi.mock("../../lib/sentry-worker", () => ({
  captureWorkerError: (...a: unknown[]) => d.sentry(...a),
}));
vi.mock("../../lib/sanitize-job-data", () => ({ redactEmailValue: (v: string) => v }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(), isDecryptedEmailUsable: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { emailOpposition: { findFirst: async () => null } },
}));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  getObjectBufferR2: (...a: unknown[]) => d.lire(...a),
}));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
}));
vi.mock("@/server/email/copie-envoi", () => ({
  enregistrerCopieEnvoi: (...a: unknown[]) => d.copie(...a),
}));

import { startEmailWorker, resoudrePiecesJointes, TAILLE_MAX_PJ_OCTETS } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CLE_CONTRAT = `apporteurs/${ID}/contrat-v2-signe-abcd.pdf`;
const CLE_FICHE = "documents-apporteurs/fiche-des-commissions.pdf";
const CLE_LIVRET = "documents-apporteurs/livret-apporteur.pdf";
const CONTRAT = { filename: "Contrat-apporteur-Axion-IA.pdf", r2Key: CLE_CONTRAT };
const FICHE = {
  filename: "Fiche-des-commissions-Axion-IA.pdf",
  r2Key: CLE_FICHE,
  facultative: true,
};
const LIVRET = { filename: "Livret-apporteur-Axion-IA.pdf", r2Key: CLE_LIVRET, facultative: true };

const PDF_FICHE = Buffer.from("%PDF-1.7 fiche");
const SHA_FICHE = createHash("sha256").update(PDF_FICHE).digest("hex").slice(0, 16);

/** Simule R2 : une clé absente rend `null`, une clé à `"panne"` lève. */
function r2(objets: Record<string, Buffer | "panne">) {
  d.lire.mockImplementation(async (cle: string) => {
    const o = objets[cle];
    if (o === "panne") throw new Error("R2 en panne");
    return o ?? null;
  });
}

function job(attachments: unknown[]): Record<string, unknown> {
  return {
    id: "job-9",
    name: "apporteur-contrat-signe",
    data: {
      template: "apporteur-contrat-signe",
      to: "a@b.fr",
      locale: "fr",
      payload: {},
      attachments,
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
  };
}

let avertissements: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  avertissements = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "A" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.copie.mockResolvedValue(true);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe("résolution des pièces", () => {
  it("🔴 annexe absente de R2 : le contrat reste, l'annexe est omise, rien n'est levé", async () => {
    r2({ [CLE_CONTRAT]: Buffer.from("%PDF contrat"), [CLE_FICHE]: PDF_FICHE });
    const r = await resoudrePiecesJointes([CONTRAT, FICHE, LIVRET]);
    expect(r.pieces.map((p) => p.filename)).toEqual([CONTRAT.filename, FICHE.filename]);
    expect(r.omises).toEqual([{ filename: LIVRET.filename, motif: "introuvable" }]);
    expect(r.empreintes).toEqual([{ filename: FICHE.filename, sha256: SHA_FICHE }]);
  });

  it("🔴 annexe illisible (R2 lève) : omise, comme une absente", async () => {
    r2({ [CLE_CONTRAT]: Buffer.from("%PDF contrat"), [CLE_FICHE]: "panne" });
    const r = await resoudrePiecesJointes([CONTRAT, FICHE]);
    expect(r.pieces.map((p) => p.filename)).toEqual([CONTRAT.filename]);
    expect(r.omises).toEqual([{ filename: FICHE.filename, motif: "introuvable" }]);
  });

  it("🔴 annexe remplacée par un fichier trop lourd : omise, le contrat part", async () => {
    r2({
      [CLE_CONTRAT]: Buffer.alloc(1000),
      [CLE_FICHE]: Buffer.alloc(TAILLE_MAX_PJ_OCTETS),
      [CLE_LIVRET]: Buffer.alloc(2000),
    });
    const r = await resoudrePiecesJointes([CONTRAT, FICHE, LIVRET]);
    expect(r.pieces.map((p) => p.filename)).toEqual([CONTRAT.filename, LIVRET.filename]);
    expect(r.omises).toEqual([{ filename: FICHE.filename, motif: "trop lourde" }]);
  });

  it("l'omission est journalisée et signalée, SANS la clé R2 ni l'identifiant du dossier", async () => {
    r2({ [CLE_CONTRAT]: Buffer.from("%PDF contrat") });
    await resoudrePiecesJointes([CONTRAT, FICHE]);
    expect(avertissements).toHaveBeenCalledTimes(1);
    expect(d.sentry).toHaveBeenCalledTimes(1);
    const ecrit = JSON.stringify([
      avertissements.mock.calls,
      d.sentry.mock.calls.map((c) => String((c[3] as Error).message)),
    ]);
    expect(ecrit).toContain(FICHE.filename);
    expect(ecrit).not.toContain("documents-apporteurs/");
    expect(ecrit).not.toContain(ID);
  });

  it("une pièce EXIGÉE introuvable arrête toujours l'envoi (inchangé)", async () => {
    r2({ [CLE_FICHE]: PDF_FICHE });
    await expect(resoudrePiecesJointes([CONTRAT, FICHE])).rejects.toThrow(/PJ introuvable/);
  });

  it("sans pièce facultative, rien n'est tracé (les autres e-mails ne changent pas)", async () => {
    r2({ [CLE_CONTRAT]: Buffer.from("%PDF contrat") });
    const r = await resoudrePiecesJointes([CONTRAT]);
    expect(r.omises).toEqual([]);
    expect(r.empreintes).toEqual([]);
  });
});

describe("à l'envoi", () => {
  it("🔴 annexe disparue depuis la mise en file : l'e-mail PART avec le contrat", async () => {
    r2({ [CLE_CONTRAT]: Buffer.from("%PDF contrat"), [CLE_FICHE]: PDF_FICHE });
    await expect(processeur()(job([CONTRAT, FICHE, LIVRET]))).resolves.toBeUndefined();
    const envoi = d.sendEmail.mock.calls[0]?.[0] as { attachments: { filename: string }[] };
    expect(envoi.attachments.map((a) => a.filename)).toEqual([CONTRAT.filename, FICHE.filename]);
    expect(d.noter).not.toHaveBeenCalled();
  });

  it("I3 : la copie de l'envoi porte les pièces RÉELLEMENT parties, pas celles demandées", async () => {
    r2({ [CLE_CONTRAT]: Buffer.from("%PDF contrat"), [CLE_FICHE]: PDF_FICHE });
    await processeur()(job([CONTRAT, FICHE, LIVRET]));
    expect(d.copie.mock.calls[0]?.[0]).toMatchObject({
      attachmentNames: [CONTRAT.filename, FICHE.filename],
    });
  });

  it("I3, I4 : le journal « envoyé » note l'empreinte de l'annexe jointe et l'annexe non jointe", async () => {
    r2({ [CLE_CONTRAT]: Buffer.from("%PDF contrat"), [CLE_FICHE]: PDF_FICHE });
    await processeur()(job([CONTRAT, FICHE, LIVRET]));
    const cloture = d.cloturer.mock.calls[0]?.[0] as { status: string; error?: string };
    expect(cloture.status).toBe("sent");
    expect(cloture.error).toBe(
      `Pièce jointe : ${FICHE.filename} (sha256 ${SHA_FICHE}). ` +
        `Pièce non jointe : ${LIVRET.filename} (introuvable).`,
    );
    expect(cloture.error).not.toContain("documents-apporteurs/");
  });

  it("e-mail sans pièce facultative : aucune note au journal (inchangé)", async () => {
    r2({ [CLE_CONTRAT]: Buffer.from("%PDF contrat") });
    await processeur()(job([CONTRAT]));
    expect(d.cloturer.mock.calls[0]?.[0]).not.toHaveProperty("error");
  });
});
