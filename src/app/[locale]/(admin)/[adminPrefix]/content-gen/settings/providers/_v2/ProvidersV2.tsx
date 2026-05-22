// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Providers settings V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions updateProvider + resetProviderSpend préservées.
// Sprint correctif SP-01 : error UI via ProviderFormClient.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { resetProviderSpend, updateProvider } from "@/server/actions/content-gen/providers";
import { ProviderFormClient } from "@/components/admin/content-gen/ProviderFormClient";

interface ProviderRow {
  id: string;
  provider: string;
  role: string;
  apiKeyEnvVar: string;
  enabled: boolean;
  model: string;
  monthlyCapUsd: number;
  rateLimitRpm: number | null;
  currentMonthSpentUsd: number;
}

interface Props {
  rows: ReadonlyArray<ProviderRow>;
}

export function ProvidersV2({ rows }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    const rateLimitRpm = formData.get("rateLimitRpm")
      ? Number(formData.get("rateLimitRpm"))
      : undefined;
    await updateProvider({
      id: String(formData.get("id")),
      enabled: formData.get("enabled") === "on",
      model: String(formData.get("model")),
      monthlyCapUsd: Number(formData.get("monthlyCapUsd") ?? 0),
      ...(rateLimitRpm !== undefined ? { rateLimitRpm } : {}),
    });
  }

  async function resetSpend(formData: FormData) {
    "use server";
    await resetProviderSpend(String(formData.get("id")));
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Providers IA"
        description={`${rows.length} provider${rows.length > 1 ? "s" : ""} configuré${rows.length > 1 ? "s" : ""} · Cost cap mensuel + reset 1er du mois.`}
      />

      {rows.length === 0 ? (
        <AdminCard>
          <p className="admin-meta-block">
            Aucun provider configuré. Lance <code>pnpm content-gen:seed</code> pour seeder
            ProviderConfig (Sprint 1 Day 1 commit <code>d174f83</code>).
          </p>
        </AdminCard>
      ) : (
        rows.map((r) => (
          <AdminCard key={r.id} className="mb-[var(--space-admin-5)]">
            <ProviderFormClient
              row={r}
              saveAction={save}
              resetSpendAction={resetSpend}
            />
          </AdminCard>
        ))
      )}
    </AdminPageShell>
  );
}
