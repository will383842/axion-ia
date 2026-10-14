/**
 * Formateurs indépendants — LE BILAN DE FIN DE FORMATION (lot G2) : lectures et écritures.
 *
 * Toutes les règles sont dans `regles.ts` (pur). Ici, pour un couple (session, formateur) :
 *   - `lireBilanFormateur` : ce que montre le bloc « Fin de formation » de l'espace ;
 *   - `enregistrerEvaluationFinaleFormateur` : l'évaluation finale d'UN stagiaire, par le
 *     service EXISTANT (`createEvaluation`, même barème, même donnée que la console),
 *     auteur = le formateur (`evalueParId` + journal) ; jamais en double ;
 *   - `enregistrerAvisFormateur` : son avis, par le service EXISTANT (`creerAppreciation`,
 *     qualité « formateur »), une seule fois par formateur et par session ;
 *   - `terminerBilanFormateur` : fige l'ensemble ;
 *   - `payerQuandMemeBilan` : le geste de l'administrateur, motivé et tracé.
 *
 * 🔒 Chaque écriture revérifie CÔTÉ SERVEUR : interrupteur allumé, formateur ayant animé
 * la session (`formateursDeLaSession`), formateur indépendant en nom propre, session non
 * annulée, dernière journée passée, et — pour une évaluation — stagiaire inscrit, actif et
 * présent DANS CETTE SESSION. La garde de l'espace (fin de collaboration) est celle de
 * l'action appelante.
 *
 * 🔴 ÉTEINT par défaut (`formateurs.bilan_fin_formation`) : rien n'est lu au-delà de
 * l'interrupteur. Aucune donnée personnelle dans les journaux : des identifiants.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { formateursDeLaSession } from "@/server/qualiopi/appreciations/formateurs-de-la-session";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { normaliserObjectifsPedagogiques } from "@/server/qualiopi/formations/objectifs";
import { creerAppreciation } from "@/server/qualiopi/portail/appreciation-service";
import { assertDossierOuvert } from "@/server/qualiopi/sessions/verrou-dossier-garde";

import { interrupteurAllume } from "../interrupteur-allume";
import { LIBELLE_MOTIF_FORMATION_INCOMPLETE } from "../paiement/formation-complete";
import { lireAllumageBilan } from "./allumage";
import {
  bilanExige,
  derniereJourneeDe,
  derniereJourneePassee,
  etatDuBilan,
  stagiairesAEvaluer,
  type EtatDuBilan,
} from "./regles";

export type IssueBilan =
  | "ok"
  | "eteint"
  | "introuvable"
  | "non_concerne"
  | "pas_encore"
  | "termine"
  | "stagiaire_inconnu"
  | "notes_invalides"
  | "deja_evalue"
  | "dossier_clos"
  | "avis_invalide"
  | "deja_donne"
  | "incomplet";

/** Le libellé d'un objectif quand la formation n'en déclare aucun. */
export const OBJECTIF_PAR_DEFAUT = "Objectifs de la formation";
export const AVIS_MIN = 10;
export const AVIS_MAX = 2000;
export const MOTIF_PAYER_MIN = 10;
export const MOTIF_PAYER_MAX = 500;

const STATUTS_SANS_BILAN = new Set(["annulee", "reportee"]);

// ─────────────────────────────────────────────────────────────────────────────
// Contexte commun et garde
// ─────────────────────────────────────────────────────────────────────────────

async function lireSession(sessionId: string) {
  return prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      statut: true,
      formateurPrincipalId: true,
      sessionFormateurs: { select: { trainerId: true } },
      jours: { select: { date: true, heureFin: true, trainerId: true } },
      formation: { select: { objectifsPedagogiques: true } },
    },
  });
}

type SessionLue = NonNullable<Awaited<ReturnType<typeof lireSession>>>;

type Garde =
  | { readonly ok: true; readonly session: SessionLue; readonly objectifs: string[] }
  | { readonly ok: false; readonly issue: IssueBilan };

/** La garde de TOUTE lecture et écriture du formateur. */
async function garder(sessionId: string, trainerId: string, maintenant: Date): Promise<Garde> {
  if (!(await interrupteurAllume("bilan_fin_formation"))) return { ok: false, issue: "eteint" };
  const session = await lireSession(sessionId);
  // Un formateur qui n'a pas animé la session reçoit la même réponse qu'une session
  // inconnue : il n'apprend rien de son existence.
  if (session === null || !formateursDeLaSession(session).includes(trainerId)) {
    return { ok: false, issue: "introuvable" };
  }
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { statut: true, organismeSousTraitantId: true },
  });
  if (
    trainer === null ||
    trainer.statut !== "sous_traitant" ||
    trainer.organismeSousTraitantId !== null ||
    STATUTS_SANS_BILAN.has(session.statut)
  ) {
    return { ok: false, issue: "non_concerne" };
  }
  if (!derniereJourneePassee(session.jours, maintenant)) return { ok: false, issue: "pas_encore" };
  const objectifs = normaliserObjectifsPedagogiques(session.formation?.objectifsPedagogiques);
  return { ok: true, session, objectifs: objectifs.length > 0 ? objectifs : [OBJECTIF_PAR_DEFAUT] };
}

