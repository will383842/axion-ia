/**
 * Import d'UN jour Search Console (P4). Trois appels, jamais plus :
 *   A  [date, page]        `byPage`  : totaux exacts par page (requêtes anonymisées comprises) ;
 *   B  [date, page, query]           : détail par requête ;
 *   C  [date]                        : total de la propriété, simple CONTRÔLE (journalisé).
 *
 * IDEMPOTENT : un jour `reussi` n'est jamais rejoué ; un jour en échec est repris tel quel.
 * Les lignes du jour sont REMPLACÉES (suppression puis insertion dans UNE transaction) : rejouer
 * donne le même état, jamais un cumul double. Rien n'est écrit tant que A et B ne sont pas lus
 * en entier (un lot partiel ne laisse aucune ligne à moitié).
 *
 * Données personnelles : le filtre passe AVANT tout stockage ; une requête retirée est seulement
 * comptée dans l'agrégat de la page (`requetesFiltrees`). Aucun texte de requête, aucun nom,
 * dans les journaux ni dans `erreurCode` : des nombres et des codes.
 */
import type { PrismaClient } from "../../../../prisma/generated/client";

import {
  gscSearchAnalytics,
  type GscLotDeps,
  type GscLotResultat,
  type GscSearchAnalyticsParams,
  type GscSearchRow,
} from "@/server/content-gen/seo/gsc-client";
import {
  filtrerDonneesPersonnelles,
  normaliserChemin,
  positionSum,
  typePageDepuisChemin,
} from "../donnees";
import { enDate, REGEX_JOUR } from "./dates";
import { chargerNomsConnus } from "./noms-connus";

export const TYPE_RECHERCHE = "web";
/** Au-delà, un jour en échec n'est plus repris seul : un humain le voit à l'écran de santé. */
export const TENTATIVES_MAX = 5;
/** Un passage `en_cours` plus vieux que ça est considéré comme mort (conteneur arrêté). */
export const DELAI_PASSAGE_MORT_MS = 30 * 60_000;
const LOT_ECRITURE = 1000;
const REQUETE_LONGUEUR_MAX = 512;
const CHEMIN_LONGUEUR_MAX = 1000;

export type BaseIngestion = Pick<
  PrismaClient,
  | "gscImportRun"
  | "gscPageJour"
  | "gscRequete"
  | "gscPageRequeteJour"
  | "siteRoute"
  | "trainer"
  | "jobApplication"
  | "client"
  | "$transaction"
>;

export interface DepsIngestion {
  readonly prisma: BaseIngestion;
  /** Injectable pour les tests ; par défaut le client Search Console par lot (P1). */
  readonly recherche?: (
    params: GscSearchAnalyticsParams,
    deps?: GscLotDeps,
  ) => Promise<GscLotResultat>;
  readonly maintenant?: () => Date;
}

export type IssueJour =
  | {
      readonly issue: "reussi";
      readonly jour: string;
      readonly pages: number;
      readonly requetes: number;
      readonly pagesIsolees: number;
      readonly requetesFiltrees: number;
      /** Impressions du total propriété (C) moins la somme des pages (A) ; `null` si C illisible. */
      readonly ecartTotal: number | null;
    }
  | { readonly issue: "deja"; readonly jour: string }
  | { readonly issue: "occupe"; readonly jour: string }
  | { readonly issue: "echec"; readonly jour: string; readonly code: string };

function ligneValide(l: GscSearchRow | undefined, cles: number): l is GscSearchRow {
  return (
    !!l &&
    Array.isArray(l.keys) &&
    l.keys.length >= cles &&
    l.keys.every((k) => typeof k === "string") &&
    [l.clicks, l.impressions, l.position].every((v) => v === undefined || Number.isFinite(v))
  );
}

