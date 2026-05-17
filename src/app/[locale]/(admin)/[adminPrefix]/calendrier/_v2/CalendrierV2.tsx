// Refonte admin mai 2026 — PR 6b (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Calendrier admin V2 — AdminPageShell + AdminPageHeader. Grid mensuel + panel
// block/unblock. V1 body preserve (admin-calendar-* classes inchangees).

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { CalendarBlockPanel } from "../CalendarBlockPanel";

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

interface SlotInfo {
  date: string;
  status: string;
  pendingOptionsCount?: number;
  blockedReason?: string | null;
}

interface Props {
  adminPrefix: string;
  year: number;
  month: number;
  slots: ReadonlyArray<SlotInfo>;
  canAct: boolean;
}

function buildMonthGrid(year: number, month: number): Array<Date | null> {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const grid: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(Date.UTC(year, month - 1, d)));
  while (grid.length < 42) grid.push(null);
  return grid;
}

export function CalendrierV2({
  adminPrefix,
  year,
  month,
  slots,
  canAct,
}: Props): React.ReactElement {
  const slotByDate = new Map(slots.map((s) => [s.date, s]));
  const grid = buildMonthGrid(year, month);
  const monthLabel = `${MONTH_LABELS[month - 1]} ${year}`;
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={monthLabel}
        description={`${slots.length} créneau${slots.length > 1 ? "x" : ""} actif${slots.length > 1 ? "s" : ""} sur ce mois`}
        actions={
          <div className="admin-filters-actions">
            <Link
              href={`/fr/${adminPrefix}/calendrier?year=${prevMonth.year}&month=${prevMonth.month}`}
              className="admin-button-ghost"
            >
              ← {MONTH_LABELS[prevMonth.month - 1]}
            </Link>
            <Link
              href={`/fr/${adminPrefix}/calendrier`}
              className="admin-button-ghost"
              title="Aujourd'hui"
            >
              ⌂
            </Link>
            <Link
              href={`/fr/${adminPrefix}/calendrier/heatmap?year=${year}&month=${month}`}
              className="admin-button-ghost"
              title="Heatmap géo"
            >
              🗺️ Heatmap
            </Link>
            <Link
              href={`/fr/${adminPrefix}/calendrier/reschedule?year=${year}&month=${month}`}
              className="admin-button-ghost"
              title="Reschedule drag-drop"
            >
              🔄 Reschedule
            </Link>
            <Link
              href={`/fr/${adminPrefix}/calendrier?year=${nextMonth.year}&month=${nextMonth.month}`}
              className="admin-button-ghost"
            >
              {MONTH_LABELS[nextMonth.month - 1]} →
            </Link>
          </div>
        }
      />

      <AdminCard className="admin-calendar-grid-wrapper mb-[var(--space-admin-5)]">
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
      </AdminCard>

      {canAct && (
        <AdminCard>
          <h2 className="admin-h2">Bloquer / débloquer une date</h2>
          <p className="admin-meta">
            Bloque une date (vacances, indisponibilité ponctuelle). Impossible de bloquer si une
            réservation ferme ou des options pending existent — refusez ou attendez
            l&apos;expiration d&apos;abord.
          </p>
          <CalendarBlockPanel />
        </AdminCard>
      )}
    </AdminPageShell>
  );
}
