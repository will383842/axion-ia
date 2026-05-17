// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Connaissances V2 (liste KB) — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { KB_TYPES, getKbTypeMeta } from "@/content/knowledge/types";
import { KB_DOMAINS } from "@/content/knowledge/domains";
import { KB_AUDIENCES } from "@/content/knowledge/audiences";
import { KB_STATUSES, getStatusLabel } from "@/content/knowledge/statuses";

interface EntryRow {
  id: string;
  type: string;
  slug: string;
  domain: string;
  audience: string;
  status: string;
  updatedAt: Date;
  translations: ReadonlyArray<{ locale: string; title: string }>;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<EntryRow>;
  total: number;
  page: number;
  totalPages: number;
}

export function ConnaissancesV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Connaissances"
        description={`${total} entrée${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/connaissances/nouvelle`} className="admin-button">
            + Nouvelle entrée
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="type" className="admin-label">
                Type
              </label>
              <select id="type" name="type" defaultValue={sp["type"] ?? ""} className="admin-input">
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
                defaultValue={sp["audience"] ?? "all"}
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
                defaultValue={sp["status"] ?? ""}
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
                defaultValue={sp["domain"] ?? ""}
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
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Min 2 caractères"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/connaissances`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    Aucune entrée trouvée.
                  </td>
                </tr>
              ) : (
                items.map((e) => {
                  const fr = e.translations.find((t) => t.locale === "fr");
                  return (
                    <tr key={e.id}>
                      <td>{getKbTypeMeta(e.type as never).labelFr}</td>
                      <td>{fr?.title ?? "(sans titre)"}</td>
                      <td>
                        <code className="admin-meta-small">{e.slug}</code>
                      </td>
                      <td>{e.domain}</td>
                      <td>{e.audience}</td>
                      <td>
                        <span className={`admin-badge admin-badge-${e.status}`}>
                          {getStatusLabel(e.status as never, "fr")}
                        </span>
                      </td>
                      <td>{e.updatedAt.toISOString().slice(0, 10)}</td>
                      <td>
                        <Link
                          href={`/fr/${adminPrefix}/connaissances/${e.id}`}
                          className="admin-link"
                        >
                          Éditer →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
