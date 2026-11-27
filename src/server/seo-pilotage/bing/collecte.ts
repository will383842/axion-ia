/**
 * Tâche `ingestion-bing` du robot (P17) : une collecte par jour des statistiques Bing Webmaster.
 *
 * - Trois lectures au plus par passage (pages, requêtes, exploration), jamais de nouvelle
 *   tentative : un 429 (quota) arrête tout le passage, l'état vit en base et le jour suivant
 *   repart. Les écritures sont des `upsert` : un passage rejoué ne double rien.
 * - Agrégats HEBDOMADAIRES (lundi) pour les pages et requêtes : les semaines recalculées sont
 *   complètes ou la semaine en cours ; la première semaine de la fenêtre, probablement tronquée,
 *   est écartée plutôt que sous-comptée.
 * - Requêtes : filtre de données personnelles AVANT stockage ; une requête retirée n'est que
 *   comptée. Des NOMBRES seulement dans les retours (jamais une requête, jamais une URL ni la clé).
 */
import type { PrismaClient } from "../../../../prisma/generated/client";
import { normaliserChemin } from "../donnees/chemins";
import { filtrerDonneesPersonnelles } from "../donnees/personnel";
import { ajouterJours, enDate, enJour } from "../ingestion/dates";
import { chargerNomsConnus } from "../ingestion/noms-connus";
import {
  bingPilotageActif,
  lireExplorationBing,
  lirePagesBing,
  lireRequetesBing,
  type DepsBing,
  type LigneStatBing,
} from "./client";

/** On ne réécrit que les 12 dernières semaines : le reste de la fenêtre Bing est de l'archive. */
const SEMAINES_RECALCULEES = 12;
const REQUETE_LONGUEUR_MAX = 512;
const CHEMIN_LONGUEUR_MAX = 1000;

export interface DepsCollecteBing extends DepsBing {
  readonly prisma: Pick<
    PrismaClient,
    "bingPageSemaine" | "bingRequeteSemaine" | "bingExplorationJour"
  >;
  readonly maintenant?: () => Date;
}

export type IssueBing =
  | { readonly issue: "saute"; readonly motif: string }
  | {
      readonly issue: "fait";
      readonly pages: number;
      readonly requetes: number;
      readonly jours: number;
      /** Requêtes retirées par le filtre de données personnelles. */
      readonly filtrees: number;
      /** Pages d'un autre hôte, comptées et jamais stockées. */
      readonly isolees: number;
      readonly erreurs: ReadonlyArray<string>;
    };

export interface LigneSemaine {
  readonly semaine: string;
  readonly cle: string;
  readonly clics: number;
  readonly impressions: number;
  readonly positionSum: number;
}

/** Lundi (UTC) de la semaine d'un jour `AAAA-MM-JJ`. */
export function lundiDe(jour: string): string {
  const decalage = (enDate(jour).getUTCDay() + 6) % 7;
  return ajouterJours(jour, -decalage);
}

export function agregerSemaines(
  lignes: ReadonlyArray<LigneStatBing>,
  aujourdhui: string,
): LigneSemaine[] {
  if (lignes.length === 0) return [];
  const plusAncien = lignes.reduce((m, l) => (l.jour < m ? l.jour : m), lignes[0]!.jour);
  const debut = ajouterJours(lundiDe(aujourdhui), -7 * (SEMAINES_RECALCULEES - 1));
  const groupes = new Map<string, LigneSemaine>();
  for (const l of lignes) {
    const semaine = lundiDe(l.jour);
    // Semaine entamée avant le premier jour renvoyé : probablement tronquée, écartée.
    if (semaine < plusAncien || semaine < debut) continue;
    const k = `${semaine}\u0000${l.cle}`;
    const cur = groupes.get(k) ?? { semaine, cle: l.cle, clics: 0, impressions: 0, positionSum: 0 };
    groupes.set(k, {
      ...cur,
      clics: cur.clics + l.clics,
      impressions: cur.impressions + l.impressions,
      positionSum: cur.positionSum + l.position * l.impressions,
    });
  }
  return [...groupes.values()].sort((a, b) =>
    a.semaine === b.semaine ? a.cle.localeCompare(b.cle) : a.semaine.localeCompare(b.semaine),
  );
}

