// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Providers settings V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions updateProvider + resetProviderSpend préservées.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { resetProviderSpend, updateProvider } from "@/server/actions/content-gen/providers";

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
        rows.map((r) => {
          const spent = Number(r.currentMonthSpentUsd);
          const cap = Number(r.monthlyCapUsd);
          const pct = cap > 0 ? Math.round((spent / cap) * 100) : 0;
          return (
            <AdminCard key={r.id} className="mb-[var(--space-admin-5)]">
              <form action={save}>
                <input type="hidden" name="id" value={r.id} />
                <h2 className="admin-h2">
                  {r.provider} <span className="admin-meta">({r.role})</span>
                </h2>
                <p className="admin-meta-block">
                  Clé env : <code>{r.apiKeyEnvVar}</code> · Dépensé ce mois : ${spent.toFixed(2)} /
                  ${cap.toFixed(2)} ({pct}%)
                </p>

                <div className="admin-filters-grid">
                  <div className="admin-field">
                    <label className="admin-label">
                      <input type="checkbox" name="enabled" defaultChecked={r.enabled} /> Actif
                    </label>
                  </div>
                  <div className="admin-field">
                    <label htmlFor={`model-${r.id}`} className="admin-label">
                      Modèle
                    </label>
                    <input
                      id={`model-${r.id}`}
                      name="model"
                      defaultValue={r.model}
                      className="admin-input"
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor={`cap-${r.id}`} className="admin-label">
                      Cap mensuel USD
                    </label>
                    <input
                      id={`cap-${r.id}`}
                      name="monthlyCapUsd"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={r.monthlyCapUsd}
                      className="admin-input"
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor={`rpm-${r.id}`} className="admin-label">
                      Rate-limit RPM
                    </label>
                    <input
                      id={`rpm-${r.id}`}
                      name="rateLimitRpm"
                      type="number"
                      min="1"
                      defaultValue={r.rateLimitRpm ?? ""}
                      className="admin-input"
                    />
                  </div>
                </div>

                <div className="admin-filters-actions">
                  <button type="submit" className="admin-button">
                    Enregistrer
                  </button>
                </div>

                <details className="mt-[var(--space-admin-4)]">
                  <summary>Reset spend mensuel (debug / fin de cycle)</summary>
                </details>
              </form>
              <form action={resetSpend} className="mt-[var(--space-admin-3)]">
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className="admin-button-ghost">
                  Reset currentMonthSpentUsd à 0
                </button>
              </form>
            </AdminCard>
          );
        })
      )}
    </AdminPageShell>
  );
}
