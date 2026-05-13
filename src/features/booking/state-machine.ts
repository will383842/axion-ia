// State machine Booking V1 (Sprint X.4)
//
// SOURCE :
//   - Agent 3 § State machine + invariants TS1-TS20
//   - 03-ARCHITECTURE-CIBLE.md §5.1.18 (BookingStatus enum) + §5.1.20 (BookingTransition)
//   - 04-PLAN-EXECUTION Sprint X.4 § « Périmètre — Helper `src/features/booking/state-machine.ts` »
//   - Agent 8 P1-3 (audit log immutable changesJson snapshot)
//
// PRINCIPES :
//   1. **Whitelist explicite** — TRANSITIONS = `Record<from, ReadonlyArray<to>>`.
//      Toute transition non listée → refus immédiat. Pas de fallback "tout autorisé".
//   2. **Audit log immutable** — chaque applyTransition() insère une ligne
//      `BookingTransition` (event sourcing). UNIQUE partiel
//      `(bookingId, toStatus, trigger)` garantit l'idempotence (un même trigger
//      ne produit pas 2 transitions identiques).
//   3. **Atomicité** — applyTransition() prend un `Prisma.TransactionClient` pour
//      que le caller groupe la transition avec les side-effects (création Invoice,
//      libération slot, etc.) dans la même tx.
//   4. **Statut terminal** — certains statuts ne sortent jamais (`archived`,
//      `paid_balance`, `refunded_full`, `disputed`). Listés dans TERMINAL_STATES.

import type {
  Prisma,
  BookingStatus,
  TransitionTriggeredBy,
} from "../../../prisma/generated/client";
import { Prisma as PrismaRuntime } from "../../../prisma/generated/client";

// ============================================================
// Types & constantes
// ============================================================

/**
 * Statuts terminaux — aucune transition n'en sort.
 * Note : `disputed` est terminal en V1 (recouvrement hors-app Will).
 */
export const TERMINAL_STATES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  "archived",
  "paid_balance",
  "refunded_full",
  "refunded_partial",
  "disputed",
  "lost_other_won",
  "expired_no_response",
  "refused",
  "quote_declined",
  "cadrage_declined",
  "cancelled",
  "cancelled_by_user",
  "cancelled_by_admin",
  "no_show",
  "force_majeure",
]);

/**
 * Whitelist des transitions autorisées. Lue : `clé from → array of allowed to`.
 *
 * Référence : Agent 3 § State machine, Sprint X.4 spec.
 * Update guideline : toute modification de la table doit :
 *   1. Référer un finding Agent 3 / Décision Will
 *   2. Avoir un test TS correspondant (state-machine.test.ts)
 *   3. Être mentionnée dans BUILD-STATE.md
 */
