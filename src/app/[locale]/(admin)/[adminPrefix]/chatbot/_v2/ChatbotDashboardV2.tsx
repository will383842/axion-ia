// Tableau de bord chatbot — KPIs + escalades récentes (read-only, FR-only).

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminTable,
  AdminEmptyState,
  AdminBadge,
  type AdminTableColumn,
} from "@/components/admin/ui";
import type { ChatbotDashboardStats, EscalationRow } from "@/features/admin-chatbot/actions";
import { IngestionButton } from "./IngestionButton";

function frDate(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function ChatbotDashboardV2({
  adminPrefix,
  stats,
  recentEscalations,
}: {
  adminPrefix: string;
  stats: ChatbotDashboardStats;
  recentEscalations: ReadonlyArray<EscalationRow>;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/chatbot`;

  const columns: ReadonlyArray<AdminTableColumn<EscalationRow>> = [
    { key: "question", header: "Question", cell: (r) => r.question },
    {
      key: "contact",
      header: "Contact",
      cell: (r) => r.contactEmail ?? "—",
      hiddenBelow: "md",
    },
    { key: "date", header: "Reçue", cell: (r) => frDate(r.createdAt), align: "right" },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Chatbot — tableau de bord"
        description="Vue d'ensemble de l'assistant conversationnel Axion-IA."
        actions={<IngestionButton />}
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] lg:grid-cols-3">
        <AdminStatCard label="Conversations" value={stats.conversations} />
        <AdminStatCard label="Messages" value={stats.messages} />
        <AdminStatCard
          label="Escalades ouvertes"
          value={stats.escalationsOpen}
          tone={stats.escalationsOpen > 0 ? "warning" : "default"}
          href={`${base}/escalades`}
          meta={`${stats.escalationsTotal} au total`}
        />
        <AdminStatCard label="Réponses depuis le cache" value={stats.cacheHits} tone="info" />
        <AdminStatCard label="Coût LLM estimé" value={`$${stats.costUsd.toFixed(2)}`} />
      </div>

      <AdminCard>
        <div className="mb-[var(--space-admin-4)] flex items-center justify-between">
          <h2 className="text-[length:var(--text-admin-lg)] font-semibold">
            Escalades récentes (ouvertes)
          </h2>
          <Link
            href={`${base}/escalades`}
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-info)] hover:underline"
          >
            Tout voir →
          </Link>
        </div>
        <AdminTable
          columns={columns}
          rows={recentEscalations}
          getRowId={(r) => r.id}
          rowAction={() => <AdminBadge tone="warning">ouverte</AdminBadge>}
          emptyState={
            <AdminEmptyState
              icon="✅"
              title="Aucune escalade ouverte"
              description="Toutes les questions sans réponse ont été traitées."
            />
          }
        />
      </AdminCard>
    </AdminPageShell>
  );
}
