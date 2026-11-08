/**
 * Reprise manuelle de l'acceptation d'un devis signé des deux parties (point 2 de l'audit) :
 * mêmes garde et habilitation que la contresignature, idempotente, sans effet si le devis n'est
 * pas signé des deux parties.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(),
}));
const reprise = vi.hoisted(() => vi.fn());
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: vi.fn(),
  PREFIXE_ACTIVATION_REFUSEE: "x",
  reprendreAcceptationDevisFormules: reprise,
}));
vi.mock("@/server/qualiopi/documents/signature/contexte-requete", () => ({
  contexteRequete: vi.fn(async () => ({})),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const garde = vi.hoisted(() => ({ role: "super_admin" }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-1", role: garde.role })),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { relancerAcceptationDevisAction } from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const DOC = "11111111-1111-4111-8111-111111111111";
const sigs = (...parties: string[]) =>
  (prisma.documentSignature.findMany as unknown as Mock).mockResolvedValue(
    parties.map((partie) => ({ partie })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  garde.role = "super_admin";
  (prisma.documentGenere.findUnique as unknown as Mock).mockResolvedValue({
    type: "devis",
    numero: "AXI-DEV-2026-001",
  });
  sigs("client", "axionia");
  reprise.mockResolvedValue({
    traite: true,
    ids: ["dv-1"],
    acceptes: ["dv-1"],
    plansEchec: [],
    confirmationsEchec: [],
    confirmationsPreparees: [],
    plansProposes: [],
  });
});

describe("relancerAcceptationDevisAction", () => {
  it("devis signé des deux parties sans formule retenue : relance l'acceptation", async () => {
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r).toEqual({ ok: true, devisAcceptes: 1 });
    expect(reprise).toHaveBeenCalledWith(DOC, { confirmer: true });
  });

  it("🔴 acceptation reprise mais plans non proposés : échec visible, jamais un succès muet", async () => {
    reprise.mockResolvedValue({
      traite: true,
      ids: ["dv-1"],
      acceptes: ["dv-1"],
      plansEchec: ["dv-1"],
      confirmationsEchec: [],
      confirmationsPreparees: [],
      plansProposes: [],
    });
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("plans récurrents");
  });

  it("🔴 acceptation reprise mais confirmation de commande non préparée : échec visible", async () => {
    reprise.mockResolvedValue({
      traite: true,
      ids: ["dv-1"],
      acceptes: [],
      plansEchec: [],
      confirmationsEchec: ["dv-1"],
      confirmationsPreparees: [],
      plansProposes: [],
    });
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("confirmation de commande");
  });

  it("rôle sans habilitation à contresigner : refusé, rien n'est relancé", async () => {
    garde.role = "editor";
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(reprise).not.toHaveBeenCalled();
  });

  it("devis signé par le client seulement : refusé, rien n'est relancé", async () => {
    sigs("client");
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(reprise).not.toHaveBeenCalled();
  });

  it("pièce qui n'est pas un devis : refusée", async () => {
    (prisma.documentGenere.findUnique as unknown as Mock).mockResolvedValue({
      type: "convention",
      numero: "X",
    });
    expect((await relancerAcceptationDevisAction({ documentGenereId: DOC })).ok).toBe(false);
    expect(reprise).not.toHaveBeenCalled();
  });

  it("rien à reprendre (déjà accepté) : message clair, pas d'erreur levée", async () => {
    reprise.mockResolvedValue({
      traite: false,
      ids: [],
      acceptes: [],
      plansEchec: [],
      confirmationsEchec: [],
      confirmationsPreparees: [],
      plansProposes: [],
    });
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
  });

  it("🔴 traite:true mais aucun devis réellement accepté : dit clairement que rien n'a été fait", async () => {
    reprise.mockResolvedValue({
      traite: true,
      ids: [],
      acceptes: [],
      plansEchec: [],
      confirmationsEchec: [],
      confirmationsPreparees: [],
      plansProposes: [],
    });
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("Rien n'a été fait");
  });

  it("🔴 devis déjà accepté, confirmation déjà garée (rien préparé) : jamais ok:true", async () => {
    reprise.mockResolvedValue({
      traite: true,
      ids: ["dv-1"],
      acceptes: [],
      plansEchec: [],
      confirmationsEchec: [],
      confirmationsPreparees: [],
      plansProposes: [],
    });
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("Rien n'a été fait");
  });

  it("🔴 devis déjà accepté dont la reprise vient de préparer la confirmation : succès", async () => {
    reprise.mockResolvedValue({
      traite: true,
      ids: ["dv-1"],
      acceptes: [],
      plansEchec: [],
      confirmationsEchec: [],
      confirmationsPreparees: ["dv-1"],
      plansProposes: [],
    });
    expect(await relancerAcceptationDevisAction({ documentGenereId: DOC })).toEqual({
      ok: true,
      devisAcceptes: 1,
    });
  });

  it("🔴 confirmation déjà garée mais plans reproposés par cet appel : pas de « Rien n'a été fait »", async () => {
    reprise.mockResolvedValue({
      traite: true,
      ids: ["dv-1"],
      acceptes: [],
      plansEchec: [],
      confirmationsEchec: [],
      confirmationsPreparees: [],
      plansProposes: ["dv-1"],
    });
    expect(await relancerAcceptationDevisAction({ documentGenereId: DOC })).toEqual({
      ok: true,
      devisAcceptes: 1,
    });
  });

  it("🔴 confirmation ET plans en échec : les deux messages sont affichés", async () => {
    reprise.mockResolvedValue({
      traite: true,
      ids: ["dv-1"],
      acceptes: ["dv-1"],
      plansEchec: ["dv-1"],
      confirmationsEchec: ["dv-1"],
      confirmationsPreparees: [],
      plansProposes: [],
    });
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("confirmation de commande");
    expect(!r.ok && r.message).toContain("plans récurrents");
  });

  it("nouvel échec : message avec le motif, jamais d'exception", async () => {
    reprise.mockRejectedValue(Object.assign(new Error("x"), { motif: "offre_alteree" }));
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.message).toContain("offre_alteree");
  });

  it("identifiant invalide : refusé", async () => {
    expect((await relancerAcceptationDevisAction({ documentGenereId: "nope" })).ok).toBe(false);
    expect(reprise).not.toHaveBeenCalled();
  });
});
