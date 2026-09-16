/**
 * La SEULE porte par laquelle un détail de santé entre dans
 * `Trainee.handicapDetailsChiffre`.
 *
 * ## Pourquoi ce module existe
 *
 * La colonne a QUATRE chemins d'écriture : le questionnaire de positionnement,
 * le formulaire « mon compte » du portail, la création d'une fiche stagiaire en
 * console et sa modification. Chacun appelait `encryptPii` directement. Quatre
 * copies d'une protection, ce sont trois occasions de diverger — et elles
 * avaient divergé : un seul des quatre vérifiait que le chiffrement avait
 * réellement eu lieu.
 *
 * ## Ce que `encryptPii` fait, et qui surprend
 *
 * Elle n'échoue jamais. Elle a deux comportements possibles :
 *
 * - elle chiffre : la sortie porte le préfixe `enc:v1:` ET diffère de l'entrée ;
 * - elle rend l'entrée **INCHANGÉE**, dans trois cas : chaîne vide, texte qui
 *   porte DÉJÀ le préfixe (garde d'idempotence, voulue), et clé absente.
 *
 * Tester le préfixe de la sortie ne suffit donc pas : sur une entrée qui porte
 * déjà le préfixe, le test répond « c'est chiffré » alors que rien ne l'est.
 * Un contrôle qui valide le clair est pire que pas de contrôle — il fait croire
 * le trou fermé.
 *
 * `chiffrerDetailSante` teste la seule propriété qui compte : **le chiffrement
 * a-t-il transformé le texte ?** Cela couvre les trois cas d'un coup.
 *
 * ## Ce qu'une écriture non chiffrée coûterait
 *
 * La donnée de santé resterait en clair dans la colonne, dans les sauvegardes
 * et dans le miroir. Et toute relecture ultérieure lèverait — `decryptPii` voit
 * le préfixe, ne trouve pas ses trois segments, et jette — chez les trois
 * lecteurs, dont aucun ne l'attrape : le référent handicap, la page du portail
 * du bénéficiaire (qui ne pourrait donc plus se corriger lui-même), et l'export
 * du droit d'accès.
 */

import * as Sentry from "@sentry/nextjs";
import { encryptPii, isEncryptedPii } from "@/lib/pii-crypto";

/**
 * Un détail de santé est-il ACCEPTABLE à la saisie ?
 *
 * Le préfixe de chiffrement est interdit en tête : il déclencherait la garde
 * d'idempotence de `encryptPii` et empêcherait le chiffrement. À brancher sur
 * les schémas de validation, pour refuser tôt et avec un message clair — la
 * garde ci-dessous reste le dernier recours.
 */
export function detailSanteSaisissable(valeur: unknown): boolean {
  if (typeof valeur !== "string") return false;
  return !isEncryptedPii(valeur.trim());
}

/**
 * Chiffre un détail de santé, ou rend `null` si le chiffrement n'a RIEN
 * transformé. `null` veut dire : NE PAS ÉCRIRE. Jamais « écris le clair ».
 *
 * L'appelant décide quoi faire d'un refus — refuser l'action, ou n'écrire que
 * le reste — mais il ne peut pas écrire par inadvertance une valeur non
 * chiffrée : le type l'y oblige.
 */
export function chiffrerDetailSante(
  clair: string,
  contexte: { service: string; traineeId?: string },
): string | null {
  const chiffre = encryptPii(clair);

  if (!isEncryptedPii(chiffre) || chiffre === clair) {
    // Le texte n'a pas été transformé : clé absente, ou entrée déjà préfixée.
    // ⚠️ Le clair ne sort PAS d'ici — ni dans le message, ni dans les extras.
    Sentry.captureMessage("détail de santé : chiffrement indisponible, écriture refusée", {
      level: "error",
      tags: { service: contexte.service, etape: "chiffrement_detail_sante" },
      ...(contexte.traineeId !== undefined ? { extra: { traineeId: contexte.traineeId } } : {}),
    });
    return null;
  }

  return chiffre;
}
