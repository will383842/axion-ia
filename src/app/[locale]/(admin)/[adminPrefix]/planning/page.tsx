// Planning unifié — calendrier des prestations (formations collectives +
// coaching 1-to-1). Grille mensuelle : chaque jour montre le nombre de
// prestations ; clic sur une date → liste du jour ; clic sur une prestation →
// sa fiche détaillée.
//
// 0 JS client : navigation et filtres par querystring (formulaire GET natif),
// grille RSC. Respecte le budget Web Vitals (aucune lib de calendrier).

import Link from "next/link";
import { getPlanningMonth } from "@/features/admin-planning/queries";
import {
  PLANNING_STATUT_LABELS,
  PLANNING_TYPE_LABELS,
  planningDetailHref,
  type PlanningEventType,
  type PlanningFilters,
  type PlanningStatut,
} from "@/features/admin-planning/types";
import { planningTimeLabel } from "@/features/admin-planning/labels";
import { listTrainers } from "@/server/qualiopi/trainers/trainers";
import { MonthGridCalendar, type MonthGridDay } from "@/components/admin/ui/MonthGridCalendar";
import { dayKeyInParis } from "@/lib/calendar-grid";
import { AdminPageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const TYPES: PlanningEventType[] = ["formation", "coaching"];
const STATUTS: PlanningStatut[] = ["planifiee", "en_cours", "realisee", "annulee", "reportee"];

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Garde : n'accepte que les valeurs connues (une querystring est publique). */
function parseType(v: string | undefined): PlanningEventType | undefined {
  return v !== undefined && (TYPES as string[]).includes(v) ? (v as PlanningEventType) : undefined;
}
function parseStatut(v: string | undefined): PlanningStatut | undefined {
  return v !== undefined && (STATUTS as string[]).includes(v) ? (v as PlanningStatut) : undefined;
}
function parseMonth(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback;
}
function parseYear(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : fallback;
}

export default async function PlanningPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  const now = new Date();
  const year = parseYear(sp["year"], now.getFullYear());
  const month = parseMonth(sp["month"], now.getMonth() + 1);
  const selectedDate = sp["date"] ?? null;

  const filters: PlanningFilters = {};
  const type = parseType(sp["type"]);
  const statut = parseStatut(sp["statut"]);
  const trainerId = sp["trainerId"];
  if (type !== undefined) filters.type = type;
  if (statut !== undefined) filters.statut = statut;
  if (trainerId !== undefined && trainerId !== "") filters.trainerId = trainerId;

  const [byDay, trainers] = await Promise.all([
    getPlanningMonth(year, month, filters),
    listTrainers({ actifOnly: true }),
  ]);

  const base = `/fr/${adminPrefix}/planning`;
  /** Conserve les filtres actifs lors de la navigation mensuelle. */
  const filterQs = [
    type !== undefined ? `type=${type}` : null,
    statut !== undefined ? `statut=${statut}` : null,
    filters.trainerId !== undefined ? `trainerId=${filters.trainerId}` : null,
  ]
    .filter(Boolean)
    .join("&");
  const withFilters = (qs: string): string => (filterQs ? `${qs}&${filterQs}` : qs);

  const days: MonthGridDay[] = [...byDay.entries()].map(([dayKey, arr]) => ({
    dayKey,
    count: arr.length,
    href: `${base}?${withFilters(`year=${year}&month=${month}&date=${dayKey}`)}`,
    selected: dayKey === selectedDate,
  }));

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const dayEvents = selectedDate !== null ? (byDay.get(selectedDate) ?? []) : [];
  /** Une prestation multi-jours compte une fois, pas une fois par case. */
  const totalDistinct = new Set([...byDay.values()].flat().map((e) => e.key)).size;

  return (
    <>
      <AdminPageHeader
        title="Planning"
        description={`${MONTHS[month - 1]} ${year} · ${totalDistinct} prestation${totalDistinct > 1 ? "s" : ""} (formations + 1-to-1)`}
      />

      <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-2">
        <Link
          href={`${base}?${withFilters(`year=${prev.y}&month=${prev.m}`)}`}
          className="admin-button-ghost"
        >
          ← {MONTHS[prev.m - 1]}
        </Link>
        <Link href={base} className="admin-button-ghost">
          Aujourd&apos;hui
        </Link>
        <Link
          href={`${base}?${withFilters(`year=${next.y}&month=${next.m}`)}`}
          className="admin-button-ghost"
        >
          {MONTHS[next.m - 1]} →
        </Link>
      </div>

      {/* Filtres — formulaire GET natif, zéro JS client. */}
      <form method="get" action={base} className="mb-[var(--space-admin-5)] flex flex-wrap gap-2">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        {selectedDate !== null && <input type="hidden" name="date" value={selectedDate} />}

        <select name="type" defaultValue={type ?? ""} className="admin-input" aria-label="Type">
          <option value="">Tous les types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {PLANNING_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          name="statut"
          defaultValue={statut ?? ""}
          className="admin-input"
          aria-label="Statut"
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {PLANNING_STATUT_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          name="trainerId"
          defaultValue={filters.trainerId ?? ""}
          className="admin-input"
          aria-label="Formateur"
        >
          <option value="">Tous les formateurs</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.prenom} {t.nom}
            </option>
          ))}
        </select>

        <button type="submit" className="admin-button">
          Filtrer
        </button>
        {filterQs !== "" && (
          <Link href={`${base}?year=${year}&month=${month}`} className="admin-button-ghost">
            Réinitialiser
          </Link>
        )}
      </form>

      <MonthGridCalendar year={year} month={month} days={days} todayKey={dayKeyInParis(now)} />

      {selectedDate !== null && (
        <div className="mt-[var(--space-admin-6)]">
          <h2 className="admin-h2">Prestations du {selectedDate}</h2>
          {dayEvents.length === 0 ? (
            <p className="text-[color:var(--color-admin-fg-muted)]">Aucune prestation ce jour.</p>
          ) : (
            <ul className="mt-[var(--space-admin-3)] space-y-2">
              {dayEvents.map((e) => (
                <li key={e.key}>
                  <Link
                    href={planningDetailHref(adminPrefix, e)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-3 hover:bg-[color:var(--color-admin-surface-hover)]"
                  >
                    <span>
                      <span className="font-semibold">{planningTimeLabel(e)}</span> — {e.titre}
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        {" "}
                        · {PLANNING_TYPE_LABELS[e.type]}
                        {e.formateurNom !== null ? ` · ${e.formateurNom}` : " · formateur ?"}
                        {e.clientNom !== null ? ` · ${e.clientNom}` : ""}
                        {e.lieu !== null ? ` · ${e.lieu}` : ""}
                      </span>
                    </span>
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {PLANNING_STATUT_LABELS[e.statut]} ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
