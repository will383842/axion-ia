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

  const status = (sp.status ?? "all") as InvoiceStatus | "all";
  const type = sp.type as InvoiceType | undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: { status?: InvoiceStatus; type?: InvoiceType } = {};
  if (status !== "all") where.status = status;
  if (type) where.type = type;

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        issuedAt: true,
        dueAt: true,
        amountTtcCents: true,
        amountHtCents: true,
        payerName: true,
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Factures</h1>
          <p className="admin-meta">
            {total} facture{total > 1 ? "s" : ""} · page {page}/{totalPages}
          </p>
        </div>
      </div>

      <div className="admin-card admin-filters">
        <p className="admin-meta-block">Statut</p>
        <div className="admin-filters-grid">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            const href =
              f.value === "all"
                ? `/fr/${adminPrefix}/factures${type ? `?type=${type}` : ""}`
                : `/fr/${adminPrefix}/factures?status=${f.value}${type ? `&type=${type}` : ""}`;
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
        <p className="admin-meta-block" style={{ marginTop: 16 }}>
          Type
        </p>
        <div className="admin-filters-grid">
          <Link
            href={`/fr/${adminPrefix}/factures${status !== "all" ? `?status=${status}` : ""}`}
            className={`admin-button-ghost ${!type ? "admin-button-active" : ""}`}
          >
            Tous
          </Link>
          {(Object.keys(TYPE_LABELS) as InvoiceType[]).map((t) => {
            const active = type === t;
            const qs = new URLSearchParams();
            if (status !== "all") qs.set("status", status);
            qs.set("type", t);
            return (
              <Link
                key={t}
                href={`/fr/${adminPrefix}/factures?${qs.toString()}`}
                className={`admin-button-ghost ${active ? "admin-button-active" : ""}`}
              >
                {TYPE_LABELS[t]}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Émise</th>
              <th>Client</th>
              <th>Type</th>
              <th>Status</th>
              <th>Montant TTC</th>
              <th>Échéance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-table-empty">
                  Aucune facture pour ce filtre.
                </td>
              </tr>
            ) : (
              items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <code>{i.number}</code>
                  </td>
                  <td>{formatDate(i.issuedAt)}</td>
                  <td>{i.payerName ?? "—"}</td>
                  <td>{TYPE_LABELS[i.type]}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${i.status}`}>
                      {STATUS_LABELS[i.status]}
                    </span>
                  </td>
                  <td>{formatEur(i.amountTtcCents)}</td>
                  <td>{formatDate(i.dueAt)}</td>
                  <td>
                    <Link href={`/fr/${adminPrefix}/factures/${i.id}`} className="admin-link">
                      Détail →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-card">
          <div className="admin-filters-actions">
            {page > 1 && (
              <Link
                href={`/fr/${adminPrefix}/factures?status=${status}${type ? `&type=${type}` : ""}&page=${page - 1}`}
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
                href={`/fr/${adminPrefix}/factures?status=${status}${type ? `&type=${type}` : ""}&page=${page + 1}`}
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
