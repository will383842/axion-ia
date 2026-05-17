// Refonte admin mai 2026 — PR 6b (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Heatmap calendrier V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { distanceAndBufferFromHub, distanceKm } from "@/lib/haversine";

const CONFLICT_THRESHOLD_KM = 600;
const WARN_THRESHOLD_KM = 300;

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

interface BookingRow {
  id: string;
  bookingDate: Date;
  interventionType: string;
  status: string;
  companyCityNormalized: string | null;
  companyLat: unknown;
  companyLng: unknown;
  travelBufferDays: number | null;
  submission: { companyName: string | null } | null;
  fromSubmission: { companyName: string | null } | null;
}

interface Props {
  adminPrefix: string;
  year: number;
  month: number;
  periodStart: Date;
  bookings: ReadonlyArray<BookingRow>;
}

export function HeatmapV2({
  adminPrefix,
  year,
  month,
  periodStart,
  bookings,
}: Props): React.ReactElement {
  const byCity = new Map<
    string,
    {
      city: string;
      count: number;
      lat: number | null;
      lng: number | null;
      bookings: typeof bookings;
    }
  >();
  for (const b of bookings) {
    const city = b.companyCityNormalized ?? "(ville inconnue)";
    const entry = byCity.get(city) ?? {
      city,
      count: 0,
      lat: b.companyLat ? Number(b.companyLat) : null,
      lng: b.companyLng ? Number(b.companyLng) : null,
      bookings: [] as typeof bookings,
    };
    entry.count++;
    (entry.bookings as BookingRow[]).push(b);
    byCity.set(city, entry);
  }
  const cities = Array.from(byCity.values()).sort((a, b) => b.count - a.count);

  type Conflict = {
    a: BookingRow;
    b: BookingRow;
    distanceKm: number;
    deltaHours: number;
  };
  const conflicts: Conflict[] = [];
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const ba = bookings[i]!;
      const bb = bookings[j]!;
      if (!ba.companyLat || !ba.companyLng || !bb.companyLat || !bb.companyLng) continue;
      const deltaMs = Math.abs(bb.bookingDate.getTime() - ba.bookingDate.getTime());
      const deltaHours = deltaMs / 3600000;
      if (deltaHours > 48) continue;
      const d = distanceKm(
        Number(ba.companyLat),
        Number(ba.companyLng),
        Number(bb.companyLat),
        Number(bb.companyLng),
      );
      if (d >= WARN_THRESHOLD_KM) {
        conflicts.push({ a: ba, b: bb, distanceKm: d, deltaHours });
      }
    }
  }
  conflicts.sort((a, b) => b.distanceKm - a.distanceKm);

  function customerName(b: BookingRow): string {
    return b.fromSubmission?.companyName ?? b.submission?.companyName ?? "—";
  }

  const periodLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(periodStart);
  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Heatmap géographique — ${periodLabel}`}
        description={`${bookings.length} booking${bookings.length > 1 ? "s" : ""} actif${bookings.length > 1 ? "s" : ""} sur la période`}
        actions={
          <div className="admin-filters-actions">
            <Link
              href={`/fr/${adminPrefix}/calendrier/heatmap?year=${prevMonth.y}&month=${prevMonth.m}`}
              className="admin-button-ghost"
            >
              ← mois préc.
            </Link>
            <Link
              href={`/fr/${adminPrefix}/calendrier/heatmap?year=${nextMonth.y}&month=${nextMonth.m}`}
              className="admin-button-ghost"
            >
              mois suiv. →
            </Link>
          </div>
        }
        breadcrumbs={
          <Link href={`/fr/${adminPrefix}/calendrier`} className="admin-link admin-back">
            ← Calendrier
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Conflits géographiques (fenêtre 48h)</h2>
        <p className="admin-meta-block">
          Bookings espacés de moins de 48 h et distants de plus de{" "}
          <strong>{WARN_THRESHOLD_KM} km</strong> (alerte) ou{" "}
          <strong>{CONFLICT_THRESHOLD_KM} km</strong> (conflit critique).
        </p>
        {conflicts.length === 0 ? (
          <p className="admin-meta-block">Aucun conflit détecté.</p>
        ) : (
          <ul className="admin-meta-block">
            {conflicts.map((c) => (
              <li key={`${c.a.id}-${c.b.id}`}>
                <strong
                  className={
                    c.distanceKm >= CONFLICT_THRESHOLD_KM
                      ? "text-[color:var(--color-admin-destructive)]"
                      : ""
                  }
                >
                  {c.distanceKm >= CONFLICT_THRESHOLD_KM ? "🚨" : "⚠️"} {Math.round(c.distanceKm)}{" "}
                  km
                </strong>{" "}
                · {Math.round(c.deltaHours)} h d&apos;écart ·{" "}
                <Link href={`/fr/${adminPrefix}/reservations/${c.a.id}`} className="admin-link">
                  {customerName(c.a)} ({c.a.companyCityNormalized ?? "?"})
                </Link>{" "}
                vs{" "}
                <Link href={`/fr/${adminPrefix}/reservations/${c.b.id}`} className="admin-link">
                  {customerName(c.b)} ({c.b.companyCityNormalized ?? "?"})
                </Link>{" "}
                · {formatDate(c.a.bookingDate)} → {formatDate(c.b.bookingDate)}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">Concentration géographique</h2>
        {cities.length === 0 ? (
          <p className="admin-meta-block">Aucune ville sur la période.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ville</th>
                  <th>Bookings</th>
                  <th>Distance hub Paris</th>
                  <th>Buffer recommandé</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => {
                  let d: number | null = null;
                  let buf: number | null = null;
                  if (c.lat != null && c.lng != null) {
                    const r = distanceAndBufferFromHub(c.lat, c.lng);
                    d = r.distanceKm;
                    buf = r.travelBufferDays;
                  }
                  return (
                    <tr key={c.city}>
                      <td>{c.city}</td>
                      <td>
                        <strong>{c.count}</strong>
                      </td>
                      <td>{d != null ? `${Math.round(d)} km` : "—"}</td>
                      <td>{buf != null ? `${buf} j` : "—"}</td>
                      <td>
                        <details>
                          <summary className="admin-link">{c.count} → voir</summary>
                          <ul className="admin-meta-block mt-[var(--space-admin-2)]">
                            {c.bookings.map((b) => (
                              <li key={b.id}>
                                <Link
                                  href={`/fr/${adminPrefix}/reservations/${b.id}`}
                                  className="admin-link"
                                >
                                  {customerName(b)} — {b.interventionType}
                                </Link>{" "}
                                · {formatDate(b.bookingDate)} · {b.status}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