export const TRANSITIONS: Readonly<Record<BookingStatus, ReadonlyArray<BookingStatus>>> = {
  // ----- V0 legacy (avant migration V0→V1) -----
  pending: ["option_pending", "cancelled_by_admin"],
  postponed: [], // mort-né (Agent 3 N9) — drop migration X.4

  // ----- Parcours visiteur -----
  draft: ["option_pending"], // état UI uniquement
  option_pending: [
    "cadrage_scheduled", // cadrage requis (cas standard)
    "contract_pending", // skip cadrage si audit_flash_onsite (I3)
    "lost_other_won", // autre option du même slot validée
    "refused", // refus admin
    "expired_no_response", // cron expiration
  ],
  lost_other_won: [], // terminal
  refused: [], // terminal
  expired_no_response: [], // terminal

  // ----- Cadrage -----
  cadrage_scheduled: ["cadrage_held", "cancelled_by_user", "cancelled_by_admin"],
  cadrage_held: [
    "quote_required", // requiresQuote=true (I4)
    "contract_pending", // pas de devis, direct contrat
    "cadrage_declined", // validationDecision=not_pertinent (I7)
  ],
  cadrage_declined: [], // terminal

  // ----- Devis (Will-A semi-auto) -----
  quote_required: ["quote_sent"],
  quote_sent: ["quote_signed", "quote_declined"],
  quote_signed: ["contract_pending"],
  quote_declined: [], // terminal

  // ----- Contrat + acompte (D49-D50-D51) -----
  contract_pending: ["contract_payment_sent", "cancelled_by_admin"],
  contract_payment_sent: [
    "contract_signed", // DocuSeal signed (pas bloquant pour la suite)
    "awaiting_admin_validation", // acompte reçu (Stripe OU manual) — D50 critère unique
    "cancelled_by_admin",
    "cancelled_by_user",
  ],
  contract_signed: ["awaiting_admin_validation", "cancelled_by_admin", "cancelled_by_user"],
  awaiting_admin_validation: ["confirmed", "cancelled_by_admin"], // I6ter — clic Will 2

  // ----- Cycle de vie confirmé -----
  confirmed: [
    "paused", // D61 — reschedule durée indéterminée
    "reminded_j7", // cron J-7
    "in_progress", // jour J
    "cancelled_by_user", // self-service magic-link
    "cancelled_by_admin",
    "no_show",
    "force_majeure",
    "installment_overdue", // D59 — retard 30j 2e/3e échéance
  ],
  paused: ["confirmed", "cancelled_by_user", "cancelled_by_admin", "force_majeure"], // D61 bidirectionnel
  reminded_j7: [
    "in_progress",
    "cancelled_by_user",
    "cancelled_by_admin",
    "no_show",
    "force_majeure",
  ],
  in_progress: ["completed", "no_show", "force_majeure"],
  completed: ["invoiced_balance", "paid_balance"], // selon échéancier
  invoiced_balance: ["paid_balance", "installment_overdue"],
  installment_overdue: ["paid_balance", "disputed"], // D59 escalade J+45
  paid_balance: ["archived"], // terminal succès (archived après 12 mois)
  disputed: [], // terminal (recouvrement hors-app, Will marque résolu manuel)
  archived: [], // terminal rétention
  cancelled: [], // V0 legacy — drop après migration
  cancelled_by_user: ["refunded_partial", "refunded_full"],
  cancelled_by_admin: ["refunded_partial", "refunded_full", "archived"],
  no_show: ["invoiced_balance", "archived"], // acompte conservé + facture solde
  force_majeure: ["refunded_full"], // refund 100%
  refunded_partial: [], // terminal
  refunded_full: [], // terminal
};

// ============================================================
// Helpers purs (testables sans DB)
// ============================================================

/**
 * Vérifie si une transition est autorisée par la whitelist.
 * Pure — ne touche pas à la DB. Utiliser avant `applyTransition()` ou pour
 * filtrer les actions affichables côté admin UI.
 */
