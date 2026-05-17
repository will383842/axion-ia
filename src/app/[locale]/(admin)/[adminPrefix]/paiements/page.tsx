// Admin Paiements (Sprint X.11 — Booking V1).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.11
//
// V1 livré
//   - Tableau global paiements (filtré status/provider/period)
//   - Section "Trésorerie" — KPIs encaissé / en attente / retards
//   - Lien export CSV (vue /paiements/export)
//   - Lien fiche détail booking depuis chaque ligne
//
// V1.5 reporté (X.11b)
//   - Fiche détail booking inline (timeline échéancier 4 profils)
//     [pour l'instant, drill-down vers /reservations/[id] + /factures/[id]]
//   - Réconciliation Stripe ↔ banque
//   - Graphique 12 mois revenus

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { PaiementsV2 } from "./_v2/PaiementsV2";
import type {
  PaymentProvider,
  PaymentStatus,
  PaymentType,
} from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "En attente",
  processing: "En traitement",
  succeeded: "Succès",
  failed: "Échoué",
  refunded: "Remboursé",
  cancelled: "Annulé",
};

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  manual_wire: "Virement",
  manual_check: "Chèque",
  manual_cash: "Espèces",
};

const TYPE_LABELS: Record<PaymentType, string> = {
  deposit: "Acompte",
  installment_2: "Tranche 2",
  installment_3: "Tranche 3",
  balance: "Solde",
  refund: "Remboursement",
};

const PAGE_SIZE = 30;

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

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(1);
  return r;
}

export default async function PaiementsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <PaiementsV2 adminPrefix={adminPrefix} searchParams={sp} />;
  }

  const status = sp.status as PaymentStatus | undefined;
  const provider = sp.provider as PaymentProvider | undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: { status?: PaymentStatus; provider?: PaymentProvider } = {};
  if (status) where.status = status;
  if (provider) where.provider = provider;

  const now = new Date();
  const monthStart = startOfMonth(now);

  const [items, total, encaisseMois, enAttente, retardsCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        provider: true,
        amountCents: true,
        currency: true,
        type: true,
        status: true,
        paidAt: true,
        failedAt: true,
        mode: true,
        receivedReference: true,
        bookingId: true,
        invoiceId: true,
        invoice: { select: { number: true, payerName: true } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart }, status: "succeeded" },
      _sum: { amountCents: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["issued", "partially_paid", "overdue"] } },
      _sum: { amountTtcCents: true },
    }),
    prisma.invoice.count({
      where: { status: { in: ["issued", "partially_paid", "overdue"] }, dueAt: { lt: now } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Paiements</h1>
          <p className="admin-meta">
            {total} paiement{total > 1 ? "s" : ""} · page {page}/{totalPages}
          </p>
        </div>
        <Link href={`/fr/${adminPrefix}/paiements/export`} className="admin-button-ghost">
          Export CSV →
        </Link>
      </div>

      {/* ── Trésorerie ─────────────────────────────────────────────── */}
      <h2 className="admin-h2">Trésorerie</h2>
      <div className="admin-kpi-grid">
        <div className="admin-card">
          <p className="admin-card-label">Encaissé ce mois</p>
          <p className="admin-kpi-value">{formatEur(encaisseMois._sum.amountCents)}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">En attente (factures émises)</p>
          <p className="admin-kpi-value">{formatEur(enAttente._sum.amountTtcCents)}</p>
        </div>
        <Link
          href={`/fr/${adminPrefix}/factures?status=overdue`}
          className="admin-card admin-kpi-link"
        >
          <p className="admin-card-label">Factures en retard</p>
          <p className="admin-kpi-value">{retardsCount}</p>
        </Link>
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────── */}
      <div className="admin-card admin-filters">
        <p className="admin-meta-block">Status</p>
        <div className="admin-filters-grid">
          <Link
            href={`/fr/${adminPrefix}/paiements`}
            className={`admin-button-ghost ${!status ? "admin-button-active" : ""}`}
          >
            Tous
          </Link>
          {(Object.keys(STATUS_LABELS) as PaymentStatus[]).map((s) => (
            <Link
              key={s}
              href={`/fr/${adminPrefix}/paiements?status=${s}${provider ? `&provider=${provider}` : ""}`}
              className={`admin-button-ghost ${status === s ? "admin-button-active" : ""}`}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
        <p className="admin-meta-block" style={{ marginTop: 16 }}>
          Provider
        </p>
        <div className="admin-filters-grid">
          <Link
            href={`/fr/${adminPrefix}/paiements${status ? `?status=${status}` : ""}`}
            className={`admin-button-ghost ${!provider ? "admin-button-active" : ""}`}
          >
            Tous
          </Link>
          {(Object.keys(PROVIDER_LABELS) as PaymentProvider[]).map((p) => {
            const qs = new URLSearchParams();
            if (status) qs.set("status", status);
            qs.set("provider", p);
            return (
              <Link
                key={p}
                href={`/fr/${adminPrefix}/paiements?${qs.toString()}`}
                className={`admin-button-ghost ${provider === p ? "admin-button-active" : ""}`}
              >
                {PROVIDER_LABELS[p]}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Tableau ────────────────────────────────────────────────── */}
      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date paiement</th>
              <th>Provider</th>
              <th>Mode</th>
              <th>Type</th>
              <th>Facture</th>
              <th>Client</th>
              <th>Référence</th>
              <th>Montant</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="admin-table-empty">
                  Aucun paiement pour ce filtre.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.paidAt ?? p.failedAt)}</td>
                  <td>{PROVIDER_LABELS[p.provider]}</td>
                  <td>{p.mode ?? "—"}</td>
                  <td>{TYPE_LABELS[p.type]}</td>
                  <td>
                    {p.invoiceId ? (
                      <Link
                        href={`/fr/${adminPrefix}/factures/${p.invoiceId}`}
                        className="admin-link"
                      >
                        <code>{p.invoice?.number ?? "voir →"}</code>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{p.invoice?.payerName ?? "—"}</td>
                  <td className="admin-meta-small">{p.receivedReference ?? "—"}</td>
                  <td>{formatEur(p.amountCents)}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${p.status}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/fr/${adminPrefix}/reservations/${p.bookingId}`}
                      className="admin-link"
                    >
                      Booking →
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
                href={`/fr/${adminPrefix}/paiements?page=${page - 1}${status ? `&status=${status}` : ""}${provider ? `&provider=${provider}` : ""}`}
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
                href={`/fr/${adminPrefix}/paiements?page=${page + 1}${status ? `&status=${status}` : ""}${provider ? `&provider=${provider}` : ""}`}
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
