// Garde du lien de signature AU RENDU (worker) : un lien refusé par ce serveur ne part pas sans
// bouton : journal clos en échec, corbeille « refusé », alerte au numéro, échec définitif.
import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  annule: vi.fn(),
  telegram: vi.fn(),
  sentryMsg: vi.fn(),
  sentryExc: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  retenue: false,
}));

vi.mock("bullmq", async () => {
  class DelayedError extends Error {}
  class UnrecoverableError extends Error {}
  return {
    DelayedError,
    UnrecoverableError,
    Worker: class {
      constructor(...args: unknown[]) {
        d.ctor(...args);
      }
      on(): this {
        return this;
      }
    },
  };
});
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...a: unknown[]) => d.sentryMsg(...a),
  captureException: (...a: unknown[]) => d.sentryExc(...a),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => d.telegram(...a) }));
vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://axion-ia.com" }));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("../../lib/sanitize-job-data", () => ({ redactEmailValue: (v: string) => v }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
  estGabaritConnu: () => true,
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(), isDecryptedEmailUsable: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOpposition: { findFirst: async () => null, findUnique: async () => null },
    emailLog: { findFirst: async () => null },
    emailOutbox: {
      findFirst: (...a: unknown[]) => d.findFirst(...a),
      updateMany: (...a: unknown[]) => d.updateMany(...a),
    },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
  marquerAnnule: (...a: unknown[]) => d.annule(...a),
}));
// Retenue au départ du gabarit de relance (lecteur simulé : la base n'est pas l'objet ici).
vi.mock("@/server/email/relecture-au-depart", () => ({
  RELECTURES_AU_DEPART: new Map([
    ["relance-devis-client", async () => (d.retenue ? "devis signé" : null)],
  ]),
}));

import { UnrecoverableError } from "bullmq";
import { startEmailWorker } from "../email-worker";
import { MOTIF_LIEN_REFUSE_AU_RENDU } from "@/server/email/lien-signature-refuse-au-rendu";

type Processeur = (job: Record<string, unknown>, token?: string) => Promise<void>;
function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

const ADRESSE = "client-secret@exemple.test";
const JETON = "SECRETJETON.ABC";
const LIEN_AUTRE = `https://autre.example/fr/portail/signer/${JETON}`;
const LIEN_BON = `https://axion-ia.com/fr/portail/signer/${JETON}`;

function job(template: string, payload: Record<string, unknown>, attemptsMade = 0) {
  return {
    id: "job-1",
    name: template,
    timestamp: Date.now(),
    data: {
      template,
      to: ADRESSE,
      locale: "fr",
      payload,
      entityType: "Devis",
      entityId: "devis-1",
    },
    attemptsMade,
    opts: { attempts: 5 },
    updateData: vi.fn(),
    moveToDelayed: vi.fn(),
  };
}

beforeEach(() => {
  d.ctor.mockClear();
  vi.clearAllMocks();
  d.retenue = false;
  d.render.mockResolvedValue({ subject: "s", html: "<p>h</p>", text: "t", famille: "B" });
  d.sendEmail.mockResolvedValue({ ok: true, messageId: "m1" });
  d.telegram.mockResolvedValue(undefined);
  d.findFirst.mockResolvedValue({ id: "ligne-1" });
  d.updateMany.mockResolvedValue({ count: 1 });
});

const sortiesSensibles = (extra: unknown[] = []) =>
  JSON.stringify([
    // Le journal garde le destinataire dans son champ `recipient` (comme toute clôture) : seul
    // son motif est une sortie libre.
    d.cloturer.mock.calls.map(([c]) => c.error),
    d.sentryMsg.mock.calls,
    d.sentryExc.mock.calls,
    d.telegram.mock.calls,
    d.updateMany.mock.calls,
    ...extra,
  ]);

