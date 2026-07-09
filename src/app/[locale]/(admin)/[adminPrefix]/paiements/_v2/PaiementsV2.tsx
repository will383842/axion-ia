// Refonte admin mai 2026 — PR 6 — paiements V2 (KPIs trésorerie + liste).

import Link from "next/link";
import { Hash, Hourglass, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type {
  PaymentProvider,
  PaymentStatus,
  PaymentType,
} from "../../../../../../../prisma/generated/client";
import {
  AdminFilterTabs,
  AdminPageShell,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
} from "@/components/admin/ui";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";

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
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(1);
  return r;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function PaiementsV2({
  adminPrefix,
  searchParams,
}: Props): Promise<React.ReactElement> {
  const status = searchParams["status"] as PaymentStatus | undefined;
  const provider = searchParams["provider"] as PaymentProvider | undefined;
  const page = Math.max(1, parseInt(searchParams["page"] ?? "1", 10) || 1);

  const where: { status?: PaymentStatus; provider?: PaymentProvider } = {};
  if (status) where.status = status;
  if (provider) where.provider = provider;

  const now = new Date();
  const monthStart = startOfMonth(now);

  const [items, total, encaisseMois, enAttenteCount, enAttenteAmount] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        provider: true,
        amountCents: true,
        type: true,
        status: true,
        paidAt: true,
        bookingId: true,
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart }, status: "succeeded" },
      _sum: { amountCents: true },
    }),
    prisma.payment.count({ where: { status: "pending" } }),
    prisma.payment.aggregate({
      where: { status: "pending" },
      _sum: { amountCents: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/fr/${adminPrefix}/paiements`;

  const statusOptions = [
    { value: "all", label: "Tous", href: base },
    ...(Object.keys(STATUS_LABELS) as PaymentStatus[]).map((s) => ({
      value: s,
      label: STATUS_LABELS[s],
      href: `${base}?status=${s}`,
    })),
  ];

  const rows = items.map((p) => ({
    id: p.id,
    ...(p.bookingId ? { detailHref: `/fr/${adminPrefix}/reservations/${p.bookingId}` } : {}),
    cells: [
      fmtDate(p.paidAt),
      fmtEur(p.amountCents),
      TYPE_LABELS[p.type],
      PROVIDER_LABELS[p.provider],
      <AdminStatusBadge
        key="status"
        type="invoice"
        status={p.status}
        label={STATUS_LABELS[p.status]}
      />,
    ],
  }));

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Paiements"
        description={`${total} paiement(s) · page ${page}/${totalPages}`}
        actions={(() => {
          const exportParams = new URLSearchParams();
          if (status) exportParams.set("status", status);
          if (provider) exportParams.set("provider", provider);
          const exportQs = exportParams.toString();
          const exportHref = exportQs ? `${base}/export?${exportQs}` : `${base}/export`;
          return (
            <Link href={exportHref} className="admin-button-ghost">
              Exporter CSV
            </Link>
          );
        })()}
      />
      <section
        aria-label="Trésorerie"
        className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3"
      >
        <AdminStatCard
          label="Encaissé ce mois"
          value={fmtEur(encaisseMois._sum.amountCents)}
          tone="success"
          icon={Wallet}
        />
        <AdminStatCard
          label="Paiements en attente"
          value={enAttenteCount}
          meta={fmtEur(enAttenteAmount._sum.amountCents)}
          tone={enAttenteCount > 0 ? "warning" : "default"}
          icon={Hourglass}
        />
        <AdminStatCard label="Total filtré" value={total} icon={Hash} />
      </section>
      <AdminListScaffold
        title="Mouvements"
        itemLabel="paiement(s)"
        total={total}
        page={page}
        totalPages={totalPages}
        filters={
          <AdminFilterTabs current={status ?? "all"} options={statusOptions} label="Statut" />
        }
        columnHeaders={["Payé le", "Montant", "Type", "Prestataire", "Statut"]}
        rows={rows}
        paginationBaseHref={base}
        paginationPreservedParams={{ status: status ?? undefined, provider: provider ?? undefined }}
      />
    </AdminPageShell>
  );
}
