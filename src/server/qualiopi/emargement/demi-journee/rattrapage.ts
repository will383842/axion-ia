/**
 * Chantier QNC, lot L06 — LE RATTRAPAGE N'EST PAS UN LIEN ROUVERT.
 *
 * Quand une demi-journée est close sans signature (téléphone éteint, réseau
 * absent, oubli), le lien du stagiaire ne se rouvre plus. L'organisme peut
 * alors SAISIR un rattrapage : une déclaration de présence, MOTIVÉE, faite par
 * une personne habilitée, et qui reste visible comme un ÉCART.
 *
 * Ce qu'un rattrapage est, et ce qu'il n'est pas :
 *   - il n'écrit AUCUNE signature : rien n'entre dans le tuple haché ni dans la
 *     chaîne de l'inscription (`emargement_signatures` reste celle du
 *     stagiaire) ;
 *   - il pose la présence du créneau (comme la grille manuelle) et ajoute la
 *     mention au commentaire du créneau, sans rien effacer de ce qui y était ;
 *   - il écrit, DANS LA MÊME TRANSACTION, sa trace au journal
 *     (`qualiopi.emargement.rattrapage`, `exiger: true`) : qui, quand, quel
 *     créneau, quel motif. Sans trace, pas de rattrapage. C'est cette trace
 *     que relisent les écarts (`ecarts.ts`).
 *
 * ⚠️ Le motif ne doit porter aucune information de santé : l'écran le dit.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import { recomputeTauxPresence } from "@/server/qualiopi/presence/presence-service";
import { emargementParDemiJourneePour } from "./activation";
import { positionFenetre, type PositionFenetre } from "./fenetre";

export const ACTION_RATTRAPAGE = "qualiopi.emargement.rattrapage" as const;

/** Même plancher que les motifs du socle (CHECK `btrim ≥ 10`). */
export const MOTIF_RATTRAPAGE_MIN = 10;
export const MOTIF_RATTRAPAGE_MAX = 500;

export type RefusRattrapage =
  | "creneau_introuvable"
  | "interrupteur_eteint"
  | "session_close"
  | "journee_non_declaree"
  | "motif_trop_court"
  | "motif_trop_long"
  | "demi_journee_non_close"
  | "deja_signe"
  | "deja_rattrape";

export const MESSAGE_REFUS_RATTRAPAGE: Readonly<Record<RefusRattrapage, string>> = {
  creneau_introuvable: "Créneau introuvable.",
  interrupteur_eteint:
    "L'émargement par demi-journée n'est pas allumé pour cette session : le rattrapage motivé n'y est pas ouvert.",
  session_close: "Cette session est annulée ou reportée : elle ne s'émarge plus.",
  journee_non_declaree: "Les horaires de cette journée ne sont pas déclarés.",
  motif_trop_court: `Le motif doit faire au moins ${MOTIF_RATTRAPAGE_MIN} caractères : dites ce qui s'est passé.`,
  motif_trop_long: `Le motif ne doit pas dépasser ${MOTIF_RATTRAPAGE_MAX} caractères.`,
  demi_journee_non_close:
    "Cette demi-journée n'est pas terminée : le stagiaire peut encore la signer par son lien.",
  deja_signe: "Cette demi-journée est déjà signée par le stagiaire : aucun rattrapage n'est utile.",
  deja_rattrape: "Un rattrapage est déjà consigné pour cette demi-journée.",
};

/** Pure : le rattrapage est-il recevable ? `null` = oui. */
export function refusRattrapage(e: {
  readonly actif: boolean;
  readonly sessionStatut: string;
  readonly position: PositionFenetre | null;
  readonly motif: string;
  readonly signee: boolean;
  readonly dejaRattrape: boolean;
}): RefusRattrapage | null {
  if (!e.actif) return "interrupteur_eteint";
  if (e.sessionStatut === "annulee" || e.sessionStatut === "reportee") return "session_close";
  if (e.position === null) return "journee_non_declaree";
  const motif = e.motif.trim();
  if (motif.length < MOTIF_RATTRAPAGE_MIN) return "motif_trop_court";
  if (motif.length > MOTIF_RATTRAPAGE_MAX) return "motif_trop_long";
  if (e.position !== "close") return "demi_journee_non_close";
  if (e.signee) return "deja_signe";
  if (e.dejaRattrape) return "deja_rattrape";
  return null;
}

