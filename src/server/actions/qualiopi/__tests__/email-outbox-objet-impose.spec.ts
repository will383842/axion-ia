// Règle d'imposition de l'objet à l'approbation : seule une retouche explicite, ou le marqueur
// `sujetChoisi` posé par `sendDevisAction`, impose un objet. Une simple étiquette de corbeille
// (« Devis N — Axion-IA », « Convention à signer — … ») n'est JAMAIS envoyée au client.
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
const ligne = (sujet: string, template = "devis-envoi", payload: Record<string, unknown> = {}) => ({
  id: ID,
  template,
  recipient: "x@exemple.test",
  locale: "fr",
  payload: { numero: "AXI-DEV-2026-001", ...payload },
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
  it("devis-envoi : étiquette de corbeille sans marqueur, approuvée sans retouche → rien d'imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("Devis AXI-DEV-2026-001 — Axion-IA"));
    await approuverEmailAction({ id: ID });
    expect(options()).not.toHaveProperty("sujetForce");
  });

  it("convention-envoi : étiquette de corbeille → rien d'imposé", async () => {
    h.findUnique.mockResolvedValue(
      ligne("Convention à signer — AXI-CONV-1", "convention-envoi", {
        sujetChoisi: "Convention à signer — AXI-CONV-1",
      }),
    );
    await approuverEmailAction({ id: ID });
    expect(options()).not.toHaveProperty("sujetForce");
  });

  it("convention-envoi : un marqueur sujetChoisi, même différent de l'étiquette, n'impose rien", async () => {
    h.findUnique.mockResolvedValue(
      ligne("Convention à signer — AXI-CONV-1", "convention-envoi", {
        sujetChoisi: "Convention à signer — AXI-CONV-1",
      }),
    );
    await approuverEmailAction({ id: ID });
    h.enqueue.mockClear();
    h.findUnique.mockResolvedValue(
      ligne("Un objet du fondateur", "convention-envoi", { sujetChoisi: "Un objet du fondateur" }),
    );
    await approuverEmailAction({ id: ID });
    expect(options()).not.toHaveProperty("sujetForce");
  });

  it("qualiopi-relance-impayee : étiquette de corbeille → rien d'imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("Relance — facture 12", "qualiopi-relance-impayee"));
    await approuverEmailAction({ id: ID });
    expect(options()).not.toHaveProperty("sujetForce");
  });

  it("devis-envoi avec marqueur égal à l'objet de la ligne : l'objet du fondateur est imposé", async () => {
    h.findUnique.mockResolvedValue(
      ligne("Votre devis, version du fondateur", "devis-envoi", {
        sujetChoisi: "Votre devis, version du fondateur",
      }),
    );
    await approuverEmailAction({ id: ID });
    expect(options()["sujetForce"]).toBe("Votre devis, version du fondateur");
  });

  it("marqueur qui ne correspond plus à l'objet de la ligne : rien d'imposé", async () => {
    h.findUnique.mockResolvedValue(
      ligne("Autre objet", "devis-envoi", { sujetChoisi: "Votre devis, version du fondateur" }),
    );
    await approuverEmailAction({ id: ID });
    expect(options()).not.toHaveProperty("sujetForce");
  });

  it("objet retouché à l'approbation et différent de la ligne : c'est lui qui est imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("Devis AXI-DEV-2026-001 — Axion-IA"));
    await approuverEmailAction({ id: ID, sujet: "Autre objet" });
    expect(options()["sujetForce"]).toBe("Autre objet");
  });

  it("objet retouché mais identique à la ligne, sans marqueur : rien d'imposé", async () => {
    h.findUnique.mockResolvedValue(ligne("Devis AXI-DEV-2026-001 — Axion-IA"));
    await approuverEmailAction({ id: ID, sujet: "Devis AXI-DEV-2026-001 — Axion-IA" });
    expect(options()).not.toHaveProperty("sujetForce");
  });
});
