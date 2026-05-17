// Heatmap géographique calendrier admin (Sprint X.9 — Booking V1).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.9 + §X.16
//
// Affiche la liste des bookings confirmés/à venir du mois groupés par ville
// (companyCityNormalized) avec distance hub Paris + buffer trajet (0/0.5/1j).
// Alerte visuelle si 2 bookings 48h consécutives à plus de 600 km l'un de
// l'autre (geo conflict — Will doit blocker un slot tampon).
//
// V1 minimum livré
//   - Section "Concentration géographique" — table villes × bookings × distance
//   - Section "Conflits 48h" — alertes si > 600 km dans fenêtre 48h
//
// V1.5 reporté (X.9b)
//   - Carte interactive Leaflet
//   - Drag-drop reschedule depuis carte (D60)
//   - Override hub depuis SiteSetting

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { distanceAndBufferFromHub, distanceKm } from "@/lib/haversine";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { HeatmapV2 } from "./_v2/HeatmapV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(1);
  return r;
}
function endOfMonth(d: Date): Date {
  const r = startOfMonth(d);
  r.setMonth(r.getMonth() + 1);
  r.setMilliseconds(-1);
  return r;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

const CONFLICT_THRESHOLD_KM = 600;
const WARN_THRESHOLD_KM = 300;

export default async function CalendarHeatmapPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = endOfMonth(periodStart);

  const bookings = await prisma.booking.findMany({
    where: {
      bookingDate: { gte: periodStart, lte: periodEnd },
      status: { in: ["confirmed", "awaiting_admin_validation", "in_progress", "paused"] },
    },
    orderBy: { bookingDate: "asc" },
    select: {
      id: true,
      bookingDate: true,
      interventionType: true,
      status: true,
      companyCityNormalized: true,
      companyLat: true,
      companyLng: true,
      travelBufferDays: true,
      submission: { select: { companyName: true } },
      fromSubmission: { select: { companyName: true } },
    },
  });

  if (await isAdminV2Enabled()) {
    return (
      <HeatmapV2
        adminPrefix={adminPrefix}
        year={year}
        month={month}
        periodStart={periodStart}
        bookings={bookings}
      />
    );
  }

  // Groupage par ville
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
      bookings: [],
    };
    entry.count++;
    entry.bookings.push(b);
    byCity.set(city, entry);
  }
  const cities = Array.from(byCity.values()).sort((a, b) => b.count - a.count);

  // Détection conflits 48h
  type Conflict = {
    a: (typeof bookings)[number];
    b: (typeof bookings)[number];
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

  function customerName(b: {
    submission: { companyName: string | null } | null;
    fromSubmission: { companyName: string | null } | null;
  }): string {
    return b.fromSubmission?.companyName ?? b.submission?.companyName ?? "—";
  }

  const periodLabel = `${new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(periodStart)}`;
  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <Link href={`/fr/${adminPrefix}/calendrier`} className="admin-link admin-back">
            ← Calendrier
          </Link>
          <h1 className="admin-h1-large">Heatmap géographique — {periodLabel}</h1>
          <p className="admin-meta">
            {bookings.length} booking{bookings.length > 1 ? "s" : ""} actif
            {bookings.length > 1 ? "s" : ""} sur la période
          </p>
        </div>
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
      </div>

      {/* ── Conflits 48h ──────────────────────────────────────────── */}
      <div className="admin-card admin-card-wide">
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
                  style={
                    c.distanceKm >= CONFLICT_THRESHOLD_KM
                      ? { color: "var(--color-terracotta)" }
                      : undefined
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
      </div>

      {/* ── Concentration par ville ──────────────────────────────── */}
      <div className="admin-card admin-card-wide">
        <h2 className="admin-h2">Concentration géographique</h2>
        {cities.length === 0 ? (
          <p className="admin-meta-block">Aucune ville sur la période.</p>
        ) : (
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
                        <ul className="admin-meta-block" style={{ marginTop: 8 }}>
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
        )}
      </div>
    </section>
  );
}
