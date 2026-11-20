// L'objet modifié par le fondateur, garé puis approuvé SANS retouche, doit partir tel quel :
// l'objet à imposer se compare à l'objet du GABARIT, pas à l'objet enregistré sur la ligne.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", () => ({
  ligneDuLien: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  revoquerJetonPrecis: vi.fn(),
}));
vi.mock("@/lib/email/templates", () => ({
  sujetDuGabarit: () => "Votre devis AXI-DEV-2026-001",
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

const ID = "00000000-0000-4000-8000-000000000002";
const ligne = (sujet: string) => ({
  id: ID,
  template: "devis-envoi",
  recipient: "x@exemple.test",
  locale: "fr",
  payload: { numero: "AXI-DEV-2026-001" },
  sujet,
  statut: "a_valider",
  clientId: "c1",
  entityType: "Devis",
  entityId: "devis-1",
  attachments: null,
});
const options = () => (h.enqueue.mock.calls[0] as unknown[])[4] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
  h.update.mockResolvedValue({});
  h.enqueue.mockResolvedValue({ enqueued: true });
});

describe("approuverEmailAction — objet à imposer", () => {
  it("objet modifié et garé, approuvé sans retouche : l'objet de la ligne est imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("Votre devis, version du fondateur"));
    await approuverEmailAction({ id: ID });
    expect(options()["sujetForce"]).toBe("Votre devis, version du fondateur");
  });

  it("objet identique à celui du gabarit : rien n'est imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("Votre devis AXI-DEV-2026-001"));
    await approuverEmailAction({ id: ID });
    expect(options()).not.toHaveProperty("sujetForce");
  });

  it("nom technique d'un vieux garage : rien n'est imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("devis-envoi"));
    await approuverEmailAction({ id: ID });
    expect(options()).not.toHaveProperty("sujetForce");
  });

  it("objet retouché à l'approbation et différent du gabarit : c'est lui qui est imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("Votre devis AXI-DEV-2026-001"));
    await approuverEmailAction({ id: ID, sujet: "Autre objet" });
    expect(options()["sujetForce"]).toBe("Autre objet");
  });

  it("objet retouché pour revenir à celui du gabarit : rien n'est imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("Version du fondateur"));
    await approuverEmailAction({ id: ID, sujet: "Votre devis AXI-DEV-2026-001" });
    expect(options()).not.toHaveProperty("sujetForce");
  });
});