/** Les inscrits de CETTE session (stagiaires effacés exclus), avec présence et finale. */
async function lireInscrits(sessionId: string) {
  const lignes = await prisma.enrollment.findMany({
    where: { sessionId, trainee: { deletedAt: null } },
    orderBy: [{ trainee: { nom: "asc" } }, { trainee: { prenom: "asc" } }],
    select: {
      id: true,
      statut: true,
      trainee: { select: { prenom: true, nom: true } },
      _count: {
        select: {
          presences: { where: { present: true } },
          emargementSignatures: { where: { revokedAt: null } },
        },
      },
      evaluations: {
        where: { type: "finale" },
        orderBy: { dateEvaluation: "desc" },
        take: 1,
        select: { id: true, niveauGlobal: true, scorePct: true, evalueParId: true },
      },
    },
  });
  return stagiairesAEvaluer(
    lignes.map((l) => ({
      enrollmentId: l.id,
      statut: l.statut as string,
      present: l._count.presences > 0 || l._count.emargementSignatures > 0,
      prenom: l.trainee.prenom,
      nom: l.trainee.nom,
      finale: l.evaluations[0] ?? null,
    })),
  );
}

/** La ligne du bilan, créée vide au premier geste (jamais supprimée). */
async function ligneBilan(sessionId: string, trainerId: string): Promise<{ id: string }> {
  return prisma.bilanFinFormation.upsert({
    where: { sessionId_trainerId: { sessionId, trainerId } },
    create: { sessionId, trainerId },
    update: {},
    select: { id: true },
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Verrou de la ligne : deux gestes simultanés du même formateur se suivent. */
async function verrouiller(tx: Tx, bilanId: string) {
  await tx.$queryRaw`SELECT id FROM "bilans_fin_formation" WHERE id = ${bilanId}::uuid FOR UPDATE`;
  return tx.bilanFinFormation.findUnique({
    where: { id: bilanId },
    select: { id: true, appreciationId: true, termineAt: true, payerQuandMemeAt: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture : le bloc de l'espace
// ─────────────────────────────────────────────────────────────────────────────

export interface VueBilan {
  readonly objectifs: readonly string[];
  readonly stagiaires: ReadonlyArray<{
    readonly enrollmentId: string;
    readonly prenom: string;
    readonly nom: string;
    readonly finale: { readonly niveauGlobal: string; readonly scorePct: number } | null;
  }>;
  readonly avis: { readonly note: number | null; readonly commentaire: string | null } | null;
  readonly termineAt: Date | null;
  readonly etat: EtatDuBilan;
  /** Le paiement (du dernier mois de la mission) attend-il ce bilan ? (session finie après l'allumage) */
  readonly attenduPourPaiement: boolean;
  /** Le motif affiché au formateur, le même que dans la console ; `null` s'il n'est pas attendu. */
  readonly motifPaiement: string | null;
}

/** `null` : aucun bloc (interrupteur éteint, pas son formateur, pas encore fini…). */
export async function lireBilanFormateur(
  sessionId: string,
  trainerId: string,
  maintenant: Date,
): Promise<VueBilan | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  try {
    const g = await garder(sessionId, trainerId, maintenant);
    if (!g.ok) return null;
    const [inscrits, bilan, allumeLe] = await Promise.all([
      lireInscrits(sessionId),
      prisma.bilanFinFormation.findUnique({
        where: { sessionId_trainerId: { sessionId, trainerId } },
        select: { appreciationId: true, termineAt: true, payerQuandMemeAt: true },
      }),
      lireAllumageBilan(prisma),
    ]);
    const avis =
      bilan?.appreciationId != null
        ? await prisma.appreciation.findUnique({
            where: { id: bilan.appreciationId },
            select: { note: true, commentaire: true },
          })
        : null;
    const derniere = derniereJourneeDe(g.session.jours);
    const attenduPourPaiement =
      derniere !== null &&
      bilan?.payerQuandMemeAt == null &&
      bilanExige({
        statut: "sous_traitant",
        organismeSousTraitantId: null,
        allumeLe,
        derniereJournee: derniere.jour,
      });
    return {
      objectifs: g.objectifs,
      stagiaires: inscrits.map((i) => ({
        enrollmentId: i.enrollmentId,
        prenom: i.prenom,
        nom: i.nom,
        finale:
          i.finale === null
            ? null
            : { niveauGlobal: String(i.finale.niveauGlobal), scorePct: i.finale.scorePct },
      })),
      avis:
        avis === null ? null : { note: avis.note ?? null, commentaire: avis.commentaire ?? null },
      termineAt: bilan?.termineAt ?? null,
      etat: etatDuBilan({
        stagiaires: inscrits.map((i) => ({
          enrollmentId: i.enrollmentId,
          finaleExiste: i.finale !== null,
        })),
        avisDonne: bilan?.appreciationId != null,
        termineAt: bilan?.termineAt ?? null,
      }),
      attenduPourPaiement,
      motifPaiement: attenduPourPaiement
        ? LIBELLE_MOTIF_FORMATION_INCOMPLETE.bilan_fin_formation_manquant
        : null,
    };
  } catch {
    // Le bloc ne doit jamais faire tomber la page de la session.
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Écritures du formateur
// ─────────────────────────────────────────────────────────────────────────────

export async function enregistrerEvaluationFinaleFormateur(i: {
  readonly sessionId: string;
  readonly trainerId: string;
  readonly enrollmentId: string;
  /** Une note par objectif, dans l'ordre des objectifs : 1 non acquis, 2 en cours, 3 acquis. */
  readonly notes: ReadonlyArray<number>;
  readonly maintenant: Date;
}): Promise<IssueBilan> {
  const g = await garder(i.sessionId, i.trainerId, i.maintenant);
  if (!g.ok) return g.issue;
  // Le stagiaire doit être inscrit, actif et présent DANS CETTE SESSION.
  const inscrits = await lireInscrits(i.sessionId);
  if (!inscrits.some((x) => x.enrollmentId === i.enrollmentId)) return "stagiaire_inconnu";
  if (
    i.notes.length !== g.objectifs.length ||
    !i.notes.every((n) => n === 1 || n === 2 || n === 3)
  ) {
    return "notes_invalides";
  }
  // ADR 0060 — même garde que la saisie de la console : dossier clos, aucune évaluation.
  const verrou = await assertDossierOuvert({ enrollmentId: i.enrollmentId });
  if (!verrou.ok) return "dossier_clos";

  const { id: bilanId } = await ligneBilan(i.sessionId, i.trainerId);
  return prisma.$transaction(async (tx) => {
    const bilan = await verrouiller(tx, bilanId);
    if (bilan?.termineAt != null) return "termine" as const;
    // Jamais doublée : une finale déjà saisie (console ou formateur) reste seule.
    const deja = await tx.evaluationAcquis.count({
      where: { enrollmentId: i.enrollmentId, type: "finale" },
    });
    if (deja > 0) return "deja_evalue" as const;
    const created = await createEvaluation(
      {
        enrollmentId: i.enrollmentId,
        type: "finale",
        dateEvaluation: i.maintenant.toISOString(),
        competences: g.objectifs.map((libelle, k) => ({
          libelle,
          note: i.notes[k] as 1 | 2 | 3,
          objectifRef: libelle,
        })),
        // L'auteur : le FORMATEUR (identifiant de sa fiche), tracé aussi au journal.
        evalueParId: i.trainerId,
      },
      tx,
    );
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.bilan_evaluation_finale",
        targetType: "EvaluationAcquis",
        targetId: created.id,
        changes: {
          sessionId: i.sessionId,
          trainerId: i.trainerId,
          nbCompetences: g.objectifs.length,
        },
        session: null,
      },
      { exiger: true },
    );
    return "ok" as const;
  });
}

export async function enregistrerAvisFormateur(i: {
  readonly sessionId: string;
  readonly trainerId: string;
  /** Facultative : un entier de 1 à 5. */
  readonly note?: number;
  readonly commentaire: string;
  readonly maintenant: Date;
}): Promise<IssueBilan> {
  const g = await garder(i.sessionId, i.trainerId, i.maintenant);
  if (!g.ok) return g.issue;
  const commentaire = i.commentaire.trim();
  if (
    commentaire.length < AVIS_MIN ||
    commentaire.length > AVIS_MAX ||
    (i.note !== undefined && (!Number.isInteger(i.note) || i.note < 1 || i.note > 5))
  ) {
    return "avis_invalide";
  }
  const { id: bilanId } = await ligneBilan(i.sessionId, i.trainerId);
  return prisma.$transaction(async (tx) => {
    const bilan = await verrouiller(tx, bilanId);
    if (bilan?.termineAt != null) return "termine" as const;
    if (bilan?.appreciationId != null) return "deja_donne" as const;
    const { id } = await creerAppreciation(
      {
        source: "formateur",
        trainerId: i.trainerId,
        ...(i.note !== undefined ? { note: i.note } : {}),
        commentaire,
        dateAppreciation: i.maintenant,
      },
      tx,
    );
    await tx.bilanFinFormation.update({ where: { id: bilanId }, data: { appreciationId: id } });
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.bilan_avis",
        targetType: "BilanFinFormation",
        targetId: bilanId,
        changes: {
          sessionId: i.sessionId,
          trainerId: i.trainerId,
          noteDonnee: i.note !== undefined,
        },
        session: null,
      },
      { exiger: true },
    );
    return "ok" as const;
  });
}

export async function terminerBilanFormateur(i: {
  readonly sessionId: string;
  readonly trainerId: string;
  readonly maintenant: Date;
}): Promise<IssueBilan> {
  const g = await garder(i.sessionId, i.trainerId, i.maintenant);
  if (!g.ok) return g.issue;
  const { id: bilanId } = await ligneBilan(i.sessionId, i.trainerId);
  const inscrits = await lireInscrits(i.sessionId);
  return prisma.$transaction(async (tx) => {
    const bilan = await verrouiller(tx, bilanId);
    if (bilan?.termineAt != null) return "termine" as const;
    const etat = etatDuBilan({
      stagiaires: inscrits.map((x) => ({
        enrollmentId: x.enrollmentId,
        finaleExiste: x.finale !== null,
      })),
      avisDonne: bilan?.appreciationId != null,
      termineAt: null,
    });
    if (!etat.peutTerminer) return "incomplet" as const;
    await tx.bilanFinFormation.update({
      where: { id: bilanId },
      data: { termineAt: i.maintenant },
    });
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.bilan_termine",
        targetType: "BilanFinFormation",
        targetId: bilanId,
        changes: { sessionId: i.sessionId, trainerId: i.trainerId, stagiaires: inscrits.length },
        session: null,
      },
      { exiger: true },
    );
    return "ok" as const;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Le geste de l'administrateur
// ─────────────────────────────────────────────────────────────────────────────

export type IssuePayerQuandMeme =
  "ok" | "eteint" | "introuvable" | "non_concerne" | "motif_invalide" | "deja_fait";

/**
 * « Payer quand même » : lève l'exigence du bilan pour CE formateur sur CETTE session
 * (jamais celle des feuilles), c'est-à-dire pour le relevé du dernier mois de la mission.
 * Réservé au formateur indépendant en nom propre, comme le bilan lui-même : un salarié, un
 * dirigeant ou un formateur d'organisme est refusé, comme une session annulée ou
 * reportée : aucune ligne n'est créée. Motif obligatoire ; auteur, date et motif posés
 * sur la ligne, l'acte tracé au journal (identifiants seuls). Aucun montant ne bouge.
 */
export async function payerQuandMemeBilan(i: {
  readonly sessionId: string;
  readonly trainerId: string;
  readonly adminUserId: string;
  readonly motif: string;
  readonly maintenant: Date;
}): Promise<IssuePayerQuandMeme> {
  if (!(await interrupteurAllume("bilan_fin_formation"))) return "eteint";
  const motif = i.motif.trim();
  if (motif.length < MOTIF_PAYER_MIN || motif.length > MOTIF_PAYER_MAX) return "motif_invalide";
  const session = await lireSession(i.sessionId);
  if (session === null || !formateursDeLaSession(session).includes(i.trainerId)) {
    return "introuvable";
  }
  const trainer = await prisma.trainer.findUnique({
    where: { id: i.trainerId },
    select: { statut: true, organismeSousTraitantId: true },
  });
  if (
    trainer === null ||
    trainer.statut !== "sous_traitant" ||
    trainer.organismeSousTraitantId !== null ||
    STATUTS_SANS_BILAN.has(session.statut)
  ) {
    return "non_concerne";
  }
  const { id: bilanId } = await ligneBilan(i.sessionId, i.trainerId);
  return prisma.$transaction(async (tx) => {
    const bilan = await verrouiller(tx, bilanId);
    if (bilan?.payerQuandMemeAt != null) return "deja_fait" as const;
    await tx.bilanFinFormation.update({
      where: { id: bilanId },
      data: {
        payerQuandMemeAt: i.maintenant,
        payerQuandMemeParId: i.adminUserId,
        payerQuandMemeMotif: motif,
      },
    });
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.bilan_payer_quand_meme",
        targetType: "BilanFinFormation",
        targetId: bilanId,
        changes: { sessionId: i.sessionId, trainerId: i.trainerId },
        session: { userId: i.adminUserId },
      },
      { exiger: true },
    );
    return "ok" as const;
  });
}
