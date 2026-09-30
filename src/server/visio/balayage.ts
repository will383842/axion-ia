/**
 * Le BALAYAGE du dossier client — le filet de sécurité, toutes les 5 minutes
 * (chantier visio, PR 4 ; plan V-07, périmètre exact de la vérification C04).
 *
 * Ce qu'il fait dans CETTE PR, et rien d'autre :
 *   1. le battement (`battement.ts`) — et, au premier passage, la BORNE ;
 *   2. les rencontres des rendez-vous Calendly de la liste blanche POSTÉRIEURS
 *      à la borne : créées ou resynchronisées (`assurerRencontrePourCalendly`),
 *      jamais rangées (A4) ;
 *   3. les comptes rendus à valider depuis 3 jours ;
 *   4. les suites échues ;
 *   5. la veille du rendez-vous suivant (demain, heure de Paris) ;
 *   6. la couverture du mois (visios client : enregistrées / notes / rien).
 *
 * « Rendez-vous tenu sans compte rendu » n'est PAS calculé ici : c'est la
 * pastille « À faire le point » qui existe déjà (`suivi-queries.ts`) —
 * correction anti-doublon A3, un seul rappel pour un seul geste.
 * La clé de chiffrement, les appareils, les enregistrements, les étapes du
 * circuit arrivent avec leur PR (5 et 6), chacun avec son test.
 *
 * ## Une étape bloquée n'arrête pas les autres
 *
 * Chaque étape a son `try` : une erreur est comptée, signalée une fois — dans
 * `AlerteSysteme` (code `visio.balayage_en_panne`, `alertes.ts`) et sur
 * Telegram —, et le passage continue.
 * Le battement est écrit EN PREMIER : un balayage qui tourne mais dont une
 * étape échoue n'est pas un balayage arrêté. Garde :
 * `le-balayage-tourne-meme-si-une-etape-est-bloquee.spec.ts`.
 *
 * ## L'historique n'est jamais remonté
 *
 * Aucune rencontre n'est créée pour un rendez-vous antérieur à la borne : les
 * ~40 « Discutons » d'avant la mise en service ne deviennent ni 40 lignes « à
 * classer » ni 40 alertes. Ils passent
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
import {
  aEuLieu,
  estDuMoisDuBilan,
  fenetreDuBilan,
} from "@/features/admin-rendezvous/rendez-vous-tenu";
import { dayKeyInParis } from "@/lib/calendar-grid";
import {
  leverPanneDuBalayage,
  signalerPanneDuBalayage,
  VISIO_BALAYAGE_EN_PANNE,
  type CreerAlerte,
  type Notifier,
} from "./alertes";
import {
  BATTEMENT_BALAYAGE,
  ecrireBattement,
  jugerBattement,
  lireBorneDuBalayage,
  type EtatBattement,
} from "./battement";
import { estRendezVousDuDossier } from "./liste-blanche-types";

/** Un compte rendu à valider depuis plus longtemps est rappelé. */
export const JOURS_COMPTE_RENDU_A_VALIDER = 3;

/** Jusqu'où, dans l'avenir, les rendez-vous Calendly sont assurés. */
export const FENETRE_AVENIR_JOURS = 60;

const JOUR_MS = 24 * 60 * 60 * 1000;

export type BaseBalayage = Tx & BaseTransactionnelle;

// ── Le passage ───────────────────────────────────────────────────────────────

export interface CouvertureDuMois {
  readonly visios: number;
  readonly avecCompteRendu: number;
  readonly avecNote: number;
  readonly sansRien: number;
}

export interface ResultatBalayage {
  readonly rencontresAssurees: number;
  readonly comptesRendusAValider: number;
  readonly suitesEchues: number;
  readonly veille: number;
  readonly couverture: CouvertureDuMois | null;
  readonly etapesEnEchec: readonly string[];
}

