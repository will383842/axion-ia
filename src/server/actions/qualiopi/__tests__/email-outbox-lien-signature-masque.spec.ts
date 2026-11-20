// B2a — le lien de signature ne reste plus en clair dans la corbeille une fois l'e-mail traité.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  enqueue: vi.fn(),
  revoquer: vi.fn(),
  ligne: vi.fn(),
  log: vi.fn(),
  sentry: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => h.sentry(...a) }));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", () => ({
  ligneDuLien: (...a: unknown[]) => h.ligne(...a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => h.log(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  revoquerJetonPrecis: (...a: unknown[]) => h.revoquer(...a),
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

import { approuverEmailAction, refuserEmailAction } from "@/server/actions/qualiopi/email-outbox";

const ID = "00000000-0000-4000-8000-000000000001";
const TOKEN = "00000000-0000-4000-8000-0000000000bb";
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
  return [...h.update.mock.calls, ...h.updateMany.mock.calls]
    .map((c) => (c[0] as { data: { payload?: Record<string, unknown> } }).data.payload)
    .filter((p): p is Record<string, unknown> => p !== undefined);
}

const ligneJeton = (extra = {}) => ({
  id: TOKEN,
  documentGenereId: "piece-1",
  partie: "client",
  createdAt: new Date(),
  revokedAt: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
  h.update.mockResolvedValue({});
  h.enqueue.mockResolvedValue({ enqueued: true });
  h.ligne.mockResolvedValue(ligneJeton());
  h.revoquer.mockResolvedValue(1);
});

describe.each(["devis-envoi", "convention-envoi"])("approbation — %s", (template) => {
  it("(a) masquage ATOMIQUE : un seul update, statut + payload masqué ; la file garde le lien", async () => {
    h.findUnique.mockResolvedValue(ligne(template, { numero: "N1", signatureUrl: LIEN }));
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({ data: { id: ID, envoye: true } });
    expect(h.enqueue.mock.calls[0]?.[3]).toMatchObject({ signatureUrl: LIEN });
    // OUT-1 : l'écriture « envoyé » est conditionnelle (`updateMany` sur « approuvé »), plus un `update`.
    expect(h.update).not.toHaveBeenCalled();
    const ecrit = h.updateMany.mock.calls
      .map((c) => c[0] as { where: Record<string, unknown>; data: Record<string, unknown> })
      .filter((c) => c.data["statut"] === "envoye");
    expect(ecrit).toHaveLength(1);
    expect(ecrit[0]!.where).toMatchObject({ id: ID, statut: "approuve" });
    const data = ecrit[0]!.data;
    expect(data["statut"]).toBe("envoye");
    expect(JSON.stringify(data)).not.toContain(FAUX);
    expect(data["payload"]).toMatchObject({ numero: "N1" });
    expect(String((data["payload"] as Record<string, unknown>)["signatureUrl"])).toContain(
      "/portail/signer/",
    );
  });

  it("(b) échec de mise en file : rien n'est masqué", async () => {
    h.findUnique.mockResolvedValue(ligne(template, { signatureUrl: LIEN }));
    h.enqueue.mockRejectedValue(new Error("redis"));
    const r = await approuverEmailAction({ id: ID });
    expect("error" in r).toBe(true);
    expect(payloadsEcrits()).toHaveLength(0);
  });

  it("(c) refus : payload masqué, UNIQUEMENT le jeton du lien révoqué", async () => {
    h.findUnique.mockResolvedValue(ligne(template, { signatureUrl: LIEN }));
    const r = await refuserEmailAction({ id: ID, motif: "non" });
    expect(r).toEqual({ data: { id: ID, jetonsRevoques: 1 } });
    expect(h.ligne).toHaveBeenCalledWith(LIEN);
    expect(JSON.stringify(payloadsEcrits())).not.toContain(FAUX);
    expect(payloadsEcrits()).toHaveLength(1);
    expect(h.revoquer).toHaveBeenCalledTimes(1);
    expect(h.revoquer).toHaveBeenCalledWith(expect.objectContaining({ tokenId: TOKEN }));
    expect(h.revoquer.mock.calls[0]?.[0]).not.toHaveProperty("documentGenereId");
  });
});

describe("refus — ciblage de la révocation", () => {
  it("jeton plus récent sur la même pièce : intact (seul le jeton du lien est visé)", async () => {
    // Le lien de l'e-mail refusé (T1) est DÉJÀ révoqué par le renvoi (T2 vivant, inconnu du refus).
    h.ligne.mockResolvedValue(ligneJeton({ revokedAt: new Date() }));
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { signatureUrl: LIEN }));
    const r = await refuserEmailAction({ id: ID, motif: "ménage" });
    expect(r).toEqual({ data: { id: ID, jetonsRevoques: 0 } });
    expect(h.revoquer).not.toHaveBeenCalled();
  });

  it("jeton d'une autre partie d'une convention : intact", async () => {
    h.ligne.mockResolvedValue(ligneJeton({ partie: "stagiaire" }));
    h.findUnique.mockResolvedValue(
      ligne("convention-envoi", { signatureUrl: LIEN }, { entityType: "DocumentGenere" }),
    );
    await refuserEmailAction({ id: ID, motif: "non" });
    // Un seul jeton visé par son id : aucune révocation « de toute la pièce ».
    expect(h.revoquer).toHaveBeenCalledTimes(1);
    expect(h.revoquer.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ tokenId: TOKEN }));
    expect(h.revoquer.mock.calls[0]?.[0]).not.toHaveProperty("partie");
    expect(h.revoquer.mock.calls[0]?.[0]).not.toHaveProperty("documentGenereId");
  });

  it("jeton expiré (la révocation ciblée rend 0) : jetonsRevoques 0, rien d'autre", async () => {
    h.revoquer.mockResolvedValue(0);
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { signatureUrl: LIEN }));
    const r = await refuserEmailAction({ id: ID, motif: "non" });
    expect(r).toEqual({ data: { id: ID, jetonsRevoques: 0 } });
  });

  it("jeton introuvable : rien n'est révoqué", async () => {
    h.ligne.mockResolvedValue(null);
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { signatureUrl: LIEN }));
    const r = await refuserEmailAction({ id: ID, motif: "non" });
    expect(r).toEqual({ data: { id: ID, jetonsRevoques: 0 } });
    expect(h.revoquer).not.toHaveBeenCalled();
    expect(payloadsEcrits()).toHaveLength(1);
  });

  it("(d) lien d'un e-mail qui n'est pas un devis : rien ne casse, rien n'est révoqué", async () => {
    h.findUnique.mockResolvedValue(ligne("facture-envoi", { signatureUrl: LIEN }));
    const r = await refuserEmailAction({ id: ID, motif: "non" });
    expect(r).toEqual({ data: { id: ID, jetonsRevoques: 0 } });
    expect(h.ligne).not.toHaveBeenCalled();
    expect(h.revoquer).not.toHaveBeenCalled();
    expect(payloadsEcrits()).toHaveLength(0);
  });

  it("échec de révocation : le refus aboutit, Sentry sans le lien, journal sans le lien", async () => {
    h.revoquer.mockRejectedValue(new Error(`boom ${FAUX}`));
    const avert = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { signatureUrl: LIEN }));
    const r = await refuserEmailAction({ id: ID, motif: "non" });
    expect(r).toEqual({ data: { id: ID, jetonsRevoques: 0 } });
    expect(h.sentry).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.sentry.mock.calls)).not.toContain(FAUX);
    expect(JSON.stringify(avert.mock.calls)).not.toContain(FAUX);
    const changes = (h.log.mock.calls[0]?.[0] as { changes: Record<string, unknown> }).changes;
    expect(changes).toMatchObject({ jetonsRevoques: 0, revocationEchouee: true });
    expect(JSON.stringify(h.log.mock.calls)).not.toContain(FAUX);
    avert.mockRestore();
  });

  it("le journal porte le nombre de jetons révoqués, jamais le lien", async () => {
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { signatureUrl: LIEN }));
    await refuserEmailAction({ id: ID, motif: "non" });
    const changes = (h.log.mock.calls[0]?.[0] as { changes: Record<string, unknown> }).changes;
    expect(changes).toMatchObject({ motif: "non", jetonsRevoques: 1 });
    expect(JSON.stringify(h.log.mock.calls)).not.toContain(FAUX);
  });
});

