// Refonte admin mai 2026 — PR 7. P0-1 Sprint P5 — pause/resume icons lucide.
// Archivage liste (2026-07-01) — vue par défaut = campagnes ACTIVES (les
// terminées/annulées sont masquées, retrouvables via l'onglet « Archivées ») +
// pagination 25/page pour la scalabilité.

import Link from "next/link";
import { Pause, Play, PlayCircle, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import {
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  launchCampaign,
  archiveCampaign,
  unarchiveCampaign,
  deleteCampaignPermanently,
} from "@/server/actions/content-gen/coverage";
import {
  parseCampaignListView,
  type CampaignListView,
} from "@/server/actions/content-gen/coverage-status-groups";
import { ConfirmSubmitButton } from "./ConfirmSubmitButton";
import { formatDateFrShort } from "@/lib/format-date-fr";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import type {
  CoverageStatus,
  ServiceSector,
} from "../../../../../../../../prisma/generated/client";

// La colonne « Scope » affichait la valeur brute : national / region /
// ville / multi.
const PERIMETRE_LABELS: Record<string, string> = {
  national: "National",
  region: "Une région",
  ville: "Une ville",
  multi: "Plusieurs zones",
};

const STATUS_LABELS_FR: Record<string, string> = {
  draft: "Brouillon",
  scheduled: "Planifiée",
  queued: "En file",
  running: "En cours",
  paused: "En pause",
  completed: "Terminée",
  failed: "Échouée",
  cancelled: "Annulée",
};

const STATUSES: ReadonlyArray<CoverageStatus> = [
  "draft",
  "scheduled",
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
];

// Onglets de vue — distinguent clairement en cours/pause vs terminées vs archivées.
const VIEW_LABEL: Record<CampaignListView, string> = {
  active: "Actives",
  paused: "En pause",
  terminated: "Terminées",
  archived: "Archivées",
  all: "Toutes",
};

const VIEW_TABS: ReadonlyArray<CampaignListView> = [
  "active",
  "paused",
  "terminated",
  "archived",
  "all",
];

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

async function pauseRow(id: string) {
  "use server";
  await pauseCampaign(id);
}

async function resumeRow(id: string) {
  "use server";
  await resumeCampaign(id);
}

async function launchRow(id: string) {
  "use server";
  await launchCampaign(id);
}

async function archiveRow(id: string) {
  "use server";
  await archiveCampaign(id);
}

async function unarchiveRow(id: string) {
  "use server";
  await unarchiveCampaign(id);
}

async function deleteRow(id: string) {
  "use server";
  await deleteCampaignPermanently(id);
}

export async function CoverageListV2({
  adminPrefix,
  searchParams: sp,
}: Props): Promise<React.ReactElement> {
  const status = (sp["status"] as CoverageStatus | undefined) || undefined;
  const sector = (sp["serviceSector"] as ServiceSector | undefined) || undefined;
  const view = parseCampaignListView(sp["view"]);
  const requestedPage = Number.parseInt(sp["page"] ?? "1", 10);
  const { rows, total, page, pageSize } = await listCampaigns({
    view,
    ...(status ? { status } : {}),
    ...(sector ? { serviceSector: sector } : {}),
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  });
  const base = `/fr/${adminPrefix}/content-gen/coverage`;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Construit une URL de la liste en préservant les filtres courants. Les
  // valeurs par défaut (view=active, page=1) sont omises → URL propre.
  const buildUrl = (overrides: Record<string, string | number | undefined>): string => {
    const merged: Record<string, string | number | undefined> = {
      view,
      ...(status ? { status } : {}),
      ...(sector ? { serviceSector: sector } : {}),
      page,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "") continue;
      if (k === "view" && v === "active") continue;
      if (k === "page" && (v === 1 || v === "1")) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  type CampaignRow = (typeof rows)[number];
  const columns: ReadonlyArray<AdminTableColumn<CampaignRow>> = [
    {
      key: "name",
      header: "Nom",
      cell: (r) => (
        <Link href={`${base}/${r.id}`} className="admin-link">
          {r.name}
        </Link>
      ),
    },
    {
      key: "sector",
      header: "Secteur",
      cell: (r) =>
        r.serviceSector ? (
          <AdminBadge tone="info">{SERVICE_SECTOR_LABELS[r.serviceSector]}</AdminBadge>
        ) : (
          <span className="admin-meta">—</span>
        ),
    },
    { key: "scope", header: "Périmètre", cell: (r) => PERIMETRE_LABELS[r.scope] ?? r.scope },
    { key: "target", header: "Cible", cell: (r) => r.totalTargetCount },
    { key: "status", header: "Statut", cell: (r) => STATUS_LABELS_FR[r.status] ?? r.status },
    {
      key: "counts",
      header: "Gén/Pub/Éch",
      cell: (r) => `${r.generatedCount} / ${r.publishedCount} / ${r.failedCount}`,
    },
    {
      key: "cost",
      header: "Coût est.",
      cell: (r) => (r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(2)}` : "—"),
    },
    {
      key: "createdAt",
      header: "Créée",
      cell: (r) => formatDateFrShort(r.createdAt),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Campagnes de couverture"
        description={`${total} campagne${total > 1 ? "s" : ""} · ${VIEW_LABEL[view]}${sector ? ` · secteur ${SERVICE_SECTOR_LABELS[sector]}` : ""}${status ? ` · ${STATUS_LABELS_FR[status] ?? status}` : ""}`}
        actions={
          <Link href={`${base}/new`} className="admin-button-cta">
            + Nouvelle campagne
          </Link>
        }
      />

      {/* Onglets de vue — Actives (défaut) masque les terminées/annulées. */}
      <div
        className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
        role="tablist"
        aria-label="Filtrer par état"
      >
        {VIEW_TABS.map((v) => (
          <Link
            key={v}
            href={buildUrl({ view: v, page: 1 })}
            role="tab"
            aria-selected={view === v}
            className={view === v ? "admin-button" : "admin-button-ghost"}
          >
            {VIEW_LABEL[v]}
          </Link>
        ))}
      </div>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          {/* Préserve la vue courante lors d'un filtrage. */}
          <input type="hidden" name="view" value={view} />
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="status" className="admin-label">
                Statut (exact)
              </label>
              <select
                id="status"
                name="status"
                defaultValue={sp["status"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS_FR[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="serviceSector" className="admin-label">
                Secteur
              </label>
              <select
                id="serviceSector"
                name="serviceSector"
                defaultValue={sp["serviceSector"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {SERVICE_SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {SERVICE_SECTOR_LABELS[s]}
                  </option>
                ))}
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
        <AdminEmptyState
          title={
            view === "archived"
              ? "Aucune campagne archivée."
              : view === "paused"
                ? "Aucune campagne en pause."
                : view === "terminated"
                  ? "Aucune campagne terminée."
                  : view === "all"
                    ? "Aucune campagne. Créez-en une."
                    : "Aucune campagne active. Créez-en une ou consultez les archivées."
          }
        />
      ) : (
        <>
          <AdminTable
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            caption="Liste des campagnes de couverture"
            rowAction={(r) => (
              <div className="flex items-center gap-[var(--space-admin-2)]">
                {r.archivedAt ? (
                  <>
                    {/* Campagne archivée → réactiver (désarchiver) ou supprimer. */}
                    <form action={unarchiveRow.bind(null, r.id)} className="inline">
                      <button
                        type="submit"
                        title="Réactiver (désarchiver)"
                        aria-label="Réactiver cette campagne"
                        className="admin-button-ghost"
                      >
                        <ArchiveRestore size={16} />
                      </button>
                    </form>
                    <form action={deleteRow.bind(null, r.id)} className="inline">
                      <ConfirmSubmitButton
                        confirmMessage={`Supprimer DÉFINITIVEMENT la campagne « ${r.name} » ? Cette action est irréversible (la campagne ne pourra plus être réactivée). Ses jobs et articles publiés sont conservés.`}
                        title="Supprimer définitivement"
                        ariaLabel="Supprimer définitivement cette campagne"
                        className="admin-button-ghost admin-button-ghost-danger"
                      >
                        <Trash2 size={16} />
                      </ConfirmSubmitButton>
                    </form>
                  </>
                ) : (
                  <>
                    {r.status === "running" ? (
                      <form action={pauseRow.bind(null, r.id)} className="inline">
                        <button
                          type="submit"
                          title="Mettre en pause"
                          aria-label="Mettre en pause cette campagne"
                          className="admin-button-ghost"
                        >
                          <Pause size={16} />
                        </button>
                      </form>
                    ) : r.status === "paused" ? (
                      <form action={resumeRow.bind(null, r.id)} className="inline">
                        <button
                          type="submit"
                          title="Reprendre"
                          aria-label="Reprendre cette campagne"
                          className="admin-button-ghost"
                        >
                          <Play size={16} />
                        </button>
                      </form>
                    ) : r.status === "draft" || r.status === "scheduled" ? (
                      <form action={launchRow.bind(null, r.id)} className="inline">
                        <button
                          type="submit"
                          title="Lancer la campagne"
                          aria-label="Lancer cette campagne"
                          className="admin-button-ghost"
                        >
                          <PlayCircle size={16} />
                        </button>
                      </form>
                    ) : null}
                    {/* Archiver : masque la campagne de la vue par défaut (réversible). */}
                    <form action={archiveRow.bind(null, r.id)} className="inline">
                      <button
                        type="submit"
                        title="Archiver (masquer, réversible)"
                        aria-label="Archiver cette campagne"
                        className="admin-button-ghost"
                      >
                        <Archive size={16} />
                      </button>
                    </form>
                    <form action={deleteRow.bind(null, r.id)} className="inline">
                      <ConfirmSubmitButton
                        confirmMessage={`Supprimer DÉFINITIVEMENT la campagne « ${r.name} » ? Cette action est irréversible (la campagne ne pourra plus être réactivée). Ses jobs et articles publiés sont conservés. Pour la masquer temporairement, préférez « Archiver ».`}
                        title="Supprimer définitivement"
                        ariaLabel="Supprimer définitivement cette campagne"
                        className="admin-button-ghost admin-button-ghost-danger"
                      >
                        <Trash2 size={16} />
                      </ConfirmSubmitButton>
                    </form>
                  </>
                )}
              </div>
            )}
          />

          <AdminPagination
            page={page}
            totalPages={totalPages}
            baseHref={base}
            preservedParams={{
              view: view === "active" ? undefined : view,
              status,
              serviceSector: sector,
            }}
          />
        </>
      )}
    </AdminPageShell>
  );
}
