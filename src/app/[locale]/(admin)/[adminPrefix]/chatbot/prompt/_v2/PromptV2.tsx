// Prompt système versionné — liste + activation (rollback) + création (T-20).

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminBadge,
  type AdminTableColumn,
} from "@/components/admin/ui";
import type { PromptVersionSummary } from "@/server/chatbot/generation/prompt-version";
import { PromptActivateButton } from "./PromptActivateButton";
import { PromptCreateForm } from "./PromptCreateForm";

function frDate(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function PromptV2({
  tenantId,
  versions,
  activeContent,
}: {
  adminPrefix: string;
  tenantId: string | null;
  versions: ReadonlyArray<PromptVersionSummary>;
  activeContent: string | null;
}): React.ReactElement {
  if (!tenantId) {
    return (
      <AdminPageShell width="wide">
        <AdminPageHeader title="Prompt versionné" />
        <AdminCard>
          <AdminEmptyState
            icon="⚠️"
            title="Tenant chatbot introuvable"
            description="Le tenant par défaut « axion-ia » n'est pas seedé."
          />
        </AdminCard>
      </AdminPageShell>
    );
  }

  const columns: ReadonlyArray<AdminTableColumn<PromptVersionSummary>> = [
    { key: "version", header: "Version", cell: (r) => `v${r.version}`, width: "90px" },
    {
      key: "actif",
      header: "Statut",
      cell: (r) =>
        r.actif ? (
          <AdminBadge tone="success">active</AdminBadge>
        ) : (
          <AdminBadge tone="neutral">inactive</AdminBadge>
        ),
    },
    { key: "note", header: "Note", cell: (r) => r.note ?? "—" },
    { key: "date", header: "Créée", cell: (r) => frDate(r.createdAt), align: "right" },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Prompt versionné"
        description="Versions du prompt système du chatbot. Une seule version est active à la fois ; activer une version antérieure = retour arrière immédiat (sans redéploiement)."
      />

      <AdminCard className="mb-[var(--space-admin-4)]">
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold">
          Versions
        </h2>
        <AdminTable
          columns={columns}
          rows={versions}
          getRowId={(r) => `v${r.version}`}
          rowAction={(r) =>
            r.actif ? (
              <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                en service
              </span>
            ) : (
              <PromptActivateButton tenantId={tenantId} version={r.version} />
            )
          }
          emptyState={
            <AdminEmptyState
              icon="📝"
              title="Aucune version publiée"
              description="Le chatbot utilise les règles système codées par défaut. Créez une version pour les surcharger."
            />
          }
        />
      </AdminCard>

      {activeContent ? (
        <AdminCard className="mb-[var(--space-admin-4)]">
          <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold">
            Contenu de la version active
          </h2>
          <pre className="overflow-x-auto rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-paper-alt)] p-3 font-mono text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
            {activeContent}
          </pre>
        </AdminCard>
      ) : null}

      <AdminCard>
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold">
          Nouvelle version
        </h2>
        <PromptCreateForm tenantId={tenantId} />
      </AdminCard>
    </AdminPageShell>
  );
}
