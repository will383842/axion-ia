// Conversations chatbot — liste read-only avec lien détail (T-19). FR-only.

import { ArrowRight, MessagesSquare } from "lucide-react";
import { libelleStatutConversation } from "@/features/admin-chatbot/statut-labels";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminBadge,
  AdminButton,
  AdminPagination,
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
    { key: "statut", header: "Statut", cell: (r) => libelleStatutConversation(r.statut) },
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
      <AdminPageHeader
        title="Conversations"
        description={`${total} conversation${total > 1 ? "s" : ""} au total.`}
      />

      <AdminCard>
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(r) => r.id}
          rowAction={(r) => (
            <AdminButton href={`${base}/${r.id}`} variant="ghost" size="sm" iconAfter={ArrowRight}>
              Voir
            </AdminButton>
          )}
          emptyState={
            <AdminEmptyState
              icon={<MessagesSquare size={28} aria-hidden="true" />}
              title="Aucune conversation"
            />
          }
        />

        <AdminPagination page={page} totalPages={totalPages} baseHref={base} />
      </AdminCard>
    </AdminPageShell>
  );
}
