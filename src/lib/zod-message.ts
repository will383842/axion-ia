/**
 * Message d'erreur exploitable à partir d'un `ZodError`.
 *
 * POURQUOI : les server actions Qualiopi retournaient toutes
 * `{ error: "Données invalides" }` en dur. Ajouter une validation SIRET sans
 * changer cela produirait une validation ACTIVE mais INEXPLOITABLE : l'admin
 * voit « Données invalides » sans savoir quel champ ni pourquoi, et n'a aucun
 * moyen de corriger. Le préfixe du chemin permet de distinguer « siret » de
 * « raisonSociale » quand plusieurs champs sont fautifs.
 *
 * Sûreté : réservé aux actions derrière `requireAdminWrite()` (surface
 * admin-only). Ne pas l'employer sur une route publique — les messages Zod par
 * défaut décrivent la forme attendue des données, information à ne pas offrir
 * à un visiteur anonyme.
 */

import type { ZodError } from "zod";

export function premierMessageZod(error: ZodError, repli = "Données invalides"): string {
  const issue = error.issues[0];
  if (issue === undefined) return repli;
  const champ = issue.path.join(".");
  return champ === "" ? issue.message : `${champ} — ${issue.message}`;
}
