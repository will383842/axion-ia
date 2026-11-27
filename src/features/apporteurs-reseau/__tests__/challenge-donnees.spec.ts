// Challenges d'apporteurs : la couche données est le SEUL endroit où la règle est figée (pas de
// déclencheur SQL). Prisma est bouchonné et enregistre les arguments. Données FICTIVES.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  ligne: null as Record<string, unknown> | null,
  publies: [] as Array<{ debutLe: Date; finLe: Date }>,
  count: 1,
  updateMany: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    challengeApporteur: {
      updateMany: h.updateMany,
      findFirst: h.findFirst,
      findMany: h.findMany,
      findUnique: h.findUnique,
    },
    $transaction: h.transaction,
  },
}));

import {
  lireEncartChallenge,
  lireReglementChallenge,
  listerReglementsPasses,
  modifierBrouillon,
  publierChallenge,
  archiverChallenge,
} from "../challenge-donnees";
import { empreinteChallenge } from "../challenge-regles";

const MAJ = new Date("2026-11-20T10:00:00.000Z");
const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const j = (s: string) => new Date(`${s}T00:00:00.000Z`);
const OPTS = { aujourdhui: "2026-11-26", confirmeDejaCommence: false };
const brouillon = () => ({
  id: ID,
  titre: "Challenge de test",
  debutLe: j("2026-12-01"),
  finLe: j("2026-12-31"),
  paiementJusquAu: null,
  produit: "journee-ia",
  critere: "facturees_dans_la_periode",
  seuil: 10,
  primeHtCents: 200_000,
  reglement: "Rien n'est attendu de vous.",
  statut: "brouillon",
  majAt: MAJ,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.ligne = brouillon();
  h.publies = [];
  h.count = 1;
  h.findUnique.mockImplementation(async () => h.ligne);
  h.findMany.mockImplementation(async () => h.publies);
  h.updateMany.mockImplementation(async () => ({ count: h.count }));
  h.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      challengeApporteur: {
        findUnique: h.findUnique,
        findMany: h.findMany,
        updateMany: h.updateMany,
      },
    }),
  );
});

describe("modification : brouillon seulement", () => {
  it("le filtre de l'update porte statut « brouillon »", async () => {
    await modifierBrouillon(ID, {
      titre: "T",
      debutLe: "2026-12-01",
      finLe: "2026-12-31",
      paiementJusquAu: null,
      produit: "journee-ia",
      critere: "facturees_dans_la_periode",
      seuil: 1,
      primeHtCents: 100,
      reglement: "R",
    });
    expect(h.updateMany.mock.calls[0]![0].where).toEqual({ id: ID, statut: "brouillon" });
  });
  it("aucune ligne touchée (plus un brouillon) : refus", async () => {
    h.count = 0;
    const r = await modifierBrouillon(ID, {} as never);
    expect(r).toMatchObject({ ok: false, code: "pas_brouillon" });
  });
});

