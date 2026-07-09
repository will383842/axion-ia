// Grille calendrier mensuelle générique (RSC, sans état, 0 lib). Réutilisable
// par n'importe quel domaine. Chaque jour affiche un compteur ; un jour avec
// `href` est cliquable (navigation par querystring, zéro JS client).

import Link from "next/link";
import { buildMonthGrid, dayKeyOfGridDate } from "@/lib/calendar-grid";

export interface MonthGridDay {
  dayKey: string;
  count: number;
  href?: string;
  selected?: boolean;
}

interface Props {
  /** Année (ex 2026). */
  year: number;
  /** Mois 1-12. */
  month: number;
  days: ReadonlyArray<MonthGridDay>;
  /** « YYYY-MM-DD » du jour courant (surlignage discret). */
  todayKey?: string;
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function MonthGridCalendar({ year, month, days, todayKey }: Props): React.ReactElement {
  const byKey = new Map(days.map((d) => [d.dayKey, d]));
  const cells = buildMonthGrid(year, month);

  return (
    <div className="w-full">
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-1 text-center text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg-muted)]"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="min-h-[64px]" />;
          const key = dayKeyOfGridDate(date);
          const info = byKey.get(key);
          const isToday = todayKey === key;
          const dayNum = date.getUTCDate();
          const hasRdv = (info?.count ?? 0) > 0;

          const inner = (
            <div
              className={[
                "flex min-h-[64px] flex-col rounded-[var(--radius-admin-md)] border p-1.5 transition-colors",
                info?.selected
                  ? "border-[color:var(--color-admin-info)] bg-[color:var(--color-admin-surface-hover)]"
                  : "border-[color:var(--color-admin-border)]",
                hasRdv ? "hover:bg-[color:var(--color-admin-surface-hover)]" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[length:var(--text-admin-xs)]",
                  isToday
                    ? "font-bold text-[color:var(--color-admin-info)]"
                    : "text-[color:var(--color-admin-fg-muted)]",
                ].join(" ")}
              >
                {dayNum}
              </span>
              {hasRdv && (
                <span className="mt-auto inline-flex items-center gap-1 self-start rounded-full bg-[color:var(--color-admin-info)]/15 px-1.5 py-0.5 text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-info)]">
                  ● {info?.count}
                </span>
              )}
            </div>
          );

          return info?.href ? (
            <Link key={key} href={info.href} className="block" aria-label={`${info.count} rendez-vous le ${key}`}>
              {inner}
            </Link>
          ) : (
            <div key={key}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
