// Relecture de la PR #2392 (🔴 1) : la phrase « pièces jointes » ne promet que ce qui part.
//
// La phrase est décidée à la mise en file, mais une annexe facultative peut être omise à l'envoi
// (GET R2 en échec, objet retiré, trop lourd). Le worker résout donc les pièces AVANT le rendu et
// retire de `annexesJointes` les annexes omises : trois en file, une omise → la phrase cite les
// deux restantes ; trois omises → aucune phrase.

import { describe, it, expect, vi, beforeEach } from "vitest";

import { phrasePiecesJointes } from "@/lib/email/templates/_annexes-jointes";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  copie: vi.fn(),
  lire: vi.fn(),
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

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

const CLES = {
  fiche: "documents-apporteurs/fiche-des-commissions.pdf",
  livret: "documents-apporteurs/livret-apporteur.pdf",
  guide: "documents-apporteurs/guide-demarrage-apporteur.pdf",
};
const FICHE = {
  filename: "Fiche-des-commissions-Axion-IA.pdf",
  r2Key: CLES.fiche,
  facultative: true,
};
const LIVRET = { filename: "Livret-apporteur-Axion-IA.pdf", r2Key: CLES.livret, facultative: true };
const GUIDE = {
  filename: "Guide-de-demarrage-apporteur-Axion-IA.pdf",
  r2Key: CLES.guide,
  facultative: true,
};
const TOUTES = ["fiche-commissions", "livret", "guide-demarrage"];

/** R2 simulé : seules les clés listées existent ; « panne » lève. */
function r2(objets: Record<string, Buffer | "panne">) {
  d.lire.mockImplementation(async (cle: string) => {
    const o = objets[cle];
    if (o === "panne") throw new Error("R2 en panne");
    return o ?? null;
  });
}

function job(template: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "job-1",
    name: template,
    data: {
      template,
      to: "a@b.fr",
      locale: "fr",
      payload,
      attachments: [FICHE, LIVRET, GUIDE],
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
  };
}

/** Le payload que le gabarit a REÇU au rendu. */
function payloadRendu(): Record<string, unknown> {
  return d.render.mock.calls[0]?.[2] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  // Le faux gabarit écrit la VRAIE phrase à partir de ce qu'il reçoit.
  d.render.mockImplementation(async (_t: string, _l: string, p: Record<string, unknown>) => ({
    subject: "Objet",
    html: "<p>x</p>",
    text: phrasePiecesJointes(p["annexesJointes"]) ?? "",
    famille: "A",
  }));
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.copie.mockResolvedValue(true);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe.each(["apporteur-dossier-lien", "apporteur-issue-retenu"])("%s", (gabarit) => {
  it("🔴 trois annexes en file, une omise au GET : la phrase ne cite que les deux restantes", async () => {
    r2({ [CLES.fiche]: Buffer.from("%PDF f"), [CLES.livret]: Buffer.from("%PDF l") });
    await processeur()(job(gabarit, { annexesJointes: TOUTES }));
    expect(payloadRendu()["annexesJointes"]).toEqual(["fiche-commissions", "livret"]);
    const rendu = (await d.render.mock.results[0]?.value) as { text: string };
    expect(rendu.text).toBe(
      "Vous trouverez en pièces jointes la fiche des commissions et le livret, pour en prendre connaissance avant de signer.",
    );
    const envoi = d.sendEmail.mock.calls[0]?.[0] as { attachments: { filename: string }[] };
    expect(envoi.attachments.map((a) => a.filename)).toEqual([FICHE.filename, LIVRET.filename]);
  });

  it("🔴 trois omises (R2 en panne) : aucune phrase, l'e-mail part quand même", async () => {
    r2({ [CLES.fiche]: "panne", [CLES.livret]: "panne", [CLES.guide]: "panne" });
    await expect(
      processeur()(job(gabarit, { contactName: "Claire", annexesJointes: TOUTES })),
    ).resolves.toBeUndefined();
    expect(payloadRendu()).not.toHaveProperty("annexesJointes");
    expect(payloadRendu()["contactName"]).toBe("Claire");
    const rendu = (await d.render.mock.results[0]?.value) as { text: string };
    expect(rendu.text).toBe("");
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.sendEmail.mock.calls[0]?.[0]).not.toHaveProperty("attachments");
  });

  it("toutes présentes : la phrase cite les trois, rien n'est retiré", async () => {
    r2({
      [CLES.fiche]: Buffer.from("%PDF f"),
      [CLES.livret]: Buffer.from("%PDF l"),
      [CLES.guide]: Buffer.from("%PDF g"),
    });
    await processeur()(job(gabarit, { annexesJointes: TOUTES }));
    expect(payloadRendu()["annexesJointes"]).toEqual(TOUTES);
  });
});

describe("autres gabarits", () => {
  it("un gabarit hors périmètre reçoit son payload tel quel, même avec des pièces omises", async () => {
    r2({});
    await processeur()(job("apporteur-contrat-signe", { annexesJointes: TOUTES }));
    expect(payloadRendu()["annexesJointes"]).toEqual(TOUTES);
  });
});
