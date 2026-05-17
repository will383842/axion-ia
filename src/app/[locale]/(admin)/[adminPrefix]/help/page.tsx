// Listing centre aide admin (M9 Tier 2 section 6).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listHelpArticlesAction } from "@/features/admin-help/actions";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { HelpV2 } from "./_v2/HelpV2";

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

export default async function HelpListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listHelpArticlesAction({
    status: sp.status as never,
    isTutorial: sp.isTutorial as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  if (await isAdminV2Enabled()) {
    return (
      <HelpV2
        adminPrefix={adminPrefix}
        searchParams={sp}
        items={result.items}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
      />
    );
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Centre d&apos;aide</h1>
          <p className="admin-meta">
            {result.total} article{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/help/new`} className="admin-button">
          + Nouvel article
        </a>
      </div>

      <div className="admin-card admin-filters">
        <form className="admin-filters-grid">
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
            <label htmlFor="isTutorial" className="admin-label">
              Type
            </label>
            <select
              id="isTutorial"
              name="isTutorial"
              defaultValue={sp.isTutorial ?? "all"}
              className="admin-input"
            >
              <option value="all">Tous</option>
              <option value="yes">Tutoriel (HowTo)</option>
              <option value="no">Article standard</option>
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="search" className="admin-label">
              Recherche (titre)
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={sp.search ?? ""}
              className="admin-input"
              placeholder="Min 2 caractères"
            />
          </div>
        </form>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Appliquer
          </button>
          <a href={`/fr/${adminPrefix}/help`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date publi</th>
              <th>Titre (FR)</th>
              <th>Slug</th>
              <th>Catégorie</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  Aucun article trouvé.
                </td>
              </tr>
            ) : (
              result.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : "—"}</td>
                  <td>{a.translations[0]?.title ?? "(sans titre)"}</td>
                  <td>
                    <code className="admin-meta-small">{a.translations[0]?.slug ?? "—"}</code>
                  </td>
                  <td>{a.category?.nameFr ?? "—"}</td>
                  <td>{a.isTutorial ? "📘 Tutoriel" : "Article"}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${a.status}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </td>
                  <td>
                    <a href={`/fr/${adminPrefix}/help/${a.id}`} className="admin-link">
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
