/**
 * Purge du robot (P4), par LOTS, le dimanche. Trois étapes, chacune bornée en nombre de lots :
 *
 *  1. Détail journalier de plus de 90 jours : on CUMULE d'abord par semaine ISO
 *     (`GscPageRequeteSemaine`), puis on supprime les jours de cette semaine, dans UNE
 *     transaction. Une semaine n'est cumulée que si tous ses jours sont importés (sinon le
 *     cumul serait faux) ; passé un délai de grâce de 30 jours elle l'est quand même.
 *  2. Cumuls hebdomadaires de plus de 25 mois.
 *  3. Texte des requêtes à moins de 3 impressions cumulées (jours + semaines) : le texte et
 *     ses lignes de détail sont supprimés, seul l'agrégat de la page (`GscPageJour`) reste.
 *
 * Tables TECHNIQUES du pilotage uniquement : aucune donnée de personne n'est effacée ici.
 */
import type { PrismaClient } from "../../../../prisma/generated/client";

import { cumulerParSemaineIso, requetesARetirerDuTexte, semaineIso } from "../donnees";
import { ajouterJours, enDate, enJour, MOIS_HISTORIQUE, reculerMois } from "./dates";
import { TYPE_RECHERCHE } from "./jour";

export const CONSERVATION_DETAIL_JOURS = 90;
export const CONSERVATION_SEMAINES_MOIS = 25;
export const GRACE_SEMAINE_JOURS = 30;
export const SEUIL_TEXTE_REQUETE = 3;
const LOT_SUPPRESSION = 1000;
const SEMAINES_MAX_PAR_PASSAGE = 60;
const LOTS_MAX_PAR_ETAPE = 200;

export type BasePurge = Pick<
  PrismaClient,
  "gscImportRun" | "gscPageRequeteJour" | "gscPageRequeteSemaine" | "gscRequete" | "$transaction"
>;

export interface DepsPurge {
  readonly prisma: BasePurge;
  readonly maintenant?: () => Date;
}

export interface BilanPurge {
  readonly semainesCumulees: number;
  readonly semainesEnAttente: number;
  readonly joursSupprimes: number;
  readonly semainesSupprimees: number;
  readonly requetesRetirees: number;
}

function cleTriplet(type: string, chemin: string, requeteId: number): string {
  return `${type}\u0000${chemin}\u0000${requeteId}`;
}

