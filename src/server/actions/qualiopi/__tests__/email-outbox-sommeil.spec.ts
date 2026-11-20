// L9b — la console refuse d'approuver un e-mail en sommeil, sans rien écrire.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  enqueue: vi.fn(),
  log: vi.fn(),
  reval: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", () => ({
  ligneDuLien: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => h.log(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => h.reval(...a) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  revoquerJetonPrecis: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findUnique: (...a: unknown[]) => h.findUnique(...a),
      update: (...a: unknown[]) => h.update(...a),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
    },
  },
}));

import { approuverEmailAction } from "@/server/actions/qualiopi/email-outbox";
import {
  GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL,
  MESSAGE_EMAIL_EN_SOMMEIL,
} from "@/server/qualiopi/financements/sommeil";

const ID = "00000000-0000-4000-8000-000000000001";
const SOMMEIL = GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL[0];

const ligne = (template: string, statut = "a_valider") => ({
  id: ID,
  template,
  recipient: "x@exemple.test",
  locale: "fr",
  payload: {},
  sujet: "s",
  statut,
  clientId: null,
  entityType: "Devis",
  entityId: "devis-1",
  attachments: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
  h.updateMany.mockResolvedValue({ count: 1 });
  h.update.mockResolvedValue({});
  h.enqueue.mockResolvedValue({ enqueued: true });
});
afterEach(() => vi.unstubAllEnvs());

function aucuneEcriture() {
  expect(h.updateMany).not.toHaveBeenCalled();
  expect(h.update).not.toHaveBeenCalled();
  expect(h.enqueue).not.toHaveBeenCalled();
  expect(h.log).not.toHaveBeenCalled();
  expect(h.reval).not.toHaveBeenCalled();
}

describe("approuverEmailAction — e-mail en sommeil", () => {
  it.each(GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL)("%s : refus sans aucune écriture", async (t) => {
    h.findUnique.mockResolvedValue(ligne(t));
    expect(await approuverEmailAction({ id: ID })).toEqual({ error: MESSAGE_EMAIL_EN_SOMMEIL });
    expect(h.findUnique).toHaveBeenCalledTimes(1);
    aucuneEcriture();
  });

  it("refus aussi quand le statut est « approuve » (garde avant le contrôle du statut)", async () => {
    h.findUnique.mockResolvedValue(ligne(SOMMEIL, "approuve"));
    expect(await approuverEmailAction({ id: ID })).toEqual({ error: MESSAGE_EMAIL_EN_SOMMEIL });
    aucuneEcriture();
  });

  it("témoin : drapeau à « true » → verrou puis mise en file", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    h.findUnique.mockResolvedValue(ligne(SOMMEIL));
    await approuverEmailAction({ id: ID });
    expect(h.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ statut: "a_valider" }) }),
    );
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.enqueue.mock.calls[0]?.[3] ?? h.enqueue.mock.calls[0]).toBeDefined();
    expect(JSON.stringify(h.enqueue.mock.calls[0])).toContain('"bypassValidation":true');
  });

  it("autre gabarit, drapeau éteint : chemin inchangé", async () => {
    h.findUnique.mockResolvedValue(ligne("devis-envoi"));
    await approuverEmailAction({ id: ID });
    expect(h.updateMany).toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.updateMany.mock.calls)).toContain("envoye");
  });

  it("le message ne contient aucun mot interdit", () => {
    expect(MESSAGE_EMAIL_EN_SOMMEIL).not.toMatch(
      /qualiopi|opco|pris(e|es)?\s+en\s+charge|financeur|financ|certification/i,
    );
  });
});
