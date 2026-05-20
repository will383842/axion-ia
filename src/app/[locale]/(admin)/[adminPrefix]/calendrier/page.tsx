// Calendrier admin vue mois (M9 Tier 1 section 3 — V1 minimal).
//
// Grid 7 colonnes (lun→dim FR) × 5-6 lignes selon mois. Chaque cell affiche
// jour + status badge + count options pending. Click ouvre le panel d'action
// (block/unblock) en bas. Navigation mois precedent/suivant via URL params.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCalendarMonthAction } from "@/features/admin-calendar/actions";
import { CalendarBlockPanel } from "./CalendarBlockPanel";
import { CalendrierV2 } from "./_v2/CalendrierV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Réservé",
  blocked: "Bloqué",
};

function buildMonthGrid(year: number, month: number): Array<Date | null> {
  // month 1-12, on sort un tableau de 42 cells (6 semaines × 7 jours)
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  // Lundi=1, Dimanche=0 → on veut Lundi=0 pour aligner FR
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const grid: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(Date.UTC(year, month - 1, d)));
  while (grid.length < 42) grid.push(null);
  return grid;
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

