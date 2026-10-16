/**
 * Chantier QNC, L03 — LA GARDE SERVEUR : aucune convention n'est envoyée sans
 * « cadrage validé + devis accepté », sauf dérogation motivée.
 *
 * `decider` est PURE (testée sans base) ; `lireEtatRecueil` lit l'état ;
 * `garderEnvoiConvention` est ce qu'appellent les chemins d'envoi.
 *
 * ⛔ ÉTEINT = INCHANGÉ. Tant que `qualiopi.recueil.actif` n'est pas allumé pour
 * la session (en `essai` : seulement les sessions du banc d'essai), la garde
 * rend « autorisé » sans rien lire d'autre que l'interrupteur et le drapeau de
 * la session. Une base injoignable éteint l'interrupteur (`lireInterrupteurQualiopi`).
 *
 * « Cadrage validé » = un questionnaire du projet de la session est
 * `reponse_recue` ET porte une ligne de validation au journal (ajout seul).
 * « Devis accepté » = le devis de la session est `accepte` ou déjà transformé.
 */

import { prisma } from "@/lib/prisma";
import { journaliser, type ClientJournal } from "@/server/journal/journaliser";
import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";

import {
  ACTION_ANALYSE_VALIDEE,
  ACTION_DEROGATION_ACCORDEE,
  ACTION_DEROGATION_UTILISEE,
  LOT_RECUEIL,
  STATUTS_DEVIS_ACCEPTE,
} from "./constantes";

export type Manque = "cadrage_non_valide" | "devis_non_accepte";

export interface EtatRecueil {
  readonly interrupteur: EtatInterrupteur;
  readonly sessionEstTest: boolean;
  readonly projetId: string | null;
  /** Le questionnaire de cadrage répondu du projet, et sa validation (`null` = non validé). */
  readonly cadrage: { readonly id: string; readonly valideLe: Date | null } | null;
  readonly devisStatut: string | null;
  readonly derogation: { readonly motif: string; readonly accordeeLe: Date } | null;
}

export type Decision =
  | { readonly autorise: true; readonly voie: "eteint" | "conforme" }
  | {
      readonly autorise: true;
      readonly voie: "derogation";
      readonly motif: string;
      readonly accordeeLe: Date;
    }
  | {
      readonly autorise: false;
      readonly manques: ReadonlyArray<Manque>;
      readonly message: string;
    };

const LIBELLE_MANQUE: Record<Manque, string> = {
  cadrage_non_valide: "le cadrage du besoin n'est pas validé",
  devis_non_accepte: "le devis n'est pas accepté",
};

/** Pure. */
export function decider(e: EtatRecueil): Decision {
  if (!estActifPour(e.interrupteur, { estTestInterne: e.sessionEstTest })) {
    return { autorise: true, voie: "eteint" };
  }
  const manques: Manque[] = [];
  if (e.cadrage === null || e.cadrage.valideLe === null) manques.push("cadrage_non_valide");
  if (e.devisStatut === null || !STATUTS_DEVIS_ACCEPTE.includes(e.devisStatut)) {
    manques.push("devis_non_accepte");
  }
  if (manques.length === 0) return { autorise: true, voie: "conforme" };
  if (e.derogation !== null) {
    return {
      autorise: true,
      voie: "derogation",
      motif: e.derogation.motif,
      accordeeLe: e.derogation.accordeeLe,
    };
  }
  return {
    autorise: false,
    manques,
    message:
      `La convention ne peut pas être envoyée : ${manques.map((m) => LIBELLE_MANQUE[m]).join(" et ")}. ` +
      "Validez le cadrage et faites accepter le devis — ou accordez une dérogation motivée depuis la session.",
  };
}

type LecteurEtat = Pick<
  typeof prisma,
  "trainingSession" | "questionnaireCadrage" | "activityLog" | "setting"
>;

