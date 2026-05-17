// Listing FAQ admin (M9 Tier 2 section 1).
//
// Filtre category / status / search. Sort par category puis displayOrder.
// V1 : pas de drag-drop reorder (M9 v2). Edit via lien vers /faq/[id].

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listFAQsAction } from "@/features/admin-faq/actions";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { FaqV2 } from "./_v2/FaqV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "Général",
  interventions: "Interventions",
  implementation: "Implémentation",
  audit: "Audit",
  pricing: "Tarifs",
  process: "Processus",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

export default async function FAQListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listFAQsAction({
    category: sp.category as never,
    status: sp.status as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  if (await isAdminV2Enabled()) {
    return (
      <FaqV2
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
          <h1 className="admin-h1-large">FAQ</h1>
          <p className="admin-meta">
            {result.total} question{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/faq/new`} className="admin-button">
          + Nouvelle question
        </a>
      </div>

      <div className="admin-card admin-filters">
        <form className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="category" className="admin-label">
              Catégorie
            </label>
            <select
              id="category"
              name="category"
              defaultValue={sp.category ?? "all"}
              className="admin-input"
            >
              <option value="all">Toutes</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
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
              placeholder="Question, slug…"
            />
          </div>
        </form>
        <div className="admin-filters-actions">
          <button form="" type="submit" className="admin-button">
            Appliquer
          </button>
          <a href={`/fr/${adminPrefix}/faq`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Catégorie</th>
              <th>Question (FR)</th>
              <th>Slug</th>
              <th>Statut</th>
              <th>Vues</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  Aucune question trouvée.
                </td>
              </tr>
            ) : (
              result.items.map((f) => (
                <tr key={f.id}>
                  <td>{f.displayOrder}</td>
                  <td>{CATEGORY_LABELS[f.category] ?? f.category}</td>
                  <td>{f.questionFr}</td>
                  <td>
                    <code className="admin-meta-small">{f.slug}</code>
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge-${f.status}`}>
                      {STATUS_LABELS[f.status] ?? f.status}
                    </span>
                  </td>
                  <td>{f.viewCount}</td>
                  <td>
                    <a href={`/fr/${adminPrefix}/faq/${f.id}`} className="admin-link">
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
