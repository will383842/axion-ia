// Liste réservations admin (Sprint X.8 — Booking V1 V2).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.8
//        Périmètre — Liste avec filtres status / search / sort
//
// V1 livré
//   - Tableau bookings avec colonnes : Date / Société / Intervention /
//     Status (badge) / Montant / Actions
//   - Filtres par status via URL (?status=...)
//   - Tri par updatedAt desc (récent en haut)
//   - Pagination 20/page
//
// V1.5 reporté (X.8b)
//   - Search globale (company / contact / email)
//   - Filtre par période bookingDate
//   - Export CSV
//   - Drawer in-page (URL param ?id=) au lieu de page séparée

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReservationsV2 } from "./_v2/ReservationsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ReservationsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <ReservationsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
