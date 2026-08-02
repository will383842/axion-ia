// Grille calendrier mensuelle générique (RSC, sans état, 0 lib). Réutilisable
// par n'importe quel domaine. Chaque jour affiche un compteur ; un jour avec
// `href` est cliquable (navigation par querystring, zéro JS client).
//
// Refonte 2026-08-02 (retour Will : « le calendrier fait très basique, pas de
// couleur de fond, couleurs trop fades ») :
//   - les cellules n'avaient AUCUN fond (bordure seule) : elles laissaient
//     voir l'arrière-plan de la page — désormais fond papier, elles se
//     détachent du canvas ;
//   - « aujourd'hui » portait le bleu du SITE PUBLIC en bordure fine — il
//     porte l'accent de la charte, en anneau plein + teinte ;
//   - la pastille de compte utilisait `bg-[…]/15`, un modificateur d'opacité
//     inopérant sur une variable CSS : son fond ne se rendait PAS. Elle passe
//     en bleu planning PLEIN, texte blanc — la couleur d'identité de la
//     famille, visible pour de bon ;
//   - les jours vides (hors mois) prennent un fond enfoncé discret : la
//     grille se lit comme une surface continue, pas comme des trous.

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
  /** « YYYY-MM-DD » du jour courant (mise en avant accent). */
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
            className="py-1 text-center text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date)
            return (
              <div
                key={`empty-${i}`}
                aria-hidden="true"
                className="min-h-[64px] rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-surface-sunken)]"
              />
            );
          const key = dayKeyOfGridDate(date);
          const info = byKey.get(key);
          const isToday = todayKey === key;
          const dayNum = date.getUTCDate();
          const hasRdv = (info?.count ?? 0) > 0;

          const inner = (
            <div
              className={[
                "flex min-h-[64px] flex-col rounded-[var(--radius-admin-md)] border p-1.5 transition-colors",
                "bg-[color:var(--color-admin-paper)]",
                isToday
                  ? "border-[color:var(--color-admin-accent)] shadow-[inset_0_0_0_1px_var(--color-admin-accent)]"
                  : info?.selected
                    ? "border-[color:var(--color-admin-id-bleu)] bg-[color:var(--color-admin-id-bleu-soft)]"
                    : "border-[color:var(--color-admin-border)]",
                hasRdv ? "hover:bg-[color:var(--color-admin-id-bleu-soft)]" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[length:var(--text-admin-xs)]",
                  isToday
                    ? "inline-flex h-5 w-5 items-center justify-center self-start rounded-full bg-[color:var(--color-admin-accent)] font-bold text-[color:var(--color-admin-accent-fg)]"
                    : "font-medium text-[color:var(--color-admin-fg-soft)]",
                ].join(" ")}
              >
                {dayNum}
              </span>
              {hasRdv && (
                <span className="mt-auto inline-flex items-center self-start rounded-full bg-[color:var(--color-admin-id-bleu)] px-2 py-0.5 text-[length:var(--text-admin-xs)] font-semibold text-white">
                  {info?.count}
                </span>
              )}
            </div>
          );

          return info?.href ? (
            <Link
              key={key}
              href={info.href}
              className="block rounded-[var(--radius-admin-md)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] focus-visible:outline-none"
              aria-label={`${info.count} rendez-vous le ${key}`}
            >
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
