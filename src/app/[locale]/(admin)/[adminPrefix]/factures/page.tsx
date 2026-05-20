// Liste factures admin (Sprint X.10 — Booking V1).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.10
//        Admin UI /admin/factures
//
// V1 livré
//   - Liste paginée 25/page
//   - Filtres par status (draft/issued/partially_paid/paid/overdue/cancelled)
//     et par type (deposit/balance/installment/full/credit_note)
//   - Tri par issuedAt desc
//   - Colonnes : N° / Date / Client / Type / Status / Montant TTC / Échéance / Action
//
// V1.5 reporté (X.10b)
//   - Export CSV mensuel
//   - Filtre par période issuedAt
//   - Search par number / payer

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FacturesV2 } from "./_v2/FacturesV2";
import type { InvoiceStatus, InvoiceType } from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_FILTERS: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "issued", label: "Émises" },
  { value: "partially_paid", label: "Partiel" },
  { value: "paid", label: "Payées" },
  { value: "overdue", label: "En retard" },
  { value: "cancelled", label: "Annulées" },
  { value: "refunded", label: "Remboursées" },
];

const TYPE_LABELS: Record<InvoiceType, string> = {
  deposit: "Acompte",
  balance: "Solde",
  installment: "Échéance",
  full: "Total",
  credit_note: "Avoir",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  issued: "Émise",
  paid: "Payée",
  partially_paid: "Partiellement payée",
  overdue: "En retard",
  cancelled: "Annulée",
  void: "Annulée (void)",
  refunded: "Remboursée",
};

const PAGE_SIZE = 25;

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
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function FacturesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <FacturesV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