/** Étape 1. Rend [cumulées, en attente, jours supprimés]. */
async function consoliderEtPurgerJours(
  prisma: BasePurge,
  aujourdhui: string,
): Promise<[number, number, number]> {
  const coupure = ajouterJours(aujourdhui, -CONSERVATION_DETAIL_JOURS);
  const jours = await prisma.gscPageRequeteJour.groupBy({
    by: ["date"],
    where: { date: { lt: enDate(coupure) } },
    orderBy: { date: "asc" },
  });
  const semaines = new Map<string, string>(); // lundi → clé ISO
  for (const j of jours) {
    const s = semaineIso(enJour(j.date));
    semaines.set(s.debut, s.cle);
  }
  const borneHistorique = reculerMois(aujourdhui, MOIS_HISTORIQUE);
  let cumulees = 0;
  let enAttente = 0;
  let supprimes = 0;
  let traitees = 0;
  for (const debut of [...semaines.keys()].sort()) {
    if (traitees >= SEMAINES_MAX_PAR_PASSAGE) break;
    const fin = ajouterJours(debut, 6);
    // Seules les semaines ENTIÈREMENT hors du délai de conservation sont touchées.
    if (fin >= coupure) continue;
    const delaiDeGraceEchu = fin < ajouterJours(coupure, -GRACE_SEMAINE_JOURS);
    if (!delaiDeGraceEchu) {
      const reussis = await prisma.gscImportRun.findMany({
        where: {
          typeRecherche: TYPE_RECHERCHE,
          statut: "reussi",
          jour: { gte: enDate(debut), lte: enDate(fin) },
        },
        select: { jour: true },
      });
      const faits = new Set(reussis.map((r) => enJour(r.jour)));
      let complet = true;
      for (let j = debut; j <= fin; j = ajouterJours(j, 1)) {
        // Les jours antérieurs à la borne de 16 mois ne seront jamais importés.
        if (j >= borneHistorique && !faits.has(j)) complet = false;
      }
      if (!complet) {
        enAttente++;
        continue;
      }
    }
    traitees++;
    const lignes = await prisma.gscPageRequeteJour.findMany({
      where: { date: { gte: enDate(debut), lte: enDate(fin) } },
      select: {
        date: true,
        typeRecherche: true,
        chemin: true,
        requeteId: true,
        clics: true,
        impressions: true,
        positionSum: true,
      },
    });
    const cumul = cumulerParSemaineIso(
      lignes.map((l) => ({
        date: enJour(l.date),
        cle: cleTriplet(l.typeRecherche, l.chemin, l.requeteId),
        clics: l.clics,
        impressions: l.impressions,
        positionSum: l.positionSum,
      })),
    );
    const semaine = enDate(debut);
    const aInserer = cumul.map((c) => {
      const [type, chemin, id] = c.cle.split("\u0000") as [string, string, string];
      return {
        semaine,
        typeRecherche: type,
        chemin,
        requeteId: Number(id),
        clics: c.clics,
        impressions: c.impressions,
        positionSum: c.positionSum,
      };
    });
    // Tout ou rien : le cumul remplace celui de la semaine, puis les jours partent. Rejouer ne
    // double rien (le cumul est recalculé, jamais additionné).
    await prisma.$transaction(
      async (tx) => {
        await tx.gscPageRequeteSemaine.deleteMany({ where: { semaine } });
        for (let i = 0; i < aInserer.length; i += LOT_SUPPRESSION) {
          await tx.gscPageRequeteSemaine.createMany({
            data: aInserer.slice(i, i + LOT_SUPPRESSION),
          });
        }
        const r = await tx.gscPageRequeteJour.deleteMany({
          where: { date: { gte: enDate(debut), lte: enDate(fin) } },
        });
        supprimes += r.count;
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
    cumulees++;
  }
  return [cumulees, enAttente, supprimes];
}

/** Étape 2 : par lots d'identifiants, jamais un `deleteMany` sans borne de taille. */
async function purgerSemainesAnciennes(prisma: BasePurge, aujourdhui: string): Promise<number> {
  const limite = enDate(reculerMois(aujourdhui, CONSERVATION_SEMAINES_MOIS));
  let total = 0;
  for (let n = 0; n < LOTS_MAX_PAR_ETAPE; n++) {
    const ids = await prisma.gscPageRequeteSemaine.findMany({
      where: { semaine: { lt: limite } },
      select: { id: true },
      take: LOT_SUPPRESSION,
    });
    if (ids.length === 0) break;
    const r = await prisma.gscPageRequeteSemaine.deleteMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    total += r.count;
  }
  return total;
}

/** Étape 3 : texte des requêtes sous le seuil, avec ses lignes de détail. */
async function purgerTexteRequetes(prisma: BasePurge): Promise<number> {
  const sommes = new Map<number, number>();
  const jours = await prisma.gscPageRequeteJour.groupBy({
    by: ["requeteId"],
    _sum: { impressions: true },
  });
  for (const j of jours) sommes.set(j.requeteId, j._sum.impressions ?? 0);
  const semaines = await prisma.gscPageRequeteSemaine.groupBy({
    by: ["requeteId"],
    _sum: { impressions: true },
  });
  for (const s of semaines) {
    sommes.set(s.requeteId, (sommes.get(s.requeteId) ?? 0) + (s._sum.impressions ?? 0));
  }

  const lignes: Array<{ requete: string; impressions: number }> = [];
  const idsParTexte = new Map<string, number[]>();
  let curseur = 0;
  for (;;) {
    const lot = await prisma.gscRequete.findMany({
      where: { id: { gt: curseur } },
      select: { id: true, texte: true },
      orderBy: { id: "asc" },
      take: 5000,
    });
    if (lot.length === 0) break;
    for (const r of lot) {
      lignes.push({ requete: r.texte, impressions: sommes.get(r.id) ?? 0 });
      idsParTexte.set(r.texte, [...(idsParTexte.get(r.texte) ?? []), r.id]);
    }
    curseur = lot[lot.length - 1]!.id;
  }
  const aRetirer = requetesARetirerDuTexte(lignes, SEUIL_TEXTE_REQUETE);
  const ids = aRetirer.flatMap((t) => idsParTexte.get(t) ?? []);
  let retirees = 0;
  for (
    let i = 0;
    i < ids.length && i / LOT_SUPPRESSION < LOTS_MAX_PAR_ETAPE;
    i += LOT_SUPPRESSION
  ) {
    const lot = ids.slice(i, i + LOT_SUPPRESSION);
    // Le détail d'abord (pas de clé étrangère, donc pas de cascade), le texte ensuite.
    await prisma.gscPageRequeteJour.deleteMany({ where: { requeteId: { in: lot } } });
    await prisma.gscPageRequeteSemaine.deleteMany({ where: { requeteId: { in: lot } } });
    const r = await prisma.gscRequete.deleteMany({ where: { id: { in: lot } } });
    retirees += r.count;
  }
  return retirees;
}

export async function tachePurge(deps: DepsPurge): Promise<BilanPurge> {
  const aujourdhui = enJour((deps.maintenant ?? (() => new Date()))());
  const [semainesCumulees, semainesEnAttente, joursSupprimes] = await consoliderEtPurgerJours(
    deps.prisma,
    aujourdhui,
  );
  const semainesSupprimees = await purgerSemainesAnciennes(deps.prisma, aujourdhui);
  const requetesRetirees = await purgerTexteRequetes(deps.prisma);
  return {
    semainesCumulees,
    semainesEnAttente,
    joursSupprimes,
    semainesSupprimees,
    requetesRetirees,
  };
}
