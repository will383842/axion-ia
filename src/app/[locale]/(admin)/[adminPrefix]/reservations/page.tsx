// Liste réservations admin (Sprint X.8 — Booking V1 V2).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.8
//        Périmètre — Liste avec filtres status / search / sort
//
// V1 livré
//   - Tableau bookings avec colonnes : Date / Société / Intervention /
//     Status (badge) / Montant / Actions
//   - Filtres par status via URL (?status=...)
//   - Tri par updatedAt desc (récent en haut)
//   - Pagination 20/page
//
// V1.5 reporté (X.8b)
//   - Search globale (company / contact / email)
//   - Filtre par période bookingDate
//   - Export CSV
//   - Drawer in-page (URL param ?id=) au lieu de page séparée

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BookingStatus } from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_FILTERS: { value: BookingStatus | "all" | "active"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "active", label: "Actives" },
  { value: "awaiting_admin_validation", label: "Prêtes à valider (D49)" },
  { value: "contract_payment_sent", label: "En attente client" },
  { value: "confirmed", label: "Confirmées" },
  { value: "paused", label: "En pause" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Terminées" },
  { value: "cancelled_by_admin", label: "Annulées admin" },
  { value: "cancelled_by_user", label: "Annulées client" },
  { value: "no_show", label: "No-show" },
];

const STATUS_LABELS: Partial<Record<BookingStatus, string>> = {
  option_pending: "Option en attente",
  cadrage_scheduled: "Cadrage planifié",
  cadrage_held: "Cadrage tenu",
  quote_required: "Devis requis",
  quote_sent: "Devis envoyé",
  quote_signed: "Devis signé",
  contract_pending: "Contrat en préparation",
  contract_payment_sent: "Contrat & acompte envoyés",
  contract_signed: "Contrat signé",
  awaiting_admin_validation: "Acompte reçu — à valider",
  confirmed: "Confirmée",
  paused: "En pause",
  reminded_j7: "Rappel J-7 envoyé",
  in_progress: "En cours",
  completed: "Terminée",
  invoiced_balance: "Solde facturé",
  installment_overdue: "Échéance en retard",
  paid_balance: "Soldée",
  disputed: "Recouvrement",
  archived: "Archivée",
  cancelled: "Annulée",
  cancelled_by_user: "Annulée client",
  cancelled_by_admin: "Annulée admin",
  no_show: "No-show",
  force_majeure: "Force majeure",
  refunded_partial: "Remboursée partiellement",
  refunded_full: "Remboursée intégralement",
};

const ACTIVE_STATUSES: BookingStatus[] = [
  "contract_pending",
  "contract_payment_sent",
  "awaiting_admin_validation",
  "confirmed",
  "paused",
  "in_progress",
  "reminded_j7",
];

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatEur(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const PAGE_SIZE = 20;

export default async function ReservationsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rawStatus = sp.status ?? "active";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: { status?: BookingStatus | { in: BookingStatus[] } } = {};
  if (rawStatus !== "all") {
    if (rawStatus === "active") {
      where.status = { in: ACTIVE_STATUSES };
    } else {
      where.status = rawStatus as BookingStatus;
    }
  }

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        bookingDate: true,
        interventionType: true,
        participantsCount: true,
        basePriceHtCents: true,
        updatedAt: true,
        submission: { select: { companyName: true, contactName: true, contactEmail: true } },
        fromSubmission: { select: { companyName: true, contactName: true, contactEmail: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Réservations</h1>
          <p className="admin-meta">
            {total} booking{total > 1 ? "s" : ""} · page {page}/{totalPages}
          </p>
        </div>
      </div>

      <div className="admin-card admin-filters">
        <div className="admin-filters-grid">
          {STATUS_FILTERS.map((f) => {
            const active = (rawStatus ?? "active") === f.value;
            const href =
              f.value === "active"
                ? `/fr/${adminPrefix}/reservations`
                : `/fr/${adminPrefix}/reservations?status=${f.value}`;
            return (
              <Link
                key={f.value}
                href={href}
                className={`admin-button-ghost ${active ? "admin-button-active" : ""}`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date intervention</th>
              <th>Société</th>
              <th>Contact</th>
              <th>Intervention</th>
              <th>Status</th>
              <th>Montant HT</th>
              <th>Mise à jour</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-table-empty">
                  Aucun booking pour ce filtre.
                </td>
              </tr>
            ) : (
              items.map((b) => {
                const company = b.fromSubmission?.companyName ?? b.submission?.companyName ?? "—";
                const contactName =
                  b.fromSubmission?.contactName ?? b.submission?.contactName ?? "—";
                const contactEmail =
                  b.fromSubmission?.contactEmail ?? b.submission?.contactEmail ?? "—";
                return (
                  <tr key={b.id}>
                    <td>{formatDate(b.bookingDate)}</td>
                    <td>
                      <div>{company}</div>
                    </td>
                    <td>
                      <div>{contactName}</div>
                      <div className="admin-meta-small">{contactEmail}</div>
                    </td>
                    <td>
                      <div>{b.interventionType}</div>
                      <div className="admin-meta-small">{b.participantsCount} participant(s)</div>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge-${b.status}`}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td>{formatEur(b.basePriceHtCents)}</td>
                    <td>{formatDate(b.updatedAt)}</td>
                    <td>
                      <Link href={`/fr/${adminPrefix}/reservations/${b.id}`} className="admin-link">
                        Détail →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-card">
          <div className="admin-filters-actions">
            {page > 1 && (
              <Link
                href={`/fr/${adminPrefix}/reservations?status=${rawStatus}&page=${page - 1}`}
                className="admin-button-ghost"
              >
                ← Précédent
              </Link>
            )}
            <span className="admin-meta">
              Page {page}/{totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/fr/${adminPrefix}/reservations?status=${rawStatus}&page=${page + 1}`}
                className="admin-button-ghost"
              >
                Suivant →
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
