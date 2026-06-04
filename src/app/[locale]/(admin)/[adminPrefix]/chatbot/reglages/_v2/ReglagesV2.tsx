// Réglages chatbot — affichage lecture seule des réglages du tenant (T-21).
//
// L'édition (curseur conversion, seuils, rétention RGPD) viendra dans un second
// temps ; ici on expose la configuration courante (transparence opérationnelle).

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminBadge,
} from "@/components/admin/ui";
import type { ChatbotSettingsView } from "@/features/admin-chatbot/actions";

function Row({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--color-admin-border)] py-2 last:border-0">
      <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {label}
      </span>
      <span className="text-[length:var(--text-admin-sm)] font-medium tabular-nums">{value}</span>
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
            icon="⚠️"
            title="Tenant chatbot introuvable"
            description="Le tenant par défaut « axion-ia » n'est pas seedé."
          />
        </AdminCard>
      </AdminPageShell>
    );
  }

  const s = data.settings;

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Réglages"
        description="Configuration courante du tenant chatbot (lecture seule)."
      />

      <AdminCard className="mb-[var(--space-admin-4)]">
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">Tenant</h2>
        <Row label="Clé" value={<span className="font-mono">{data.tenantCle}</span>} />
        <Row label="Nom" value={data.tenantNom} />
        <Row label="Domaine (CORS)" value={data.domaine ?? "—"} />
        <Row
          label="Actif"
          value={
            data.actif ? (
              <AdminBadge tone="success">oui</AdminBadge>
            ) : (
              <AdminBadge tone="neutral">non</AdminBadge>
            )
          }
        />
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-4)]">
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">
          Conversation & conversion
        </h2>
        <Row label="Seuil de confiance (escalade en-dessous)" value={s.confidenceThreshold} />
        <Row label="Curseur de conversion (0 info → 1 lead)" value={s.conversionCursor} />
        <Row label="Cartes d'offre max / réponse" value={s.maxOfferCards} />
        <Row
          label="Confirmation avant envoi des liens"
          value={s.confirmBeforeLinks ? "oui" : "non"}
        />
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-4)]">
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">
          Cache sémantique
        </h2>
        <Row label="Activé" value={s.cache.enabled ? "oui" : "non"} />
        <Row label="Seuil de similarité (hit)" value={s.cache.similarityThreshold} />
        <Row label="TTL (heures)" value={s.cache.ttlHours} />
      </AdminCard>

      <AdminCard>
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">Coût & RGPD</h2>
        <Row label="Cap coût mensuel (USD)" value={`$${s.costCapUsdPerMonth}`} />
        <Row label="Rétention conversations (mois)" value={s.retentionMonths} />
        <Row label="Pages d'activation" value={s.pages.join(", ")} />
      </AdminCard>
    </AdminPageShell>
  );
}
