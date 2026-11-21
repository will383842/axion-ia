// ⚠️ PAS de `import "server-only"` : ce module est atteint par `envoyer-reponse.ts`, donc par
// la réponse automatique « poste pourvu » qui tourne dans le WORKER BullMQ (`tsx`, hors de
// Next). Gardé par `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`.

/**
 * LE RENDU D'UNE RÉPONSE À UN CANDIDAT — une seule fonction, deux appelants (lot I2-2).
 *
 * `ecrireEtEnfilerReponse` (envoi unitaire ET envoi groupé) et `apercuReponseCandidatAction`
 * appellent CETTE fonction avec les mêmes arguments. Un aperçu qui rendrait par un autre
 * chemin finirait par montrer autre chose que ce qui part.
 *
 * 🔑 Le rendu se fait avec le VRAI destinataire : l'adresse est déchiffrée ici, côté serveur,
 * et le pied de page porte SON lien d'opposition signé. Le HTML enregistré (`bodyHtml`) porte
 * donc un jeton personnel : tout affichage d'une réponse enregistrée le masque, et l'aperçu
 * renvoyé au navigateur passe par `masquerSecretsEmail` puis `rendreLiensInertes` (voir
 * `apercuReponseCandidatAction`).
 *
 * Ce module ne journalise rien, ne met rien en cache et ne trace jamais le HTML : l'appelant
 * décide quoi faire d'une erreur (il reçoit `cause`, jamais le HTML).
 */

import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { renderEmailTemplate } from "@/lib/email/templates";
import { lienSuppressionCandidature } from "@/server/careers/lien-suppression-candidature";
import type { Locale } from "../../../prisma/generated/client";

/** Le dossier, réduit à ce dont le rendu a besoin. */
export interface CandidatureARendre {
  id: string;
  /** Adresse CHIFFRÉE, telle qu'en base. */
  email: string;
  locale: Locale;
  offerTitleSnap: string | null;
}

/** Ce que l'auteur a saisi (corps déjà rempli : `{lien_complement}` est résolu). */
export interface SaisieReponse {
  subject: string;
  bodyMarkdown: string;
}

export type RenduReponseCandidat =
  | {
      ok: true;
      subject: string;
      html: string;
      text: string;
      /** Adresse déchiffrée : usage serveur seulement, jamais renvoyée telle quelle au navigateur. */
      destinataire: string;
    }
  | { ok: false; error: "invalid_recipient" }
  | { ok: false; error: "render_failed"; cause: unknown };

export async function rendreReponseCandidat(
  candidature: CandidatureARendre,
  saisie: SaisieReponse,
): Promise<RenduReponseCandidat> {
  // Pré-vol : une adresse illisible (clé absente → substitut) échoue AVANT tout rendu.
  const destinataire = decryptPii(candidature.email);
  if (!isDecryptedEmailUsable(destinataire)) return { ok: false, error: "invalid_recipient" };

  try {
    // Le lien « Supprimer ma candidature » est figé dans le HTML, avec un jeton qui vit
    // plus longtemps que le dossier.
    const lienSuppression = await lienSuppressionCandidature(candidature.id);
    const rendu = await renderEmailTemplate(
      "candidature-reponse",
      candidature.locale,
      {
        subject: saisie.subject,
        bodyMarkdown: saisie.bodyMarkdown,
        offerTitle: candidature.offerTitleSnap,
        ...(lienSuppression ? { lienSuppression } : {}),
      },
      { destinataire },
    );
    return { ok: true, subject: rendu.subject, html: rendu.html, text: rendu.text, destinataire };
  } catch (cause) {
    return { ok: false, error: "render_failed", cause };
  }
}
