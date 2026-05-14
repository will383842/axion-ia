/**
 * Content Generator — Settings providers (§ 12.5).
 *
 * Liste ProviderConfig (5 providers V1 : OpenAI, Anthropic, Perplexity,
 * Unsplash, Voyage). Édition inline par row : toggle, modèle, monthly cap.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listProviders,
  resetProviderSpend,
  updateProvider,
} from "@/server/actions/content-gen/providers";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ProvidersSettingsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listProviders();

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Providers IA</h1>
          <p className="admin-meta">
            {rows.length} provider{rows.length > 1 ? "s" : ""} configuré{rows.length > 1 ? "s" : ""}{" "}
            · Cost cap mensuel + reset 1<sup>er</sup> du mois.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-card">
          <p>
            Aucun provider configuré. Lance <code>pnpm content-gen:seed</code> pour seeder
            ProviderConfig (Sprint 1 Day 1 commit <code>d174f83</code>).
          </p>
        </div>
      ) : (
        rows.map((r) => {
          const spent = Number(r.currentMonthSpentUsd);
          const cap = Number(r.monthlyCapUsd);
          const pct = cap > 0 ? Math.round((spent / cap) * 100) : 0;
          return (
            <form key={r.id} action={save} className="admin-card">
              <input type="hidden" name="id" value={r.id} />
              <h2 style={{ marginTop: 0 }}>
                {r.provider} <span className="admin-meta">({r.role})</span>
              </h2>
              <p className="admin-meta">
                Clé env : <code>{r.apiKeyEnvVar}</code> · Dépensé ce mois : ${spent.toFixed(2)} / $
                {cap.toFixed(2)} ({pct}%)
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

              <details style={{ marginTop: 12 }}>
                <summary>Reset spend mensuel (debug / fin de cycle)</summary>
                <form action={resetSpend} style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button-ghost">
                    Reset currentMonthSpentUsd à 0
                  </button>
                </form>
              </details>
            </form>
          );
        })
      )}
    </section>
  );
}