/** Lit l'état. `null` : session introuvable. */
export async function lireEtatRecueil(
  sessionId: string,
  db: LecteurEtat = prisma,
): Promise<EtatRecueil | null> {
  const session = await db.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      estTestInterne: true,
      projetId: true,
      devis: { select: { statut: true } },
    },
  });
  if (session === null) return null;
  const interrupteur = await lireInterrupteurQualiopi(LOT_RECUEIL, db);
  // Éteint (pour cette session) : rien d'autre à lire.
  if (!estActifPour(interrupteur, { estTestInterne: session.estTestInterne })) {
    return {
      interrupteur,
      sessionEstTest: session.estTestInterne,
      projetId: session.projetId,
      cadrage: null,
      devisStatut: session.devis?.statut ?? null,
      derogation: null,
    };
  }

  let cadrage: EtatRecueil["cadrage"] = null;
  if (session.projetId !== null) {
    const reponses = await db.questionnaireCadrage.findMany({
      where: { projetId: session.projetId, statut: "reponse_recue" },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    if (reponses.length > 0) {
      const validation = await db.activityLog.findFirst({
        where: {
          action: ACTION_ANALYSE_VALIDEE,
          targetType: "QuestionnaireCadrage",
          targetId: { in: reponses.map((r) => r.id) },
        },
        orderBy: { createdAt: "desc" },
        select: { targetId: true, createdAt: true },
      });
      cadrage =
        validation === null
          ? { id: reponses[0]!.id, valideLe: null }
          : { id: validation.targetId ?? reponses[0]!.id, valideLe: validation.createdAt };
    }
  }

  const derogation = await derogationDeLaSession(sessionId, db);
  return {
    interrupteur,
    sessionEstTest: session.estTestInterne,
    projetId: session.projetId,
    cadrage,
    devisStatut: session.devis?.statut ?? null,
    derogation,
  };
}

/** La dérogation la plus récente de la session, ou `null`. */
export async function derogationDeLaSession(
  sessionId: string,
  db: Pick<typeof prisma, "activityLog"> = prisma,
): Promise<{ motif: string; accordeeLe: Date } | null> {
  const ligne = await db.activityLog.findFirst({
    where: {
      action: ACTION_DEROGATION_ACCORDEE,
      targetType: "TrainingSession",
      targetId: sessionId,
    },
    orderBy: { createdAt: "desc" },
    select: { changes: true, createdAt: true },
  });
  if (ligne === null) return null;
  const c = ligne.changes;
  const motif =
    c !== null && typeof c === "object" && !Array.isArray(c)
      ? (c as Record<string, unknown>)["motif"]
      : undefined;
  if (typeof motif !== "string" || motif.trim() === "") return null;
  return { motif, accordeeLe: ligne.createdAt };
}

export type VerdictEnvoi =
  | { readonly ok: true; readonly decision: Decision }
  | { readonly ok: false; readonly message: string };

/**
 * LE point d'appel des chemins d'envoi d'une convention. Quand la dérogation
 * est la seule raison du passage, l'USAGE est journalisé (qui, quand, motif) :
 * l'accord et l'usage sont deux faits distincts.
 */
export async function garderEnvoiConvention(
  entree: { readonly sessionId: string; readonly auteurId: string | null },
  db: LecteurEtat & { activityLog: ClientJournal["activityLog"] } = prisma,
): Promise<VerdictEnvoi> {
  const etat = await lireEtatRecueil(entree.sessionId, db);
  // Session introuvable : ce n'est pas à cette garde d'en décider.
  if (etat === null) return { ok: true, decision: { autorise: true, voie: "eteint" } };
  const decision = decider(etat);
  if (!decision.autorise) return { ok: false, message: decision.message };
  if (decision.voie === "derogation") {
    await journaliser(
      db,
      {
        action: ACTION_DEROGATION_UTILISEE,
        targetType: "TrainingSession",
        targetId: entree.sessionId,
        changes: { motif: decision.motif, accordeeLe: decision.accordeeLe.toISOString() },
        session: entree.auteurId === null ? null : { userId: entree.auteurId },
      },
      { exiger: true },
    );
  }
  return { ok: true, decision };
}
