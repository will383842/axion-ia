// Liste devis admin (Sprint A — UI admin devis).
//
// Tableau paginé 25/page. Filtres : status (draft/sent/accepted/declined/expired).
// Lien détail [id] pour actions admin.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { QuoteStatus } from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté (signé)",
  declined: "Refusé",
  expired: "Expiré",
};

const STATUS_FILTERS: { value: QuoteStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "sent", label: "Envoyés" },
  { value: "accepted", label: "Acceptés" },
  { value: "declined", label: "Refusés" },
  { value: "expired", label: "Expirés" },
];

const PAGE_SIZE = 25;

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function DevisListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const status = (sp.status ?? "all") as QuoteStatus | "all";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

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
        sentAt: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
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

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Devis</h1>
          <p className="admin-meta">
            {total} devis · page {page}/{totalPages}
          </p>
        </div>
      </div>

      <div className="admin-card admin-filters">
        <div className="admin-filters-grid">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            const href =
              f.value === "all"
                ? `/fr/${adminPrefix}/devis`
                : `/fr/${adminPrefix}/devis?status=${f.value}`;
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
              <th>Numéro</th>
              <th>Société</th>
              <th>Contact</th>
              <th>Intervention</th>
              <th>Montant TTC</th>
              <th>Status</th>
              <th>Validité</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-table-empty">
                  Aucun devis pour ce filtre.
                </td>
              </tr>
            ) : (
              items.map((q) => {
                const sub = q.booking.fromSubmission ?? q.booking.submission;
                return (
                  <tr key={q.id}>
                    <td>
                      <code>{q.number}</code>
                    </td>
                    <td>{sub?.companyName ?? "—"}</td>
                    <td>{sub?.contactName ?? "—"}</td>
                    <td>{q.booking.interventionType}</td>
                    <td>{formatEur(q.amountTtcCents)}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${q.status}`}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </td>
                    <td>{formatDate(q.validUntil)}</td>
                    <td>
                      <Link href={`/fr/${adminPrefix}/devis/${q.id}`} className="admin-link">
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
                href={`/fr/${adminPrefix}/devis?status=${status}&page=${page - 1}`}
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
                href={`/fr/${adminPrefix}/devis?status=${status}&page=${page + 1}`}
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
