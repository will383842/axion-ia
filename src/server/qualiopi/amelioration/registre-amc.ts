/**
 * 🔴 CHANTIER QNC, LOT L10 — le registre des actions d'amélioration AXI-AMC.
 *
 * Quand `qualiopi.amelioration.actif` vaut `actif`, ce registre devient la
 * SEULE source du plan d'actions (indicateur 32) : `RevueDirection.planActions`
 * n'est plus relu que pour l'historique (trigger `revues_direction_plan_actions_
 * lecture_seule`, socle L00). Les deux tables sont en ajout seul en base.
 *
 * Chaque écriture porte, dans UNE transaction : la ligne, sa trace
 * `activity_logs` (`journaliser`, `exiger: true`) ; l'auteur RÉEL (identifiant
 * et nom figé au moment du geste) ; la date du serveur (`cree_le`, `now()`).
 *
 * Module NEUTRE : il reçoit son client Prisma.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { journaliser, type ContexteJournal } from "@/server/journal/journaliser";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { jourParisIso } from "@/server/qualiopi/conformite/indicateurs-registre";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";
import { prochainNumeroAmc } from "./numero-amc";
import {
  commentaireAEcrire,
  refusEtape,
  type ActionAmcLue,
  type EtapeAmc,
  type OrigineAmc,
} from "./etapes-amc";

export const LOT_AMELIORATION = "amelioration" as const;

export const ACTION_JOURNAL_AMC = {
  ouverture: "qualiopi.amelioration.ouverte",
  etape: "qualiopi.amelioration.etape",
} as const;

export class RefusAmelioration extends Error {}

type Tx = Prisma.TransactionClient;
type BaseAmc = { $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> };

export interface OptionsAmc {
  readonly contexte?: () => ContexteJournal | Promise<ContexteJournal>;
  /** Pour tester : l'instant du serveur (millésime du numéro). */
  readonly maintenant?: Date;
}

/** Le lot agit-il ? `essai` n'agit pas : le registre ne porte sur aucune session. */
export async function registreAmeliorationActif(
  client?: Parameters<typeof lireInterrupteurQualiopi>[1],
): Promise<boolean> {
  return estActifPour(await lireInterrupteurQualiopi(LOT_AMELIORATION, client), null);
}

export interface EntreeOuverture {
  readonly origine: OrigineAmc;
  readonly origineRefId?: string | null;
  readonly constat: string;
  readonly action: string;
  readonly auteurId: string;
  readonly auteurNom: string;
}

function texteRequis(v: string, libelle: string): string {
  const t = v.trim();
  if (t.length < 3) throw new RefusAmelioration(`${libelle} : 3 caractères au moins.`);
  return t;
}

/** Ouvre une action AXI-AMC : numéro de la série de l'année (heure de Paris). */
export async function ouvrirActionAmelioration(
  db: BaseAmc,
  e: EntreeOuverture,
  options: OptionsAmc = {},
): Promise<{ id: string; numero: string }> {
  const constat = texteRequis(e.constat, "Constat");
  const action = texteRequis(e.action, "Action");
  const auteurNom = e.auteurNom.trim().slice(0, 200) || "administrateur";
  const annee = Number(jourParisIso(options.maintenant ?? new Date()).slice(0, 4));
  return withNumberRetry(() =>
    db.$transaction(async (tx) => {
      // Deux ouvertures simultanées liraient la même borne : la série est sérialisée.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('qualiopi.amc.serie'))`;
      const numero = await prochainNumeroAmc(tx, annee);
      const cree = await tx.actionAmelioration.create({
        data: {
          numero,
          origine: e.origine,
          origineRefId: e.origineRefId ?? null,
          constat,
          action,
          auteurId: e.auteurId,
          auteurNom,
        },
        select: { id: true, numero: true },
      });
      await journaliser(
        tx,
        {
          action: ACTION_JOURNAL_AMC.ouverture,
          targetType: "ActionAmelioration",
          targetId: cree.id,
          changes: { numero, origine: e.origine, origineRefId: e.origineRefId ?? null },
          session: { userId: e.auteurId },
        },
        { exiger: true, ...(options.contexte ? { contexte: options.contexte } : {}) },
      );
      return cree;
    }),
  );
}

export interface EntreeEtape {
  readonly actionId: string;
  readonly etape: EtapeAmc;
  readonly commentaire: string;
  readonly responsable?: string;
  readonly echeance?: string;
  readonly auteurId: string;
  readonly auteurNom: string;
}

/** Ajoute une étape, après avoir relu les précédentes sous verrou. */
export async function ajouterEtapeAmelioration(
  db: BaseAmc,
  e: EntreeEtape,
  options: OptionsAmc = {},
): Promise<{ id: string }> {
  const auteurNom = e.auteurNom.trim().slice(0, 200) || "administrateur";
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`qualiopi.amc.${e.actionId}`}))`;
    const action = await tx.actionAmelioration.findUnique({
      where: { id: e.actionId },
      select: {
        id: true,
        numero: true,
        etapes: { select: { etape: true, commentaire: true, auteurId: true, creeLe: true } },
      },
    });
    if (action === null) throw new RefusAmelioration("Action d'amélioration introuvable.");
    const refus = refusEtape(action.etapes, e);
    if (refus !== null) throw new RefusAmelioration(refus);
    const cree = await tx.actionAmeliorationEtape.create({
      data: {
        actionId: e.actionId,
        etape: e.etape,
        commentaire: commentaireAEcrire(e),
        auteurId: e.auteurId,
        auteurNom,
      },
      select: { id: true },
    });
    await journaliser(
      tx,
      {
        action: ACTION_JOURNAL_AMC.etape,
        targetType: "ActionAmelioration",
        targetId: e.actionId,
        changes: { numero: action.numero, etape: e.etape, etapeId: cree.id },
        session: { userId: e.auteurId },
      },
      { exiger: true, ...(options.contexte ? { contexte: options.contexte } : {}) },
    );
    return cree;
  });
}

type LecteurAmc = {
  actionAmelioration: { findMany(args: unknown): PromiseLike<unknown> };
};

/** Bornes UTC de l'année civile de PARIS (`cree_le` est un timestamptz). */
export function bornesAnneeParis(annee: number): { gte: Date; lt: Date } {
  // Le 1er janvier à 00:00 à Paris est toujours en heure d'hiver (UTC+1).
  return {
    gte: new Date(`${annee - 1}-12-31T23:00:00.000Z`),
    lt: new Date(`${annee}-12-31T23:00:00.000Z`),
  };
}

/** Les actions AXI-AMC (avec leurs étapes), les plus récentes d'abord. */
export async function listerActionsAmelioration(
  client: LecteurAmc,
  filtre: { readonly annee?: number } = {},
): Promise<ActionAmcLue[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];
  const lignes = (await client.actionAmelioration.findMany({
    where: filtre.annee !== undefined ? { creeLe: bornesAnneeParis(filtre.annee) } : {},
    select: {
      id: true,
      numero: true,
      origine: true,
      constat: true,
      action: true,
      auteurId: true,
      auteurNom: true,
      creeLe: true,
      etapes: {
        select: { etape: true, commentaire: true, auteurId: true, auteurNom: true, creeLe: true },
        orderBy: { creeLe: "asc" },
      },
    },
    orderBy: { creeLe: "desc" },
    take: 500,
  })) as ActionAmcLue[];
  return lignes;
}
