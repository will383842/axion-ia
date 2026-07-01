// Refonte admin mai 2026 — PR 6 (ADR 0028, audit A3 row reservations).
//
// Liste réservations V2 — utilise AdminListScaffold + AdminStatusBadge +
// AdminFilterTabs. Re-fetch Prisma identique à V1 (Server Component).

import { prisma } from "@/lib/prisma";
import type { BookingStatus } from "../../../../../../../prisma/generated/client";
import { AdminFilterTabs, AdminStatusBadge } from "@/components/admin/ui";
import { interventionTypeLabel } from "@/lib/intervention-label";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "active", label: "Actives" },
  { value: "all", label: "Toutes" },
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
  awaiting_admin_validation: "Acompte reçu — à valider",
  contract_payment_sent: "Contrat & acompte envoyés",
  confirmed: "Confirmée",
  paused: "En pause",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled_by_user: "Annulée client",
  cancelled_by_admin: "Annulée admin",
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

const PAGE_SIZE = 20;

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
function fmtEur(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function ReservationsV2({
  adminPrefix,
  searchParams,
}: Props): Promise<React.ReactElement> {
  const rawStatus = searchParams["status"] ?? "active";
  const page = Math.max(1, parseInt(searchParams["page"] ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // Filtre par jour (lien depuis le calendrier console — modèle multi-demandes).
  const rawDate = searchParams["date"];
  const dateValid = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate);

  const where: {
    status?: BookingStatus | { in: BookingStatus[] };
    bookingDate?: { gte: Date; lt: Date };
  } = {};
  if (rawStatus !== "all") {
    if (rawStatus === "active") where.status = { in: ACTIVE_STATUSES };
    else where.status = rawStatus as BookingStatus;
  }
  if (dateValid) {
    const start = new Date(`${rawDate}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    where.bookingDate = { gte: start, lt: end };
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
        formateur: { select: { prenom: true, nom: true } },
        submission: { select: { companyName: true, contactName: true, contactEmail: true } },
        fromSubmission: { select: { companyName: true, contactName: true, contactEmail: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/fr/${adminPrefix}/reservations`;

  const filterOptions = STATUS_FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
    href: f.value === "active" ? base : `${base}?status=${f.value}`,
  }));

  const rows = items.map((b) => {
    const company = b.fromSubmission?.companyName ?? b.submission?.companyName ?? "—";
    const contactName = b.fromSubmission?.contactName ?? b.submission?.contactName ?? "—";
    const contactEmail = b.fromSubmission?.contactEmail ?? b.submission?.contactEmail ?? "—";
    return {
      id: b.id,
      detailHref: `${base}/${b.id}`,
      cells: [
        fmtDate(b.bookingDate),
        company,
        <span key="contact" className="block">
          <div>{contactName}</div>
          <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {contactEmail}
          </div>
        </span>,
        <span key="intervention" className="block">
          <div>{interventionTypeLabel(b.interventionType)}</div>
          <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {b.participantsCount} participant(s)
          </div>
        </span>,
        <AdminStatusBadge
          key="status"
          type="booking"
          status={b.status}
          label={STATUS_LABELS[b.status] ?? b.status}
        />,
        b.formateur ? `${b.formateur.prenom} ${b.formateur.nom}` : "—",
        fmtEur(b.basePriceHtCents),
        fmtDate(b.updatedAt),
      ],
    };
  });

  return (
    <AdminListScaffold
      title={
        dateValid
          ? `Réservations · ${fmtDate(new Date(`${rawDate}T00:00:00.000Z`))}`
          : "Réservations"
      }
      itemLabel="réservation(s)"
      total={total}
      page={page}
      totalPages={totalPages}
      filters={<AdminFilterTabs current={rawStatus} options={filterOptions} label="Statut" />}
      columnHeaders={[
        "Date intervention",
        "Société",
        "Contact",
        "Intervention",
        "Statut",
        "Formateur",
        "Montant HT",
        "Mise à jour",
      ]}
      rows={rows}
      paginationBaseHref={base}
      paginationPreservedParams={
        dateValid ? { status: rawStatus, date: rawDate } : { status: rawStatus }
      }
    />
  );
}
