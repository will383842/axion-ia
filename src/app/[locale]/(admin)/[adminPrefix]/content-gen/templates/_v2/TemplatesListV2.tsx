// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Templates list V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { listTemplates, toggleTemplate } from "@/server/actions/content-gen/templates";
import type { ContentType } from "../../../../../../../../prisma/generated/client";

const CONTENT_TYPES: ReadonlyArray<ContentType> = [
  "landing_ville",
  "blog_article",
  "blog_from_title",
  "blog_from_keywords",
  "blog_from_rss",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
] satisfies ReadonlyArray<ContentType>;

type TemplateRow = Awaited<ReturnType<typeof listTemplates>>[number];

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function TemplatesListV2({
  adminPrefix,
  searchParams: sp,
}: Props): Promise<React.ReactElement> {
  const rows = await listTemplates({
    ...(sp["contentType"] ? { contentType: sp["contentType"] as ContentType } : {}),
    ...(sp["isActive"] === "true"
      ? { isActive: true }
      : sp["isActive"] === "false"
        ? { isActive: false }
        : {}),
  });

  const base = `/fr/${adminPrefix}/content-gen/templates`;

  async function toggle(formData: FormData) {
    "use server";
    await toggleTemplate(String(formData.get("id")), formData.get("isActive") === "true");
  }

  const columns: ReadonlyArray<AdminTableColumn<TemplateRow>> = [
    { key: "type", header: "Type", cell: (r) => r.contentType },
    {
      key: "slug",
      header: "Identifiant",
      cell: (r) => (
        <Link href={`${base}/${r.id}`} className="admin-link">
          <code>{r.slug}</code>
        </Link>
      ),
    },
    { key: "variant", header: "Variante", cell: (r) => r.variant ?? "—" },
    { key: "version", header: "Version", cell: (r) => `v${r.version}` },
    {
      key: "stats",
      header: "Génér./Publ./Échecs",
      cell: (r) => `${r.generatedItems} / ${r.publishedItems} / ${r.failedItems}`,
    },
    { key: "model", header: "Modèle", cell: (r) => r.defaultModel ?? "—" },
    {
      key: "active",
      header: "Actif",
      cell: (r) => (
        <AdminBadge tone={r.isActive ? "success" : "neutral"}>
          {r.isActive ? "✅" : "🚫"}
        </AdminBadge>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Templates de prompts"
        description={`${rows.length} template${rows.length > 1 ? "s" : ""}`}
        actions={
          <Link href={`${base}/new`} className="admin-button">
            + Nouveau template
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <p className="text-[length:var(--text-admin-sm)]">
          ℹ️ Un template <strong>actif</strong> remplace, à la génération, le prompt système (+
          température / max tokens) codé en dur — la voix de marque reste toujours ré-appliquée.
          Câblé pour :{" "}
          <strong>blog_article, blog_from_keywords, blog_from_title, blog_from_rss</strong>. Les
          autres types utilisent encore le prompt code (fallback).
        </p>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="contentType" className="admin-label">
                Type
              </label>
              <select
                id="contentType"
                name="contentType"
                defaultValue={sp["contentType"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="isActive" className="admin-label">
                Actif
              </label>
              <select
                id="isActive"
                name="isActive"
                defaultValue={sp["isActive"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button-secondary">
              Filtrer
            </button>
            <Link href={base} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {rows.length === 0 ? (
        <AdminEmptyState title="Aucun template — créez-en un." />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          caption="Liste des templates de prompts"
          rowAction={(r) => (
            <div className="flex gap-[var(--space-admin-2)]">
              <Link href={`${base}/${r.id}`} className="admin-button-ghost">
                Éditer
              </Link>
              <form action={toggle} className="inline">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                <button type="submit" className="admin-button-ghost">
                  {r.isActive ? "Désactiver" : "Activer"}
                </button>
              </form>
            </div>
          )}
        />
      )}
    </AdminPageShell>
  );
}