describe.each(["devis-envoi", "relance-devis-client"])("lien refusé au rendu — %s", (gabarit) => {
  it("W1/W2 — ni rendu ni envoi, journal clos en échec, UnrecoverableError, aucune tentative notée", async () => {
    const p = processeur();
    const erreur = await p(job(gabarit, { numero: "D-2026-0042", signatureUrl: LIEN_AUTRE })).catch(
      (e) => e,
    );
    expect(erreur).toBeInstanceOf(UnrecoverableError);
    expect(d.render).not.toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.noter).not.toHaveBeenCalled();
    expect(d.cloturer).toHaveBeenCalledTimes(1);
    expect(d.cloturer.mock.calls[0]![0]).toMatchObject({
      status: "failed",
      error: MOTIF_LIEN_REFUSE_AU_RENDU,
    });
  });

  it("W3 — dès le premier essai sur cinq : aucun réessai", async () => {
    const p = processeur();
    const erreur = await p(job(gabarit, { numero: "D-1", signatureUrl: LIEN_AUTRE }, 0)).catch(
      (e) => e,
    );
    expect(erreur).toBeInstanceOf(UnrecoverableError);
    expect(d.cloturer.mock.calls[0]![0].attempts).toBe(1);
  });

  it("W4 — la ligne de corbeille « envoyé » passe « refusé » avec le motif", async () => {
    await processeur()(job(gabarit, { numero: "D-1", signatureUrl: LIEN_AUTRE })).catch(() => {});
    expect(d.updateMany).toHaveBeenCalledWith({
      where: { id: "ligne-1", statut: "envoye" },
      data: expect.objectContaining({ statut: "refuse", refuseMotif: MOTIF_LIEN_REFUSE_AU_RENDU }),
    });
  });

  it("W4 — aucune ligne, ou lecture qui lève : l'échec a quand même lieu", async () => {
    d.findFirst.mockResolvedValueOnce(null);
    let e = await processeur()(job(gabarit, { numero: "D-1", signatureUrl: LIEN_AUTRE })).catch(
      (x) => x,
    );
    expect(e).toBeInstanceOf(UnrecoverableError);
    expect(d.updateMany).not.toHaveBeenCalled();
    d.findFirst.mockRejectedValueOnce(new Error("base muette"));
    e = await processeur()(job(gabarit, { numero: "D-1", signatureUrl: LIEN_AUTRE })).catch(
      (x) => x,
    );
    expect(e).toBeInstanceOf(UnrecoverableError);
    expect(d.cloturer).toHaveBeenCalledTimes(2);
  });

  it("W5/W6 — alerte au numéro ; aucune URL, jeton, adresse dans aucune sortie", async () => {
    await processeur()(job(gabarit, { numero: "D-2026-0042", signatureUrl: LIEN_AUTRE })).catch(
      () => {},
    );
    expect(d.telegram).toHaveBeenCalledTimes(1);
    expect(d.telegram.mock.calls[0]![0].body).toContain("Devis D-2026-0042");
    expect(d.sentryMsg).toHaveBeenCalledTimes(1);
    const s = sortiesSensibles();
    expect(s).not.toContain("/portail/signer/");
    expect(s).not.toContain(JETON);
    expect(s).not.toContain(ADRESSE);
    expect(s).not.toContain("autre.example");
  });

  it("W5 — numéro piégé : « numéro illisible »", async () => {
    await processeur()(job(gabarit, { numero: "x@y.fr", signatureUrl: LIEN_AUTRE })).catch(
      () => {},
    );
    expect(d.telegram.mock.calls[0]![0].body).toContain("(numéro illisible)");
    expect(d.telegram.mock.calls[0]![0].body).not.toContain("x@y.fr");
  });

  it("W7 — lien VALIDE : rendu et envoi appelés", async () => {
    await processeur()(job(gabarit, { numero: "D-1", signatureUrl: LIEN_BON }));
    expect(d.render).toHaveBeenCalledTimes(1);
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.telegram).not.toHaveBeenCalled();
  });

  it("W7 — lien absent : envoi (sans bouton)", async () => {
    await processeur()(job(gabarit, { numero: "D-1" }));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("retenue au départ", () => {
  it("W9 — relance retenue (devis sans objet) + lien refusé : « annulé », pas « échec »", async () => {
    d.retenue = true;
    await processeur()(job("relance-devis-client", { numero: "D-1", signatureUrl: LIEN_AUTRE }));
    expect(d.annule).toHaveBeenCalledTimes(1);
    expect(d.cloturer).not.toHaveBeenCalled();
    expect(d.telegram).not.toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
});
