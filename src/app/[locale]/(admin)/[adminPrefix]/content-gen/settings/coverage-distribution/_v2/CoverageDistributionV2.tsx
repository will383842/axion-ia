// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Coverage distribution V2 — AdminPageShell + AdminPageHeader + AdminCard.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEtatBooleen,
} from "@/components/admin/ui";
import {
  deleteDistributionProfile,
  upsertDistributionProfile,
} from "@/server/actions/content-gen/distribution";

interface ProfileRow {
  id: string;
  slug: string;
  name: string;
  isDefault: boolean;
  distribution: unknown;
}

interface Props {
  rows: ReadonlyArray<ProfileRow>;
}

const DEFAULT_PROFILE = `{
  "landing_ville": 25,
  "blog_from_title": 20,
  "blog_from_keywords": 20,
  "blog_from_rss": 15,
  "comparison": 10,
  "guide_pilier": 5,
  "faq_standalone": 5
}`;

/**
 * 🔴 LA CELLULE AFFICHAIT UN `JSON.stringify` SUR UNE LIGNE : accolades,
 * guillemets et clés d'enum, dans un tableau. Une répartition en
 * pourcentages se lit en clair ; la forme brute reste en infobulle.
 */
function resumerRepartition(valeur: unknown): string {
  if (valeur === null || typeof valeur !== "object") return "—";
  const entrees = Object.entries(valeur as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  if (entrees.length === 0) return "—";
  return entrees.map(([k, v]) => `${k} ${v} %`).join(" · ");
}

export function CoverageDistributionV2({ rows }: Props): React.ReactElement {
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

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Distribution couverture (5+ types)"
        description={`${rows.length} profil${rows.length > 1 ? "s" : ""} · somme JSON doit valoir 100.`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={upsert}>
          <h2 className="admin-h2">Créer / mettre à jour un profil</h2>
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
              className="admin-input font-mono text-[length:var(--text-admin-sm)]"
              defaultValue={DEFAULT_PROFILE}
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
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">Profils existants</h2>
        <div className="admin-table-wrapper">
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
                  <td colSpan={5} className="admin-table-empty">
                    Aucun profil pour l&apos;instant — créez-en un dans le formulaire ci-dessus.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.slug}</code>
                    </td>
                    <td>{r.name}</td>
                    <td>
                      <AdminEtatBooleen
                        actif={r.isDefault}
                        libelles={{ vrai: "Profil par défaut", faux: "Profil secondaire" }}
                      />
                    </td>
                    <td>
                      <span className="admin-meta-small" title={JSON.stringify(r.distribution)}>
                        {resumerRepartition(r.distribution)}
                      </span>
                    </td>
                    <td>
                      <form action={remove} className="inline">
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
      </AdminCard>
    </AdminPageShell>
  );
}
