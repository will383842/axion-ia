// Admin — liste des demandes de tournage podcast (page publique `/podcast`).
// Calqué sur `qr-codes/page.tsx` : server component mince, Prisma direct,
// filtres par statut en liens GET, zéro JS client.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminEmptyState,
  AdminBadge,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui/AdminTable";
import {
  PODCAST_REQUEST_STATUSES,
  PODCAST_REQUEST_STATUS_VALUES,
  podcastRequestStatusLabel,
  podcastRequestStatusTone,
} from "@/features/admin-podcast-requests/statuses";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ status?: string }>;
}

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);

export default async function PodcastRequestsListPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const { status } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const activeStatus = PODCAST_REQUEST_STATUS_VALUES.includes(status as never) ? status : undefined;

  const rows = await prisma.podcastRequest.findMany({
    ...(activeStatus ? { where: { status: activeStatus as never } } : {}),
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  type Row = (typeof rows)[number];

  const base = `/${locale}/${adminPrefix}/podcast`;

  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    {
      key: "company",
      header: "Entreprise",
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.companyName}</div>
          <div className="truncate text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {decryptPii(r.leaderName)}
          </div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Lieu du tournage",
      hiddenBelow: "md",
      cell: (r) => (
        <span className="text-[length:var(--text-admin-sm)]">
          {r.city} ({r.postalCode})
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      hiddenBelow: "lg",
      cell: (r) => (
        <div className="min-w-0 text-[length:var(--text-admin-sm)]">
          <div className="truncate">{decryptPii(r.email)}</div>
          <div className="truncate text-[color:var(--color-admin-fg-muted)]">
            {decryptPii(r.phone)}
          </div>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Reçue le",
      hiddenBelow: "sm",
      cell: (r) => (
        <span className="text-[length:var(--text-admin-sm)]">{fmtDateTime(r.createdAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Statut",
      align: "center",
      cell: (r) => (
        <AdminBadge tone={podcastRequestStatusTone(r.status)}>
          {podcastRequestStatusLabel(r.status)}
        </AdminBadge>
      ),
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Demandes de podcast"
        description="Demandes de tournage déposées depuis la page publique /podcast (offre gratuite, tournage dans les locaux du dirigeant). Le statut sert au suivi interne — rien n'est publié côté site."
      />

      <nav
        aria-label="Filtrer par statut"
        className="mb-[var(--space-admin-6)] flex flex-wrap gap-2"
      >
        <a
          href={base}
          className={`rounded-full border px-3 py-1 text-[length:var(--text-admin-sm)] font-medium ${
            !activeStatus
              ? "border-transparent bg-[color:var(--color-admin-info)] text-white"
              : "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)]"
          }`}
        >
          Toutes
        </a>
        {PODCAST_REQUEST_STATUSES.map((s) => (
          <a
            key={s.value}
            href={`${base}?status=${s.value}`}
            className={`rounded-full border px-3 py-1 text-[length:var(--text-admin-sm)] font-medium ${
              activeStatus === s.value
                ? "border-transparent bg-[color:var(--color-admin-info)] text-white"
                : "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)]"
            }`}
          >
            {s.label}
          </a>
        ))}
      </nav>

      {rows.length === 0 ? (
        <AdminEmptyState
          icon="🎙️"
          title="Aucune demande pour l'instant"
          description="Les demandes déposées sur /podcast (ou via le QR du flyer) apparaîtront ici."
        />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          rowAction={(r) => (
            <a href={`${base}/${r.id}`} className="admin-link">
              Ouvrir
            </a>
          )}
        />
      )}
    </AdminPageShell>
  );
}