function nombre(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

function codeErreurCoherent(r: GscLotResultat): string {
  if (r.etat !== "ok") return r.etat;
  return "incomplet";
}

/** Marque le jour en échec ; un échec de QUOTA ne compte pas comme une tentative. */
async function noterEchec(
  prisma: BaseIngestion,
  idRun: string,
  code: string,
  tentativesAvant: number,
  maintenant: Date,
): Promise<void> {
  await prisma.gscImportRun.update({
    where: { id: idRun },
    data: {
      statut: "echec",
      erreurCode: code.slice(0, 80),
      finLe: maintenant,
      ...(code === "quota" ? { tentatives: tentativesAvant } : {}),
    },
  });
}

/**
 * Réserve le jour : crée la ligne `en_cours`, ou reprend un échec / un passage mort.
 * `null` = déjà fait (`reussi`) ou tenu par un autre passage ; la raison est rendue à part.
 */
async function reserverJour(
  prisma: BaseIngestion,
  jour: string,
  maintenant: Date,
): Promise<{ id: string; tentativesAvant: number } | "deja" | "occupe"> {
  const cle = { jour: enDate(jour), typeRecherche: TYPE_RECHERCHE };
  const existant = await prisma.gscImportRun.findUnique({
    where: { jour_typeRecherche: cle },
  });
  if (existant?.statut === "reussi") return "deja";
  if (!existant) {
    try {
      const cree = await prisma.gscImportRun.create({
        data: { ...cle, statut: "en_cours", tentatives: 1 },
      });
      return { id: cree.id, tentativesAvant: 0 };
    } catch (err) {
      // Doublon d'un passage concurrent (unique jour × type) : l'autre le tient.
      if ((err as { code?: unknown } | null)?.code === "P2002") return "occupe";
      throw err;
    }
  }
  const vivant =
    existant.statut === "en_cours" &&
    maintenant.getTime() - existant.debutLe.getTime() < DELAI_PASSAGE_MORT_MS;
  if (vivant) return "occupe";
  // Prise « compare-and-set » : si un autre passage a changé la ligne entre-temps, rien n'est pris.
  const pris = await prisma.gscImportRun.updateMany({
    where: { id: existant.id, statut: existant.statut, tentatives: existant.tentatives },
    data: {
      statut: "en_cours",
      tentatives: existant.tentatives + 1,
      erreurCode: null,
      debutLe: maintenant,
      finLe: null,
    },
  });
  return pris.count === 1 ? { id: existant.id, tentativesAvant: existant.tentatives } : "occupe";
}

interface PageAgregee {
  clics: number;
  impressions: number;
  positionSum: number;
  impressionsDetaillees: number;
  requetesFiltrees: number;
}

function* lots<T>(liste: ReadonlyArray<T>, taille: number): Generator<T[]> {
  for (let i = 0; i < liste.length; i += taille) yield liste.slice(i, i + taille);
}

export async function ingererJour(jour: string, deps: DepsIngestion): Promise<IssueJour> {
  if (!REGEX_JOUR.test(jour)) return { issue: "echec", jour, code: "jour_invalide" };
  const { prisma } = deps;
  const recherche = deps.recherche ?? gscSearchAnalytics;
  const maintenant = (deps.maintenant ?? (() => new Date()))();

  const prise = await reserverJour(prisma, jour, maintenant);
  if (prise === "deja") return { issue: "deja", jour };
  if (prise === "occupe") return { issue: "occupe", jour };
  const { id: idRun, tentativesAvant } = prise;

  try {
    const base = { startDate: jour, endDate: jour, dataState: "final" as const };
    const a = await recherche({ ...base, dimensions: ["date", "page"], aggregationType: "byPage" });
    if (a.etat !== "ok" || !a.complet) {
      await noterEchec(prisma, idRun, codeErreurCoherent(a), tentativesAvant, maintenant);
      return { issue: "echec", jour, code: codeErreurCoherent(a) };
    }
    const b = await recherche({ ...base, dimensions: ["date", "page", "query"] });
    if (b.etat !== "ok" || !b.complet) {
      await noterEchec(prisma, idRun, codeErreurCoherent(b), tentativesAvant, maintenant);
      return { issue: "echec", jour, code: codeErreurCoherent(b) };
    }
    // C : contrôle seulement. Un échec ici n'invalide pas le jour.
    const c = await recherche({ ...base, dimensions: ["date"] });
    const totalPropriete =
      c.etat === "ok" && c.complet ? c.rows.reduce((s, l) => s + nombre(l?.impressions), 0) : null;

    // ── A : une ligne par chemin (plusieurs URL brutes peuvent se ramener au même chemin) ──
    const pages = new Map<string, PageAgregee>();
    let pagesIsolees = 0;
    for (const l of a.rows) {
      if (!ligneValide(l, 2)) continue;
      const chemin = normaliserChemin(l.keys[1] as string);
      if (!chemin || chemin.length > CHEMIN_LONGUEUR_MAX) {
        pagesIsolees++;
        continue;
      }
      const cur = pages.get(chemin) ?? {
        clics: 0,
        impressions: 0,
        positionSum: 0,
        impressionsDetaillees: 0,
        requetesFiltrees: 0,
      };
      cur.clics += nombre(l.clicks);
      cur.impressions += nombre(l.impressions);
      cur.positionSum += positionSum(nombre(l.position), nombre(l.impressions));
      pages.set(chemin, cur);
    }
    const sommePages = [...pages.values()].reduce((s, p) => s + p.impressions, 0);

    // ── B : filtre de données personnelles AVANT stockage ──
    const noms = await chargerNomsConnus(prisma);
    const brutes: Array<{
      chemin: string;
      requete: string;
      clics: number;
      impressions: number;
      position: number;
    }> = [];
    for (const l of b.rows) {
      if (!ligneValide(l, 3) || l.keys[0] !== jour) continue;
      const chemin = normaliserChemin(l.keys[1] as string);
      // Détail d'une page absente de A (ou isolée) : écarté, pour ne jamais stocker un détail
      // sans sa ligne de page.
      if (!chemin || !pages.has(chemin)) continue;
      brutes.push({
        chemin,
        requete: (l.keys[2] as string).trim(),
        clics: nombre(l.clicks),
        impressions: nombre(l.impressions),
        position: nombre(l.position),
      });
    }
    // Une requête vide ou trop longue pour la colonne ne peut pas être stockée : retirée comme
    // une donnée écartée (comptée, jamais stockée).
    const parPage = new Map<string, typeof brutes>();
    for (const l of brutes) {
      const p = pages.get(l.chemin) as PageAgregee;
      p.impressionsDetaillees += l.impressions;
      if (l.requete.length === 0 || l.requete.length > REQUETE_LONGUEUR_MAX) {
        p.requetesFiltrees += 1;
        continue;
      }
      parPage.set(l.chemin, [...(parPage.get(l.chemin) ?? []), l]);
    }
    const detail = new Map<
      string,
      { chemin: string; requete: string; clics: number; impressions: number; positionSum: number }
    >();
    for (const [chemin, groupe] of parPage) {
      const filtre = filtrerDonneesPersonnelles(groupe, { noms });
      (pages.get(chemin) as PageAgregee).requetesFiltrees += filtre.retirees.lignes;
      for (const l of filtre.conservees) {
        const k = `${l.chemin}\u0000${l.requete}`;
        const cur = detail.get(k) ?? {
          chemin: l.chemin,
          requete: l.requete,
          clics: 0,
          impressions: 0,
          positionSum: 0,
        };
        cur.clics += l.clics;
        cur.impressions += l.impressions;
        cur.positionSum += positionSum(l.position, l.impressions);
        detail.set(k, cur);
      }
    }

    // ── Rattachement à la route et type de page, figés à l'import ──
    const routes = await prisma.siteRoute.findMany({
      where: { visibility: "public", removedAt: null, pathRendered: { not: null } },
      select: { id: true, pathRendered: true, category: true },
    });
    const parChemin = new Map<string, { id: string; category: string | null }>();
    for (const r of routes) {
      const ch = r.pathRendered ? normaliserChemin(r.pathRendered) : null;
      if (ch && !parChemin.has(ch)) parChemin.set(ch, { id: r.id, category: r.category });
    }

    // ── Dictionnaire des requêtes (idempotent : doublons ignorés, bornes de dates recalées) ──
    const date = enDate(jour);
    const textes = [...new Set([...detail.values()].map((d) => d.requete))];
    const idParTexte = new Map<string, number>();
    for (const lot of lots(textes, LOT_ECRITURE)) {
      await prisma.gscRequete.createMany({
        data: lot.map((texte) => ({ texte, premiereLe: date, derniereLe: date })),
        skipDuplicates: true,
      });
      await prisma.gscRequete.updateMany({
        where: { texte: { in: lot }, derniereLe: { lt: date } },
        data: { derniereLe: date },
      });
      await prisma.gscRequete.updateMany({
        where: { texte: { in: lot }, premiereLe: { gt: date } },
        data: { premiereLe: date },
      });
      const ids = await prisma.gscRequete.findMany({
        where: { texte: { in: lot } },
        select: { id: true, texte: true },
      });
      for (const r of ids) idParTexte.set(r.texte, r.id);
    }

    const lignesPages = [...pages.entries()].map(([chemin, p]) => {
      const route = parChemin.get(chemin);
      return {
        date,
        typeRecherche: TYPE_RECHERCHE,
        chemin,
        clics: Math.round(p.clics),
        impressions: Math.round(p.impressions),
        positionSum: p.positionSum,
        impressionsDetaillees: Math.round(p.impressionsDetaillees),
        requetesFiltrees: p.requetesFiltrees,
        siteRouteId: route?.id ?? null,
        categorie: route?.category ? route.category.slice(0, 40) : null,
        typePage: typePageDepuisChemin(chemin),
      };
    });
    const lignesDetail = [...detail.values()].flatMap((d) => {
      const requeteId = idParTexte.get(d.requete);
      return requeteId === undefined
        ? []
        : [
            {
              date,
              typeRecherche: TYPE_RECHERCHE,
              chemin: d.chemin,
              requeteId,
              clics: Math.round(d.clics),
              impressions: Math.round(d.impressions),
              positionSum: d.positionSum,
            },
          ];
    });

    // ── Écriture : le jour est REMPLACÉ, en une transaction ──
    await prisma.$transaction(
      async (tx) => {
        await tx.gscPageJour.deleteMany({ where: { date, typeRecherche: TYPE_RECHERCHE } });
        await tx.gscPageRequeteJour.deleteMany({ where: { date, typeRecherche: TYPE_RECHERCHE } });
        for (const lot of lots(lignesPages, LOT_ECRITURE)) {
          await tx.gscPageJour.createMany({ data: lot });
        }
        for (const lot of lots(lignesDetail, LOT_ECRITURE)) {
          await tx.gscPageRequeteJour.createMany({ data: lot });
        }
      },
      { timeout: 120_000, maxWait: 30_000 },
    );

    await prisma.gscImportRun.update({
      where: { id: idRun },
      data: {
        statut: "reussi",
        nbLignesPage: lignesPages.length,
        nbLignesReq: lignesDetail.length,
        erreurCode: null,
        finLe: maintenant,
      },
    });
    const requetesFiltrees = lignesPages.reduce((s, p) => s + p.requetesFiltrees, 0);
    return {
      issue: "reussi",
      jour,
      pages: lignesPages.length,
      requetes: lignesDetail.length,
      pagesIsolees,
      requetesFiltrees,
      ecartTotal: totalPropriete === null ? null : Math.round(totalPropriete - sommePages),
    };
  } catch (err) {
    // Panne de base ou bug : le jour repasse en échec (repris plus tard), l'erreur remonte pour
    // que la tâche échoue et soit vue. Le noter ne doit pas masquer l'erreur d'origine.
    await noterEchec(prisma, idRun, "exception", tentativesAvant, maintenant).catch(
      () => undefined,
    );
    throw err;
  }
}
