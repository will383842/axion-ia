// Conversations chatbot — liste read-only avec lien détail (T-19). FR-only.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminBadge,
  type AdminTableColumn,
} from "@/components/admin/ui";
import type { ConversationRow } from "@/features/admin-chatbot/actions";

function frDate(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function ConversationsV2({
  adminPrefix,
  items,
  total,
  page,
  totalPages,
}: {
  adminPrefix: string;
  items: ReadonlyArray<ConversationRow>;
  total: number;
  page: number;
  totalPages: number;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/chatbot/conversations`;

  const columns: ReadonlyArray<AdminTableColumn<ConversationRow>> = [
    {
      key: "session",
      header: "Session",
      cell: (r) => (
        <span className="font-mono text-[length:var(--text-admin-sm)]">
          {r.sessionUuid.slice(0, 8)}…
        </span>
      ),
    },
    { key: "statut", header: "Statut", cell: (r) => r.statut },
    { key: "messages", header: "Messages", cell: (r) => r.messageCount, align: "right" },
    {
      key: "lead",
      header: "Lead",
      cell: (r) => (r.hasLead ? <AdminBadge tone="success">lead</AdminBadge> : "—"),
      hiddenBelow: "md",
    },
    { key: "date", header: "Début", cell: (r) => frDate(r.createdAt), align: "right" },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader title="Conversations" description={`${total} conversation(s) au total.`} />

      <AdminCard>
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(r) => r.id}
          rowAction={(r) => (
            <Link
              href={`${base}/${r.id}`}
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-info)] hover:underline"
            >
              Voir →
            </Link>
          )}
          emptyState={<AdminEmptyState icon="💬" title="Aucune conversation" />}
        />

        {totalPages > 1 ? (
          <div className="mt-[var(--space-admin-4)] flex items-center justify-between text-[length:var(--text-admin-sm)]">
            <span className="text-[color:var(--color-admin-fg-muted)]">
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-[var(--space-admin-2)]">
              {page > 1 ? (
                <Link
                  href={`${base}?page=${page - 1}`}
                  className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-3 py-1 hover:bg-[color:var(--color-admin-surface-hover)]"
                >
                  ← Précédent
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`${base}?page=${page + 1}`}
                  className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-3 py-1 hover:bg-[color:var(--color-admin-surface-hover)]"
                >
                  Suivant →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </AdminCard>
    </AdminPageShell>
  );
}
