// Refonte admin mai 2026 — PR 6b (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Calendrier reschedule V2 — AdminPageShell + AdminPageHeader + AdminCard.
// ReschedulePanel client component preserve.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { ReschedulePanel } from "../ReschedulePanel";

interface BookingItem {
  id: string;
  bookingDate: string;
  status: string;
  interventionType: string;
  slotId: string | null;
  companyName: string;
}

interface SlotItem {
  id: string;
  slotDate: string;
  status: string;
  interventionType: string | null;
  blockedReason: string | null;
}

interface Props {
  adminPrefix: string;
  year: number;
  month: number;
  periodStart: Date;
  bookings: ReadonlyArray<BookingItem>;
  slots: ReadonlyArray<SlotItem>;
}

export function RescheduleV2({
  adminPrefix,
  year,
  month,
  periodStart,
  bookings,
  slots,
}: Props): React.ReactElement {
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(periodStart);
  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const availSlots = slots.filter((s) => s.status === "available").length;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Reprogrammer (D60) — ${monthLabel}`}
        description={`${bookings.length} booking${bookings.length > 1 ? "s" : ""} reschedulable${bookings.length > 1 ? "s" : ""} · ${availSlots} slot${availSlots > 1 ? "s" : ""} disponible${availSlots > 1 ? "s" : ""}`}
        breadcrumbs={
          <Link href={`/fr/${adminPrefix}/calendrier`} className="admin-link admin-back">
            ← Calendrier
          </Link>
        }
        actions={
          <div className="admin-filters-actions">
            <Link
              href={`/fr/${adminPrefix}/calendrier/reschedule?year=${prevMonth.y}&month=${prevMonth.m}`}
              className="admin-button-ghost"
            >
              ← mois préc.
            </Link>
            <Link
              href={`/fr/${adminPrefix}/calendrier/reschedule?year=${nextMonth.y}&month=${nextMonth.m}`}
              className="admin-button-ghost"
            >
              mois suiv. →
            </Link>
          </div>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <p className="admin-meta-block">
          Glisse-dépose un booking de la colonne gauche sur un slot vert (disponible) de la grille
          pour reprogrammer. Une modal s&apos;ouvrira pour saisir le motif puis confirmer (email
          auto au client).
        </p>
      </AdminCard>

      <ReschedulePanel bookings={[...bookings]} slots={[...slots]} />
    </AdminPageShell>
  );
}
