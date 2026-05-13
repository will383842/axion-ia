// Sprint X.5 — Multi-options simultanées (ADR 0017).
//
// Cap configurable de BookingOptions concurrentes par CalendarSlot.
// Permet à plusieurs visiteurs de poser une option 48h sur le même créneau ;
// l'admin choisit ensuite laquelle valider (les autres deviennent
// `lost_other_won`).
//
// Cap par défaut : 3 (ADR 0017). Override via env
// `BOOKING_MAX_CONCURRENT_OPTIONS_PER_SLOT`.
//
// Statuts d'option considérés "actifs" (qui consomment un slot du cap) :
//   - `pending` (V0 legacy, encore créé par postOption48hAction)
//   - `pending_validation` (V1)
//   - `validated` (V1 — réservé, en attente acompte/contrat)
//
// Statuts terminaux (libèrent le slot du cap) :
//   - `refused`, `expired`, `expired_no_response`, `lost_other_won`,
//     `converted`, `awaiting_winner_payment` (hook V1.5+).

import type { BookingOptionStatus, Prisma } from "../../../prisma/generated/client";

const DEFAULT_MAX_CONCURRENT_OPTIONS = 3;

/**
 * Lit le cap configuré (env override → défaut 3). Parse safe : si valeur
 * négative, zéro, ou non-numérique → fallback default.
 */
export function getMaxConcurrentOptionsPerSlot(): number {
  const raw = process.env["BOOKING_MAX_CONCURRENT_OPTIONS_PER_SLOT"];
  if (!raw) return DEFAULT_MAX_CONCURRENT_OPTIONS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_CONCURRENT_OPTIONS;
  return n;
}

/**
 * Statuts BookingOption considérés "actifs" — comptent contre le cap.
 * Cohérent avec admin actions qui terminent ces options (ex:
 * `lost_other_won` après validation d'un concurrent).
 */
export const ACTIVE_OPTION_STATUSES: ReadonlyArray<BookingOptionStatus> = [
  "pending",
  "pending_validation",
  "validated",
];

/**
 * Compte les options actives sur un slot. À appeler DANS la même transaction
 * qui SELECT FOR UPDATE le slot, sinon race possible.
 */
export async function countActiveOptionsForSlot(
  tx: Prisma.TransactionClient,
  slotId: string,
): Promise<number> {
  return tx.bookingOption.count({
    where: {
      slotId,
      status: { in: [...ACTIVE_OPTION_STATUSES] },
    },
  });
}
