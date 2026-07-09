// Contacts admin — vue Calendrier des RDV. Grille mensuelle : chaque jour
// montre le nombre de RDV ; clic sur une date → panneau « RDV du jour » (0 JS
// client, navigation par querystring). V1 = Calendly.

import Link from "next/link";
import { getRdvMonth } from "@/features/admin-rendezvous/queries";
import { RDV_STATUS_LABELS } from "@/features/admin-rendezvous/types";
import { MonthGridCalendar, type MonthGridDay } from "@/components/admin/ui/MonthGridCalendar";
import { dayKeyInParis, timeInParis } from "@/lib/calendar-grid";
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

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RdvCalendrierPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const now = new Date();
  const year = sp["year"] ? parseInt(sp["year"], 10) : now.getFullYear();
  const month = sp["month"] ? parseInt(sp["month"], 10) : now.getMonth() + 1;
  const selectedDate = sp["date"] ?? null;

  const byDay = await getRdvMonth(year, month);
  const base = `/fr/${adminPrefix}/contacts/rendez-vous/calendrier`;

  const days: MonthGridDay[] = [...byDay.entries()].map(([dayKey, arr]) => ({
    dayKey,
    count: arr.length,
    href: `${base}?year=${year}&month=${month}&date=${dayKey}`,
    selected: dayKey === selectedDate,
  }));

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const dayRdv = selectedDate ? (byDay.get(selectedDate) ?? []) : [];

  return (
    <>
      <AdminPageHeader
        title="Calendrier des RDV"
        description={`${MONTHS[month - 1]} ${year} · ${[...byDay.values()].reduce((n, a) => n + a.length, 0)} rendez-vous`}
      />

      <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-2">
        <Link href={`${base}?year=${prev.y}&month=${prev.m}`} className="admin-button-ghost">
          ← {MONTHS[prev.m - 1]}
        </Link>
        <Link href={base} className="admin-button-ghost">
          Aujourd&apos;hui
        </Link>
        <Link href={`${base}?year=${next.y}&month=${next.m}`} className="admin-button-ghost">
          {MONTHS[next.m - 1]} →
        </Link>
      </div>

      <MonthGridCalendar year={year} month={month} days={days} todayKey={dayKeyInParis(now)} />

      {selectedDate && (
        <div className="mt-[var(--space-admin-6)]">
          <h2 className="admin-h2">RDV du {selectedDate}</h2>
          {dayRdv.length === 0 ? (
            <p className="text-[color:var(--color-admin-fg-muted)]">Aucun rendez-vous ce jour.</p>
          ) : (
            <ul className="mt-[var(--space-admin-3)] space-y-2">
              {dayRdv.map((r) => (
                <li key={r.key}>
                  <Link
                    href={r.detailHref}
                    className="flex items-center justify-between rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-3 hover:bg-[color:var(--color-admin-surface-hover)]"
                  >
                    <span>
                      <span className="font-semibold">
                        {r.timeConfirmed && r.startTime ? timeInParis(r.startTime) : "heure ?"}
                      </span>{" "}
                      — {r.title}
                      {r.contactName ? (
                        <span className="text-[color:var(--color-admin-fg-muted)]">
                          {" "}
                          · {r.contactName}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {RDV_STATUS_LABELS[r.status]} ›
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
