// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Connaissances V2 (liste KB) — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badges → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminButton,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/lib/format-date-fr";
import { KB_TYPES, getKbTypeMeta } from "@/content/knowledge/types";
import { KB_DOMAINS, getDomainLabel } from "@/content/knowledge/domains";
import { KB_AUDIENCES, getAudienceLabel } from "@/content/knowledge/audiences";
import { KB_STATUSES, getStatusLabel } from "@/content/knowledge/statuses";

// Track 2 : tonalité du badge dérivée du statut (avant : `.admin-badge-${status}`
// non défini pour les statuts KB → badge neutre non coloré).
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  published: "success",
  approved: "success",
  draft: "warning",
  review: "warning",
  scheduled: "warning",
  archived: "neutral",
  deprecated: "neutral",
};

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
  const columns: ReadonlyArray<AdminTableColumn<EntryRow>> = [
    { key: "type", header: "Type", cell: (e) => getKbTypeMeta(e.type as never).labelFr },
    {
      key: "title",
      header: "Titre (FR)",
      cell: (e) => e.translations.find((t) => t.locale === "fr")?.title ?? "(sans titre)",
    },
    {
      key: "slug",
      header: "Adresse (URL)",
      cell: (e) => <code className="admin-meta-small">{e.slug}</code>,
    },
    { key: "domain", header: "Domaine", cell: (e) => getDomainLabel(e.domain as never, "fr") },
    {
      key: "audience",
      header: "Audience",
      cell: (e) => getAudienceLabel(e.audience as never, "fr"),
    },
    {
      key: "status",
      header: "Statut",
      cell: (e) => (
        <AdminBadge tone={STATUS_TONE[e.status] ?? "neutral"}>
          {getStatusLabel(e.status as never, "fr")}
        </AdminBadge>
      ),
    },
    { key: "updatedAt", header: "Modifiée le", cell: (e) => formatDateFrShort(e.updatedAt) },
  ];

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
                    {getAudienceLabel(a, "fr")}
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
                    {getDomainLabel(d, "fr")}
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
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/connaissances`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucune entrée trouvée." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(e) => e.id}
          caption="Liste des entrées de la base de connaissances"
          rowAction={(e) => (
            <AdminButton
              href={`/fr/${adminPrefix}/connaissances/${e.id}`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Éditer
            </AdminButton>
          )}
        />
      )}

      {/* 🔴 Le sous-titre annonçait « page 1/N » et la page N n'existait
          nulle part à l'écran : au-delà de la première, les lignes
          n'étaient atteignables qu'en éditant l'URL. Les filtres en cours
          sont reportés dans les liens — sinon changer de page les
          effacerait, et on repartirait d'une autre liste. */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={`/fr/${adminPrefix}/connaissances`}
        preservedParams={{
          status: sp["status"],
          search: sp["search"],
          type: sp["type"],
          domain: sp["domain"],
          audience: sp["audience"],
        }}
      />
    </AdminPageShell>
  );
}
