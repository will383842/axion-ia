/**
 * 🔴 CHANTIER QNC, LOT L10 — les écritures de la veille quand
 * `qualiopi.veille.actif` vaut `actif`.
 *
 * Chaque geste écrit sa ligne `veilles` (INSERT seulement : la table est en
 * ajout seul) ET sa trace `activity_logs` dans UNE transaction, la trace par
 * `journaliser(…, { exiger: true })` : sans trace, pas d'écriture. Les dates
 * sont posées par le serveur (`created_at`, `now()`) ; la date de
 * l'INFORMATION, elle, est choisie par la personne qui saisit, au jour près, et
 * jamais dans le futur (heure de Paris).
 *
 * Les gestes :
 *   - `creerVeilleTracee`  : la proposition (IA ou humaine). PAS de décision ;
 *   - `deciderVeille`      : une personne décide → nouvelle version, ancienne archivée ;
 *   - `corrigerVeille`     : correction motivée → nouvelle version, ancienne archivée ;
 *     type et date de l'information sont repris tels quels, jamais renvoyés ;
 *   - `archiverVeille`     : remplace la suppression ; la ligne reste.
 *
 * Un verrou consultatif par veille sérialise deux gestes croisés sur la même
 * entrée : le second relit l'archivage laissé par le premier et refuse.
 *
 * Module NEUTRE : il reçoit son client Prisma.
 */

import type { Prisma, VeilleType } from "../../../../prisma/generated/client";
import { journaliser, type ContexteJournal } from "@/server/journal/journaliser";
import { jourParisIso } from "@/server/qualiopi/conformite/indicateurs-registre";
import { ACTION_JOURNAL_VEILLE, MOTIF_MIN, TARGET_TYPE_VEILLE, motifValide } from "./trace-veille";

export class RefusVeille extends Error {}

type Tx = Prisma.TransactionClient;
type BaseVeille = { $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> };

export interface OptionsVeille {
  readonly contexte?: () => ContexteJournal | Promise<ContexteJournal>;
  /** Pour tester : l'instant du serveur. */
  readonly maintenant?: Date;
}

export interface EntreeCreationVeille {
  readonly type: VeilleType;
  readonly source: string;
  readonly titre: string;
  readonly contenu: string;
  readonly impact?: string;
  /**
   * Date de l'information (jour civil) : jamais après aujourd'hui, heure de
   * Paris. Absente : le jour de Paris, posé par le serveur.
   */
  readonly dateVeille?: Date;
  readonly auteurId: string;
}

/**
 * La date de l'information, ramenée au jour (midi UTC, aucun basculement de
 * fuseau). Sans date : le jour de PARIS au moment de la saisie — jamais celui
 * du conteneur, qui tourne en UTC.
 */
export function jourInformation(date: Date | undefined, maintenant: Date): Date {
  if (date !== undefined && Number.isNaN(date.getTime())) {
    throw new RefusVeille("Date de l'information invalide.");
  }
  const jour = date === undefined ? jourParisIso(maintenant) : date.toISOString().slice(0, 10);
  if (jour > jourParisIso(maintenant)) {
    throw new RefusVeille(
      "La date de l'information ne peut pas être postérieure à aujourd'hui (heure de Paris).",
    );
  }
  return new Date(`${jour}T12:00:00.000Z`);
}

function requis(valeur: string, libelle: string, max?: number): string {
  const v = valeur.trim();
  if (v === "") throw new RefusVeille(`${libelle} : champ obligatoire.`);
  if (max !== undefined && v.length > max)
    throw new RefusVeille(`${libelle} : ${max} caractères au plus.`);
  return v;
}