export interface DependancesBalayage {
  readonly maintenant?: Date;
  readonly notifier: Notifier;
  /** Création d'alerte (`creerOuDedup` par défaut) : injectée par les tests. */
  readonly creerAlerte?: CreerAlerte;
  /** Valeur brute du drapeau, recopiée dans le battement. */
  readonly drapeauBrut?: string | undefined;
}

// ── Les lectures (partagées par le passage et le panneau de la console) ──────

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

/**
 * Visios client TENUES du mois (Paris) : avec compte rendu, avec note, sans rien.
 *
 * « Tenue » et « du mois » suivent la règle UNIQUE de `rendez-vous-tenu.ts`,
 * celle du bilan (`bilanDuMois`) : le point fait après l'appel dit « A eu
 * lieu », et le rendez-vous Calendly commence ce mois-ci. « Visios tenues »
 * est donc toujours une partie de « ont eu lieu » (correction A3) : jamais
 * une visio passée sans point, jamais une visio saisie à la main que le bilan
 * ne connaît pas.
 * Trois lectures à plat, dans l'ordre du bilan : rendez-vous du mois → points
 * « A eu lieu » → rencontres visio du dossier.
 */
export async function couvertureDuMois(db: Tx, maintenant: Date): Promise<CouvertureDuMois> {
  const duMois = (
    await db.calendlyEvent.findMany({
      where: { startTime: fenetreDuBilan(maintenant) },
      select: { id: true, startTime: true },
    })
  )
    .filter((e) => estDuMoisDuBilan(e.startTime, maintenant))
    .map((e) => e.id);
  const tenus =
    duMois.length > 0
      ? (
          await db.rendezVousSuivi.findMany({
            where: { calendlyEventId: { in: duMois } },
            select: { calendlyEventId: true, issue: true },
          })
        )
          .filter((s) => aEuLieu(s.issue))
          .map((s) => s.calendlyEventId)
      : [];
  const visios =
    tenus.length > 0
      ? await db.rencontre.findMany({
          where: {
            type: "visio",
            ...HORS_RENCONTRES_DE_TEST,
            repriseHistorique: false,
            calendlyEventId: { in: tenus },
          },
          select: { id: true },
        })
      : [];
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
  readonly comptesRendusAValider: number;
  readonly suitesEchues: number;
  readonly veille: number;
  readonly couverture: CouvertureDuMois;
  /** Pannes ouvertes du circuit, lues dans `AlerteSysteme` (codes `visio.*`). */
  readonly alertesTechniques: ReadonlyArray<{
    id: string;
    code: string;
    titre: string;
    createdAt: Date;
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
  const comptesRendusAValider = await compterComptesRendusAValider(db, maintenant);
  const suitesEchues = await compterSuitesEchues(db, maintenant);
  const veille = await compterVeille(db, maintenant);
  const couverture = await couvertureDuMois(db, maintenant);
  const alertesTechniques = await db.alerteSysteme.findMany({
    where: { code: VISIO_BALAYAGE_EN_PANNE, resolue: false },
    select: { id: true, code: true, titre: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const etapesEnCours = await db.traitementVisio.count({ where: { statut: "en_cours" } });
  return {
    battement: jugerBattement(b?.dernierLe ?? null, maintenant),
    drapeauVuParWorker: b?.drapeauVuParWorker ?? null,
    borne,
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
      await leverPanneDuBalayage(db, nom, maintenant).catch(() => false);
      return r;
    } catch (err) {
      echecs.push(nom);
      await signalerPanneDuBalayage(
        db,
        { etape: nom, erreur: err instanceof Error ? err.name : "inconnue" },
        {
          notifier: deps.notifier,
          maintenant,
          ...(deps.creerAlerte ? { creer: deps.creerAlerte } : {}),
        },
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

  // 3 à 6. Les compteurs (les mêmes lectures que le panneau de la console).
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
    comptesRendusAValider,
    suitesEchues,
    veille,
    couverture,
    etapesEnEchec: echecs,
  };
}
