// Calendrier admin vue mois (M9 Tier 1 section 3 — V1 minimal).
//
// Grid 7 colonnes (lun→dim FR) × 5-6 lignes selon mois. Chaque cell affiche
// jour + status badge + count options pending. Click ouvre le panel d'action
// (block/unblock) en bas. Navigation mois precedent/suivant via URL params.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCalendarMonthAction } from "@/features/admin-calendar/actions";
import { CalendarBlockPanel } from "./CalendarBlockPanel";
import { isAdminV2Enabled } from "@/lib/feature-flags";
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

  if (await isAdminV2Enabled()) {
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

  const slotByDate = new Map(slots.map((s) => [s.date, s]));

  const grid = buildMonthGrid(year, month);
  const monthLabel = `${MONTH_LABELS[month - 1]} ${year}`;
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">{monthLabel}</h1>
          <p className="admin-meta">
            {slots.length} créneau{slots.length > 1 ? "x" : ""} actif{slots.length > 1 ? "s" : ""}{" "}
            sur ce mois
          </p>
        </div>
        <div className="admin-filters-actions">
          <a
            href={`/fr/${adminPrefix}/calendrier?year=${prevMonth.year}&month=${prevMonth.month}`}
            className="admin-button-ghost"
          >
            ← {MONTH_LABELS[prevMonth.month - 1]}
          </a>
          <a
            href={`/fr/${adminPrefix}/calendrier`}
            className="admin-button-ghost"
            title="Aujourd'hui"
          >
            ⌂
          </a>
          <a
            href={`/fr/${adminPrefix}/calendrier/heatmap?year=${year}&month=${month}`}
            className="admin-button-ghost"
            title="Heatmap géo"
          >
            🗺️ Heatmap
          </a>
          <a
            href={`/fr/${adminPrefix}/calendrier/reschedule?year=${year}&month=${month}`}
            className="admin-button-ghost"
            title="Reschedule drag-drop"
          >
            🔄 Reschedule
          </a>
          <a
            href={`/fr/${adminPrefix}/calendrier?year=${nextMonth.year}&month=${nextMonth.month}`}
            className="admin-button-ghost"
          >
            {MONTH_LABELS[nextMonth.month - 1]} →
          </a>
        </div>
      </div>

      <div className="admin-card admin-calendar-grid-wrapper">
        <div className="admin-calendar-headers">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} className="admin-calendar-header">
              {d}
            </div>
          ))}
        </div>
        <div className="admin-calendar-grid">
          {grid.map((d, i) => {
            if (!d) {
              return <div key={i} className="admin-calendar-cell admin-calendar-cell-empty" />;
            }
            const dateKey = d.toISOString().slice(0, 10);
            const slot = slotByDate.get(dateKey);
            const status = slot?.status ?? "available";
            const isToday = dateKey === new Date().toISOString().slice(0, 10);
            return (
              <div
                key={dateKey}
                className={`admin-calendar-cell admin-calendar-cell-${status} ${isToday ? "admin-calendar-cell-today" : ""}`}
              >
                <div className="admin-calendar-cell-date">{d.getUTCDate()}</div>
                <div className="admin-calendar-cell-status">
                  <span className={`admin-badge admin-badge-${status}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>
                {slot?.pendingOptionsCount ? (
                  <div className="admin-calendar-cell-meta">
                    {slot.pendingOptionsCount} option{slot.pendingOptionsCount > 1 ? "s" : ""} pend.
                  </div>
                ) : null}
                {slot?.blockedReason ? (
                  <div className="admin-calendar-cell-meta admin-meta-small">
                    {slot.blockedReason}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {canAct && (
        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Bloquer / débloquer une date</h2>
          <p className="admin-meta">
            Bloque une date (vacances, indisponibilité ponctuelle). Impossible de bloquer si une
            réservation ferme ou des options pending existent — refusez ou attendez
            l&apos;expiration d&apos;abord.
          </p>
          <CalendarBlockPanel />
        </div>
      )}
    </section>
  );
}
