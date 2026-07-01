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

// Modèle multi-demandes (Will 2026-06-10) : une journée = conteneur de demandes.
// Chaque case affiche le nombre de pré-réservations (demandes à rappeler) et de
// validées, ou « Complet » si l'admin a bloqué la date. Cliquer une journée
// ouvre la liste filtrée /reservations?date=YYYY-MM-DD (boutons valider/refuser).
interface DaySummary {
  date: string;
  blocked: boolean;
  blockedReason?: string | null;
  demandesCount: number;
  valideesCount: number;
  formateurs?: string[];
}

interface Props {
  adminPrefix: string;
  year: number;
  month: number;
  slots: ReadonlyArray<DaySummary>;
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
  const totalDemandes = slots.reduce((n, s) => n + s.demandesCount, 0);
  const totalValidees = slots.reduce((n, s) => n + s.valideesCount, 0);
  const reservationsBase = `/fr/${adminPrefix}/reservations`;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={monthLabel}
        description={`${totalDemandes} demande${totalDemandes > 1 ? "s" : ""} à traiter · ${totalValidees} validée${totalValidees > 1 ? "s" : ""} ce mois`}
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
              title="Carte de chaleur géo"
            >
              🗺️ Carte de chaleur
            </Link>
            <Link
              href={`/fr/${adminPrefix}/calendrier/reschedule?year=${year}&month=${month}`}
              className="admin-button-ghost"
              title="Reprogrammation (glisser-déposer)"
            >
              🔄 Reprogrammer
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
            const isToday = dateKey === new Date().toISOString().slice(0, 10);
            const cellKey = slot?.blocked
              ? "blocked"
              : slot?.valideesCount
                ? "validated"
                : slot?.demandesCount
                  ? "prereserved"
                  : "available";
            const hasActivity = !!slot && (slot.demandesCount > 0 || slot.valideesCount > 0);
            const inner = (
              <>
                <div className="admin-calendar-cell-date">{d.getUTCDate()}</div>
                {slot?.blocked ? (
                  <>
                    <div className="admin-calendar-cell-status">
                      <span className="admin-badge admin-badge-blocked">Complet</span>
                    </div>
                    {slot.blockedReason ? (
                      <div className="admin-calendar-cell-meta admin-meta-small">
                        {slot.blockedReason}
                      </div>
                    ) : null}
                  </>
                ) : hasActivity ? (
                  <div className="admin-calendar-cell-status admin-calendar-cell-counts">
                    {slot!.demandesCount > 0 ? (
                      <span className="admin-badge admin-badge-prereserved">
                        {slot!.demandesCount} dem.
                      </span>
                    ) : null}
                    {slot!.valideesCount > 0 ? (
                      <span className="admin-badge admin-badge-validated">
                        {slot!.valideesCount} val.
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {!slot?.blocked && slot?.formateurs && slot.formateurs.length > 0 ? (
                  <div
                    className="admin-calendar-cell-meta admin-meta-small"
                    title={slot.formateurs.join(", ")}
                  >
                    👤 {slot.formateurs.join(", ")}
                  </div>
                ) : null}
              </>
            );
            const cls = `admin-calendar-cell admin-calendar-cell-${cellKey} ${isToday ? "admin-calendar-cell-today" : ""}`;
            return hasActivity ? (
              <Link
                key={dateKey}
                href={`${reservationsBase}?status=all&date=${dateKey}`}
                className={`${cls} admin-calendar-cell-link`}
                title={`Voir les demandes du ${dateKey}`}
              >
                {inner}
              </Link>
            ) : (
              <div key={dateKey} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </AdminCard>

      {canAct && (
        <AdminCard>
          <h2 className="admin-h2">Marquer complet / rouvrir une date</h2>
          <p className="admin-meta">
            « Complet » ferme la date aux nouvelles demandes côté public (vacances, journée pleine).
            Les demandes déjà reçues restent gérables dans Réservations — les bloquer ne les
            supprime pas. Rouvrir la date la rend de nouveau réservable.
          </p>
          <CalendarBlockPanel />
        </AdminCard>
      )}
    </AdminPageShell>
  );
}