/** La mention ajoutée au commentaire du créneau. */
export function mentionRattrapage(motif: string, le: Date): string {
  return `Rattrapage de l'organisme (${parisDateISO(le)}) — non signé par le stagiaire. Motif : ${motif.trim()}`;
}

export type ResultatRattrapage = { ok: true } | { ok: false; raison: RefusRattrapage };

/**
 * Consigne le rattrapage d'une demi-journée close et non signée.
 * L'habilitation (`attester`) se vérifie chez l'appelant.
 */
export async function saisirRattrapage(input: {
  readonly creneauId: string;
  readonly motif: string;
  readonly adminUserId: string;
  readonly maintenant?: Date;
}): Promise<ResultatRattrapage> {
  const maintenant = input.maintenant ?? new Date();
  const c = await prisma.presenceCreneau.findUnique({
    where: { id: input.creneauId },
    select: {
      id: true,
      date: true,
      demiJournee: true,
      dureePrevueMinutes: true,
      importId: true,
      commentaire: true,
      enrollmentId: true,
      enrollment: {
        select: {
          session: {
            select: {
              id: true,
              statut: true,
              estTestInterne: true,
              jours: { select: { date: true, heureDebut: true, heureFin: true } },
            },
          },
        },
      },
      emargementSignatures: { where: { revokedAt: null }, select: { id: true }, take: 1 },
    },
  });
  if (c === null) return { ok: false, raison: "creneau_introuvable" };

  const session = c.enrollment.session;
  const date = parisDateISO(c.date);
  const jour = session.jours.find((j) => parisDateISO(j.date) === date);
  const position =
    jour === undefined
      ? null
      : positionFenetre(
          {
            creneauId: c.id,
            date,
            demiJournee: c.demiJournee,
            jourHeureDebut: jour.heureDebut,
            jourHeureFin: jour.heureFin,
          },
          maintenant,
        );
  const dejaRattrape =
    (await prisma.activityLog.count({
      where: { action: ACTION_RATTRAPAGE, targetId: c.id },
    })) > 0;

  const refus = refusRattrapage({
    actif: await emargementParDemiJourneePour(session),
    sessionStatut: session.statut,
    position,
    motif: input.motif,
    signee: c.emargementSignatures.length > 0,
    dejaRattrape,
  });
  if (refus !== null) return { ok: false, raison: refus };

  const motif = input.motif.trim();
  const mention = mentionRattrapage(motif, maintenant);
  await prisma.$transaction(async (tx) => {
    await tx.presenceCreneau.update({
      where: { id: c.id },
      data: {
        present: true,
        // Un créneau issu d'un relevé de connexion garde sa durée mesurée.
        ...(c.importId === null ? { dureeRealiseeMinutes: c.dureePrevueMinutes } : {}),
        // Rien ne s'efface : la mention s'ajoute au commentaire existant.
        commentaire: c.commentaire ? `${c.commentaire}\n${mention}` : mention,
        enregistreParId: input.adminUserId,
      },
    });
    await journaliser(
      tx,
      {
        action: ACTION_RATTRAPAGE,
        targetType: "presence_creneau",
        targetId: c.id,
        changes: {
          sessionId: session.id,
          enrollmentId: c.enrollmentId,
          date,
          demiJournee: c.demiJournee,
          motif,
        },
        session: { userId: input.adminUserId },
      },
      { exiger: true },
    );
  });
  // Après commit, best-effort : le taux se recalcule, la preuve est déjà écrite.
  try {
    await recomputeTauxPresence(c.enrollmentId);
  } catch (err) {
    console.error(
      "[emargement] rattrapage consigné, taux de présence non recalculé :",
      err instanceof Error ? err.message : String(err),
    );
  }
  return { ok: true };
}