describe("publication", () => {
  it("réussit, filtre le brouillon, fige l'empreinte de la règle complète", async () => {
    const r = await publierChallenge(ID, "adm-1", MAJ.toISOString(), OPTS);
    expect(r).toEqual({ ok: true });
    const appel = h.updateMany.mock.calls[0]![0];
    expect(appel.where).toEqual({ id: ID, statut: "brouillon" });
    expect(appel.data.statut).toBe("publie");
    expect(appel.data.publiePar).toBe("adm-1");
    expect(appel.data.reglementSha256).toBe(
      empreinteChallenge({
        titre: "Challenge de test",
        debutLe: "2026-12-01",
        finLe: "2026-12-31",
        paiementJusquAu: null,
        produit: "journee-ia",
        critere: "facturees_dans_la_periode",
        seuil: 10,
        primeHtCents: 200_000,
        reglement: "Rien n'est attendu de vous.",
      }),
    );
  });
  it("la transaction est sérialisable", async () => {
    await publierChallenge(ID, "adm-1", MAJ.toISOString(), OPTS);
    expect(h.transaction.mock.calls[0]![1]).toEqual({ isolationLevel: "Serializable" });
  });
  it("refuse si la version relue ne correspond pas", async () => {
    const r = await publierChallenge(ID, "adm-1", "2026-11-19T10:00:00.000Z", OPTS);
    expect(r).toMatchObject({ ok: false, code: "modifie" });
    expect(h.updateMany).not.toHaveBeenCalled();
  });
  it("refuse ce qui n'est pas un brouillon", async () => {
    h.ligne = { ...brouillon(), statut: "publie" };
    expect(await publierChallenge(ID, "a", MAJ.toISOString(), OPTS)).toMatchObject({
      ok: false,
      code: "pas_publiable",
    });
    h.ligne = null;
    expect(await publierChallenge(ID, "a", MAJ.toISOString(), OPTS)).toMatchObject({ ok: false });
    expect(h.updateMany).not.toHaveBeenCalled();
  });
  it("le contrôle de chevauchement ne porte que sur les PUBLIÉS du même produit", async () => {
    await publierChallenge(ID, "a", MAJ.toISOString(), OPTS);
    expect(h.findMany.mock.calls[0]![0].where).toEqual({ statut: "publie", produit: "journee-ia" });
  });
  it.each([
    ["recouvre le début (borne incluse)", "2026-11-01", "2026-12-01"],
    ["recouvre la fin (borne incluse)", "2026-12-31", "2027-01-31"],
    ["inclus dedans", "2026-12-10", "2026-12-20"],
    ["englobant", "2026-11-01", "2027-01-31"],
  ])("refuse si un publié %s", async (_n, debut, fin) => {
    h.publies = [{ debutLe: j(debut), finLe: j(fin) }];
    const r = await publierChallenge(ID, "a", MAJ.toISOString(), OPTS);
    expect(r).toMatchObject({ ok: false, code: "chevauche" });
    expect(h.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    ["finit la veille", "2026-11-01", "2026-11-30"],
    ["commence le lendemain", "2027-01-01", "2027-01-31"],
  ])("accepte un publié qui %s", async (_n, debut, fin) => {
    h.publies = [{ debutLe: j(debut), finLe: j(fin) }];
    expect(await publierChallenge(ID, "a", MAJ.toISOString(), OPTS)).toEqual({ ok: true });
  });
  it("refus si l'update ne touche aucune ligne (course)", async () => {
    h.count = 0;
    expect(await publierChallenge(ID, "a", MAJ.toISOString(), OPTS)).toMatchObject({
      ok: false,
      code: "modifie",
    });
  });
  it("refuse une période terminée, même avec la case cochée", async () => {
    const r = await publierChallenge(ID, "a", MAJ.toISOString(), {
      aujourdhui: "2027-01-01",
      confirmeDejaCommence: true,
    });
    expect(r).toMatchObject({ ok: false, code: "termine" });
  });
  it("le dernier jour est encore publiable (borne incluse)", async () => {
    const r = await publierChallenge(ID, "a", MAJ.toISOString(), {
      aujourdhui: "2026-12-31",
      confirmeDejaCommence: true,
    });
    expect(r).toEqual({ ok: true });
  });
  it("période commencée : exige la case, revérifiée ici", async () => {
    const commence = { aujourdhui: "2026-12-10", confirmeDejaCommence: false };
    expect(await publierChallenge(ID, "a", MAJ.toISOString(), commence)).toMatchObject({
      ok: false,
      code: "deja_commence",
    });
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(
      await publierChallenge(ID, "a", MAJ.toISOString(), {
        ...commence,
        confirmeDejaCommence: true,
      }),
    ).toEqual({ ok: true });
  });
  it("le premier jour lui-même n'est pas « déjà commencé »", async () => {
    expect(
      await publierChallenge(ID, "a", MAJ.toISOString(), {
        aujourdhui: "2026-12-01",
        confirmeDejaCommence: false,
      }),
    ).toEqual({ ok: true });
  });
});

describe("archivage et lectures", () => {
  it("archive un publié seulement", async () => {
    await archiverChallenge(ID);
    const a = h.updateMany.mock.calls[0]![0];
    expect(a.where).toEqual({ id: ID, statut: "publie" });
    expect(a.data.statut).toBe("archive");
    expect(a.data.archiveAt).toBeInstanceOf(Date);
  });
  const ligne = (o: Record<string, unknown>) => ({
    titre: "T",
    reglement: "R",
    debutLe: j("2026-12-01"),
    finLe: j("2026-12-31"),
    statut: "publie",
    publieAt: new Date("2026-11-20T10:00:00.000Z"),
    archiveAt: null,
    ...o,
  });
  it("règlement : cherché PAR IDENTIFIANT, publié ou archivé, publication avérée, commencé", async () => {
    h.findFirst.mockResolvedValueOnce(ligne({}));
    const v = await lireReglementChallenge(ID, "2027-02-01");
    expect(v).toMatchObject({ titre: "T", reglement: "R", arreteLe: null });
    const a = h.findFirst.mock.calls[0]![0];
    expect(a.where.id).toBe(ID);
    expect(a.where.statut).toEqual({ in: ["publie", "archive"] });
    expect(a.where.publieAt).toEqual({ not: null });
    expect(a.where.debutLe).toEqual({ lte: j("2027-02-01") });
    // plus aucun tri « le plus récent » : l'identifiant désigne le challenge
    expect(a.orderBy).toBeUndefined();
  });
  it("l'encart X donne le règlement X, même si un archivé a un début plus récent", async () => {
    const X = "11111111-1111-4111-8111-111111111111";
    const Y = "22222222-2222-4222-8222-222222222222";
    const base = [
      { id: X, ...ligne({ titre: "X publié", debutLe: j("2026-12-01") }) },
      {
        id: Y,
        ...ligne({
          titre: "Y archivé plus récent",
          debutLe: j("2027-01-01"),
          finLe: j("2027-01-31"),
          statut: "archive",
          archiveAt: new Date("2027-01-15T10:00:00.000Z"),
        }),
      },
    ];
    h.findFirst.mockImplementation(
      async (a: { where: { id: string } }) => base.find((l) => l.id === a.where.id) ?? null,
    );
    expect((await lireReglementChallenge(X, "2027-02-01"))?.titre).toBe("X publié");
    expect((await lireReglementChallenge(Y, "2027-02-01"))?.titre).toBe("Y archivé plus récent");
  });
  it("un archivé lisible porte la date d'arrêt (jour de Paris)", async () => {
    h.findFirst.mockResolvedValueOnce(
      ligne({ statut: "archive", archiveAt: new Date("2026-12-15T23:30:00.000Z") }),
    );
    expect((await lireReglementChallenge(ID, "2027-02-01"))?.arreteLe).toBe("2026-12-16");
  });
  it("un archivé le jour même de son début reste lisible (borne incluse)", async () => {
    h.findFirst.mockResolvedValueOnce(
      ligne({ statut: "archive", archiveAt: new Date("2026-12-01T09:00:00.000Z") }),
    );
    expect(await lireReglementChallenge(ID, "2027-02-01")).not.toBeNull();
  });
  it.each([
    [
      "archivé avant son début",
      { statut: "archive", archiveAt: new Date("2026-11-30T10:00:00.000Z") },
    ],
    ["archivé sans date d'archivage", { statut: "archive", archiveAt: null }],
    ["jamais publié", { publieAt: null }],
    ["brouillon", { statut: "brouillon" }],
  ])("%s : jamais lisible", async (_n, o) => {
    h.findFirst.mockResolvedValueOnce(ligne(o));
    expect(await lireReglementChallenge(ID, "2027-02-01")).toBeNull();
  });
  it("aucune ligne : null", async () => {
    h.findFirst.mockResolvedValueOnce(null);
    expect(await lireReglementChallenge(ID, "2027-02-01")).toBeNull();
  });
  it("liste des passés : tri, filtre, et seuls titre et période sortent", async () => {
    h.findMany.mockResolvedValueOnce([
      { id: "a", ...ligne({ titre: "Terminé", finLe: j("2026-12-31") }) },
      { id: "b", ...ligne({ titre: "En cours", finLe: j("2027-03-31") }) },
      {
        id: "c",
        ...ligne({
          titre: "Archivé ok",
          statut: "archive",
          archiveAt: new Date("2026-12-10T10:00:00Z"),
        }),
      },
      {
        id: "d",
        ...ligne({
          titre: "Archivé avant début",
          statut: "archive",
          archiveAt: new Date("2026-11-01T10:00:00Z"),
        }),
      },
    ]);
    const r = await listerReglementsPasses("2027-02-01");
    const a = h.findMany.mock.calls[0]![0];
    expect(a.where.statut).toEqual({ in: ["publie", "archive"] });
    expect(a.where.publieAt).toEqual({ not: null });
    expect(a.where.debutLe).toEqual({ lte: j("2027-02-01") });
    expect(a.orderBy).toEqual([{ debutLe: "desc" }, { publieAt: "desc" }]);
    expect(r.map((l) => l.titre)).toEqual(["Terminé", "Archivé ok"]);
    expect(Object.keys(r[0]!).sort()).toEqual(["debutLe", "finLe", "id", "titre"]);
  });
  it("encart : les publiés en cours seulement (jamais un archivé)", async () => {
    h.findFirst.mockResolvedValueOnce(null);
    expect(await lireEncartChallenge("2026-12-10")).toBeNull();
    expect(h.findFirst.mock.calls[0]![0].select.id).toBe(true);
    const w = h.findFirst.mock.calls[0]![0].where;
    expect(w.statut).toBe("publie");
    expect(w.debutLe).toEqual({ lte: j("2026-12-10") });
    expect(w.finLe).toEqual({ gte: j("2026-12-10") });
  });
});
