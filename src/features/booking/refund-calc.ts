// Refund calculation helper (Sprint X.15 / Booking V1).
//
// Module pur (no "use server") — utilisable depuis Server Components et
// Server Actions. Extrait de self-service-actions.ts pour respecter la
// contrainte Next 16 « tous les exports d'un fichier `"use server"` doivent
// être des fonctions async ».
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.15
//   - CGV grille refund V1 (cf. Sprint X.17 / Sous-processeurs RGPD)

import type { CancellationWindow } from "../../../prisma/generated/client";

export interface RefundCalculation {
  cancellationWindow: CancellationWindow;
  refundPercentage: number; // 0 | 50 | 100
}

/**
 * Calcule la fenêtre d'annulation et le pourcentage de refund applicable.
 * Règles V1 par défaut (override admin V1.5+) :
 *   - J-15+ → 50 % de l'acompte
 *   - 15j > diff ≥ 2j → 0 % (acompte conservé)
 *   - < J-2 → 0 % (acompte conservé)
 *   - force_majeure (déclaré par admin) → 100 % (géré ailleurs)
 */
export function computeRefundFromCancellation(opts: {
  bookingDate: Date;
  now: Date;
}): RefundCalculation {
  const diffMs = opts.bookingDate.getTime() - opts.now.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  if (diffDays >= 15) {
    return { cancellationWindow: "more_than_15d", refundPercentage: 50 };
  }
  if (diffDays >= 2) {
    return { cancellationWindow: "between_15d_and_2d", refundPercentage: 0 };
  }
  return { cancellationWindow: "less_than_2d", refundPercentage: 0 };
}
