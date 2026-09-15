// `enqueueEmail({ exigerValidation: true })` GARE l'e-mail quelles que soient
// les règles d'automatisation — 2026-09-15, facture générée le lendemain de la
// session.
//
// 🛑 Ordre permanent de Will : rien ne part à un client sans sa validation. Une
// règle `auto` posée pour un client exprime un choix sur les envois qu'un humain
// déclenche ; elle ne vaut pas consentement pour un automate. Ce test exerce le
// VRAI `enqueueEmail` (BullMQ et Redis doublés), comme
// `enqueue-email-liste-de-suppression.spec.ts`.

import { describe, it, expect, vi, beforeEach } from "vitest";

const doublures = vi.hoisted(() => ({
  add: vi.fn(),
  verdict: vi.fn(),
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
vi.mock("@/lib/email/templates", () => ({
  sujetDuGabarit: () => "Votre facture",
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: vi.fn(),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: (...a: unknown[]) => doublures.verdict(...a),
  signalerRetenue: vi.fn(),
}));

import { enqueueEmail } from "../queues";

beforeEach(() => {
  doublures.add.mockReset().mockResolvedValue({ id: "job-1" });
  doublures.verdict.mockReset().mockResolvedValue({ retenu: false });
  // Le cas qui compte : une règle d'automatisation a passé le gabarit en `auto`.
  doublures.resoudreMode.mockReset().mockResolvedValue("auto");
  doublures.garer.mockReset().mockResolvedValue("outbox-1");
  doublures.journaliser.mockReset().mockResolvedValue(undefined);
});

describe("🛑 exigerValidation — l'automate ne peut pas envoyer", () => {
  it("règle `auto` en place : l'e-mail est GARÉ, rien n'entre dans la file d'envoi", async () => {
    const res = await enqueueEmail(
      "facture-envoi",
      "compta@acme.test",
      "fr",
      { numero: "AXI-FACT-2026-001" },
      {
        clientId: "client-1",
        attachments: [{ filename: "AXI-FACT-2026-001.pdf", r2Key: "cle" }],
        exigerValidation: true,
      },
    );

    expect(res).toEqual({ enqueued: false, garePourValidation: true, outboxId: "outbox-1" });
    expect(doublures.add).not.toHaveBeenCalled();
    expect(doublures.garer).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "facture-envoi",
        recipient: "compta@acme.test",
        clientId: "client-1",
        attachments: [{ filename: "AXI-FACT-2026-001.pdf", r2Key: "cle" }],
      }),
    );
  });

  it("TÉMOIN : sans l'option, la même règle `auto` envoie — c'est bien elle que l'option neutralise", async () => {
    const res = await enqueueEmail(
      "facture-envoi",
      "compta@acme.test",
      "fr",
      {},
      {
        clientId: "client-1",
      },
    );
    expect(res).toEqual({ enqueued: true });
    expect(doublures.add).toHaveBeenCalledTimes(1);
    expect(doublures.garer).not.toHaveBeenCalled();
  });

  it("corbeille indisponible : toujours RIEN ne part", async () => {
    doublures.garer.mockResolvedValue(null);
    const res = await enqueueEmail(
      "facture-envoi",
      "c@acme.test",
      "fr",
      {},
      {
        exigerValidation: true,
      },
    );
    expect(res).toEqual({ enqueued: false, corbeilleIndisponible: true });
    expect(doublures.add).not.toHaveBeenCalled();
  });

  it("la liste de suppression passe toujours AVANT", async () => {
    doublures.verdict.mockResolvedValue({ retenu: true, motif: "rebond_dur", depuis: null });
    const res = await enqueueEmail(
      "facture-envoi",
      "mort@acme.test",
      "fr",
      {},
      {
        exigerValidation: true,
      },
    );
    expect(res).toEqual({ enqueued: false, retenu: "rebond_dur" });
    expect(doublures.garer).not.toHaveBeenCalled();
  });
});
