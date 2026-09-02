// `enqueueEmail` consulte la liste de suppression AVANT la corbeille et AVANT
// la file — audit e-mails du 2026-09-02.
//
// Ce test doublure BullMQ et la connexion Redis pour exercer le VRAI
// `enqueueEmail` : c'est le câblage qu'on garde, pas le module de suppression
// (couvert par `suppression.spec.ts`). Sans ce test, `verdictAvantEnvoi` peut
// exister, être vert, et n'être appelé par personne.

import { describe, it, expect, vi, beforeEach } from "vitest";

const doublures = vi.hoisted(() => ({
  add: vi.fn(),
  verdict: vi.fn(),
  signaler: vi.fn(),
  resoudreMode: vi.fn(),
  garer: vi.fn(),
  journaliser: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    readonly name: string;
    constructor(name: string) {
      this.name = name;
    }
    add = doublures.add;
    removeRepeatable = vi.fn();
    getRepeatableJobs = vi.fn().mockResolvedValue([]);
  },
}));
vi.mock("../connection", () => ({
  getBullConnection: () => ({ host: "doublure" }),
  getBullConnectionOrThrow: () => ({ host: "doublure" }),
  isBullmqDisabled: () => false,
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: (...a: unknown[]) => doublures.resoudreMode(...a),
  garerPourValidation: (...a: unknown[]) => doublures.garer(...a),
}));
vi.mock("@/server/email/email-log", () => ({
  journaliserEnAttente: (...a: unknown[]) => doublures.journaliser(...a),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: (...a: unknown[]) => doublures.verdict(...a),
  signalerRetenue: (...a: unknown[]) => doublures.signaler(...a),
}));

import { enqueueEmail } from "../queues";

beforeEach(() => {
  doublures.add.mockReset().mockResolvedValue({ id: "job-1" });
  doublures.verdict.mockReset().mockResolvedValue({ retenu: false });
  doublures.signaler.mockReset().mockResolvedValue(undefined);
  doublures.resoudreMode.mockReset().mockResolvedValue("auto");
  doublures.garer.mockReset().mockResolvedValue("outbox-1");
  doublures.journaliser.mockReset().mockResolvedValue(undefined);
});

describe("enqueueEmail — liste de suppression", () => {
  it("🔴 un envoi retenu n'est ni enfilé, ni garé, ni journalisé « en attente » — et il est signalé", async () => {
    doublures.verdict.mockResolvedValue({ retenu: true, motif: "rebond_dur", depuis: null });
    doublures.resoudreMode.mockResolvedValue("validation");

    const res = await enqueueEmail("devis-envoi", "mort@client.fr", "fr", { n: 1 });

    expect(res).toEqual({ enqueued: false, retenu: "rebond_dur" });
    expect(doublures.add).not.toHaveBeenCalled();
    expect(doublures.garer).not.toHaveBeenCalled();
    expect(doublures.journaliser).not.toHaveBeenCalled();
    // La suppression passe AVANT la corbeille : un email vers une adresse
    // morte n'a rien à faire dans une file de relecture.
    expect(doublures.resoudreMode).not.toHaveBeenCalled();
    expect(doublures.signaler).toHaveBeenCalledWith(
      "mort@client.fr",
      "devis-envoi",
      expect.objectContaining({ motif: "rebond_dur" }),
    );
  });

  it("le verdict reçoit le gabarit et le drapeau marketing tels qu'enfilés", async () => {
    await enqueueEmail("newsletter-confirm-optin", "x@client.fr", "fr", {}, { marketing: true });
    expect(doublures.verdict).toHaveBeenCalledWith("x@client.fr", {
      template: "newsletter-confirm-optin",
      marketing: true,
    });
    await enqueueEmail("facture-envoi", "y@client.fr", "fr", {});
    expect(doublures.verdict).toHaveBeenLastCalledWith("y@client.fr", {
      template: "facture-envoi",
      marketing: false,
    });
  });

  it("un envoi non retenu suit le chemin habituel : file puis journal", async () => {
    const res = await enqueueEmail("contact-confirmed", "ok@client.fr", "fr", { a: 1 });
    expect(res).toEqual({ enqueued: true });
    expect(doublures.add).toHaveBeenCalledTimes(1);
    expect(doublures.journaliser).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "ok@client.fr", template: "contact-confirmed" }),
    );
  });

  it("la suppression s'applique aussi à l'envoi DEPUIS la corbeille (bypassValidation)", async () => {
    doublures.verdict.mockResolvedValue({ retenu: true, motif: "desabonne", depuis: null });
    const res = await enqueueEmail(
      "facture-envoi",
      "parti@client.fr",
      "fr",
      {},
      { bypassValidation: true, marketing: true },
    );
    expect(res).toEqual({ enqueued: false, retenu: "desabonne" });
    expect(doublures.add).not.toHaveBeenCalled();
  });
});
