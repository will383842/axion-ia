// Heatmap géographique calendrier admin (Sprint X.9 — Booking V1).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.9 + §X.16
//
// Affiche la liste des bookings confirmés/à venir du mois groupés par ville
// (companyCityNormalized) avec distance hub Paris + buffer trajet (0/0.5/1j).
// Alerte visuelle si 2 bookings 48h consécutives à plus de 600 km l'un de
// l'autre (geo conflict — Will doit blocker un slot tampon).
//
// V1 minimum livré
//   - Section "Concentration géographique" — table villes × bookings × distance
//   - Section "Conflits 48h" — alertes si > 600 km dans fenêtre 48h
//
// V1.5 reporté (X.9b)
//   - Carte interactive Leaflet
//   - Drag-drop reschedule depuis carte (D60)
//   - Override hub depuis SiteSetting

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HeatmapV2 } from "./_v2/HeatmapV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(1);
  return r;
}
function endOfMonth(d: Date): Date {
  const r = startOfMonth(d);
  r.setMonth(r.getMonth() + 1);
  r.setMilliseconds(-1);
  return r;
}

export default async function CalendarHeatmapPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = endOfMonth(periodStart);

  const bookings = await prisma.booking.findMany({
    where: {
      bookingDate: { gte: periodStart, lte: periodEnd },
      status: { in: ["confirmed", "awaiting_admin_validation", "in_progress", "paused"] },
    },
    orderBy: { bookingDate: "asc" },
    select: {
      id: true,
      bookingDate: true,
      interventionType: true,
      status: true,
      companyCityNormalized: true,
      companyLat: true,
      companyLng: true,
      travelBufferDays: true,
      submission: { select: { companyName: true } },
      fromSubmission: { select: { companyName: true } },
    },
  });

  return (
    <HeatmapV2
      adminPrefix={adminPrefix}
      year={year}
      month={month}
      periodStart={periodStart}
      bookings={bookings}
    />
  );
}
