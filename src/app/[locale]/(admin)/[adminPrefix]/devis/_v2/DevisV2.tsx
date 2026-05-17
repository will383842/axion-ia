// Refonte admin mai 2026 — PR 6 — liste devis V2.

import { prisma } from "@/lib/prisma";
import type { QuoteStatus } from "../../../../../../../prisma/generated/client";
import { AdminFilterTabs, AdminStatusBadge } from "@/components/admin/ui";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté (signé)",
  declined: "Refusé",
  expired: "Expiré",
};

const STATUS_FILTERS = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "sent", label: "Envoyés" },
  { value: "accepted", label: "Acceptés" },
  { value: "declined", label: "Refusés" },
  { value: "expired", label: "Expirés" },
] as const;

const PAGE_SIZE = 25;
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
function fmtEur(cents: number): string {
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

export async function DevisV2({ adminPrefix, searchParams }: Props): Promise<React.ReactElement> {
  const status = (searchParams["status"] ?? "all") as QuoteStatus | "all";
  const page = Math.max(1, parseInt(searchParams["page"] ?? "1", 10) || 1);
  const where: { status?: QuoteStatus } = {};
  if (status !== "all") where.status = status;

  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        amountTtcCents: true,
        validUntil: true,
        booking: {
          select: {
            interventionType: true,
            submission: { select: { companyName: true, contactName: true } },
            fromSubmission: { select: { companyName: true, contactName: true } },
          },
        },
      },
    }),
    prisma.quote.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/fr/${adminPrefix}/devis`;
  const filterOptions = STATUS_FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
    href: f.value === "all" ? base : `${base}?status=${f.value}`,
  }));

  const rows = items.map((q) => {
    const sub = q.booking.fromSubmission ?? q.booking.submission;
    return {
      id: q.id,
      detailHref: `${base}/${q.id}`,
      cells: [
        <code key="number">{q.number}</code>,
        sub?.companyName ?? "—",
        sub?.contactName ?? "—",
        q.booking.interventionType,
        fmtEur(q.amountTtcCents),
        <AdminStatusBadge
          key="status"
          type="quote"
          status={q.status}
          label={STATUS_LABELS[q.status]}
        />,
        fmtDate(q.validUntil),
      ],
    };
  });

  return (
    <AdminListScaffold
      title="Devis"
      itemLabel="devis"
      total={total}
      page={page}
      totalPages={totalPages}
      filters={<AdminFilterTabs current={status} options={filterOptions} label="Statut" />}
      columnHeaders={[
        "Numéro",
        "Société",
        "Contact",
        "Intervention",
        "Montant TTC",
        "Status",
        "Validité",
      ]}
      rows={rows}
      paginationBaseHref={base}
      paginationPreservedParams={{ status: status === "all" ? undefined : status }}
    />
  );
}
