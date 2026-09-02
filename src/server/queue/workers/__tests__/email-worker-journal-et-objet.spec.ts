// Le processeur du worker d'e-mails — lot 2 (2026-09-02) et lot 1b.
//
// On capture le processeur passé au constructeur BullMQ (2ᵉ argument) et on
// l'exécute avec un job doublé. Gardé ici :
//   - l'objet FORCÉ depuis la corbeille prime sur celui du gabarit (lot 2) ;
//   - une tentative ratée non définitive laisse la ligne « en attente » et
//     relance ; seule la dernière clôt en « échec » (lot 2) ;
//   - hors famille A, l'en-tête RFC 8058 porte le jeton d'opposition du
//     destinataire ; jamais en famille A (lot 1b).

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
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
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
}));

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

function job(
  data: Record<string, unknown>,
  opts: { attemptsMade?: number; attempts?: number } = {},
): Record<string, unknown> {
  return {
    id: "job-1",
    name: data["template"],
    data,
    attemptsMade: opts.attemptsMade ?? 0,
    opts: { attempts: opts.attempts ?? 5 },
  };
}

const RENDU = {
  subject: "Objet du gabarit",
  html: "<p>x</p>",
  text: "x",
  famille: "A" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue(RENDU);
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.noter.mockResolvedValue(undefined);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe("objet forcé depuis la corbeille (lot 2)", () => {
  it("🔴 l'objet forcé prime sur celui du gabarit", async () => {
    await processeur()(
      job({
        template: "devis-envoi",
        to: "a@b.fr",
        locale: "fr",
        payload: {},
        sujet: "Facture AXI-2026-118, second rappel",
      }),
    );
    expect(d.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Facture AXI-2026-118, second rappel" }),
    );
  });

  it("sans objet forcé, ou vide, l'objet du gabarit s'applique", async () => {
    await processeur()(job({ template: "devis-envoi", to: "a@b.fr", locale: "fr", payload: {} }));
    expect(d.sendEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({ subject: "Objet du gabarit" }),
    );
    await processeur()(
      job({ template: "devis-envoi", to: "a@b.fr", locale: "fr", payload: {}, sujet: "   " }),
    );
    expect(d.sendEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({ subject: "Objet du gabarit" }),
    );
  });

  it("le rendu reçoit le destinataire (lien d'opposition, lot 1b)", async () => {
    await processeur()(job({ template: "devis-envoi", to: "a@b.fr", locale: "fr", payload: {} }));
    expect(d.render).toHaveBeenCalledWith("devis-envoi", "fr", {}, { destinataire: "a@b.fr" });
  });
});

describe("journal : une ligne par job (lot 2)", () => {
  it("🔴 une tentative ratée NON définitive note la tentative et relance, sans clôturer", async () => {
    d.sendEmail.mockRejectedValue(new Error("SMTP 421 réessayer"));
    await expect(
      processeur()(
        job(
          { template: "contact-confirmed", to: "a@b.fr", locale: "fr", payload: {} },
          { attemptsMade: 0, attempts: 5 },
        ),
      ),
    ).rejects.toThrow("SMTP 421");
    expect(d.noter).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", attempts: 1, error: "SMTP 421 réessayer" }),
    );
    expect(d.cloturer).not.toHaveBeenCalled();
  });

  it("la DERNIÈRE tentative clôt en « échec », une seule fois", async () => {
    d.sendEmail.mockRejectedValue(new Error("SMTP 550"));
    await expect(
      processeur()(
        job(
          { template: "contact-confirmed", to: "a@b.fr", locale: "fr", payload: {} },
          { attemptsMade: 4, attempts: 5 },
        ),
      ),
    ).rejects.toThrow("SMTP 550");
    expect(d.noter).not.toHaveBeenCalled();
    expect(d.cloturer).toHaveBeenCalledTimes(1);
    expect(d.cloturer).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", attempts: 5, jobId: "job-1" }),
    );
  });

  it("un job sans rejeu (attempts: 1) clôt dès la première tentative", async () => {
    d.sendEmail.mockRejectedValue(new Error("x"));
    await expect(
      processeur()(
        job(
          { template: "contact-confirmed", to: "a@b.fr", locale: "fr", payload: {} },
          { attemptsMade: 0, attempts: 1 },
        ),
      ),
    ).rejects.toThrow();
    expect(d.cloturer).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("un succès clôt en « envoyé » avec l'identifiant du relais", async () => {
    await processeur()(
      job(
        { template: "contact-confirmed", to: "a@b.fr", locale: "fr", payload: {} },
        { attemptsMade: 1, attempts: 5 },
      ),
    );
    expect(d.cloturer).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", attempts: 2, providerMessageId: "<m1>" }),
    );
  });
});

describe("en-tête RFC 8058 selon la famille (lot 1b)", () => {
  it("🔴 hors famille A, l'en-tête porte le jeton d'opposition du destinataire", async () => {
    d.render.mockResolvedValue({ ...RENDU, famille: "B" });
    await processeur()(job({ template: "roi-report", to: "a@b.fr", locale: "fr", payload: {} }));
    const appel = d.sendEmail.mock.calls[0]![0] as { unsubscribeToken?: string };
    expect(appel.unsubscribeToken).toMatch(/^op1\./);
  });

  it("en famille A, aucun en-tête de désabonnement", async () => {
    d.render.mockResolvedValue({ ...RENDU, famille: "A" });
    await processeur()(job({ template: "facture-envoi", to: "a@b.fr", locale: "fr", payload: {} }));
    const appel = d.sendEmail.mock.calls[0]![0] as { unsubscribeToken?: string };
    expect(appel.unsubscribeToken).toBeUndefined();
  });

  it("un jeton newsletter fourni par le gabarit prime sur le jeton d'opposition", async () => {
    d.render.mockResolvedValue({ ...RENDU, famille: "B" });
    await processeur()(
      job({
        template: "newsletter-confirm-optin",
        to: "a@b.fr",
        locale: "fr",
        // Valeur faite de MOTS, sans suite de chiffres : une chaîne à forte entropie
        // ici est prise pour une vraie clé par le détecteur de secrets
        // (`gitleaks`, règle `generic-api-key`) — constaté sur la Gate A de #941.
        payload: { unsubscribeToken: "jeton-newsletter-factice-pour-le-test" },
      }),
    );
    const appel = d.sendEmail.mock.calls[0]![0] as { unsubscribeToken?: string };
    expect(appel.unsubscribeToken).toBe("jeton-newsletter-factice-pour-le-test");
  });
});
