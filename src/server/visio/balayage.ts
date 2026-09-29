/**
 * Le BALAYAGE du dossier client — le filet de sécurité, toutes les 5 minutes
 * (chantier visio, PR 4 ; plan V-07, périmètre exact de la vérification C04).
 *
 * Ce qu'il fait dans CETTE PR, et rien d'autre :
 *   1. le battement (`battement.ts`) — et, au premier passage, la BORNE ;
 *   2. les rencontres des rendez-vous Calendly de la liste blanche POSTÉRIEURS
 *      à la borne : créées ou resynchronisées (`assurerRencontrePourCalendly`),
 *      jamais rangées (A4) ;
 *   3. « F1 » — rendez-vous tenu sans compte rendu : calculé sur `CompteRendu`
 *      SEUL (aucune table d'enregistrement n'est encore écrite). Une note
 *      manuelle l'éteint. Rappel de CONSOLE, pas Telegram (`F1_SUR_TELEGRAM`) ;
 *   4. les comptes rendus à valider depuis 3 jours ;
 *   5. les suites échues ;
 *   6. la veille du rendez-vous suivant (demain, heure de Paris) ;
 *   7. la couverture du mois (visios client : enregistrées / notes / rien).
 * La clé de chiffrement, les appareils, les enregistrements, les étapes du
 * circuit arrivent avec leur PR (5 et 6), chacun avec son test.
 *
 * ## Une étape bloquée n'arrête pas les autres
 *
 * Chaque étape a son `try` : une erreur est comptée, signalée une fois sur
 * Telegram (panne technique : `balayage-etape:<nom>`), et le passage continue.
 * Le battement est écrit EN PREMIER : un balayage qui tourne mais dont une
 * étape échoue n'est pas un balayage arrêté. Garde :
 * `le-balayage-tourne-meme-si-une-etape-est-bloquee.spec.ts`.
 *
 * ## L'historique n'est jamais remonté
 *
 * Aucune rencontre n'est créée pour un rendez-vous antérieur à la borne, et
 * F1 ignore `repriseHistorique` : les ~40 « Discutons » d'avant la mise en
 * service ne deviennent ni 40 lignes « à classer » ni 40 alertes. Ils passent
 * par `scripts/visio/reprendre-historique-calendly.ts`.
 *
 * ## Les dates se jugent à l'heure de Paris
 *
 * « Demain », « échue », « ce mois-ci » sont des jours de Paris
 * (`dayKeyInParis`), jamais des jours UTC : le 25/10/2026, l'heure change, et
 * un calcul en UTC déplacerait d'un jour ce qui tombe entre minuit et 2 h.
 *
 * Module neutre : le worker l'appelle, avec `prisma` et `notify`.
 */

import type { Tx, BaseTransactionnelle } from "@/features/dossier-client/base";
import { HORS_RENCONTRES_DE_TEST } from "@/features/dossier-client/client-test";
import { assurerRencontrePourCalendly } from "@/features/dossier-client/rencontre-calendly";
import { dayKeyInParis } from "@/lib/calendar-grid";
import { canalDesRappels, leverAlerte, signalerAlerte, type Notifier } from "./alertes";
import {
  BATTEMENT_BALAYAGE,
  ecrireBattement,
  jugerBattement,
  lireBorneDuBalayage,
  type EtatBattement,
} from "./battement";
import { estRendezVousDuDossier } from "./liste-blanche-types";

/** Délai après la fin prévue au-delà duquel un rendez-vous tenu attend son compte rendu. */
export const DELAI_F1_MIN = 120;

/** Un compte rendu à valider depuis plus longtemps est rappelé. */
export const JOURS_COMPTE_RENDU_A_VALIDER = 3;

/** Jusqu'où, dans l'avenir, les rendez-vous Calendly sont assurés. */
export const FENETRE_AVENIR_JOURS = 60;

const DUREE_PAR_DEFAUT_MIN = 60;
const JOUR_MS = 24 * 60 * 60 * 1000;

