/**
 * Qualiopi — Server Actions Évaluations des acquis (T9).
 *
 * createEvaluationAcquisAction : enregistre une évaluation avec calcul automatique
 *   du score/niveau/réussite via l'AGENT A (evaluations-service).
 * genererAttestationAction : génère (ou renvoie) l'attestation d'un stagiaire
 *   via l'AGENT A (attestation-service). Idempotent si force=false.
 *
 * Pattern : garde d'habilitation + Zod + ActionResult + logQualiopiActivity.
 *
 * ⚠️ « garde d'habilitation », et non `requireAdminWrite` comme l'annonçait
 * cette ligne jusqu'au 2026-08-20 : les deux actions de ce module posent des
 * actes ENGAGEANTS — valider une évaluation finale fonde l'attestation, émettre
 * l'attestation engage l'organisme sur la réalisation. `requireAdminWrite`
 * autorise `editor`, et c'était faux pour les deux (`D6-1-C1`).
 * Voir src/server/actions/qualiopi/enrollments.ts comme référence.
 */

"use server";

import { z } from "zod";
import { requireHabilitation, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { genererAttestationPourEnrollment } from "@/server/qualiopi/evaluations/attestation-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const competenceSchema = z.object({
  libelle: z.string().min(1),
  note: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  observations: z.string().optional(),
  objectifRef: z.string().optional(),
});

const createEvaluationAcquisSchema = z.object({
  enrollmentId: z.string().uuid(),
  type: z.enum(["initiale", "intermediaire", "finale"]),
  dateEvaluation: z.string().min(1),
  competences: z.array(competenceSchema).min(1),
  recommandations: z.string().optional(),
});

const genererAttestationSchema = z.object({
  enrollmentId: z.string().uuid(),
  force: z.boolean().optional(),
  /**
   * 🔴 Motif d'une RECTIFICATION, saisi dans la console. [2026-08-04]
   *
   * Le bouton « régénérer » de l'attestation ne passait NI `force` NI motif :
   * la pièce ressortait donc filigranée COPIE. C'est très exactement ce qui a
   * produit `AXI-ATT-2026-004`, la version JUSTE marquée comme un duplicata,
   * pendant que la version FAUSSE gardait le rang d'original.
   *
   * Le motif vaut désormais intention de rectifier : il implique `force`.
   * Sans lui, rien ne change — une régénération non motivée reste une copie.
   */
  rectificationMotif: z.string().trim().min(10).max(500).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une évaluation des acquis pour une inscription.
 *
 * Délègue le calcul score/niveau/réussite à `createEvaluation` (AGENT A).
 * Trace dans l'audit trail (indicateur 11 Qualiopi).
 */
export async function createEvaluationAcquisAction(input: {
  enrollmentId: string;
  type: "initiale" | "intermediaire" | "finale";
  dateEvaluation: string;
  competences: Array<{
    libelle: string;
    note?: 1 | 2 | 3;
    observations?: string;
    objectifRef?: string;
  }>;
  recommandations?: string;
}): Promise<ActionResult<{ id: string }>> {
  // 🔴 `D6-1-C1` (2026-08-20) — c'était `requireAdminWrite()`, qui autorise
  // `editor` et `secretaire`. Or l'acte `valider_evaluation` EXISTE dans la
  // matrice depuis sa création, il est TESTÉ… et il n'était appelé NULLE PART.
  //
  // Ce que cela permettait : un `editor` saisit une évaluation finale, le moteur
  // en calcule `reussite`, et `attestation-service.ts` l'imprime tel quel sur
  // l'attestation — « Réussite : oui », score à l'appui. Le responsable qualité
  // qui émet ensuite la pièce est, lui, correctement gardé par `attester` : il
  // n'a aucun moyen de savoir que la donnée sous-jacente n'a été validée par
  // personne d'habilité.
  //
  // 🔑 Un acte déclaré que rien n'appelle est une garde qui n'existe pas. Sa
  // présence dans la matrice, et le test vert qui l'accompagne, faisaient
  // précisément croire l'inverse.
  //
  // ⚠️ La SAISIE par le formateur, elle, passe par
  // `evaluation-formateur.ts` : il évalue, l'organisme atteste. Les deux portes
  // sont distinctes et le restent.
  const session = await requireHabilitation("valider_evaluation");
  const parsed = createEvaluationAcquisSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let created: { id: string };
  try {
    created = await createEvaluation({
      enrollmentId: v.enrollmentId,
      type: v.type,
      dateEvaluation: v.dateEvaluation,
      // Zod retourne `T | undefined` pour les propriétés optionnelles → cast nécessaire
      // en exactOptionalPropertyTypes:true (les propriétés absentes ne sont pas undefined).
      competences: v.competences as Array<{
        libelle: string;
        note?: 1 | 2 | 3;
        observations?: string;
        objectifRef?: string;
      }>,
      ...(v.recommandations !== undefined ? { recommandations: v.recommandations } : {}),
      // Traçabilité de l'auteur : `evalueParId` était une colonne morte, jamais
      // écrite nulle part. Sans elle, impossible de démontrer qui a évalué —
      // sans effet avec un formateur unique, déterminant dès qu'ils sont plusieurs.
      ...(session.userId !== undefined ? { evalueParId: session.userId } : {}),
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erreur lors de la création de l'évaluation",
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.evaluation.create",
    targetType: "EvaluationAcquis",
    targetId: created.id,
    changes: {
      enrollmentId: v.enrollmentId,
      type: v.type,
      dateEvaluation: v.dateEvaluation,
      nbCompetences: v.competences.length,
    },
    session,
  });

  return { data: { id: created.id } };
}

/**
 * Génère (ou renvoie existante) l'attestation de réalisation d'un stagiaire.
 *
 * Délègue entièrement à `genererAttestationPourEnrollment` (AGENT A) :
 * classement présence, construction PDF, mise à jour Enrollment.
 * Idempotent sauf si `force=true`.
 */
export async function genererAttestationAction(input: {
  enrollmentId: string;
  force?: boolean;
  rectificationMotif?: string;
}): Promise<
  ActionResult<{ resultat: "complete" | "partielle" | "aucune"; documentId: string | null }>
> {
  // Acte ENGAGEANT : l'attestation atteste la realisation au nom de l'organisme.
  const session = await requireHabilitation("attester");
  const parsed = genererAttestationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let resultat: "complete" | "partielle" | "aucune";
  let documentId: string | null;
  try {
    // Un motif SAISI vaut intention de rectifier : il force la régénération.
    // Sans cette implication, l'humain aurait dû cocher une case en plus du
    // motif — et l'oublier aurait suffi à refabriquer une COPIE.
    const forcer = v.force === true || v.rectificationMotif !== undefined;
    const res = await genererAttestationPourEnrollment(v.enrollmentId, {
      ...(forcer ? { force: true } : {}),
      ...(v.rectificationMotif !== undefined ? { rectificationMotif: v.rectificationMotif } : {}),
    });
    resultat = res.resultat;
    documentId = res.documentId;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erreur lors de la génération de l'attestation",
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.attestation.generer",
    targetType: "Enrollment",
    targetId: v.enrollmentId,
    changes: { resultat, documentId, force: v.force ?? false },
    session,
  });

  return { data: { resultat, documentId } };
}
