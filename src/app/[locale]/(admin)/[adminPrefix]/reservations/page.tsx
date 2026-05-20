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
import { ReservationsV2 } from "./_v2/ReservationsV2";
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

  return <ReservationsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