export type BaseBalayage = Tx & BaseTransactionnelle;

// ── F1 : la règle, pure ──────────────────────────────────────────────────────

export interface RencontrePourF1 {
  readonly id: string;
  readonly type: "visio" | "telephone" | "presentiel" | "inconnu";
  readonly debutPrevu: Date | null;
  readonly finPrevue: Date | null;
  readonly statut: "planifie" | "tenu" | "annule" | "absent" | "reporte" | null;
  readonly repriseHistorique: boolean;
  readonly estTestInterne: boolean;
  /** Issue du suivi, s'il est fait. */
  readonly issue: "eu_lieu" | "absent" | "reporte" | null;
  /** Le rendez-vous Calendly a été annulé. */
  readonly annuleCalendly: boolean;
  /** Un compte rendu (brouillon, à valider ou validé) existe. */
  readonly aUnCompteRendu: boolean;
}

export type AttenduF1 = "note" | "compte_rendu_ou_note";

/**
 * Ce rendez-vous attend-il son compte rendu ? `null` sinon ; sinon ce qu'il
 * attend : un appel TÉLÉPHONIQUE n'est jamais enregistré, il attend une note.
 */
export function attenduF1(r: RencontrePourF1, borne: Date, maintenant: Date): AttenduF1 | null {
  if (r.repriseHistorique || r.estTestInterne) return null;
  if (r.type !== "visio" && r.type !== "telephone") return null;
  if (r.debutPrevu === null || r.debutPrevu.getTime() < borne.getTime()) return null;
  if (r.annuleCalendly) return null;
  if (r.statut === "annule" || r.statut === "absent" || r.statut === "reporte") return null;
  if (r.issue === "absent" || r.issue === "reporte") return null;
  if (r.aUnCompteRendu) return null;
  const fin = r.finPrevue ?? new Date(r.debutPrevu.getTime() + DUREE_PAR_DEFAUT_MIN * 60_000);
  if (fin.getTime() + DELAI_F1_MIN * 60_000 > maintenant.getTime()) return null;
  return r.type === "telephone" ? "note" : "compte_rendu_ou_note";
}

/** Clé de l'alerte F1 d'une rencontre. */
export function cleF1(rencontreId: string): string {
  return `f1:${rencontreId}`;
}

// ── Lectures ─────────────────────────────────────────────────────────────────

async function rencontresPourF1(tx: Tx, borne: Date, maintenant: Date): Promise<RencontrePourF1[]> {
  const lignes = await tx.rencontre.findMany({
    where: {
      repriseHistorique: false,
      ...HORS_RENCONTRES_DE_TEST,
      type: { in: ["visio", "telephone"] },
      debutPrevu: { gte: borne, lt: maintenant },
    },
    select: {
      id: true,
      type: true,
      debutPrevu: true,
      finPrevue: true,
      statut: true,
      repriseHistorique: true,
      estTestInterne: true,
      calendlyEventId: true,
    },
    take: 500,
  });
  if (lignes.length === 0) return [];
  const ids = lignes.map((l) => l.id);
  const suivis = await tx.rencontreSuivi.findMany({
    where: { rencontreId: { in: ids } },
    select: { rencontreId: true, issue: true },
  });
  const crs = await tx.compteRendu.findMany({
    where: { rencontreId: { in: ids }, statut: { in: ["brouillon", "a_valider", "valide"] } },
    select: { rencontreId: true },
  });
  const evIds = lignes.map((l) => l.calendlyEventId).filter((x): x is string => x !== null);
  const annules =
    evIds.length > 0
      ? await tx.calendlyEvent.findMany({
          where: { id: { in: evIds }, status: "canceled" },
          select: { id: true },
        })
      : [];
  const issue = new Map(suivis.map((s) => [s.rencontreId, s.issue]));
  const avecCr = new Set(crs.map((c) => c.rencontreId));
  const evAnnules = new Set(annules.map((a) => a.id));
  return lignes.map((l) => ({
    id: l.id,
    type: l.type,
    debutPrevu: l.debutPrevu,
    finPrevue: l.finPrevue,
    statut: l.statut,
    repriseHistorique: l.repriseHistorique,
    estTestInterne: l.estTestInterne,
    issue: issue.get(l.id) ?? null,
    annuleCalendly: l.calendlyEventId !== null && evAnnules.has(l.calendlyEventId),
    aUnCompteRendu: avecCr.has(l.id),
  }));
}

