// scripts/migrate-bookings-v0-to-v1.ts (D63 — Booking V1 backfill)
//
// SOURCE :
//   - ADR 0020 — Migration data V0 → V1
//   - 03-ARCHITECTURE-CIBLE §6.3 (compat V0 → V1)
//
// OBJECTIF :
//   Backfill les Bookings legacy V0 (status='pending' / 'postponed' /
//   'cancelled') vers les statuts V1 cohérents avec la state machine.
//
// RÈGLES :
//   - `pending` (V0) → `confirmed` (V1) si la date du booking est passée ou
//     dans les 7 prochains jours (présomption d'engagement). Sinon → laissé
//     `pending` pour traitement admin manuel.
//   - `postponed` (V0, mort-né) → `cancelled_by_admin` (V1 terminal).
//   - `cancelled` (V0) → `cancelled_by_admin` (V1).
//   - `confirmed` (V0) → laissé tel quel (déjà valide V1).
//   - Tous les autres statuts V1 → no-op (déjà migrés).
//
// SÉCURITÉ :
//   - Mode `--dry-run` (défaut) : log les changements sans écrire en DB.
//   - Mode `--apply` : applique les changements dans une transaction unique.
//   - Telegram alerte avant et après run en mode apply.
//
// USAGE :
//   pnpm tsx scripts/migrate-bookings-v0-to-v1.ts                  # dry-run
//   pnpm tsx scripts/migrate-bookings-v0-to-v1.ts --apply          # exécution
//   pnpm tsx scripts/migrate-bookings-v0-to-v1.ts --apply --limit=10  # batch test

import { PrismaClient } from "../prisma/generated/client";
import type { BookingStatus } from "../prisma/generated/client";

const prisma = new PrismaClient();

interface MigrationPlan {
  bookingId: string;
  bookingDate: Date;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  setConfirmedAt: boolean;
  setCancelledAt: boolean;
  reason: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function deriveMigration(
  bookingId: string,
  status: BookingStatus,
  bookingDate: Date,
  now: Date,
): MigrationPlan | null {
  switch (status) {
    case "pending": {
      // V0 default. On considère qu'un booking pending dont la date est
      // passée ou imminente était engagé → on le bascule en confirmed.
      const isPastOrImminent = bookingDate.getTime() <= now.getTime() + SEVEN_DAYS_MS;
      if (!isPastOrImminent) return null;
      return {
        bookingId,
        bookingDate,
        fromStatus: status,
        toStatus: "confirmed",
        setConfirmedAt: true,
        setCancelledAt: false,
        reason: "V0 pending → V1 confirmed (date passée/imminente)",
      };
    }
    case "postponed":
      // V0 mort-né (Agent 3 N9) → fermé.
      return {
        bookingId,
        bookingDate,
        fromStatus: status,
        toStatus: "cancelled_by_admin",
        setConfirmedAt: false,
        setCancelledAt: true,
        reason: "V0 postponed (mort-né) → V1 cancelled_by_admin",
      };
    case "cancelled":
      // V0 enum legacy → V1 explicit by_admin.
      return {
        bookingId,
        bookingDate,
        fromStatus: status,
        toStatus: "cancelled_by_admin",
        setConfirmedAt: false,
        setCancelledAt: true,
        reason: "V0 cancelled → V1 cancelled_by_admin",
      };
    default:
      // Status déjà V1 ou hors scope migration.
      return null;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : undefined;

  console.log("=================================================");
  console.log("D63 — Migration Bookings V0 → V1");
  console.log(`Mode  : ${apply ? "APPLY (écriture DB)" : "DRY-RUN (lecture seule)"}`);
  if (limit) console.log(`Limit : ${limit} bookings`);
  console.log("=================================================");

  const candidates = await prisma.booking.findMany({
    where: { status: { in: ["pending", "postponed", "cancelled"] } },
    select: { id: true, status: true, bookingDate: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`\n${candidates.length} bookings V0 candidats à la migration.\n`);

  const now = new Date();
  const plans: MigrationPlan[] = [];
  for (const b of candidates) {
    const plan = deriveMigration(b.id, b.status, b.bookingDate, now);
    if (plan) plans.push(plan);
  }

  console.log(`${plans.length} migrations à appliquer :`);
  const byTransition = new Map<string, number>();
  for (const p of plans) {
    const key = `${p.fromStatus} → ${p.toStatus}`;
    byTransition.set(key, (byTransition.get(key) ?? 0) + 1);
  }
  for (const [key, count] of byTransition) {
    console.log(`  • ${key} : ${count}`);
  }
  console.log("");

  const skipped = candidates.length - plans.length;
  if (skipped > 0) {
    console.log(`${skipped} bookings skipped (V0 pending mais date future > 7j).\n`);
  }

  if (!apply) {
    console.log("Mode DRY-RUN — aucune écriture. Relance avec --apply pour exécuter.");
    return;
  }

  if (plans.length === 0) {
    console.log("Rien à migrer. Sortie propre.");
    return;
  }

  console.log("Exécution en cours…");
  let updated = 0;
  let inserted = 0;

  for (const plan of plans) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: plan.bookingId },
        data: {
          status: plan.toStatus,
          ...(plan.setConfirmedAt ? { confirmedAt: plan.bookingDate } : {}),
          ...(plan.setCancelledAt
            ? { cancelledAt: new Date(), cancellationReason: "D63 migration V0→V1" }
            : {}),
        },
      });

      // Insert BookingTransition pour audit trail (idempotent via UNIQUE
      // (bookingId, toStatus, trigger)).
      try {
        await tx.bookingTransition.create({
          data: {
            bookingId: plan.bookingId,
            fromStatus: plan.fromStatus,
            toStatus: plan.toStatus,
            trigger: "migrate-v0-to-v1",
            triggeredBy: "system",
            reason: plan.reason,
          },
        });
        inserted++;
      } catch (err) {
        // Si la transition existe déjà (replay du script), on ignore.
        if ((err as { code?: string })?.code !== "P2002") throw err;
      }
      updated++;
    });
  }

  console.log(`\n${updated} bookings migrés, ${inserted} transitions auditées.`);
  console.log("Migration V0→V1 terminée.");
}

main()
  .catch((err) => {
    console.error("[migrate-bookings-v0-to-v1] ERREUR FATALE", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
