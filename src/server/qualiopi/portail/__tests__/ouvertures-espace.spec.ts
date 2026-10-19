import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  $executeRaw: vi.fn(),
  remiseRetour: { findFirst: vi.fn(), create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    espaceStagiaireOuverture: { create: vi.fn() },
    remiseRetour: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  journaliserOuvertureDocument,
  ouverturesActivesPourStagiaire,
  trouverPieceDuStagiaire,
  tracerOuvertureEspace,
} from "../ouvertures-espace";

const p = prisma as unknown as {
  setting: { findUnique: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
  espaceStagiaireOuverture: { create: ReturnType<typeof vi.fn> };
};
const etat = (e: string | null) =>
  p.setting.findUnique.mockResolvedValue(e === null ? null : { value: { etat: e } });

const DOC_ID = "11111111-1111-4111-8111-111111111111";
const insc = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  estTestInterne: false,
  sessionId: "s1",
  attestationDocument: null,
  session: { statut: "planifiee", dateDebut: null, dateFin: null, documents: [] },
  ...over,
});
const piece = (over: Record<string, unknown> = {}) => ({
  id: DOC_ID,
  type: "programme",
  numero: "AXI-PRG-1",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  p.enrollment.findMany.mockResolvedValue([insc()]);
  tx.remiseRetour.findFirst.mockResolvedValue({ id: "r1" });
});

describe("tracerOuvertureEspace", () => {
  it.each([null, "eteint"])("%s : aucune lecture d'inscription, aucune écriture", async (e) => {
    etat(e);
    await tracerOuvertureEspace("t1", "navigateur");
    expect(p.enrollment.findMany).not.toHaveBeenCalled();
    expect(p.espaceStagiaireOuverture.create).not.toHaveBeenCalled();
  });

  it("essai : une inscription réelle parmi les siennes = rien", async () => {
    etat("essai");
    p.enrollment.findMany.mockResolvedValue([insc({ estTestInterne: true }), insc()]);
    await tracerOuvertureEspace("t1", "navigateur");
    expect(p.espaceStagiaireOuverture.create).not.toHaveBeenCalled();
  });

  it("essai : toutes d'essai = une ligne, origine reprise", async () => {
    etat("essai");
    p.enrollment.findMany.mockResolvedValue([insc({ estTestInterne: true })]);
    await tracerOuvertureEspace("t1", "apercu_automatique");
    expect(p.espaceStagiaireOuverture.create).toHaveBeenCalledTimes(1);
    expect(p.espaceStagiaireOuverture.create.mock.calls[0]![0].data).toEqual({
      traineeId: "t1",
      origine: "apercu_automatique",
    });
  });

  it("essai : aucune inscription = rien (pas de « toutes » sur le vide)", async () => {
    etat("essai");
    p.enrollment.findMany.mockResolvedValue([]);
    expect(await ouverturesActivesPourStagiaire("t1")).toBe(false);
  });

  it("actif : une ligne ; l'échec de l'écriture ne remonte jamais", async () => {
    etat("actif");
    p.espaceStagiaireOuverture.create.mockRejectedValue(new Error("db"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(tracerOuvertureEspace("t1", "navigateur")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("actif : l'échec de la lecture de l'interrupteur ne remonte jamais", async () => {
    p.setting.findUnique.mockRejectedValue(new Error("db"));
    await expect(tracerOuvertureEspace("t1", "navigateur")).resolves.toBeUndefined();
    expect(p.espaceStagiaireOuverture.create).not.toHaveBeenCalled();
  });
});

describe("trouverPieceDuStagiaire — appartenance", () => {
  it("pièce collective de sa session", async () => {
    p.enrollment.findMany.mockResolvedValue([
      insc({ session: { ...insc().session, documents: [piece()] } }),
    ]);
    const r = await trouverPieceDuStagiaire("t1", DOC_ID);
    expect(r).toMatchObject({ enrollmentId: "e1", sessionId: "s1", documentId: DOC_ID });
  });

  it("attestation de son inscription", async () => {
    p.enrollment.findMany.mockResolvedValue([
      insc({ attestationDocument: piece({ type: "attestation", numero: "AXI-ATT-1" }) }),
    ]);
    expect(await trouverPieceDuStagiaire("t1", DOC_ID)).not.toBeNull();
  });

  it("la requête borne aux inscriptions de CE stagiaire et aux nominatives de CE stagiaire", async () => {
    await trouverPieceDuStagiaire("t1", DOC_ID);
    const arg = p.enrollment.findMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ traineeId: "t1" });
    const wDocs = arg.select.session.select.documents.where;
    expect(JSON.stringify(wDocs)).toContain('"traineeId":"t1"');
    expect(wDocs.id).toBe(DOC_ID);
  });

  it("pièce absente de ses inscriptions = null (aucune différence avec l'inexistante)", async () => {
    expect(await trouverPieceDuStagiaire("t1", DOC_ID)).toBeNull();
  });

  it("type non remis (facture) = null même si rattaché", async () => {
    p.enrollment.findMany.mockResolvedValue([
      insc({ session: { ...insc().session, documents: [piece({ type: "facture" })] } }),
    ]);
    expect(await trouverPieceDuStagiaire("t1", DOC_ID)).toBeNull();
  });
});

describe("journaliserOuvertureDocument", () => {
  const ctx = {
    documentId: DOC_ID,
    type: "programme",
    numero: "AXI-PRG-1",
    enrollmentId: "e1",
    sessionId: "s1",
  };

  it("crée la remise si absente puis le retour « ouverture », canal espace, documentGenereId", async () => {
    tx.remiseRetour.findFirst.mockResolvedValue(null);
    tx.remiseRetour.create.mockResolvedValue({ id: "r1" });
    const create = (prisma as unknown as { remiseRetour: { create: ReturnType<typeof vi.fn> } })
      .remiseRetour.create;
    await journaliserOuvertureDocument(ctx);
    expect(tx.remiseRetour.create.mock.calls[0]![0].data).toMatchObject({
      nature: "remise",
      canal: "espace",
      destinataire: "stagiaire",
      documentGenereId: DOC_ID,
    });
    expect(create.mock.calls[0]![0].data).toMatchObject({
      nature: "ouverture",
      remiseId: "r1",
      canal: "espace",
      destinataire: "stagiaire",
      enrollmentId: "e1",
      sessionId: "s1",
      documentGenereId: DOC_ID,
    });
  });

  it("réutilise la remise existante", async () => {
    await journaliserOuvertureDocument(ctx);
    expect(tx.remiseRetour.create).not.toHaveBeenCalled();
  });
});
