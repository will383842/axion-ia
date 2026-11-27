import { describe, expect, it, vi } from "vitest";

import type { GscLotResultat, GscSearchRow } from "@/server/content-gen/seo/gsc-client";
import { ingererJour } from "../jour";
import { creerFauxPrisma } from "./faux-prisma";

const JOUR = "2026-11-20";
const row = (keys: string[], impressions: number, clics = 0, position = 5): GscSearchRow => ({
  keys,
  clicks: clics,
  impressions,
  ctr: impressions ? clics / impressions : 0,
  position,
});
const ok = (rows: GscSearchRow[]): GscLotResultat => ({ etat: "ok", rows, complet: true });

function recherche(opts: { a?: GscLotResultat; b?: GscLotResultat; c?: GscLotResultat }) {
  const a =
    opts.a ??
    ok([
      row([JOUR, "https://axion-ia.com/fr/blog/x"], 100, 4, 6),
      row([JOUR, "https://www.axion-ia.com/fr/blog/x/?utm=1"], 20, 0, 10),
      row([JOUR, "https://autre-site.fr/page"], 5),
    ]);
  const b =
    opts.b ??
    ok([
      row([JOUR, "https://axion-ia.com/fr/blog/x", "formation ia"], 60, 3, 4),
      row([JOUR, "https://axion-ia.com/fr/blog/x", "jean dupont"], 10, 0, 8),
      row([JOUR, "https://axion-ia.com/fr/blog/x", "contact@exemple.fr"], 2),
    ]);
  const c = opts.c ?? ok([row([JOUR], 130)]);
  return vi.fn(async (p: { dimensions: ReadonlyArray<string> }) =>
    p.dimensions.length === 1 ? c : p.dimensions.includes("query") ? b : a,
  );
}

