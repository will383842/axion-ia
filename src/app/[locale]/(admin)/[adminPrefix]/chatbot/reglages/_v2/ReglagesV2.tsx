// Réglages chatbot — identité tenant (read-only) + formulaire d'édition (T-21).

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminBadge,
} from "@/components/admin/ui";
import type { ChatbotSettingsView } from "@/features/admin-chatbot/actions";
import { AlertTriangle } from "lucide-react";
import { ReglagesForm } from "./ReglagesForm";

function Row({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--color-admin-border)] py-2 last:border-0">
      <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {label}
      </span>
      <span className="text-[length:var(--text-admin-sm)] font-medium">{value}</span>
    </div>
  );
}

export function ReglagesV2({ data }: { data: ChatbotSettingsView | null }): React.ReactElement {
  if (!data) {
    return (
      <AdminPageShell width="narrow">
        <AdminPageHeader title="Réglages" />
        <AdminCard>
          <AdminEmptyState
            icon={<AlertTriangle size={28} aria-hidden="true" />}
            title="Tenant chatbot introuvable"
            description="Le tenant par défaut « axion-ia » n'est pas seedé."
          />
        </AdminCard>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Réglages"
        description="Configuration du tenant chatbot. Les modifications sont prises en compte sans redéploiement."
      />

      <AdminCard className="mb-[var(--space-admin-4)]">
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">Tenant</h2>
        <Row label="Clé" value={<span className="font-mono">{data.tenantCle}</span>} />
        <Row label="Nom" value={data.tenantNom} />
        <Row label="Domaine (CORS)" value={data.domaine ?? "—"} />
        <Row
          label="État"
          value={
            data.actif ? (
              <AdminBadge tone="success">actif</AdminBadge>
            ) : (
              <AdminBadge tone="neutral">inactif</AdminBadge>
            )
          }
        />
      </AdminCard>

      <ReglagesForm data={data} />
    </AdminPageShell>
  );
}
