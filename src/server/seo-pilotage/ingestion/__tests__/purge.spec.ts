import { describe, expect, it } from "vitest";

import { tachePurge } from "../purge";
import { creerFauxPrisma } from "./faux-prisma";

const date = (j: string) => new Date(`${j}T00:00:00Z`);
// « aujourd'hui » = 2026-11-29 (dimanche) → coupure à 90 jours = 2026-08-31
const maintenant = () => new Date("2026-11-29T03:17:00Z");

function semaineComplete(
  base: ReturnType<typeof creerFauxPrisma>["base"],
  lundi: string,
  reussie = true,
) {
  for (let i = 0; i < 7; i++) {
    const d = new Date(date(lundi).getTime() + i * 86_400_000);
    if (reussie)
      base.gscImportRun.lignes.push({
        id: `r${lundi}${i}`,
        jour: d,
        typeRecherche: "web",
        statut: "reussi",
        tentatives: 1,
        debutLe: d,
      });
  }
}
const detail = (j: string, requeteId: number, impressions: number, position = 4) => ({
  date: date(j),
  typeRecherche: "web",
  chemin: "/fr/blog/x",
  requeteId,
  clics: 1,
  impressions,
  positionSum: position * impressions,
});

describe("tachePurge", () => {
  it("cumule la semaine ISO puis supprime ses jours ; rejouer ne double rien", async () => {
    const { prisma, base } = creerFauxPrisma();
    semaineComplete(base, "2026-08-03"); // lundi 3 août, fin 9 août : bien avant la coupure
    base.gscRequete.lignes.push({
      id: 1,
      texte: "formation ia",
      premiereLe: date("2026-08-03"),
      derniereLe: date("2026-08-09"),
    });
    base.gscPageRequeteJour.lignes.push(detail("2026-08-03", 1, 10), detail("2026-08-05", 1, 20));
    const b = await tachePurge({ prisma, maintenant });
    expect(b).toMatchObject({ semainesCumulees: 1, joursSupprimes: 2 });
    expect(base.gscPageRequeteJour.lignes).toHaveLength(0);
    expect(base.gscPageRequeteSemaine.lignes).toHaveLength(1);
    expect(base.gscPageRequeteSemaine.lignes[0]).toMatchObject({
      impressions: 30,
      clics: 2,
      positionSum: 120,
    });
    expect(base.gscPageRequeteSemaine.lignes[0]!["semaine"]).toEqual(date("2026-08-03"));
    // 30 impressions : le texte est conservé
    expect(base.gscRequete.lignes).toHaveLength(1);
    // rejouer : plus de jours, le cumul reste intact
    await tachePurge({ prisma, maintenant });
    expect(base.gscPageRequeteSemaine.lignes).toHaveLength(1);
    expect(base.gscPageRequeteSemaine.lignes[0]!["impressions"]).toBe(30);
  });

  it("garde une semaine dont un jour n'est pas importé (cumul faux sinon)", async () => {
    const { prisma, base } = creerFauxPrisma();
    semaineComplete(base, "2026-08-10");
    base.gscImportRun.lignes.pop(); // un jour manque
    base.gscRequete.lignes.push({
      id: 1,
      texte: "q",
      premiereLe: date("2026-08-10"),
      derniereLe: date("2026-08-10"),
    });
    base.gscPageRequeteJour.lignes.push(detail("2026-08-10", 1, 50));
    const b = await tachePurge({ prisma, maintenant });
    expect(b).toMatchObject({ semainesCumulees: 0, semainesEnAttente: 1, joursSupprimes: 0 });
    expect(base.gscPageRequeteJour.lignes).toHaveLength(1);
  });

  it("ne touche jamais aux jours de moins de 90 jours", async () => {
    const { prisma, base } = creerFauxPrisma();
    base.gscRequete.lignes.push({
      id: 1,
      texte: "q",
      premiereLe: date("2026-11-20"),
      derniereLe: date("2026-11-20"),
    });
    base.gscPageRequeteJour.lignes.push(detail("2026-11-20", 1, 50));
    await tachePurge({ prisma, maintenant });
    expect(base.gscPageRequeteJour.lignes).toHaveLength(1);
    expect(base.gscPageRequeteSemaine.lignes).toHaveLength(0);
  });

  it("supprime les cumuls hebdomadaires de plus de 25 mois seulement", async () => {
    const { prisma, base } = creerFauxPrisma();
    base.gscRequete.lignes.push({
      id: 1,
      texte: "q",
      premiereLe: date("2024-01-01"),
      derniereLe: date("2026-01-01"),
    });
    let n = 0;
    const s = (j: string) => ({
      id: ++n,
      semaine: date(j),
      typeRecherche: "web",
      chemin: "/fr",
      requeteId: 1,
      clics: 0,
      impressions: 50,
      positionSum: 0,
    });
    base.gscPageRequeteSemaine.lignes.push(s("2024-09-30"), s("2025-06-02")); // 2026-11-29 − 25 mois = 2024-10-29
    const b = await tachePurge({ prisma, maintenant });
    expect(b.semainesSupprimees).toBe(1);
    expect(base.gscPageRequeteSemaine.lignes).toHaveLength(1);
  });

  it("retire le texte des requêtes sous 3 impressions, avec leur détail ; garde l'agrégat de page", async () => {
    const { prisma, base } = creerFauxPrisma();
    base.gscRequete.lignes.push(
      { id: 1, texte: "rare", premiereLe: date("2026-05-01"), derniereLe: date("2026-11-20") },
      { id: 2, texte: "courante", premiereLe: date("2026-05-01"), derniereLe: date("2026-11-21") },
    );
    base.gscPageRequeteJour.lignes.push(detail("2026-11-20", 1, 2), detail("2026-11-20", 2, 40));
    base.gscPageJour.lignes.push({
      date: date("2026-11-20"),
      typeRecherche: "web",
      chemin: "/fr/blog/x",
      impressions: 42,
    });
    const b = await tachePurge({ prisma, maintenant });
    expect(b.requetesRetirees).toBe(1);
    expect(base.gscRequete.lignes.map((l) => l["texte"])).toEqual(["courante"]);
    expect(base.gscPageRequeteJour.lignes.map((l) => l["requeteId"])).toEqual([2]);
    expect(base.gscPageJour.lignes).toHaveLength(1);
  });

  it("compte les cumuls hebdomadaires : une requête ancienne mais forte n'est pas purgée", async () => {
    const { prisma, base } = creerFauxPrisma();
    base.gscRequete.lignes.push({
      id: 1,
      texte: "ancienne",
      premiereLe: date("2025-10-01"),
      derniereLe: date("2025-12-01"),
    });
    base.gscPageRequeteSemaine.lignes.push({
      semaine: date("2025-10-06"),
      typeRecherche: "web",
      chemin: "/fr",
      requeteId: 1,
      clics: 2,
      impressions: 80,
      positionSum: 0,
    });
    await tachePurge({ prisma, maintenant });
    expect(base.gscRequete.lignes).toHaveLength(1);
  });
});