// ── Le passage ───────────────────────────────────────────────────────────────

export interface CouvertureDuMois {
  readonly visios: number;
  readonly avecCompteRendu: number;
  readonly avecNote: number;
  readonly sansRien: number;
}

export interface ResultatBalayage {
  readonly rencontresAssurees: number;
  readonly f1: number;
  readonly comptesRendusAValider: number;
  readonly suitesEchues: number;
  readonly veille: number;
  readonly couverture: CouvertureDuMois | null;
  readonly etapesEnEchec: readonly string[];
}

export interface DependancesBalayage {
  readonly maintenant?: Date;
  readonly notifier: Notifier;
  /** Valeur brute du drapeau, recopiée dans le battement. */
  readonly drapeauBrut?: string | undefined;
}

/** Le premier jour du mois de Paris qui contient `d`, à 00:00 UTC (borne large). */
function debutDuMoisParis(d: Date): Date {
  const [a, m] = dayKeyInParis(d).split("-").map(Number);
  // Minuit de Paris vaut 22 h ou 23 h UTC la veille : on prend la veille à 22 h,
  // puis on filtre par jour de Paris.
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, 1) - 2 * 60 * 60 * 1000);
}

// ── Les lectures (partagées par le passage et le panneau de la console) ──────

/** Les rendez-vous qui attendent leur compte rendu (F1). */
export async function listerF1(
  db: Tx,
  borne: Date,
  maintenant: Date,
): Promise<Array<{ rencontreId: string; attendu: AttenduF1 }>> {
  const rencontres = await rencontresPourF1(db, borne, maintenant);
  return rencontres.flatMap((r) => {
    const attendu = attenduF1(r, borne, maintenant);
    return attendu === null ? [] : [{ rencontreId: r.id, attendu }];
  });
}

/** Comptes rendus à valider depuis plus de 3 jours. */
export async function compterComptesRendusAValider(db: Tx, maintenant: Date): Promise<number> {
  return db.compteRendu.count({
    where: {
      statut: "a_valider",
      createdAt: { lt: new Date(maintenant.getTime() - JOURS_COMPTE_RENDU_A_VALIDER * JOUR_MS) },
    },
  });
}

/** Suites convenues dont l'échéance est passée (jour de Paris). */
export async function compterSuitesEchues(db: Tx, maintenant: Date): Promise<number> {
  const aujourdhui = dayKeyInParis(maintenant);
  const suivis = await db.rencontreSuivi.findMany({
    where: { suite: { in: ["devis", "relance", "proposition"] }, suiteLe: { not: null } },
    select: { suiteLe: true },
    take: 2000,
  });
  // `suiteLe` est une DATE (sans heure) : sa clé de jour est sa partie UTC.
  return suivis.filter(
    (s) => s.suiteLe !== null && s.suiteLe.toISOString().slice(0, 10) < aujourdhui,
  ).length;
}

/** Rendez-vous de DEMAIN (jour de Paris) : la veille, « Préparer ». */
export async function compterVeille(db: Tx, maintenant: Date): Promise<number> {
  const demain = dayKeyInParis(new Date(maintenant.getTime() + JOUR_MS));
  const proches = await db.rencontre.findMany({
    where: {
      ...HORS_RENCONTRES_DE_TEST,
      debutPrevu: { gte: maintenant, lt: new Date(maintenant.getTime() + 2 * JOUR_MS) },
    },
    select: { debutPrevu: true },
  });
  return proches.filter((r) => r.debutPrevu !== null && dayKeyInParis(r.debutPrevu) === demain)
    .length;
}

