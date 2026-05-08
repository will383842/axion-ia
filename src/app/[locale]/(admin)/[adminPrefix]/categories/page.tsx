// Listing categories admin (M9 Tier 2 section 3).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCategoriesAction } from "@/features/admin-categories/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};
const MODULE_LABELS: Record<string, string> = {
  intervention: "Intervention",
  implementation: "Implémentation",
  audit: "Audit",
};

export default async function CategoriesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listCategoriesAction({
    module: sp.module as never,
    status: sp.status as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Catégories</h1>
          <p className="admin-meta">
            {result.total} catégorie{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/categories/new`} className="admin-button">
          + Nouvelle catégorie
        </a>
      </div>

      <div className="admin-card admin-filters">
        <form className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="module" className="admin-label">
              Module
            </label>
            <select
              id="module"
              name="module"
              defaultValue={sp.module ?? "all"}
              className="admin-input"
            >
              <option value="all">Tous</option>
              <option value="blog">Blog (sans module)</option>
              {Object.entries(MODULE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={sp.status ?? "all"}
              className="admin-input"
            >
              <option value="all">Tous</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="search" className="admin-label">
              Recherche
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={sp.search ?? ""}
              className="admin-input"
              placeholder="Nom, slug…"
            />
          </div>
        </form>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Appliquer
          </button>
          <a href={`/fr/${adminPrefix}/categories`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Nom (FR)</th>
              <th>Slug</th>
              <th>Module</th>
              <th>Parent</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  Aucune catégorie trouvée.
                </td>
              </tr>
            ) : (
              result.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.displayOrder}</td>
                  <td>{c.nameFr}</td>
                  <td>
                    <code className="admin-meta-small">{c.slug}</code>
                  </td>
                  <td>{c.module ? MODULE_LABELS[c.module] : "Blog"}</td>
                  <td>
                    {c.parentId ? (
                      <code className="admin-meta-small">{c.parentId.slice(0, 8)}…</code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge-${c.status}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td>
                    <a href={`/fr/${adminPrefix}/categories/${c.id}`} className="admin-link">
                      Éditer →
                    </a>
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
