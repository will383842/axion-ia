import "server-only";

/**
 * L'ACCUSÉ DE RÉCEPTION AUTOMATIQUE d'un MESSAGE (`Submission`) — lecture.
 *
 * ## Le défaut que ce module ferme (production, 2026-09-18)
 *
 * L'écran « Messages » affichait « SANS RÉPONSE » sur chaque ligne, et rien
 * d'autre : impossible de savoir si la personne avait au moins reçu l'accusé
 * automatique. Mesuré ce jour-là sur toute la boîte de réception : 196 accusés
 * partis sur 201 vérifiables — aucun ne se lisait dans la console.
 *
 * Couvre TOUS les messages, candidatures commerciales comprises (dossier
 * complet, premier contact apporteur) : ce sont des `Submission`, listées et
 * ouvertes par les mêmes composants.
 *
 * ## Ce que ce module rend
 *
 * L'état réel de l'accusé — jamais son contenu. Un accusé n'est PAS une
 * réponse : « Sans réponse » garde son sens, l'accusé s'affiche À CÔTÉ.
 *
 * 🔴 Le rattachement par ADRESSE DÉCHIFFRÉE, pas par `contact_email_hash` :
 * mesuré le 18/09, 7 dossiers apporteur sur 10 ont cette empreinte VIDE. Par
 * empreinte, ils auraient été déclarés « sans accusé » alors que l'accusé est
 * parti la même minute.
 *
 * Aucune garde de droit ici : l'appelant est la page de la console, déjà
 * gardée, qui affiche ces mêmes adresses en clair.
 */

import {
  ENTITE_MESSAGE,
  GABARITS_ACCUSE_MESSAGE,
  absenceVoulue,
} from "@/lib/contact/accuse-attendu";
import { lireAccuses } from "@/server/email/accuse-lecture";
import type { AccuseReception } from "@/server/email/accuse-noyau";

export interface MessagePourAccuse {
  readonly id: string;
  /** Adresse DÉCHIFFRÉE, telle qu'affichée. Vide si le déchiffrement a échoué. */
  readonly contactEmail: string;
  readonly submittedAt: Date;
  /** `details.origine` — dit si l'absence d'accusé est voulue. */
  readonly origine: string | null;
}

export interface AccuseMessage extends AccuseReception {
  /** Phrase dite quand l'absence est VOULUE, sinon `null`. */
  readonly absenceVoulue: string | null;
}

/**
 * Une absence n'est « voulue » que si RIEN n'est parti : un accusé trouvé ne
 * doit jamais être présenté comme une absence, même sur un dépôt qui n'en
 * attendait pas.
 */
export function avecAbsenceVoulue(accuse: AccuseReception, origine: string | null): AccuseMessage {
  return {
    ...accuse,
    absenceVoulue: accuse.etat === "absent" ? absenceVoulue({ origine }) : null,
  };
}

/** Les accusés d'une PAGE de messages, en UNE requête — jamais une par ligne. */
export async function lireAccusesMessages(
  messages: ReadonlyArray<MessagePourAccuse>,
): Promise<Map<string, AccuseMessage>> {
  const accuses = await lireAccuses(
    { entityType: ENTITE_MESSAGE, gabarits: GABARITS_ACCUSE_MESSAGE },
    messages.map((m) => ({ id: m.id, email: m.contactEmail, submittedAt: m.submittedAt })),
  );
  const resultat = new Map<string, AccuseMessage>();
  for (const m of messages) {
    const a = accuses.get(m.id);
    if (a) resultat.set(m.id, avecAbsenceVoulue(a, m.origine));
  }
  return resultat;
}

/** L'accusé d'UN message (fiche détail). `null` seulement si rien n'a pu être lu. */
export async function lireAccuseMessage(message: MessagePourAccuse): Promise<AccuseMessage | null> {
  return (await lireAccusesMessages([message])).get(message.id) ?? null;
}