export async function tacheIngestionBing(deps: DepsCollecteBing): Promise<IssueBing> {
  const env = deps.env ?? process.env;
  if (!bingPilotageActif(env)) return { issue: "saute", motif: "cle_absente" };
  const { prisma } = deps;
  const client: DepsBing = { env, ...(deps.fetch ? { fetch: deps.fetch } : {}) };
  const aujourdhui = enJour((deps.maintenant ?? (() => new Date()))());
  const erreurs: string[] = [];

  // ── Pages ──
  const lecturePages = await lirePagesBing(client);
  if (lecturePages.etat === "quota") return { issue: "saute", motif: "quota" };
  let pages = 0;
  let isolees = 0;
  if (lecturePages.etat === "ok") {
    const surChemin: LigneStatBing[] = [];
    for (const l of lecturePages.lignes) {
      const chemin = normaliserChemin(l.cle);
      if (!chemin || chemin.length > CHEMIN_LONGUEUR_MAX) {
        isolees += 1;
        continue;
      }
      surChemin.push({ ...l, cle: chemin });
    }
    for (const l of agregerSemaines(surChemin, aujourdhui)) {
      const donnees = { clics: l.clics, impressions: l.impressions, positionSum: l.positionSum };
      await prisma.bingPageSemaine.upsert({
        where: { semaine_chemin: { semaine: enDate(l.semaine), chemin: l.cle } },
        create: { semaine: enDate(l.semaine), chemin: l.cle, ...donnees },
        update: { ...donnees, misAJourLe: new Date() },
      });
      pages += 1;
    }
  } else {
    erreurs.push(`pages:${lecturePages.etat}`);
  }

  // ── Requêtes ──
  const lectureRequetes = await lireRequetesBing(client);
  if (lectureRequetes.etat === "quota") {
    return pages > 0 || erreurs.length > 0
      ? {
          issue: "fait",
          pages,
          requetes: 0,
          jours: 0,
          filtrees: 0,
          isolees,
          erreurs: [...erreurs, "requetes:quota"],
        }
      : { issue: "saute", motif: "quota" };
  }
  let requetes = 0;
  let filtrees = 0;
  if (lectureRequetes.etat === "ok") {
    const valides = lectureRequetes.lignes.filter((l) => l.cle.length <= REQUETE_LONGUEUR_MAX);
    filtrees += lectureRequetes.lignes.length - valides.length;
    const noms = await chargerNomsConnus(
      prisma as unknown as Parameters<typeof chargerNomsConnus>[0],
    );
    const filtre = filtrerDonneesPersonnelles(
      valides.map((l) => ({ ...l, requete: l.cle })),
      { noms },
    );
    filtrees += filtre.retirees.lignes;
    for (const l of agregerSemaines(filtre.conservees, aujourdhui)) {
      const donnees = { clics: l.clics, impressions: l.impressions, positionSum: l.positionSum };
      await prisma.bingRequeteSemaine.upsert({
        where: { semaine_texte: { semaine: enDate(l.semaine), texte: l.cle } },
        create: { semaine: enDate(l.semaine), texte: l.cle, ...donnees },
        update: { ...donnees, misAJourLe: new Date() },
      });
      requetes += 1;
    }
  } else {
    erreurs.push(`requetes:${lectureRequetes.etat}`);
  }

  // ── Exploration et erreurs d'exploration ──
  const lectureExploration = await lireExplorationBing(client);
  let jours = 0;
  if (lectureExploration.etat === "ok") {
    for (const l of lectureExploration.lignes) {
      const donnees = {
        pagesExplorees: l.pagesExplorees,
        erreursExploration: l.erreurs,
        pagesIndexees: l.pagesIndexees,
        codes4xx: l.codes4xx,
        codes5xx: l.codes5xx,
      };
      await prisma.bingExplorationJour.upsert({
        where: { date: enDate(l.jour) },
        create: { date: enDate(l.jour), ...donnees },
        update: { ...donnees, misAJourLe: new Date() },
      });
      jours += 1;
    }
  } else if (lectureExploration.etat !== "quota") {
    erreurs.push(`exploration:${lectureExploration.etat}`);
  } else {
    erreurs.push("exploration:quota");
  }

  return { issue: "fait", pages, requetes, jours, filtrees, isolees, erreurs };
}
