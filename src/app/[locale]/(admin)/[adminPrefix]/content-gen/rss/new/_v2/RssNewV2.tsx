// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// RSS new V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { addRssSource } from "@/server/actions/content-gen/rss";

interface Props {
  adminPrefix: string;
}

export function RssNewV2({ adminPrefix }: Props): React.ReactElement {
  async function add(formData: FormData) {
    "use server";
    await addRssSource({
      url: String(formData.get("url") ?? ""),
      name: String(formData.get("name") ?? ""),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      pollIntervalMin: Number(formData.get("pollIntervalMin") ?? 60),
      autoPublish: formData.get("autoPublish") === "on",
      enabled: formData.get("enabled") === "on",
    });
    redirect(`/fr/${adminPrefix}/content-gen/rss`);
  }

  return (
    <AdminPageShell>
      <AdminPageHeader title="Nouvelle source RSS" />

      <AdminCard>
        <form action={add}>
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
                placeholder="https://example.com/feed.xml"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="name" className="admin-label">
                Nom
              </label>
              <input id="name" name="name" required className="admin-input" />
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
                defaultValue="60"
                className="admin-input"
                required
              />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="autoPublish" /> Auto-publish si score ≥ seuil
            </label>
          </div>
          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="enabled" defaultChecked /> Source active
            </label>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Ajouter
            </button>
          </div>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
