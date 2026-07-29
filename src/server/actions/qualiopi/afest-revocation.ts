/**
 * Révocation d'une signature de SÉANCE AFEST, avec chiffrage d'impact.
 *
 * 🔴 `revoquerSignatureSeance` existait, était testée, et n'était appelable par
 * PERSONNE — vérifié : aucun appelant sous `src/app`, `src/components` ni
 * `src/server/actions`. Même défaut que la révocation document, corrigé en
 * PR 415. Cette action ferme le manque.
 *
 * ## Pourquoi elle chiffre l'impact AVANT et APRÈS, et le journalise
 *
 * Révoquer une signature de séance n'est pas un geste de registre isolé : en
 * régime `signature_reelle`, `heuresReellesSignees` ne compte QUE les séances
 * dont le bénéficiaire a signé. Retirer une signature retire donc des HEURES —
 * et les heures alimentent la facture, le BPF (R.6313-3), le certificat de
 * réalisation et l'attestation.
 *
 * Une correction légitime peut donc faire BAISSER un montant déjà appelé auprès
 * d'un OPCO ou de France Travail, ou rétrograder une attestation déjà remise.
 * Ce n'est pas une raison de l'interdire — c'est une raison de la RENDRE
 * VISIBLE. L'action mesure les heures avant, révoque, mesure après, et
 * journalise les deux avec l'écart.
 *
 * ⚠️ Elle ne corrige AUCUNE pièce déjà émise, et ne prétend pas le faire : elle
 * dit ce qui a bougé. Reprendre une facture ou une attestation est une décision,
 * pas une conséquence mécanique.
 *
 * ## Impact mesuré en production au 2026-07-30
 *
 * `coaching_seance_signatures` = **0 ligne**, `coaching_sessions` = **0
 * parcours**. Aucune donnée n'est aujourd'hui exposée à ce geste. Le garde-fou
 * est construit pour le jour où il y en aura, pas pour rattraper un existant.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import {
  revoquerSignatureSeance,
  type RefusRevocationSeance,
} from "@/server/qualiopi/coaching-afest/signature/signature-afest-service";
import {
  heuresReellesSignees,
  SEANCE_HEURES_SELECT,
  versSeancePourHeures,
} from "@/server/qualiopi/coaching-afest/heures";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";

export type RefusRevocationAfest =
  | RefusRevocationSeance
  | "role_insuffisant"
  | "motif_requis"
  | "parcours_introuvable";

export type ResultatRevocationAfest =
  | {
      ok: true;
      /** Heures retenues AVANT révocation, régime réel du parcours. */
      heuresAvant: number;
      heuresApres: number;
      /** Négatif ou nul. Zéro signifie que la séance n'était pas comptée. */
      deltaHeures: number;
    }
  | { ok: false; raison: RefusRevocationAfest; message: string };

/** Heures retenues pour un parcours, avec SON régime de preuve. */
async function heuresDuParcours(coachingId: string): Promise<number | null> {
  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingId },
    select: { regimePreuve: true, comptesRendus: { select: SEANCE_HEURES_SELECT } },
  });
  if (cs === null) return null;
  // 🔴 Le régime RÉEL du parcours, jamais un défaut : `legacy_boolean` et
  // `signature_reelle` ne comptent pas les mêmes séances, et se tromper de
  // régime produirait un « impact » faux dans le journal — pire qu'aucun.
  return heuresReellesSignees(cs.comptesRendus.map(versSeancePourHeures), cs.regimePreuve);
}

/**
 * Révoque une signature de séance et journalise l'écart d'heures qu'elle produit.
 *
 * ⚠️ Le motif est OBLIGATOIRE : une révocation sans motif est une preuve retirée
 * sans raison, et c'est précisément ce qu'un auditeur cherche à savoir.
 */
export async function revoquerSignatureSeanceAction(input: {
  signatureId: string;
  motif: string;
}): Promise<ResultatRevocationAfest> {
  const session = await requireAdminWrite();
  // Même exigence qu'à la signature : retirer une preuve du dossier engage
  // l'organisme autant que l'y verser. `requireAdminWrite` admet `editor`.
  if (session.role !== "super_admin" && session.role !== "admin") {
    return {
      ok: false,
      raison: "role_insuffisant",
      message:
        "Révoquer une signature retire une preuve du dossier : seuls un administrateur ou le dirigeant peuvent le faire.",
    };
  }

  const motif = input.motif.trim();
  if (motif === "") {
    return {
      ok: false,
      raison: "motif_requis",
      message: "Indiquez le motif de la révocation : sans lui, le registre ne dit rien.",
    };
  }

  const ligne = await prisma.coachingSeanceSignature.findUnique({
    where: { id: input.signatureId },
    select: { coachingId: true, role: true, compteRenduSeanceId: true },
  });
  if (ligne === null) {
    return { ok: false, raison: "signature_introuvable", message: "Signature introuvable." };
  }

  // ── Mesure AVANT ──
  const heuresAvant = await heuresDuParcours(ligne.coachingId);
  if (heuresAvant === null) {
    return { ok: false, raison: "parcours_introuvable", message: "Parcours introuvable." };
  }

  const res = await revoquerSignatureSeance({
    signatureId: input.signatureId,
    motif,
    parAdminId: session.userId,
  });
  if (!res.ok) return res;

  // ── Mesure APRÈS ──
  //
  // ⚠️ Relue, jamais déduite. Déduire « la séance faisait N minutes, donc on
  // retire N » supposerait connaître le régime, la neutralisation et l'absence
  // actée — trois règles qui vivent dans `heures.ts` et qui doivent y rester.
  const heuresApres = (await heuresDuParcours(ligne.coachingId)) ?? heuresAvant;
  const deltaHeures = Math.round((heuresApres - heuresAvant) * 100) / 100;

  await logQualiopiActivity({
    action: "qualiopi.afest.signature.revocation",
    targetType: "CoachingSeanceSignature",
    targetId: input.signatureId,
    changes: {
      coachingId: ligne.coachingId,
      compteRenduSeanceId: ligne.compteRenduSeanceId,
      role: ligne.role,
      motif,
      // 🔴 L'écart est la vraie information : c'est lui qui dit si une facture,
      // un BPF, un certificat ou une attestation devient inexact.
      heuresAvant,
      heuresApres,
      deltaHeures,
    },
    session,
  });

  if (deltaHeures !== 0) {
    // Une révocation qui change le comptage doit REMONTER : sans alerte, l'écart
    // n'existe que dans un journal que personne ne relit avant l'audit.
    Sentry.captureMessage("Révocation AFEST modifiant le comptage d'heures", {
      level: "warning",
      tags: { action: "revoquerSignatureSeanceAction" },
      extra: { coachingId: ligne.coachingId, heuresAvant, heuresApres, deltaHeures },
    });
  }

  return { ok: true, heuresAvant, heuresApres, deltaHeures };
}
