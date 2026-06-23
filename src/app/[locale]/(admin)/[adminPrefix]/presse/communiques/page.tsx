/**
 * Admin — Salle de presse · liste des communiqués.
 *
 * Liste filtrable (statut · catégorie · recherche titre), triable (ordre manuel
 * ↑/↓, plus récents, titre, statut) et avec import groupé multi-PDF. Lecture
 * directe via prisma (Server Component force-dynamic). Le réordonnancement manuel
 * écrit `sortOrder` → pilote l'ordre d'affichage public sur /presse.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { movePressRelease } from "@/server/actions/press/releases";
import type { PublishStatus, PressReleaseTag } from "../../../../../../../prisma/generated/client";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminBadge,
  AdminStatusBadge,
  AdminEmptyState,
  AdminFilterTabs,
  type AdminTableColumn,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Communiqués | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const TAG_LABELS: Record<string, string> = {
  launch: "Lancement",
  partnership: "Partenariat",
  study: "Étude",
  product: "Produit",
  milestone: "Jalon",
};
const TAG_VALUES = ["launch", "partnership", "study", "product", "milestone"] as const;
const STATUS_VALUES = ["draft", "published", "archived"] as const;
const SORT_VALUES = ["manual", "recent", "oldest", "title", "status"] as const;
type SortKey = (typeof SORT_VALUES)[number];
const SORT_LABELS: Record<SortKey, string> = {
  manual: "Ordre manuel",
  recent: "Plus récents",
  oldest: "Plus anciens",
  title: "Titre A→Z",
  status: "Statut",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams?: Promise<{
    status?: string;
    tag?: string;
    q?: string;
    sort?: string;
    imported?: string;
  }>;
}

interface ReleaseRow {
  id: string;
  tag: string;
  status: string;
  title: string;
  updatedAt: Date;
  idx: number;
}

/** Construit un query-string en ignorant les valeurs vides / « all ». */
function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all" && v !== "") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function PressReleasesListPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;
  const sp = (await searchParams) ?? {};

  // Filtres + tri depuis l'URL (server-driven, zéro state client).
  const rawStatus = sp.status ?? "";
  const statusFilter: PublishStatus | undefined = (STATUS_VALUES as readonly string[]).includes(
    rawStatus,
  )
    ? (rawStatus as PublishStatus)
    : undefined;
  const rawTag = sp.tag ?? "";
  const tagFilter: PressReleaseTag | undefined = (TAG_VALUES as readonly string[]).includes(rawTag)
    ? (rawTag as PressReleaseTag)
    : undefined;
  const q = (sp.q ?? "").trim();
  const rawSort = sp.sort ?? "";
  const sortKey: SortKey = (SORT_VALUES as readonly string[]).includes(rawSort)
    ? (rawSort as SortKey)
    : "manual";
  const importedCount = Number.parseInt(sp.imported ?? "", 10);
  const filtersActive = Boolean(statusFilter || tagFilter || q);
  // Réordonnancement manuel = uniquement en ordre manuel SANS filtre (sinon
  // l'adjacence affichée ≠ adjacence réelle dans l'ordre complet).
  const manualMode = sortKey === "manual" && !filtersActive;

  // where typé explicitement (évite l'import du namespace Prisma).
  const where: {
    deletedAt: null;
    status?: PublishStatus;
    tag?: PressReleaseTag;
    translations?: { some: { locale: "fr"; title: { contains: string; mode: "insensitive" } } };
  } = { deletedAt: null };
  if (statusFilter) where.status = statusFilter;
  if (tagFilter) where.tag = tagFilter;
  if (q)
    where.translations = { some: { locale: "fr", title: { contains: q, mode: "insensitive" } } };

  const orderBy =
    sortKey === "recent"
      ? [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }]
      : sortKey === "oldest"
        ? [{ createdAt: "asc" as const }]
        : sortKey === "status"
          ? [
              { status: "asc" as const },
              { sortOrder: "asc" as const },
              { createdAt: "desc" as const },
            ]
          : // manual + title (title est re-trié en JS ensuite)
            [
              { sortOrder: "asc" as const },
              { publishedAt: "desc" as const },
              { createdAt: "desc" as const },
            ];

  let rows: ReleaseRow[] = [];
  let totalCount = 0;
  let publishedCount = 0;
  let draftCount = 0;
  try {
    const [releases, grouped] = await Promise.all([
      prisma.pressRelease.findMany({
        where,
        include: { translations: { where: { locale: "fr" } } },
        orderBy,
        take: 200,
      }),
      prisma.pressRelease.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    let mapped = releases.map((r, i) => ({
      id: r.id,
      tag: r.tag,
      status: r.status,
      title: r.translations[0]?.title ?? "(sans titre)",
      updatedAt: r.updatedAt,
      idx: i,
    }));
    if (sortKey === "title") {
      mapped = [...mapped]
        .sort((a, b) => a.title.localeCompare(b.title, "fr"))
        .map((r, i) => ({ ...r, idx: i }));
    }
    rows = mapped;

    for (const g of grouped) {
      const n = g._count._all;
      totalCount += n;
      if (g.status === "published") publishedCount = n;
      if (g.status === "draft") draftCount = n;
    }
  } catch {
    rows = [];
  }

  // Server action réordonnancement (capte `base`).
  async function move(formData: FormData): Promise<void> {
    "use server";
    const mid = String(formData.get("id") ?? "");
    const dir = formData.get("dir") === "up" ? "up" : "down";
    if (mid) await movePressRelease(mid, dir);
    redirect(`${base}/communiques`);
  }

  const statusTabs = [
    {
      value: "all",
      label: "Tous",
      href: `${base}/communiques${qs({ tag: sp.tag, q, sort: sortKey })}`,
      count: totalCount,
    },
    {
      value: "published",
      label: "Publiés",
      href: `${base}/communiques${qs({ status: "published", tag: sp.tag, q, sort: sortKey })}`,
      count: publishedCount,
    },
    {
      value: "draft",
      label: "Brouillons",
      href: `${base}/communiques${qs({ status: "draft", tag: sp.tag, q, sort: sortKey })}`,
      count: draftCount,
    },
  ];

  const inputClass =
    "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const labelClass =
    "flex flex-col gap-1 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]";

  const reorderColumn: AdminTableColumn<ReleaseRow> = {
    key: "reorder",
    header: "Ordre",
    width: "84px",
    cell: (row) => (
      <div className="flex items-center gap-[var(--space-admin-2)]">
        <form action={move}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="dir" value="up" />
          <button
            type="submit"
            disabled={row.idx === 0}
            aria-label="Monter"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-soft)] hover:bg-[color:var(--color-admin-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
        <form action={move}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="dir" value="down" />
          <button
            type="submit"
            disabled={row.idx === rows.length - 1}
            aria-label="Descendre"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-soft)] hover:bg-[color:var(--color-admin-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    ),
  };

  const baseColumns: ReadonlyArray<AdminTableColumn<ReleaseRow>> = [
    {
      key: "title",
      header: "Titre",
      cell: (row) => (
        <Link
          href={`${base}/communiques/${row.id}`}
          className="font-medium text-[color:var(--color-admin-fg)] hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: "tag",
      header: "Catégorie",
      cell: (row) => <AdminBadge tone="outline">{TAG_LABELS[row.tag] ?? row.tag}</AdminBadge>,
      hiddenBelow: "sm",
    },
    {
      key: "status",
      header: "Statut",
      cell: (row) => <AdminStatusBadge type="publication" status={row.status} />,
    },
    {
      key: "updatedAt",
      header: "Modifié le",
      cell: (row) => (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] tabular-nums">
          {row.updatedAt.toLocaleDateString("fr-FR")}
        </span>
      ),
      hiddenBelow: "md",
    },
  ];

  const columns = manualMode ? [reorderColumn, ...baseColumns] : baseColumns;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Communiqués de presse"
        description={`${totalCount} communiqué${totalCount > 1 ? "s" : ""} au total (brouillons inclus)`}
        actions={
          <div className="flex items-center gap-[var(--space-admin-3)]">
            <Link href={`${base}/communiques/import`} className="admin-button-secondary">
              Importer plusieurs
            </Link>
            <Link href={`${base}/communiques/nouveau`} className="admin-button">
              + Nouveau
            </Link>
          </div>
        }
      />

      {Number.isFinite(importedCount) && importedCount > 0 ? (
        <div className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-info)] bg-[color:var(--color-admin-info-soft)] px-[var(--space-admin-5)] py-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-info)]">
          {importedCount} communiqué{importedCount > 1 ? "s" : ""} importé
          {importedCount > 1 ? "s" : ""} en brouillon. Complétez le titre et publiez depuis chaque
          fiche.
        </div>
      ) : null}

      {/* Filtres + tri */}
      <div className="mb-[var(--space-admin-6)] flex flex-col gap-[var(--space-admin-5)]">
        <AdminFilterTabs options={statusTabs} current={statusFilter ?? "all"} label="Statut" />
        <form
          method="get"
          action={`${base}/communiques`}
          className="flex flex-wrap items-end gap-[var(--space-admin-4)]"
        >
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <label className={labelClass}>
            Catégorie
            <select name="tag" defaultValue={tagFilter ?? "all"} className={inputClass}>
              <option value="all">Toutes</option>
              {TAG_VALUES.map((tg) => (
                <option key={tg} value={tg}>
                  {TAG_LABELS[tg]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Recherche
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Titre…"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Tri
            <select name="sort" defaultValue={sortKey} className={inputClass}>
              {SORT_VALUES.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="admin-button">
            Filtrer
          </button>
          {filtersActive || sortKey !== "manual" ? (
            <Link href={`${base}/communiques`} className="admin-button-secondary">
              Réinitialiser
            </Link>
          ) : null}
        </form>
      </div>

      <AdminTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="Liste des communiqués de presse"
        rowAction={(row) => (
          <Link
            href={`${base}/communiques/${row.id}`}
            className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
          >
            Éditer
          </Link>
        )}
        emptyState={
          <AdminEmptyState
            title={filtersActive ? "Aucun communiqué pour ces filtres" : "Aucun communiqué"}
            description={
              filtersActive
                ? "Ajustez ou réinitialisez les filtres."
                : "Créez votre premier communiqué de presse."
            }
            primaryAction={
              filtersActive ? (
                <Link href={`${base}/communiques`} className="admin-button">
                  Réinitialiser les filtres
                </Link>
              ) : (
                <Link href={`${base}/communiques/nouveau`} className="admin-button">
                  Nouveau communiqué
                </Link>
              )
            }
          />
        }
      />

      {manualMode ? (
        <p className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Utilisez les flèches ↑/↓ pour ordonner les communiqués — cet ordre est repris sur la salle
          de presse publique. (Le réordonnancement est disponible uniquement en « Ordre manuel »
          sans filtre.)
        </p>
      ) : null}
    </AdminPageShell>
  );
}
