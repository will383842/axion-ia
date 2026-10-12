/**
 * Lot C (M16) — la copie de SA signature d'une lettre de mission part par F28
 * (« Votre copie de la lettre de mission signée ») quand le signataire est un
 * formateur indépendant ; sinon, ou si F28 ne peut pas partir, la copie
 * générique d'avant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  piece: null as Record<string, unknown> | null,
  envoyer: vi.fn(async (..._a: unknown[]) => "envoye" as string),
  enqueue: vi.fn(async (..._a: unknown[]) => ({ enqueued: true })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findUnique: async () => h.piece } },
}));
vi.mock("@/server/qualiopi/documents/signature/exemplaire-signe", () => ({
  rendreExemplaireSigne: async () => ({ ok: true, buffer: Buffer.from("pdf"), nomFichier: "l.pdf" }),
}));
vi.mock("@/server/qualiopi/documents/render", () => ({ storeAndSignPdf: async () => ({}) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueue }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: h.envoyer }));

import { transmettreCopiePartielle } from "./transmission-exemplaire";

function lettre(trainer: Record<string, unknown> | null) {
  return {
    id: "d1",
    type: "lettre_mission",
    numero: "AXI-LM-1",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    statutSignature: "partielle",
    annuleeAt: null,
    clientId: null,
    hashSha256: "abc",
    trainerId: trainer === null ? null : "t1",
    trainer,
    signatures: [{ signataireEmail: "m@ex.test", signataireNom: "Marie Durand" }],
  };
}

const INDEP = { statut: "sous_traitant", organismeSousTraitantId: null, prenom: "Marie" };

describe("copie de la signature d'une lettre (F28)", () => {
  beforeEach(() => {
    h.envoyer.mockClear().mockResolvedValue("envoye");
    h.enqueue.mockClear();
  });

  it("indépendant : F28 avec la pièce jointe, pas la copie générique", async () => {
    h.piece = lettre(INDEP);
    const r = await transmettreCopiePartielle("d1", "formateur");
    expect(r.ok).toBe(true);
    expect(h.enqueue).not.toHaveBeenCalled();
    const e = h.envoyer.mock.calls[0]![0] as Record<string, unknown>;
    expect(e).toMatchObject({
      gabarit: "formateur-lettre-copie-signature",
      destinataire: "m@ex.test",
      entityType: "Trainer",
      entityId: "t1",
    });
    expect((e.payload as Record<string, unknown>).valeurs).toEqual({ numéro: "AXI-LM-1" });
    expect((e.attachments as unknown[]).length).toBe(1);
  });

  it("texte F28 non validé : la copie générique d'avant", async () => {
    h.piece = lettre(INDEP);
    h.envoyer.mockResolvedValue("texte-non-valide");
    const r = await transmettreCopiePartielle("d1", "formateur");
    expect(r.ok).toBe(true);
    expect(h.enqueue).toHaveBeenCalledTimes(1);
  });

  it("salarié ou intervenant d'organisme : la copie générique, F28 jamais tenté", async () => {
    for (const t of [
      { ...INDEP, statut: "salarie" },
      { ...INDEP, organismeSousTraitantId: "o1" },
    ]) {
      h.piece = lettre(t);
      await transmettreCopiePartielle("d1", "formateur");
    }
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledTimes(2);
  });

  it("autre partie qu'un formateur : la copie générique", async () => {
    h.piece = lettre(INDEP);
    await transmettreCopiePartielle("d1", "client");
    expect(h.envoyer).not.toHaveBeenCalled();
  });
});
