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
const repriseClassique = vi.hoisted(() => vi.fn());
vi.mock("@/server/qualiopi/documents/signature/apres-signature", async (importOriginal) => ({
  // Le choix du message selon la raison est du code réel, jamais simulé.
  messageConfirmationSelonRaisons: (
    await importOriginal<typeof import("@/server/qualiopi/documents/signature/apres-signature")>()
  ).messageConfirmationSelonRaisons,
  apresSignature: vi.fn(),
  PREFIXE_ACTIVATION_REFUSEE: "x",
  reprendreAcceptationDevisFormules: reprise,
  reprendreConfirmationDevisClassiques: repriseClassique,
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
    annuleeAt: null,
  });
  sigs("client", "axionia");
  repriseClassique.mockReset();
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

describe("relancerAcceptationDevisAction : devis CLASSIQUE (M1)", () => {
  const aucunFormules = {
    traite: false,
    ids: [],
    acceptes: [],
    plansEchec: [],
    confirmationsEchec: [],
    confirmationsPreparees: [],
    plansProposes: [],
  };
  const classique = (patch: Record<string, unknown> = {}) => ({
    traite: true,
    ids: ["dv-c"],
    confirmationsPreparees: ["dv-c"],
    confirmationsDejaFaites: [],
    confirmationsEchec: [],
    echecs: [],
    ...patch,
  });
  beforeEach(() => reprise.mockResolvedValue(aucunFormules));

  it("reprise des formules sans effet : la confirmation du devis classique est préparée", async () => {
    repriseClassique.mockResolvedValue(classique());
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(repriseClassique).toHaveBeenCalledWith(DOC);
    expect(r).toMatchObject({
      ok: true,
      message:
        "Confirmation de commande préparée : elle attend votre validation dans les e-mails à valider.",
    });
  });

  it("confirmation déjà faite : « existe déjà », sans échec", async () => {
    repriseClassique.mockResolvedValue(
      classique({ confirmationsPreparees: [], confirmationsDejaFaites: ["dv-c"] }),
    );
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r).toMatchObject({ ok: true, message: "La confirmation de commande existe déjà." });
  });

  it("échec pas_d_adresse : le message dit la cause", async () => {
    repriseClassique.mockResolvedValue(
      classique({
        confirmationsPreparees: [],
        confirmationsEchec: ["dv-c"],
        echecs: [{ devisId: "dv-c", raison: "pas_d_adresse" }],
      }),
    );
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("n'a pas d'adresse e-mail");
  });

  it("échec exemplaire_absent : le message dit la cause et renvoie au support", async () => {
    repriseClassique.mockResolvedValue(
      classique({
        confirmationsPreparees: [],
        confirmationsEchec: ["dv-c"],
        echecs: [{ devisId: "dv-c", raison: "exemplaire_absent" }],
      }),
    );
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r).toEqual({
      ok: false,
      message:
        "La confirmation de commande n'a pas pu être préparée : l'exemplaire signé du devis est absent. Relancez depuis la fiche du devis ; si le problème persiste, prévenez le support technique.",
    });
  });

  it.each(["etat_inconnu", "file_indisponible", "exception"])(
    "échec %s : message générique, sans mention d'un code consigné",
    async (raison) => {
      repriseClassique.mockResolvedValue(
        classique({
          confirmationsPreparees: [],
          confirmationsEchec: ["dv-c"],
          echecs: [{ devisId: "dv-c", raison }],
        }),
      );
      const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.message).toBe(
        "La confirmation de commande n'a pas pu être préparée. Relancez depuis la fiche du devis.",
      );
    },
  );

  it("X3 : une confirmation préparée et une autre en échec : le message dit combien ont été préparées", async () => {
    repriseClassique.mockResolvedValue(
      classique({
        ids: ["a", "b"],
        confirmationsPreparees: ["a"],
        confirmationsEchec: ["b"],
        echecs: [{ devisId: "b", raison: "pas_d_adresse" }],
      }),
    );
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain("n'a pas d'adresse e-mail");
    expect(!r.ok && r.message).toContain("1 confirmation de commande a déjà été préparée");
  });

  it("X3 : deux préparées et une en échec : accord au pluriel", async () => {
    repriseClassique.mockResolvedValue(
      classique({
        ids: ["a", "b", "c"],
        confirmationsPreparees: ["a", "b"],
        confirmationsEchec: ["c"],
        echecs: [{ devisId: "c", raison: "exception" }],
      }),
    );
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(!r.ok && r.message).toContain("2 confirmations de commande ont déjà été préparées");
  });

  it("m1 : devisAcceptes compte les confirmations préparées, pas les déjà faites", async () => {
    repriseClassique.mockResolvedValue(
      classique({ ids: ["a", "b"], confirmationsPreparees: ["a"], confirmationsDejaFaites: ["b"] }),
    );
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r).toMatchObject({ ok: true, devisAcceptes: 1 });
  });

  it("M1 : pièce annulée : refus AVANT toute reprise (formules et classique)", async () => {
    (prisma.documentGenere.findUnique as unknown as Mock).mockResolvedValue({
      type: "devis",
      numero: "AXI-DEV-2026-001",
      annuleeAt: new Date("2026-11-01T10:00:00Z"),
    });
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r).toEqual({ ok: false, message: "Cette pièce est annulée : aucune relance possible." });
    expect(reprise).not.toHaveBeenCalled();
    expect(repriseClassique).not.toHaveBeenCalled();
  });

  it("rien à reprendre nulle part : refus", async () => {
    repriseClassique.mockResolvedValue({ ...classique(), traite: false, ids: [] });
    expect((await relancerAcceptationDevisAction({ documentGenereId: DOC })).ok).toBe(false);
  });

  it("devis non contresigné : refusé AVANT toute reprise", async () => {
    sigs("client");
    const r = await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(r.ok).toBe(false);
    expect(repriseClassique).not.toHaveBeenCalled();
  });

  it("devis à formules traité par la reprise des formules : la reprise classique n'est pas appelée", async () => {
    reprise.mockResolvedValue({
      ...aucunFormules,
      traite: true,
      ids: ["dv-1"],
      acceptes: ["dv-1"],
    });
    await relancerAcceptationDevisAction({ documentGenereId: DOC });
    expect(repriseClassique).not.toHaveBeenCalled();
  });
});
