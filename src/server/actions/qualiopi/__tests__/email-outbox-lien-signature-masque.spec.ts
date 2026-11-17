// B2a — le lien de signature ne reste plus en clair dans la corbeille une fois l'e-mail traité.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  devisFind: vi.fn(),
  enqueue: vi.fn(),
  revoquer: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  revoquerTokensDocument: (...a: unknown[]) => h.revoquer(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findUnique: (...a: unknown[]) => h.findUnique(...a),
      update: (...a: unknown[]) => h.update(...a),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
    },
    devis: { findUnique: (...a: unknown[]) => h.devisFind(...a) },
  },
}));

import { approuverEmailAction, refuserEmailAction } from "@/server/actions/qualiopi/email-outbox";

const ID = "00000000-0000-4000-8000-000000000001";
const PIECE = "00000000-0000-4000-8000-0000000000aa";
const FAUX = "FAUX-JETON-EVIDENT-0000-0000-0000";
const LIEN = `https://exemple.test/portail/signer/${FAUX}`;

const ligne = (template: string, payload: Record<string, unknown>, extra = {}) => ({
  id: ID,
  template,
  recipient: "x@exemple.test",
  locale: "fr",
  payload,
  sujet: "s",
  statut: "a_valider",
  clientId: null,
  entityType: "Devis",
  entityId: "devis-1",
  attachments: null,
  ...extra,
});

function payloadsEcrits(): Array<Record<string, unknown>> {
  return h.update.mock.calls
    .map((c) => (c[0] as { data: { payload?: Record<string, unknown> } }).data.payload)
    .filter((p): p is Record<string, unknown> => p !== undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
  h.update.mockResolvedValue({});
  h.enqueue.mockResolvedValue({ enqueued: true });
  h.devisFind.mockResolvedValue({ documentGenereId: PIECE });
});

describe.each(["devis-envoi", "convention-envoi"])("approbation — %s", (template) => {
  it("(a) le payload stocké est masqué, le payload mis en file garde le lien", async () => {
    h.findUnique.mockResolvedValue(ligne(template, { numero: "N1", signatureUrl: LIEN }));
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({ data: { id: ID, envoye: true } });
    expect(h.enqueue.mock.calls[0]?.[3]).toMatchObject({ signatureUrl: LIEN });
    const ecrits = payloadsEcrits();
    expect(ecrits).toHaveLength(1);
    expect(JSON.stringify(ecrits[0])).not.toContain(FAUX);
    expect(ecrits[0]).toMatchObject({ numero: "N1" });
    expect(String(ecrits[0]?.["signatureUrl"])).toContain("/portail/signer/");
  });

  it("(b) échec de mise en file : rien n'est masqué", async () => {
    h.findUnique.mockResolvedValue(ligne(template, { signatureUrl: LIEN }));
    h.enqueue.mockRejectedValue(new Error("redis"));
    const r = await approuverEmailAction({ id: ID });
    expect("error" in r).toBe(true);
    expect(payloadsEcrits()).toHaveLength(0);
  });

  it("(c) refus : payload masqué et jeton de la bonne pièce révoqué", async () => {
    h.findUnique.mockResolvedValue(ligne(template, { signatureUrl: LIEN }));
    const r = await refuserEmailAction({ id: ID, motif: "non" });
    expect(r).toEqual({ data: { id: ID } });
    expect(JSON.stringify(payloadsEcrits())).not.toContain(FAUX);
    expect(payloadsEcrits()).toHaveLength(1);
    expect(h.revoquer).toHaveBeenCalledWith(expect.objectContaining({ documentGenereId: PIECE }));
  });
});

describe("refus — retrouver la pièce", () => {
  it("DocumentGenere : l'entityId est la pièce", async () => {
    h.findUnique.mockResolvedValue(
      ligne(
        "convention-envoi",
        { signatureUrl: LIEN },
        { entityType: "DocumentGenere", entityId: PIECE },
      ),
    );
    await refuserEmailAction({ id: ID, motif: "non" });
    expect(h.revoquer).toHaveBeenCalledWith(expect.objectContaining({ documentGenereId: PIECE }));
    expect(h.devisFind).not.toHaveBeenCalled();
  });

  it("pièce introuvable : masque quand même, avertit sans écrire le lien", async () => {
    h.devisFind.mockResolvedValue(null);
    const avert = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { signatureUrl: LIEN }));
    const r = await refuserEmailAction({ id: ID, motif: "non" });
    expect(r).toEqual({ data: { id: ID } });
    expect(h.revoquer).not.toHaveBeenCalled();
    expect(payloadsEcrits()).toHaveLength(1);
    expect(avert).toHaveBeenCalled();
    expect(JSON.stringify(avert.mock.calls)).not.toContain(FAUX);
    avert.mockRestore();
  });
});

describe("(d) robustesse", () => {
  it("sans signatureUrl, ou autre gabarit : aucune écriture de payload, aucune erreur", async () => {
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { numero: "N1" }));
    expect(await approuverEmailAction({ id: ID })).toEqual({ data: { id: ID, envoye: true } });
    h.findUnique.mockResolvedValue(ligne("autre-gabarit", { signatureUrl: LIEN }));
    expect(await approuverEmailAction({ id: ID })).toEqual({ data: { id: ID, envoye: true } });
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { numero: "N1" }));
    expect(await refuserEmailAction({ id: ID, motif: "non" })).toEqual({ data: { id: ID } });
    h.findUnique.mockResolvedValue(ligne("autre-gabarit", { signatureUrl: LIEN }));
    expect(await refuserEmailAction({ id: ID, motif: "non" })).toEqual({ data: { id: ID } });
    expect(payloadsEcrits()).toHaveLength(0);
    // refus sans signatureUrl sur devis-envoi : le jeton est tout de même révoqué
    expect(h.revoquer).toHaveBeenCalledTimes(1);
  });
});
