/**
 * CHANTIER QNC, LOT L02 — UN ESSAI N'ATTEINT AUCUN CANAL EXTERNE.
 *
 * Chaque porte de sortie (facture électronique, facture automatique,
 * commission d'apporteur, autofacture, Axion Partners, alertes Telegram /
 * WhatsApp, e-mail hors liste blanche) consulte le drapeau d'essai de la
 * session, de l'inscription ou de la facture qu'elle s'apprête à faire sortir,
 * et s'arrête. L'arrêt est JOURNALISÉ (`activity_logs`, action
 * `qualiopi.essai.sortie_bloquee`) : un essai doit pouvoir montrer ce qu'il
 * aurait envoyé, et à qui il ne l'a pas envoyé.
 *
 * Le journal ne porte jamais d'adresse : une empreinte, au plus.
 *
 * Tolérant : un journal raté n'ouvre pas la porte. La sortie reste bloquée,
 * l'échec du journal est seulement signalé dans les journaux du processus.
 */

import { prisma } from "@/lib/prisma";
import { journaliser, type ClientJournal } from "@/server/journal/journaliser";

/** Les canaux externes qu'un essai ne franchit pas. */
export const CANAUX_EXTERNES = [
  "email",
  "facture_electronique",
  "facture_automatique",
  "autofacture",
  "commission_apporteur",
  "partners",
  "telegram",
  "whatsapp",
] as const;

export type CanalExterne = (typeof CANAUX_EXTERNES)[number];

export interface SortieBloquee {
  readonly canal: CanalExterne;
  /** Type de la cible (`TrainingSession`, `Enrollment`, `FactureFormation`…). */
  readonly cibleType: string;
  /** Identifiant UUID de la cible, si elle en a un. */
  readonly cibleId?: string | null;
  /** Ce qui aurait été envoyé (gabarit, type d'évènement…), sans donnée personnelle. */
  readonly objet?: string;
  /** Pour un e-mail : empreintes des destinataires bloqués. */
  readonly empreintes?: ReadonlyArray<string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Journalise une sortie bloquée. Ne lève jamais. */
export async function journaliserSortieBloquee(
  sortie: SortieBloquee,
  client: ClientJournal = prisma,
): Promise<void> {
  const cibleId = sortie.cibleId != null && UUID.test(sortie.cibleId) ? sortie.cibleId : null;
  try {
    const ecrit = await journaliser(client, {
      action: "qualiopi.essai.sortie_bloquee",
      targetType: sortie.cibleType,
      targetId: cibleId,
      changes: {
        canal: sortie.canal,
        ...(sortie.objet !== undefined ? { objet: sortie.objet } : {}),
        ...(sortie.empreintes !== undefined ? { emailHashes: [...sortie.empreintes] } : {}),
      },
      session: null,
    });
    if (!ecrit) {
      console.warn(`[qualiopi.essai] sortie ${sortie.canal} bloquée, journal non écrit`);
    }
  } catch (err) {
    console.warn(`[qualiopi.essai] sortie ${sortie.canal} bloquée, journal en échec`, err);
  }
}

/**
 * Exécute une sortie externe SAUF pour un essai : dans ce cas rien ne part,
 * le refus est journalisé et la fonction rend `null`.
 */
export async function sortieSaufEssai<T>(
  essai: boolean,
  sortie: SortieBloquee,
  envoyer: () => Promise<T>,
): Promise<T | null> {
  if (!essai) return envoyer();
  await journaliserSortieBloquee(sortie);
  return null;
}
