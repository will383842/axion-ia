// KB-3 — Liste filtrable des entrées Knowledge Base admin (FR cohérent).
//
// Spec : `_AUDIT/KNOWLEDGE-BASE-2026/03-ADMIN-UI.md`.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEntriesAction } from "@/server/actions/knowledge/list-entries";
import { KB_TYPES } from "@/content/knowledge/types";
import { KB_DOMAINS } from "@/content/knowledge/domains";
import { KB_AUDIENCES } from "@/content/knowledge/audiences";
import { KB_STATUSES, getStatusLabel } from "@/content/knowledge/statuses";
import { getKbTypeMeta } from "@/content/knowledge/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ConnaissancesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listEntriesAction({
    type: sp.type as never,
    audience: (sp.audience as never) ?? "all",
    status: sp.status as never,
    domain: sp.domain as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Connaissances</h1>
          <p className="admin-meta">
            {result.total} entrée{result.total > 1 ? "s" : ""} · page {result.page}/
            {result.totalPages}
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/connaissances/nouvelle`} className="admin-button">
          + Nouvelle entrée
        </a>
      </div>

      <div className="admin-card admin-filters">
        <form className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="type" className="admin-label">
              Type
            </label>
            <select id="type" name="type" defaultValue={sp.type ?? ""} className="admin-input">
              <option value="">Tous</option>
              {KB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {getKbTypeMeta(t).labelFr}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="audience" className="admin-label">
              Audience
            </label>
            <select
              id="audience"
              name="audience"
              defaultValue={sp.audience ?? "all"}
              className="admin-input"
            >
              <option value="all">Toutes</option>
              {KB_AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
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
              defaultValue={sp.status ?? ""}
              className="admin-input"
            >
              <option value="">Tous</option>
              {KB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {getStatusLabel(s, "fr")}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="domain" className="admin-label">
              Domaine
            </label>
            <select
              id="domain"
              name="domain"
              defaultValue={sp.domain ?? ""}
              className="admin-input"
            >
              <option value="">Tous</option>
              {KB_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
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
          <a href={`/fr/${adminPrefix}/connaissances`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Titre (FR)</th>
              <th>Slug</th>
              <th>Domaine</th>
              <th>Audience</th>
              <th>Statut</th>
              <th>Maj</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-table-empty">
                  Aucune entrée trouvée.
                </td>
              </tr>
            ) : (
              result.items.map((e) => {
                const fr = e.translations.find((t) => t.locale === "fr");
                return (
                  <tr key={e.id}>
                    <td>{getKbTypeMeta(e.type).labelFr}</td>
                    <td>{fr?.title ?? "(sans titre)"}</td>
                    <td>
                      <code className="admin-meta-small">{e.slug}</code>
                    </td>
                    <td>{e.domain}</td>
                    <td>{e.audience}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${e.status}`}>
                        {getStatusLabel(e.status, "fr")}
                      </span>
                    </td>
                    <td>{e.updatedAt.toISOString().slice(0, 10)}</td>
                    <td>
                      <a href={`/fr/${adminPrefix}/connaissances/${e.id}`} className="admin-link">
                        Éditer →
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
