// Admin calendrier reschedule drag-drop (Sprint E — D60).
//
// Vue interactive 2 colonnes :
//   Gauche : bookings reschedulables (status confirmed/paused/contract_payment_sent)
//   Droite : grille mensuelle slots disponibles
//
// L'admin glisse un booking sur un slot → modal saisie reason → confirmation
// → rescheduleBookingByAdminAction côté serveur.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ReschedulePanel } from "./ReschedulePanel";
import { RescheduleV2 } from "./_v2/RescheduleV2";
import type { BookingStatus } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const RESCHEDULABLE: BookingStatus[] = [
  "contract_payment_sent",
  "awaiting_admin_validation",
  "confirmed",
  "paused",
];

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  r.setUTCDate(1);
  return r;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

export default async function CalendarReschedulePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getUTCFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : now.getUTCMonth() + 1;
  const periodStart = startOfMonth(new Date(Date.UTC(year, month - 1, 1)));
  const periodEnd = addMonths(periodStart, 1);

  // Bookings reschedulables — on prend ceux à venir uniquement (bookingDate >= today)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [bookings, slots] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: RESCHEDULABLE },
        bookingDate: { gte: todayStart },
      },
      orderBy: { bookingDate: "asc" },
      take: 30,
      select: {
        id: true,
        bookingDate: true,
        status: true,
        interventionType: true,
        slotId: true,
        submission: { select: { companyName: true } },
        fromSubmission: { select: { companyName: true } },
      },
    }),
    prisma.calendarSlot.findMany({
      where: {
        slotDate: { gte: periodStart, lt: periodEnd },
      },
      orderBy: { slotDate: "asc" },
      select: {
        id: true,
        slotDate: true,
        status: true,
        interventionType: true,
        blockedReason: true,
      },
    }),
  ]);

  return (
    <RescheduleV2
      adminPrefix={adminPrefix}
      year={year}
      month={month}
      periodStart={periodStart}
      bookings={bookings.map((b) => ({
        id: b.id,
        bookingDate: b.bookingDate.toISOString(),
        status: b.status,
        interventionType: b.interventionType,
        slotId: b.slotId,
        companyName: b.fromSubmission?.companyName ?? b.submission?.companyName ?? "—",
      }))}
      slots={slots.map((s) => ({
        id: s.id,
        slotDate: s.slotDate.toISOString(),
        status: s.status,
        interventionType: s.interventionType,
        blockedReason: s.blockedReason,
      }))}
    />
  );
}

