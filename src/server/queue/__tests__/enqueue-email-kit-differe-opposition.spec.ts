// Le kit du dossier commencé honore l'opposition DÈS l'enfilage — 2026-09-19.
//
// Le kit partage son gabarit avec l'accusé immédiat (`lead-apporteur-recu`) et
// ne s'en distingue que par sa variante. Or le verdict ne regardait que le NOM
// du gabarit : le kit, envoyé 30 minutes plus tard sans nouvelle démarche de la
// personne, passait donc une opposition comme un accusé. Ici, le VRAI
// `enqueueEmail` et le VRAI verdict ; seules la base et la file sont doublées.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  add: vi.fn(),
  opposition: vi.fn(),
  resoudreMode: vi.fn(),
  journaliser: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    readonly name: string;
    constructor(name: string) {
      this.name = name;
    }
    add = d.add;
    removeRepeatable = vi.fn();
    getRepeatableJobs = vi.fn().mockResolvedValue([]);
  },
}));
vi.mock("../connection", () => ({
  getBullConnection: () => ({ host: "doublure" }),
  getBullConnectionOrThrow: () => ({ host: "doublure" }),
  isBullmqDisabled: () => false,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findFirst: vi.fn().mockResolvedValue(null) },
    newsletterSubscriber: { findUnique: vi.fn().mockResolvedValue(null) },
    emailOpposition: { findUnique: (...a: unknown[]) => d.opposition(...a) },
  },
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: (...a: unknown[]) => d.resoudreMode(...a),
  garerPourValidation: vi.fn(),
}));
vi.mock("@/server/email/email-log", () => ({
  journaliserEnAttente: (...a: unknown[]) => d.journaliser(...a),
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: vi.fn().mockResolvedValue(null),
}));

import { enqueueEmail } from "../queues";

beforeEach(() => {
  d.add.mockReset().mockResolvedValue({ id: "job-1" });
  d.opposition.mockReset().mockResolvedValue({ id: "opp-1" });
  d.resoudreMode.mockReset().mockResolvedValue("auto");
  d.journaliser.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("enqueueEmail — kit du dossier commencé vers une adresse opposée", () => {
  it("🔴 n'est pas enfilé : retenu pour opposition", async () => {
    const res = await enqueueEmail("lead-apporteur-recu", "oppose@exemple.fr", "fr", {
      contactName: "Nadia",
      variante: "dossier-commence",
    });
    expect(res).toEqual({ enqueued: false, retenu: "oppose" });
    expect(d.add).not.toHaveBeenCalled();
  });

  it("l'accusé immédiat (sans variante) reste enfilé : la personne vient de reprendre contact", async () => {
    const res = await enqueueEmail("lead-apporteur-recu", "oppose@exemple.fr", "fr", {
      contactName: "Nadia",
    });
    expect(res).toEqual({ enqueued: true });
    expect(d.add).toHaveBeenCalledTimes(1);
  });
});