describe("tachePurge : import tardif d'un jour d'une semaine déjà purgée", () => {
  it("conserve la somme de la semaine (cumul additionné, jamais écrasé)", async () => {
    const { prisma, base } = creerFauxPrisma();
    semaineComplete(base, "2026-08-03");
    base.gscRequete.lignes.push({
      id: 1,
      texte: "q",
      premiereLe: date("2026-08-03"),
      derniereLe: date("2026-08-09"),
    });
    base.gscPageRequeteJour.lignes.push(detail("2026-08-03", 1, 10));
    await tachePurge({ prisma, maintenant });
    // un jour de la même semaine réapparaît (reprise tardive), puis nouvelle purge
    base.gscPageRequeteJour.lignes.push({ id: 99, ...detail("2026-08-06", 1, 5) });
    await tachePurge({ prisma, maintenant });
    expect(base.gscPageRequeteSemaine.lignes).toHaveLength(1);
    expect(base.gscPageRequeteSemaine.lignes[0]!["impressions"]).toBe(15);
  });

  it("un jour jamais tenté met la semaine en attente ; un jour abandonné la débloque", async () => {
    const { prisma, base } = creerFauxPrisma();
    semaineComplete(base, "2026-08-10");
    const manquant = base.gscImportRun.lignes.pop()!;
    base.gscRequete.lignes.push({
      id: 1,
      texte: "q",
      premiereLe: date("2026-08-10"),
      derniereLe: date("2026-08-10"),
    });
    base.gscPageRequeteJour.lignes.push(detail("2026-08-10", 1, 50));
    expect(await tachePurge({ prisma, maintenant })).toMatchObject({
      semainesEnAttente: 1,
      semainesCumulees: 0,
    });
    base.gscImportRun.lignes.push({ ...manquant, statut: "echec", tentatives: 5 });
    expect(await tachePurge({ prisma, maintenant })).toMatchObject({ semainesCumulees: 1 });
  });
});

describe("tachePurge : requêtes récentes", () => {
  it("ne retire jamais le texte d'une requête de moins de 90 jours", async () => {
    const { prisma, base } = creerFauxPrisma();
    base.gscRequete.lignes.push({
      id: 1,
      texte: "neuve",
      premiereLe: date("2026-11-25"),
      derniereLe: date("2026-11-25"),
    });
    base.gscPageRequeteJour.lignes.push(detail("2026-11-25", 1, 1));
    expect((await tachePurge({ prisma, maintenant })).requetesRetirees).toBe(0);
    expect(base.gscRequete.lignes).toHaveLength(1);
  });
});
