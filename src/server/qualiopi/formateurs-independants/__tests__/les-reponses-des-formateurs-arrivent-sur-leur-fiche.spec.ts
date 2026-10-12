/**
 * CAMP-4 — les réponses des formateurs indépendants, dans le relevé des candidatures :
 * une réponse automatique n'a aucun effet ; une seule alerte par message.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const trainers = vi.fn();
const connues = vi.fn();
const create = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findMany: (...a: unknown[]) => trainers(...a) },
    reponseEntranteFormateur: {
      findMany: (...a: unknown[]) => connues(...a),
      create: (...a: unknown[]) => create(...a),
    },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (e: string) => `h-${e}` }));
const notify = vi.fn();
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));

import { rapprocherReponsesFormateurs } from "../reponses-entrantes";

const MAINTENANT = new Date("2026-10-20T10:00:00Z");
const T = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
function msg(id: string, o: Record<string, unknown> = {}) {
  return {
    messageId: id,
    folderId: "f",
    fromAddress: "Formateur <Form@Example.com>",
    subject: "Re: votre mission",
    summary: "…",
    receivedAt: new Date("2026-10-20T09:00:00Z"),
    ...o,
  };
}
const client = { lireEntetes: vi.fn(async () => ({})) };
const allume = async () => true;

beforeEach(() => {
  vi.clearAllMocks();
  trainers.mockResolvedValue([{ id: T, email: "form@example.com" }]);
  connues.mockResolvedValue([]);
  create.mockResolvedValue({ id: "r1" });
});

describe("rapprocherReponsesFormateurs", () => {
  it("interrupteur coupé : aucune lecture", async () => {
    const b = await rapprocherReponsesFormateurs([msg("m1")], client, MAINTENANT, {
      allume: async () => false,
    });
    expect(b).toEqual({ rangees: 0, automatiques: 0, alertes: 0, erreurs: 0 });
    expect(trainers).not.toHaveBeenCalled();
  });

  it("une réponse humaine : rangée sur la fiche ouverte, UNE alerte, ni objet ni adresse", async () => {
    const b = await rapprocherReponsesFormateurs([msg("m1")], client, MAINTENANT, { allume });
    expect(b).toMatchObject({ rangees: 1, alertes: 1 });
    expect(trainers.mock.calls[0]![0].where).toEqual({
      email: { in: ["form@example.com"] },
      finCollaborationAt: null,
    });
    const data = create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ trainerId: T, source: "zoho", zohoMessageId: "m1", auto: false });
    expect(JSON.stringify(data)).not.toContain("votre mission");
    expect(notify).toHaveBeenCalledWith({
      category: "FORMATEUR_REPLIED",
      payload: { trainerId: T, receivedAt: "2026-10-20T09:00:00.000Z" },
    });
  });

  it("une réponse automatique : gardée, sans alerte", async () => {
    const b = await rapprocherReponsesFormateurs(
      [msg("m2", { subject: "Réponse automatique : absent du bureau" })],
      { lireEntetes: vi.fn(async () => ({ "auto-submitted": ["auto-replied"] })) },
      MAINTENANT,
      { allume },
    );
    expect(b).toMatchObject({ rangees: 0, automatiques: 1, alertes: 0 });
    expect(notify).not.toHaveBeenCalled();
  });

  it("un message déjà rangé (relu au passage suivant) n'alerte plus", async () => {
    connues.mockResolvedValue([{ zohoMessageId: "m1" }]);
    const b = await rapprocherReponsesFormateurs([msg("m1")], client, MAINTENANT, { allume });
    expect(b.alertes).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("une écriture concurrente (clé unique) ne compte ni erreur ni alerte", async () => {
    create.mockRejectedValue({ code: "P2002" });
    const b = await rapprocherReponsesFormateurs([msg("m1")], client, MAINTENANT, { allume });
    expect(b).toEqual({ rangees: 0, automatiques: 0, alertes: 0, erreurs: 0 });
  });
});