async function verrouiller(tx: Tx, veilleId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`qualiopi.veille.${veilleId}`}))`;
}

/** La veille, si elle existe et n'est pas archivée. Sinon refus, en français. */
async function veilleVivante(tx: Tx, veilleId: string) {
  const veille = await tx.veille.findUnique({ where: { id: veilleId } });
  if (veille === null) throw new RefusVeille("Entrée de veille introuvable.");
  const archivage = await tx.activityLog.findFirst({
    where: {
      action: ACTION_JOURNAL_VEILLE.archivage,
      targetType: TARGET_TYPE_VEILLE,
      targetId: veilleId,
    },
    select: { id: true },
  });
  if (archivage !== null) {
    throw new RefusVeille(
      "Cette entrée est archivée : une version plus récente la remplace. Rechargez la page.",
    );
  }
  return veille;
}

async function archiverDansTx(
  tx: Tx,
  e: { veilleId: string; motif: string; remplaceePar: string | null; auteurId: string },
  options: OptionsVeille,
): Promise<void> {
  await journaliser(
    tx,
    {
      action: ACTION_JOURNAL_VEILLE.archivage,
      targetType: TARGET_TYPE_VEILLE,
      targetId: e.veilleId,
      changes: { motif: e.motif, remplaceePar: e.remplaceePar },
      session: { userId: e.auteurId },
    },
    { exiger: true, ...(options.contexte ? { contexte: options.contexte } : {}) },
  );
}

/** Enregistre une proposition de veille. La décision se prend à part, par une personne. */
export async function creerVeilleTracee(
  db: BaseVeille,
  e: EntreeCreationVeille,
  options: OptionsVeille = {},
): Promise<{ id: string }> {
  const maintenant = options.maintenant ?? new Date();
  const data = {
    type: e.type,
    source: requis(e.source, "Source", 300),
    titre: requis(e.titre, "Titre", 300),
    contenu: requis(e.contenu, "Analyse"),
    dateVeille: jourInformation(e.dateVeille, maintenant),
    ...(e.impact !== undefined && e.impact.trim() !== "" ? { impact: e.impact.trim() } : {}),
    creeParId: e.auteurId,
  };
  return db.$transaction(async (tx) => {
    const veille = await tx.veille.create({ data, select: { id: true } });
    await journaliser(
      tx,
      {
        action: ACTION_JOURNAL_VEILLE.creation,
        targetType: TARGET_TYPE_VEILLE,
        targetId: veille.id,
        changes: { type: data.type, titre: data.titre, dateVeille: data.dateVeille },
        session: { userId: e.auteurId },
      },
      { exiger: true, ...(options.contexte ? { contexte: options.contexte } : {}) },
    );
    return veille;
  });
}

export interface EntreeDecisionVeille {
  readonly veilleId: string;
  /** Ce que la personne décide (y compris « aucune suite », motivé). */
  readonly decision: string;
  /** La pièce modifiée en conséquence (référence ou lien), ou « aucune ». */
  readonly pieceModifiee: string;
  readonly auteurId: string;
}

/** Une personne décide : la décision devient une nouvelle version, l'ancienne est archivée. */
export async function deciderVeille(
  db: BaseVeille,
  e: EntreeDecisionVeille,
  options: OptionsVeille = {},
): Promise<{ id: string }> {
  const decision = requis(e.decision, "Décision");
  if (decision.length < MOTIF_MIN) {
    throw new RefusVeille(`Décision : ${MOTIF_MIN} caractères au moins.`);
  }
  const pieceModifiee = requis(e.pieceModifiee, "Pièce modifiée", 300);
  return db.$transaction(async (tx) => {
    await verrouiller(tx, e.veilleId);
    const v = await veilleVivante(tx, e.veilleId);
    const nouvelle = await tx.veille.create({
      data: {
        type: v.type,
        source: v.source,
        titre: v.titre,
        contenu: v.contenu,
        dateVeille: v.dateVeille,
        ...(v.impact !== null ? { impact: v.impact } : {}),
        actionDecidee: decision,
        creeParId: e.auteurId,
      },
      select: { id: true },
    });
    await journaliser(
      tx,
      {
        action: ACTION_JOURNAL_VEILLE.decision,
        targetType: TARGET_TYPE_VEILLE,
        targetId: nouvelle.id,
        changes: { remplace: e.veilleId, decision, pieceModifiee },
        session: { userId: e.auteurId },
      },
      { exiger: true, ...(options.contexte ? { contexte: options.contexte } : {}) },
    );
    await archiverDansTx(
      tx,
      {
        veilleId: e.veilleId,
        motif: "Décision prise : remplacée par sa version décidée.",
        remplaceePar: nouvelle.id,
        auteurId: e.auteurId,
      },
      options,
    );
    return nouvelle;
  });
}

export interface EntreeCorrectionVeille {
  readonly veilleId: string;
  readonly source?: string;
  readonly titre?: string;
  readonly contenu?: string;
  readonly impact?: string;
  readonly motif: string;
  readonly auteurId: string;
}

/**
 * Corrige une veille PAR AJOUT. Ni le type ni la date de l'information ne se
 * corrigent : l'entrée d'origine reste lisible, archivée, avec son motif.
 */
export async function corrigerVeille(
  db: BaseVeille,
  e: EntreeCorrectionVeille,
  options: OptionsVeille = {},
): Promise<{ id: string }> {
  if (!motifValide(e.motif)) {
    throw new RefusVeille(`Motif de la correction : ${MOTIF_MIN} caractères au moins.`);
  }
  const motif = e.motif.trim();
  return db.$transaction(async (tx) => {
    await verrouiller(tx, e.veilleId);
    const v = await veilleVivante(tx, e.veilleId);
    const apres = {
      source: e.source !== undefined ? requis(e.source, "Source", 300) : v.source,
      titre: e.titre !== undefined ? requis(e.titre, "Titre", 300) : v.titre,
      contenu: e.contenu !== undefined ? requis(e.contenu, "Analyse") : v.contenu,
      impact: e.impact !== undefined ? e.impact.trim() || null : v.impact,
    };
    const champs = (Object.keys(apres) as Array<keyof typeof apres>).filter(
      (k) => apres[k] !== v[k],
    );
    if (champs.length === 0) throw new RefusVeille("Aucune correction : rien n'a changé.");
    const nouvelle = await tx.veille.create({
      data: {
        type: v.type,
        dateVeille: v.dateVeille,
        source: apres.source,
        titre: apres.titre,
        contenu: apres.contenu,
        ...(apres.impact !== null ? { impact: apres.impact } : {}),
        ...(v.actionDecidee !== null ? { actionDecidee: v.actionDecidee } : {}),
        creeParId: e.auteurId,
      },
      select: { id: true },
    });
    await journaliser(
      tx,
      {
        action: ACTION_JOURNAL_VEILLE.correction,
        targetType: TARGET_TYPE_VEILLE,
        targetId: nouvelle.id,
        changes: { remplace: e.veilleId, motif, champs },
        session: { userId: e.auteurId },
      },
      { exiger: true, ...(options.contexte ? { contexte: options.contexte } : {}) },
    );
    await archiverDansTx(
      tx,
      { veilleId: e.veilleId, motif, remplaceePar: nouvelle.id, auteurId: e.auteurId },
      options,
    );
    return nouvelle;
  });
}

/** Remplace la suppression : la ligne reste, son archivage motivé est inscrit au journal. */
export async function archiverVeille(
  db: BaseVeille,
  e: { readonly veilleId: string; readonly motif: string; readonly auteurId: string },
  options: OptionsVeille = {},
): Promise<{ id: string }> {
  if (!motifValide(e.motif)) {
    throw new RefusVeille(`Motif de l'archivage : ${MOTIF_MIN} caractères au moins.`);
  }
  const motif = e.motif.trim();
  return db.$transaction(async (tx) => {
    await verrouiller(tx, e.veilleId);
    await veilleVivante(tx, e.veilleId);
    await archiverDansTx(
      tx,
      { veilleId: e.veilleId, motif, remplaceePar: null, auteurId: e.auteurId },
      options,
    );
    return { id: e.veilleId };
  });
}
