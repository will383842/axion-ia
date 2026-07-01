// Refonte admin mai 2026 — PR 6 — liste factures V2.

import { prisma } from "@/lib/prisma";
import type { InvoiceStatus, InvoiceType } from "../../../../../../../prisma/generated/client";
import { AdminFilterTabs, AdminStatusBadge } from "@/components/admin/ui";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";

const STATUS_FILTERS = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "issued", label: "Émises" },
  { value: "partially_paid", label: "Partiel" },
  { value: "paid", label: "Payées" },
  { value: "overdue", label: "En retard" },
  { value: "cancelled", label: "Annulées" },
  { value: "refunded", label: "Remboursées" },
] as const;

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

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function FacturesV2({
  adminPrefix,
  searchParams,
}: Props): Promise<React.ReactElement> {
  const status = (searchParams["status"] ?? "all") as InvoiceStatus | "all";
  const type = searchParams["type"] as InvoiceType | undefined;
  const page = Math.max(1, parseInt(searchParams["page"] ?? "1", 10) || 1);

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
        payerName: true,
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/fr/${adminPrefix}/factures`;

  const statusOptions = STATUS_FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
    href:
      f.value === "all"
        ? `${base}${type ? `?type=${type}` : ""}`
        : `${base}?status=${f.value}${type ? `&type=${type}` : ""}`,
  }));

  const typeOptions = [
    {
      value: "all",
      label: "Tous",
      href: `${base}${status !== "all" ? `?status=${status}` : ""}`,
    },
    ...(Object.keys(TYPE_LABELS) as InvoiceType[]).map((t) => {
      const qs = new URLSearchParams();
      if (status !== "all") qs.set("status", status);
      qs.set("type", t);
      return { value: t, label: TYPE_LABELS[t], href: `${base}?${qs.toString()}` };
    }),
  ];

  const rows = items.map((i) => ({
    id: i.id,
    detailHref: `${base}/${i.id}`,
    cells: [
      <code key="number">{i.number}</code>,
      fmtDate(i.issuedAt),
      i.payerName ?? "—",
      TYPE_LABELS[i.type],
      <AdminStatusBadge
        key="status"
        type="invoice"
        status={i.status}
        label={STATUS_LABELS[i.status]}
      />,
      fmtEur(i.amountTtcCents),
      fmtDate(i.dueAt),
    ],
  }));

  return (
    <AdminListScaffold
      title="Factures"
      itemLabel="facture(s)"
      total={total}
      page={page}
      totalPages={totalPages}
      filters={
        <div className="flex flex-col gap-[var(--space-admin-4)]">
          <AdminFilterTabs current={status} options={statusOptions} label="Statut" />
          <AdminFilterTabs current={type ?? "all"} options={typeOptions} label="Type" />
        </div>
      }
      columnHeaders={["Numéro", "Émise", "Client", "Type", "Statut", "Montant TTC", "Échéance"]}
      rows={rows}
      paginationBaseHref={base}
      paginationPreservedParams={{
        status: status === "all" ? undefined : status,
        type: type ?? undefined,
      }}
    />
  );
}