/** Visios client du mois (Paris) : avec compte rendu, avec note, sans rien. */
export async function couvertureDuMois(db: Tx, maintenant: Date): Promise<CouvertureDuMois> {
  const mois = dayKeyInParis(maintenant).slice(0, 7);
  const visios = (
    await db.rencontre.findMany({
      where: {
        type: "visio",
        ...HORS_RENCONTRES_DE_TEST,
        repriseHistorique: false,
        debutPrevu: { gte: debutDuMoisParis(maintenant), lt: maintenant },
      },
      select: { id: true, debutPrevu: true, statut: true },
    })
  ).filter(
    (r) =>
      r.debutPrevu !== null &&
      dayKeyInParis(r.debutPrevu).slice(0, 7) === mois &&
      r.statut !== "annule" &&
      r.statut !== "absent" &&
      r.statut !== "reporte",
  );
  const ids = visios.map((v) => v.id);
  const crs =
    ids.length > 0
      ? await db.compteRendu.findMany({
          where: { rencontreId: { in: ids }, statut: { in: ["a_valider", "valide"] } },
          select: { rencontreId: true, origine: true },
        })
      : [];
  const ia = new Set(crs.filter((c) => c.origine === "ia").map((c) => c.rencontreId));
  const notes = new Set(crs.filter((c) => c.origine !== "ia").map((c) => c.rencontreId));
  const avecNote = ids.filter((id) => !ia.has(id) && notes.has(id)).length;
  return {
    visios: ids.length,
    avecCompteRendu: ia.size,
    avecNote,
    sansRien: ids.length - ia.size - avecNote,
  };
}

export interface EtatDuCircuit {
  readonly battement: EtatBattement;
  readonly drapeauVuParWorker: string | null;
  readonly borne: Date | null;
  readonly f1: ReadonlyArray<{ rencontreId: string; attendu: AttenduF1 }>;
  readonly comptesRendusAValider: number;
  readonly suitesEchues: number;
  readonly veille: number;
  readonly couverture: CouvertureDuMois;
  readonly alertesTechniques: ReadonlyArray<{
    cle: string;
    categorie: string;
    premiereLe: Date;
    envoyeeLe: Date | null;
  }>;
  /** Étapes du circuit en cours : « ne pas fusionner maintenant ». */
  readonly etapesEnCours: number;
}

/** Le panneau « État du circuit » : calculé depuis la base, sans rien écrire. */
export async function lireEtatDuCircuit(db: Tx, maintenant: Date): Promise<EtatDuCircuit> {
  const b = await db.battementCircuit.findUnique({
    where: { nom: BATTEMENT_BALAYAGE },
    select: { premierLe: true, dernierLe: true, drapeauVuParWorker: true },
  });
  const borne = b?.premierLe ?? null;
  // L'une après l'autre : jamais deux requêtes en parallèle sur une même connexion.
  const f1 = borne ? await listerF1(db, borne, maintenant) : [];
  const comptesRendusAValider = await compterComptesRendusAValider(db, maintenant);
  const suitesEchues = await compterSuitesEchues(db, maintenant);
  const veille = await compterVeille(db, maintenant);
  const couverture = await couvertureDuMois(db, maintenant);
  const alertesTechniques = await db.alerteVisio.findMany({
    where: { NOT: { cle: { startsWith: "f1:" } } },
    select: { cle: true, categorie: true, premiereLe: true, envoyeeLe: true },
    orderBy: { premiereLe: "desc" },
    take: 50,
  });
  const etapesEnCours = await db.traitementVisio.count({ where: { statut: "en_cours" } });
  return {
    battement: jugerBattement(b?.dernierLe ?? null, maintenant),
    drapeauVuParWorker: b?.drapeauVuParWorker ?? null,
    borne,
    f1,
    comptesRendusAValider,
    suitesEchues,
    veille,
    couverture,
    alertesTechniques,
    etapesEnCours,
  };
}