describe("ingererJour", () => {
  it("écrit une ligne par chemin, cumule les variantes d'URL et filtre les données personnelles", async () => {
    const { prisma, base } = creerFauxPrisma({ noms: [{ prenom: "Jean", nom: "Dupont" }] });
    const r = await ingererJour(JOUR, { prisma, recherche: recherche({}) });
    expect(r).toMatchObject({
      issue: "reussi",
      pages: 1,
      requetes: 1,
      pagesIsolees: 1,
      requetesFiltrees: 2,
    });
    const page = base.gscPageJour.lignes[0]!;
    expect(page).toMatchObject({
      chemin: "/fr/blog/x",
      clics: 4,
      impressions: 120,
      typePage: "article",
    });
    // position × impressions : 6×100 + 10×20
    expect(page["positionSum"]).toBe(800);
    // 60 + 10 + 2 impressions retrouvées dans le détail, dont 2 requêtes retirées
    expect(page["impressionsDetaillees"]).toBe(72);
    expect(base.gscRequete.lignes.map((l) => l["texte"])).toEqual(["formation ia"]);
    // jamais le nom ni l'e-mail en base, nulle part
    expect(JSON.stringify([base.gscRequete.lignes, base.gscPageRequeteJour.lignes])).not.toMatch(
      /dupont|exemple/i,
    );
    expect(base.gscImportRun.lignes[0]).toMatchObject({
      statut: "reussi",
      nbLignesPage: 1,
      nbLignesReq: 1,
    });
  });

  it("rejouer un jour en échec donne le même état (jamais un cumul double)", async () => {
    const { prisma, base } = creerFauxPrisma();
    const deps = { prisma, recherche: recherche({}) };
    await ingererJour(JOUR, deps);
    const sansId = () =>
      JSON.stringify(
        [base.gscPageJour.lignes, base.gscPageRequeteJour.lignes, base.gscRequete.lignes].map((t) =>
          t.map(({ id: _id, ...reste }) => reste),
        ),
      );
    const apres1 = sansId();
    // on remet le jour « en échec » : la reprise réécrit les lignes du jour
    base.gscImportRun.lignes[0]!["statut"] = "echec";
    const r = await ingererJour(JOUR, deps);
    expect(r.issue).toBe("reussi");
    expect(sansId()).toBe(apres1);
    expect(base.gscPageJour.lignes).toHaveLength(1);
  });

  it("un jour déjà réussi n'est pas rejoué : aucun appel Google", async () => {
    const { prisma } = creerFauxPrisma();
    const rech = recherche({});
    await ingererJour(JOUR, { prisma, recherche: rech });
    rech.mockClear();
    expect(await ingererJour(JOUR, { prisma, recherche: rech })).toEqual({
      issue: "deja",
      jour: JOUR,
    });
    expect(rech).not.toHaveBeenCalled();
  });

  it("un passage vivant tient le jour ; un passage mort (> 30 min) est repris", async () => {
    const { prisma, base } = creerFauxPrisma();
    const maintenant = new Date("2026-11-21T10:00:00Z");
    await base.gscImportRun.create({
      data: {
        jour: new Date(`${JOUR}T00:00:00Z`),
        typeRecherche: "web",
        statut: "en_cours",
        tentatives: 1,
        debutLe: new Date("2026-11-21T09:50:00Z"),
      },
    });
    const rech = recherche({});
    expect(
      await ingererJour(JOUR, { prisma, recherche: rech, maintenant: () => maintenant }),
    ).toMatchObject({ issue: "occupe" });
    expect(rech).not.toHaveBeenCalled();
    base.gscImportRun.lignes[0]!["debutLe"] = new Date("2026-11-21T09:00:00Z");
    expect(
      await ingererJour(JOUR, { prisma, recherche: rech, maintenant: () => maintenant }),
    ).toMatchObject({ issue: "reussi" });
  });

  it("A incomplet ou en erreur : le jour est en échec et RIEN n'est écrit", async () => {
    const { prisma, base } = creerFauxPrisma();
    const r = await ingererJour(JOUR, {
      prisma,
      recherche: recherche({
        a: { etat: "ok", rows: [row([JOUR, "https://axion-ia.com/fr"], 5)], complet: false },
      }),
    });
    expect(r).toEqual({ issue: "echec", jour: JOUR, code: "incomplet" });
    expect(base.gscPageJour.lignes).toHaveLength(0);
    expect(base.gscImportRun.lignes[0]).toMatchObject({ statut: "echec", erreurCode: "incomplet" });
  });

  it("B en erreur : échec, aucune ligne de page non plus", async () => {
    const { prisma, base } = creerFauxPrisma();
    const r = await ingererJour(JOUR, {
      prisma,
      recherche: recherche({ b: { etat: "erreur", rows: [], complet: false } }),
    });
    expect(r).toMatchObject({ issue: "echec", code: "erreur" });
    expect(base.gscPageJour.lignes).toHaveLength(0);
  });

  it("un quota atteint arrête le jour sans compter de tentative", async () => {
    const { prisma, base } = creerFauxPrisma();
    const r = await ingererJour(JOUR, {
      prisma,
      recherche: recherche({ a: { etat: "quota", rows: [], complet: false } }),
    });
    expect(r).toMatchObject({ issue: "echec", code: "quota" });
    expect(base.gscImportRun.lignes[0]).toMatchObject({ statut: "echec", tentatives: 0 });
  });

  it("C illisible n'invalide pas le jour ; l'écart au total est rendu", async () => {
    const { prisma } = creerFauxPrisma();
    const r = await ingererJour(JOUR, {
      prisma,
      recherche: recherche({ c: { etat: "erreur", rows: [], complet: false } }),
    });
    expect(r).toMatchObject({ issue: "reussi", ecartTotal: null });
    const { prisma: p2 } = creerFauxPrisma();
    expect(await ingererJour(JOUR, { prisma: p2, recherche: recherche({}) })).toMatchObject({
      ecartTotal: 10,
    });
  });

  it("un détail dont la page est absente de A n'est pas stocké", async () => {
    const { prisma, base } = creerFauxPrisma();
    await ingererJour(JOUR, {
      prisma,
      recherche: recherche({
        b: ok([row([JOUR, "https://axion-ia.com/fr/orpheline", "requete"], 9)]),
      }),
    });
    expect(base.gscPageRequeteJour.lignes).toHaveLength(0);
    expect(base.gscRequete.lignes).toHaveLength(0);
  });

  it("une panne de base remonte et laisse le jour en échec (repris plus tard)", async () => {
    const { prisma, base } = creerFauxPrisma();
    base.gscRequete.createMany = async () => {
      throw new Error("panne");
    };
    await expect(ingererJour(JOUR, { prisma, recherche: recherche({}) })).rejects.toThrow("panne");
    expect(base.gscImportRun.lignes[0]).toMatchObject({ statut: "echec", erreurCode: "exception" });
  });

  it("une date mal formée est refusée sans toucher à la base", async () => {
    const { prisma, base } = creerFauxPrisma();
    expect(await ingererJour("hier", { prisma, recherche: recherche({}) })).toMatchObject({
      issue: "echec",
    });
    expect(base.gscImportRun.lignes).toHaveLength(0);
  });
});
