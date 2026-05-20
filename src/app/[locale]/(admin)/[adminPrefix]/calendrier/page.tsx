// Calendrier admin vue mois (M9 Tier 1 section 3 — V1 minimal).
//
// Grid 7 colonnes (lun→dim FR) × 5-6 lignes selon mois. Chaque cell affiche
// jour + status badge + count options pending. Click ouvre le panel d'action
// (block/unblock) en bas. Navigation mois precedent/suivant via URL params.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCalendarMonthAction } from "@/features/admin-calendar/actions";
import { CalendrierV2 } from "./_v2/CalendrierV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getUTCFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : now.getUTCMonth() + 1;

  const slots = await getCalendarMonthAction(year, month);

  const role = (session.user as { role?: string }).role;
  const canAct = role === "super_admin" || role === "admin";

  return (
    <CalendrierV2
      adminPrefix={adminPrefix}
      year={year}
      month={month}
      slots={slots}
      canAct={canAct}
    />
  );
}