/** Un passage du balayage. Voir l'en-tête. */
export async function passerBalayage(
  db: BaseBalayage,
  deps: DependancesBalayage,
): Promise<ResultatBalayage> {
  const maintenant = deps.maintenant ?? new Date();
  const echecs: string[] = [];

  async function etape<T>(nom: string, defaut: T, fn: () => Promise<T>): Promise<T> {
    try {
      const r = await fn();
      await leverAlerte(db, `balayage-etape:${nom}`).catch(() => false);
      return r;
    } catch (err) {
      echecs.push(nom);
      await signalerAlerte(
        db,
        {
          cle: `balayage-etape:${nom}`,
          categorie: "circuit",
          canal: "telegram",
          message: `Balayage du dossier client : l'étape « ${nom} » échoue.`,
          details: { erreur: err instanceof Error ? err.name : "inconnue" },
        },
        deps.notifier,
        maintenant,
      ).catch(() => "echec_envoi");
      return defaut;
    }
  }

  // 1. Battement (et borne au premier passage).
  await etape<void>("battement", undefined, () =>
    ecrireBattement(db, { maintenant, drapeauBrut: deps.drapeauBrut }),
  );
  const borne = (await lireBorneDuBalayage(db)) ?? maintenant;

  // 2. Les rencontres des rendez-vous postérieurs à la borne.
  const rencontresAssurees = await etape("rencontres", 0, async () => {
    const evs = await db.calendlyEvent.findMany({
      where: {
        startTime: {
          gte: borne,
          lte: new Date(maintenant.getTime() + FENETRE_AVENIR_JOURS * JOUR_MS),
        },
      },
      select: { id: true, eventTypeName: true, linkedJobApplicationId: true },
      take: 500,
    });
    let n = 0;
    for (const ev of evs) {
      if (!estRendezVousDuDossier(ev)) continue;
      const r = await assurerRencontrePourCalendly(db, ev.id, { maintenant, borne });
      if (r.statut === "creee" || r.statut === "existante") n += 1;
    }
    return n;
  });

  // 3. F1 — rappel de console.
  const f1 = await etape("f1", 0, async () => {
    const enAttente = await listerF1(db, borne, maintenant);
    const cles = new Set(enAttente.map((r) => cleF1(r.rencontreId)));
    for (const r of enAttente) {
      await signalerAlerte(
        db,
        {
          cle: cleF1(r.rencontreId),
          categorie: "circuit",
          canal: canalDesRappels(),
          message: "Rendez-vous tenu sans compte rendu ni note.",
          details: { rencontreId: r.rencontreId, attendu: r.attendu },
        },
        deps.notifier,
        maintenant,
      );
    }
    // Les alertes F1 éteintes (compte rendu écrit, rendez-vous déplacé ou annulé).
    const anciennes = await db.alerteVisio.findMany({
      where: { cle: { startsWith: "f1:" } },
      select: { cle: true },
    });
    for (const a of anciennes) {
      if (!cles.has(a.cle)) await leverAlerte(db, a.cle);
    }
    return enAttente.length;
  });

  // 4 à 7. Les compteurs (les mêmes lectures que le panneau de la console).
  const comptesRendusAValider = await etape("comptes-rendus", 0, () =>
    compterComptesRendusAValider(db, maintenant),
  );
  const suitesEchues = await etape("suites", 0, () => compterSuitesEchues(db, maintenant));
  const veille = await etape("veille", 0, () => compterVeille(db, maintenant));
  const couverture = await etape<CouvertureDuMois | null>("couverture", null, () =>
    couvertureDuMois(db, maintenant),
  );

  return {
    rencontresAssurees,
    f1,
    comptesRendusAValider,
    suitesEchues,
    veille,
    couverture,
    etapesEnEchec: echecs,
  };
}