describe("gabarits formateurs — clé `lien`", () => {
  const LIEN_F = `https://exemple.test/portail/signer/${FAUX}`;
  it.each([
    "formateur-contrat-a-signer",
    "formateur-contrat-relance",
    "formateur-contrat-nouvelle-version",
  ])("%s : approbation masque `lien`, la file garde le vrai lien", async (t) => {
    h.findUnique.mockResolvedValue(
      ligne(t, { prenom: "P", lien: LIEN_F }, { entityType: "Trainer" }),
    );
    await approuverEmailAction({ id: ID });
    expect(h.enqueue.mock.calls[0]?.[3]).toMatchObject({ lien: LIEN_F });
    expect(JSON.stringify(payloadsEcrits())).not.toContain(FAUX);
    expect(payloadsEcrits()).toHaveLength(1);
  });

  it("refus : masquage SEUL, aucune révocation (ESCALADE : comportement du worker conditionnel)", async () => {
    h.findUnique.mockResolvedValue(
      ligne("formateur-contrat-relance", { lien: LIEN_F }, { entityType: "Trainer" }),
    );
    const r = await refuserEmailAction({ id: ID, motif: "non" });
    expect(r).toEqual({ data: { id: ID, jetonsRevoques: 0 } });
    expect(JSON.stringify(payloadsEcrits())).not.toContain(FAUX);
    expect(h.ligne).not.toHaveBeenCalled();
    expect(h.revoquer).not.toHaveBeenCalled();
  });
});

