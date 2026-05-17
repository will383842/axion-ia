/**
 * Content Generator — Settings distribution couverture (§ 25.2 v1.7).
 *
 * CRUD profils nommés CoverageDistributionProfile. Édition JSON brut V1
 * (validation Zod somme = 100 % côté Server Action). UI sliders peut être
 * ajoutée V2 si Will demande.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  deleteDistributionProfile,
  listDistributionProfiles,
  upsertDistributionProfile,
} from "@/server/actions/content-gen/distribution";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { CoverageDistributionV2 } from "./_v2/CoverageDistributionV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CoverageDistributionPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listDistributionProfiles();

  if (await isAdminV2Enabled()) {
    return <CoverageDistributionV2 rows={rows} />;
  }

  async function upsert(formData: FormData) {
    "use server";
    const distributionRaw = String(formData.get("distribution") ?? "{}");
    const distribution = JSON.parse(distributionRaw) as Record<string, number>;
    const description = formData.get("description")
      ? String(formData.get("description"))
      : undefined;
    await upsertDistributionProfile({
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      ...(description ? { description } : {}),
      distribution,
      isDefault: formData.get("isDefault") === "on",
    });
  }

  async function remove(formData: FormData) {
    "use server";
    await deleteDistributionProfile(String(formData.get("slug")));
  }

  const defaultProfile = `{
  "landing_ville": 25,
  "blog_from_title": 20,
  "blog_from_keywords": 20,
  "blog_from_rss": 15,
  "comparison": 10,
  "guide_pilier": 5,
  "faq_standalone": 5
}`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Distribution couverture (5+ types)</h1>
          <p className="admin-meta">
            {rows.length} profil{rows.length > 1 ? "s" : ""} · somme JSON doit valoir 100.
          </p>
        </div>
      </div>

      <form action={upsert} className="admin-card">
        <h2>Créer / mettre à jour un profil</h2>
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="slug" className="admin-label">
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              required
              minLength={2}
              maxLength={80}
              className="admin-input"
              placeholder="ex. mix-premium-2026"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="name" className="admin-label">
              Nom
            </label>
            <input id="name" name="name" required className="admin-input" />
          </div>
        </div>
        <div className="admin-field">
          <label htmlFor="description" className="admin-label">
            Description (optionnelle)
          </label>
          <input id="description" name="description" className="admin-input" />
        </div>
        <div className="admin-field">
          <label htmlFor="distribution" className="admin-label">
            Distribution (JSON, somme = 100)
          </label>
          <textarea
            id="distribution"
            name="distribution"
            rows={10}
            className="admin-input"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
            defaultValue={defaultProfile}
            required
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">
            <input type="checkbox" name="isDefault" /> Définir comme défaut (les autres seront
            désactivés)
          </label>
        </div>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Enregistrer
          </button>
        </div>
      </form>

      <div className="admin-card admin-table-wrapper">
        <h2>Profils existants</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Nom</th>
              <th>Défaut</th>
              <th>Distribution</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>Aucun profil — seedez ou créez-en un ci-dessus.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.slug}</code>
                  </td>
                  <td>{r.name}</td>
                  <td>{r.isDefault ? "✅" : "—"}</td>
                  <td>
                    <code style={{ fontSize: 11 }}>{JSON.stringify(r.distribution)}</code>
                  </td>
                  <td>
                    <form action={remove} style={{ display: "inline" }}>
                      <input type="hidden" name="slug" value={r.slug} />
                      <button type="submit" className="admin-button-ghost">
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
