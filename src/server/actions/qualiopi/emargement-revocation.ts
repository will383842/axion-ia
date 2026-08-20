/**
 * Révocation d'une signature d'émargement — la seule porte.
 *
 * 🔴 `D3-3-04` (audit E2E 2026-08-20). Aucune surface ne révoquait une signature
 * d'émargement : une signature apposée sur le mauvais nom était **définitive, et
 * scellée**. Les colonnes `revokedAt` / `revokedById` / `revokedMotif`
 * existaient, les huit lecteurs du registre filtraient déjà `revokedAt: null`,
 * et personne n'écrivait jamais ces colonnes.
 *
 * ## Habilitation
 *
 * `requireHabilitation("revoquer_signature")` — DIRECTION seule, et non le
 * responsable qualité. Celui-ci peut attester et valider, c'est-à-dire AJOUTER
 * de la preuve. Retirer sa valeur à une preuve déjà recueillie n'est pas le même
 * geste, et ne relève pas de la même responsabilité.
 *
 * ⚠️ `requireAdminWrite` aurait été FAUX ici : il autorise `editor`.
 *
 * ## Ce que l'action garantit et ce qu'elle ne fait pas
 *
 * Elle ne supprime rien : la ligne reste au registre avec son chaînage intact.
 * Elle exige un motif écrit. Et elle fait retomber `emargementSigneAt` quand
 * l'inscription n'a plus aucune signature vivante — sans quoi la conformité
 * continuerait d'affirmer « émargement réellement signé » sur une preuve
 * qu'on vient de retirer. Le détail du raisonnement vit dans
 * `emargement/revocation-service.ts`.
 */

"use server";

import { z } from "zod";
import { requireHabilitation, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { revoquerSignature, MOTIF_MIN } from "@/server/qualiopi/emargement/revocation-service";

const schema = z.object({
  signatureId: z.string().uuid(),
  motif: z.string().trim().min(MOTIF_MIN).max(2000),
});

export type RevocationResultat =
  { ok: true; emargementRetombe: boolean } | { ok: false; message: string };

export async function revoquerSignatureEmargementAction(input: {
  signatureId: string;
  motif: string;
}): Promise<RevocationResultat> {
  const session = await requireHabilitation("revoquer_signature");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    // Le message de zod est UTILE ici : il distingue « motif trop court » de
    // « identifiant invalide », et l'un des deux se corrige à l'écran.
    const premier = parsed.error.issues[0];
    return {
      ok: false,
      message:
        premier?.code === "too_small"
          ? `Le motif doit faire au moins ${MOTIF_MIN} caractères : c'est lui que l'auditeur lira pour comprendre pourquoi la preuve a été retirée.`
          : "Données invalides.",
    };
  }

  const res = await revoquerSignature(parsed.data.signatureId, parsed.data.motif, session.userId);
  if (!res.ok) return { ok: false, message: res.message };

  // 🔑 Le journal porte le MOTIF, pas seulement le fait. Une révocation dont on
  // ne peut plus dire pourquoi elle a eu lieu est, du point de vue de
  // l'auditeur, indiscernable d'une manipulation.
  await logQualiopiActivity({
    action: "qualiopi.emargement.signature_revoquee",
    targetType: "EmargementSignature",
    targetId: parsed.data.signatureId,
    changes: {
      motif: parsed.data.motif,
      enrollmentId: res.enrollmentId,
      // Retenu explicitement : c'est la conséquence de conformité, et elle
      // change ce que le certificat de réalisation peut affirmer.
      emargementSigneAtRetire: res.emargementRetombe,
    },
    session,
  });

  return { ok: true, emargementRetombe: res.emargementRetombe };
}