describe("refus automatique « retenu » (liste de suppression)", () => {
  it("masque le lien dans le même updateMany et révoque le jeton ciblé", async () => {
    h.enqueue.mockResolvedValue({ enqueued: false, retenu: "rebond_dur" });
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { signatureUrl: LIEN }));
    const r = await approuverEmailAction({ id: ID });
    expect("error" in r).toBe(true);
    const refus = h.updateMany.mock.calls.find(
      (c) => (c[0] as { data: { statut?: string } }).data.statut === "refuse",
    );
    expect(refus).toBeDefined();
    expect(JSON.stringify(refus?.[0])).not.toContain(FAUX);
    expect((refus?.[0] as { data: { payload?: unknown } }).data.payload).toBeDefined();
    expect(h.revoquer).toHaveBeenCalledTimes(1);
    expect(h.revoquer).toHaveBeenCalledWith(expect.objectContaining({ tokenId: TOKEN }));
  });

  it("(a) refus rendant count 0 (ligne déjà repartie ailleurs) : AUCUNE révocation, jetonsRevoques 0", async () => {
    h.enqueue.mockResolvedValue({ enqueued: false, retenu: "rebond_dur" });
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { signatureUrl: LIEN }));
    // Verrou a_valider → approuve : count 1 ; refus conditionnel sur « approuve » : count 0.
    h.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const r = await approuverEmailAction({ id: ID });
    expect("error" in r).toBe(true);
    expect(h.ligne).not.toHaveBeenCalled();
    expect(h.revoquer).not.toHaveBeenCalled();
    const entree = h.log.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "email.outbox.retenu",
    );
    expect((entree?.[0] as { changes: Record<string, unknown> }).changes["jetonsRevoques"]).toBe(0);
    expect(JSON.stringify(h.log.mock.calls)).not.toContain(FAUX);
  });
});

describe("robustesse", () => {
  it("SANS lien (signatureUrl absente) : aucune écriture de payload, AUCUNE révocation", async () => {
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { numero: "N1" }));
    expect(await approuverEmailAction({ id: ID })).toEqual({ data: { id: ID, envoye: true } });
    h.findUnique.mockResolvedValue(ligne("autre-gabarit", { signatureUrl: LIEN }));
    expect(await approuverEmailAction({ id: ID })).toEqual({ data: { id: ID, envoye: true } });
    h.findUnique.mockResolvedValue(ligne("devis-envoi", { numero: "N1" }));
    expect(await refuserEmailAction({ id: ID, motif: "non" })).toEqual({
      data: { id: ID, jetonsRevoques: 0 },
    });
    h.findUnique.mockResolvedValue(ligne("autre-gabarit", { signatureUrl: LIEN }));
    expect(await refuserEmailAction({ id: ID, motif: "non" })).toEqual({
      data: { id: ID, jetonsRevoques: 0 },
    });
    expect(payloadsEcrits()).toHaveLength(0);
    expect(h.revoquer).not.toHaveBeenCalled();
  });
});