export function isTransitionAllowed(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Throw si la transition n'est pas autorisée. Utilisé par les Server Actions
 * avant tout side-effect. Le message contient le contexte (from → to) pour
 * debug, mais reste neutre côté UI (le caller doit mapper sur un code propre).
 */
export function assertTransitionAllowed(from: BookingStatus, to: BookingStatus): void {
  if (!isTransitionAllowed(from, to)) {
    throw new StateMachineError(
      `Transition non autorisée : ${from} → ${to}`,
      "transition_not_allowed",
    );
  }
}

/**
 * `true` si le statut est terminal (aucune transition sortante).
 */
export function isTerminalState(status: BookingStatus): boolean {
  return TERMINAL_STATES.has(status);
}

// ============================================================
// Erreurs typées
// ============================================================

export type StateMachineErrorCode =
  | "transition_not_allowed"
  | "booking_not_found"
  | "booking_status_mismatch"
  | "transition_duplicate"; // idempotence — déjà appliquée pour ce trigger

export class StateMachineError extends Error {
  readonly code: StateMachineErrorCode;
  constructor(message: string, code: StateMachineErrorCode) {
    super(message);
    this.name = "StateMachineError";
    this.code = code;
  }
}

// ============================================================
// applyTransition — atomique + audit log
// ============================================================

export interface ApplyTransitionOptions {
  /** Statut cible. */
  to: BookingStatus;
  /**
   * Identifiant logique du trigger (ex. `admin.send_contract`,
   * `webhook.stripe.checkout_completed`, `cron.j7_reminder`). Voir doc
   * `BookingTransition.trigger` pour la convention de nommage.
   * Combinaison UNIQUE `(bookingId, toStatus, trigger)` garantit
   * l'idempotence (rejouer le même webhook = no-op).
   */
  trigger: string;
  triggeredBy: TransitionTriggeredBy;
  /** UUID admin si triggeredBy=admin, UUID user si triggeredBy=client, sinon null. */
  triggeredById?: string | null;
  /** Raison libre (visible audit log). */
  reason?: string;
  /** Notes internes additionnelles. */
  notes?: string;
  /** Snapshot fields-diff (Agent 8 P1-3). */
  snapshotBefore?: Prisma.JsonValue;
  snapshotAfter?: Prisma.JsonValue;
  /**
   * Si true : refuse silencieusement (return) plutôt que throw quand la
   * transition est déjà appliquée pour ce trigger. Utile pour les workers
   * Stripe qui rejouent les events.
   */
  ignoreDuplicate?: boolean;
}

/**
 * Applique une transition de statut Booking + insère un BookingTransition.
 *
 * **Le caller DOIT** :
 *   - Passer un `Prisma.TransactionClient` (`prisma.$transaction(async tx => ...)`)
 *     pour grouper la transition avec ses side-effects.
 *   - Vérifier au préalable que le `fromStatus` est attendu (anti-race
 *     condition). On le re-vérifie ici par `Booking.findUnique` + assert,
 *     mais idéalement le caller `SELECT … FOR UPDATE` le booking.
 *
 * @throws StateMachineError(transition_not_allowed) si la whitelist refuse.
 * @throws StateMachineError(booking_not_found) si le bookingId n'existe pas.
 * @throws StateMachineError(transition_duplicate) si le trigger a déjà créé
 *   une transition vers ce toStatus (sauf `ignoreDuplicate=true`).
 */
export async function applyTransition(
  tx: Prisma.TransactionClient,
  bookingId: string,
  opts: ApplyTransitionOptions,
): Promise<void> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { status: true },
  });
  if (!booking) {
    throw new StateMachineError(`Booking ${bookingId} introuvable`, "booking_not_found");
  }

  const from = booking.status;
  assertTransitionAllowed(from, opts.to);

  // Idempotence : INSERT BookingTransition. UNIQUE
  // `(bookingId, toStatus, trigger)` empêche le doublon.
  try {
    await tx.bookingTransition.create({
      data: {
        bookingId,
        fromStatus: from,
        toStatus: opts.to,
        trigger: opts.trigger,
        triggeredBy: opts.triggeredBy,
        triggeredById: opts.triggeredById ?? null,
        reason: opts.reason ?? null,
        notes: opts.notes ?? null,
        snapshotBefore: opts.snapshotBefore ?? Prisma_JsonNull(),
        snapshotAfter: opts.snapshotAfter ?? Prisma_JsonNull(),
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      // UNIQUE conflict = transition déjà appliquée pour ce trigger.
      if (opts.ignoreDuplicate) return;
      throw new StateMachineError(
        `Transition ${from} → ${opts.to} déjà appliquée pour trigger=${opts.trigger}`,
        "transition_duplicate",
      );
    }
    throw err;
  }

  await tx.booking.update({
    where: { id: bookingId },
    data: { status: opts.to },
  });
}

// ============================================================
// Helper Prisma.JsonNull (runtime import via `PrismaRuntime` au top du
// fichier — l'import type-only `Prisma` ne porte pas la valeur runtime
// `Prisma.JsonNull`, d'où le second import non-type).
// ============================================================

function Prisma_JsonNull(): Prisma.NullableJsonNullValueInput {
  return PrismaRuntime.JsonNull;
}
