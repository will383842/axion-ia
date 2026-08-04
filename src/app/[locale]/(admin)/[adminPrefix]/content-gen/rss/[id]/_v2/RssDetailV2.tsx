// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// Sprint v7 post-audit FIX (F2) — migration UI legacy `rss.ts` (ContentGenConfig
// JSON, keyed by URL) → `rss-sources.ts` (Prisma `rss_sources`, keyed by id).
//
// RSS detail V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  removeRssSourceFromDb,
  updateRssSourceInDb,
  type RssSourceInput,
  type RssSourceRow,
} from "@/server/actions/content-gen/rss-sources";

interface Props {
  adminPrefix: string;
  source: RssSourceRow;
}

const VERTICALE_OPTIONS = [
  { value: "", label: "— (transversal)" },
  { value: "interventions", label: "Interventions" },
  { value: "audit", label: "Audit" },
  { value: "implementations", label: "Implémentations" },
  { value: "un_a_un", label: "Un à un" },
] as const;

export function RssDetailV2({ adminPrefix, source }: Props): React.ReactElement {
  const id = source.id;

  async function remove() {
    "use server";
    await removeRssSourceFromDb(id);
    redirect(`/fr/${adminPrefix}/content-gen/rss`);
  }

  async function update(formData: FormData) {
    "use server";
    const verticaleRaw = String(formData.get("verticale") ?? "");
    await updateRssSourceInDb(id, {
      url: String(formData.get("url") ?? ""),
      name: String(formData.get("name") ?? ""),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      pollIntervalMin: Number(formData.get("pollIntervalMin") ?? 60),
      autoPublish: formData.get("autoPublish") === "on",
      enabled: formData.get("enabled") === "on",
      verticale: verticaleRaw === "" ? null : (verticaleRaw as RssSourceInput["verticale"]),
      language: String(formData.get("language") ?? "fr"),
    });
    redirect(`/fr/${adminPrefix}/content-gen/rss`);
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={source.name}
        description={source.url}
        actions={
          <form action={remove}>
            <button type="submit" className="admin-button-ghost">
              Supprimer
            </button>
          </form>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Éditer la source</h2>
        <form action={update}>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="url" className="admin-label">
                URL flux
              </label>
              <input
                id="url"
                name="url"
                type="url"
                required
                className="admin-input"
                defaultValue={source.url}
                placeholder="https://example.com/feed.xml"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="name" className="admin-label">
                Nom
              </label>
              <input
                id="name"
                name="name"
                required
                className="admin-input"
                defaultValue={source.name}
              />
            </div>
          </div>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="tags" className="admin-label">
                Tags (CSV)
              </label>
              <input
                id="tags"
                name="tags"
                className="admin-input"
                defaultValue={source.tags.join(", ")}
                placeholder="actualite-ia, reglementation"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="pollIntervalMin" className="admin-label">
                Intervalle (min)
              </label>
              <input
                id="pollIntervalMin"
                name="pollIntervalMin"
                type="number"
                min="5"
                max="1440"
                required
                className="admin-input"
                defaultValue={source.pollIntervalMin}
              />
            </div>
          </div>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="verticale" className="admin-label">
                Verticale
              </label>
              <select
                id="verticale"
                name="verticale"
                className="admin-input"
                defaultValue={source.verticale ?? ""}
              >
                {VERTICALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="language" className="admin-label">
                Langue
              </label>
              <input
                id="language"
                name="language"
                required
                className="admin-input"
                defaultValue={source.language}
                placeholder="fr"
              />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="autoPublish" defaultChecked={source.autoPublish} />{" "}
              Auto-publish si score ≥ seuil
            </label>
          </div>
          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="enabled" defaultChecked={source.enabled} /> Source active
            </label>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Enregistrer les modifications
            </button>
          </div>
        </form>
        <p className="admin-meta-block mt-[var(--space-admin-4)]">
          Échecs consécutifs : {source.failureCount}
        </p>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Items récents</h2>
        <p className="admin-meta-block">
          Les articles collectés depuis cette source apparaîtront ici.
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
