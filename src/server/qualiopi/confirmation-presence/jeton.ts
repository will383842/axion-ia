/**
 * Chantier QNC, NC6 — le jeton de confirmation de présence.
 *
 * Il désigne UNE inscription (`resourceId` = `Enrollment.id`), jamais une
 * session : le lien d'un stagiaire ne répond que pour lui. Il expire au début
 * de la première demi-journée (une confirmation après le début n'a plus de
 * sens), plafonné à 30 jours. Le scope `presence_confirmation` est distinct de
 * `emargement` : un lien de signature ne confirme rien, et inversement.
 */

import { signMagicToken, verifyMagicToken, type VerifyFailReason } from "@/lib/magic-token";
import { TTL_MAX_JETON_PRESENCE_MS } from "./objets";

export async function emettreJetonPresence(
  enrollmentId: string,
  debutSession: Date,
): Promise<string> {
  const restant = debutSession.getTime() - Date.now();
  if (!(restant > 0)) {
    throw new RangeError("Jeton de présence : la session a déjà commencé.");
  }
  return signMagicToken({
    scope: "presence_confirmation",
    resourceId: enrollmentId,
    ttlMs: Math.min(restant, TTL_MAX_JETON_PRESENCE_MS),
  });
}

export type VerificationJetonPresence =
  | { readonly ok: true; readonly enrollmentId: string }
  | { readonly ok: false; readonly raison: VerifyFailReason };

export async function verifierJetonPresence(token: string): Promise<VerificationJetonPresence> {
  const r = await verifyMagicToken(token, { scope: "presence_confirmation" });
  if (!r.ok) return { ok: false, raison: r.reason };
  return { ok: true, enrollmentId: r.resourceId };
}
