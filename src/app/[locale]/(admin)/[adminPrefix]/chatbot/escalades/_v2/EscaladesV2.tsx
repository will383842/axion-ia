// Escalades chatbot — liste filtrable + résolution (REQ-034). FR-only.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminBadge,
  AdminPagination,
  type AdminTableColumn,
} from "@/components/admin/ui";
import type { EscalationRow } from "@/features/admin-chatbot/actions";
import { EscaladeResolveButton } from "./EscaladeResolveButton";

function frDate(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

const TABS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "ouverte", label: "Ouvertes" },
  { key: "resolue", label: "Résolues" },
  { key: "all", label: "Toutes" },
];

export function EscaladesV2({
  adminPrefix,
  currentStatut,
  items,
  total,
  page,
  totalPages,
}: {
  adminPrefix: string;
  currentStatut: string;
  items: ReadonlyArray<EscalationRow>;
  total: number;
  page: number;
  totalPages: number;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/chatbot/escalades`;

  const columns: ReadonlyArray<AdminTableColumn<EscalationRow>> = [
    { key: "question", header: "Question", cell: (r) => r.question },
    {
      key: "contact",
      header: "Contact",
      cell: (r) => r.contactEmail ?? "—",
      hiddenBelow: "md",
    },
    {
      key: "statut",
      header: "Statut",
      cell: (r) =>
        r.statut === "resolue" ? (
          <AdminBadge tone="success">résolue</AdminBadge>
        ) : (
          <AdminBadge tone="warning">ouverte</AdminBadge>
        ),
    },
    { key: "date", header: "Reçue", cell: (r) => frDate(r.createdAt), align: "right" },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Escalades"
        description={`Questions sans réponse remontées par le chatbot — ${total} ${currentStatut === "ouverte" ? "ouverte(s)" : "au total"}.`}
      />

      <AdminCard className="mb-[var(--space-admin-4)]">
        <div className="flex gap-[var(--space-admin-2)]">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`${base}?statut=${t.key}`}
              className={
                currentStatut === t.key
                  ? "rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-info)] px-3 py-1 text-[length:var(--text-admin-sm)] font-medium text-white"
                  : "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-3 py-1 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-hover)]"
              }
            >
              {t.label}
            </Link>
          ))}
        </div>
      </AdminCard>

      <AdminCard>
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(r) => r.id}
          rowAction={(r) =>
            r.statut === "ouverte" ? (
              <EscaladeResolveButton id={r.id} />
            ) : (
              <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                —
              </span>
            )
          }
          emptyState={<AdminEmptyState icon="✅" title="Aucune escalade dans ce filtre" />}
        />

        <AdminPagination
          page={page}
          totalPages={totalPages}
          baseHref={base}
          preservedParams={{ statut: currentStatut }}
        />
      </AdminCard>
    </AdminPageShell>
  );
}
