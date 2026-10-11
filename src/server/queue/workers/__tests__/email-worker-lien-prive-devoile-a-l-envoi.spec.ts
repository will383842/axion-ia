// @vitest-environment node

/**
 * LE JETON DU LIEN PRIVÉ N'EST REMIS QU'AU MOMENT DE L'ENVOI (relecture sécurité, 2026-10-08).
 *
 * La réponse en base ne porte que l'adresse MASQUÉE
 * `…/api/partage/<id>/lien-prive-de-telechargement`. Le worker qui envoie
 * remplace ce marqueur par le vrai jeton — uniquement pour le lien de CETTE
 * réponse. S'il ne le peut pas (`PARTAGES_SECRET` absent, lien d'une autre
 * réponse), la réponse est marquée en échec et RIEN ne part avec le marqueur.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  reponse: null as Record<string, unknown> | null,
  lien: null as { id: string } | null,
  erreurLien: null as unknown,
  majs: [] as Array<Record<string, unknown>>,
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
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: () => "candidat@example.org",
  isDecryptedEmailUsable: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplicationReply: {
      findUnique: async () => d.reponse,
      update: async (a: { data: Record<string, unknown> }) => {
        d.majs.push(a.data);
        return {};
      },
    },
    lienPartage: {
      findFirst: async () => {
        if (d.erreurLien) throw d.erreurLien;
        return d.lien;
      },
    },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: vi.fn(),
  noterTentativeEchouee: vi.fn(),
  marquerAnnule: vi.fn(),
}));

import { adresseLien, adresseMasqueeLien, jetonLien } from "@/server/partages/jeton";

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

const LIEN = "55555555-5555-4555-8555-555555555555";
const AUTRE = "66666666-6666-4666-8666-666666666666";
const SECRET = "p".repeat(40);

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

function envoyer(): Promise<void> {
  return processeur()({
    id: "job-1",
    name: "candidature-reponse",
    data: {
      template: "candidature-reponse",
      to: "",
      locale: "fr",
      payload: { replyId: "rep-1" },
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
  });
}

function reponseAvec(lienId: string): Record<string, unknown> {
  const masquee = adresseMasqueeLien(lienId, { NEXT_PUBLIC_SITE_URL: "https://axion-ia.com" })!;
  return {
    id: "rep-1",
    toEmail: "chiffre",
    subject: "Votre essai",
    bodyHtml: `<p>Bonjour,</p><p><a href="${masquee}">ouvrir</a></p>`,
    bodyText: `Bonjour,\n\nouvrir : ${masquee}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.majs = [];
  d.lien = { id: LIEN };
  d.erreurLien = null;
  d.reponse = reponseAvec(LIEN);
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  process.env["PARTAGES_SECRET"] = SECRET;
  process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
});

describe("le worker remet le vrai jeton au moment de l'envoi", () => {
  it("le message part avec l'adresse complète du lien de CETTE réponse", async () => {
    await envoyer();
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    const envoi = d.sendEmail.mock.calls[0]![0] as { html: string; text: string };
    const vraie = adresseLien(LIEN, { PARTAGES_SECRET: SECRET })!;
    expect(envoi.html).toContain(`href="${vraie}"`);
    expect(envoi.text).toContain(vraie);
    expect(envoi.html + envoi.text).not.toContain("lien-prive-de-telechargement");
    // La base n'est jamais réécrite avec le jeton.
    expect(JSON.stringify(d.majs)).not.toContain(jetonLien(LIEN, { PARTAGES_SECRET: SECRET })!);
    expect(d.majs.at(-1)).toMatchObject({ deliveryStatus: "sent" });
  });

  it("sans PARTAGES_SECRET sur le worker : réponse en échec, rien ne part", async () => {
    delete process.env["PARTAGES_SECRET"];
    await envoyer();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.majs.at(-1)).toMatchObject({ deliveryStatus: "failed" });
    expect(String(d.majs.at(-1)!.errorMsg)).toMatch(/lien privé/);
  });

  it("le marqueur d'un AUTRE lien que celui de la réponse : échec, rien ne part", async () => {
    d.reponse = reponseAvec(AUTRE);
    await envoyer();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.majs.at(-1)).toMatchObject({ deliveryStatus: "failed" });
  });

  it("une réponse sans lien part telle quelle", async () => {
    d.lien = null;
    d.reponse = { ...reponseAvec(LIEN), bodyHtml: "<p>Bonjour</p>", bodyText: "Bonjour" };
    await envoyer();
    expect(d.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<p>Bonjour</p>", text: "Bonjour" }),
    );
  });
});

describe("la table des liens n'existe pas encore (worker en avance sur la migration)", () => {
  it("table absente (P2021) : la réponse part, sans lien", async () => {
    d.erreurLien = Object.assign(new Error("table absente"), { code: "P2021" });
    d.reponse = { ...reponseAvec(LIEN), bodyHtml: "<p>Bonjour</p>", bodyText: "Bonjour" };
    await envoyer();
    expect(d.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<p>Bonjour</p>", text: "Bonjour" }),
    );
    expect(d.majs.at(-1)).toMatchObject({ deliveryStatus: "sent" });
  });

  it("toute autre erreur : rien ne part, le job lève pour que BullMQ réessaie", async () => {
    d.erreurLien = Object.assign(new Error("connexion perdue"), { code: "P1001" });
    await expect(envoyer()).rejects.toThrow("connexion perdue");
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
});
