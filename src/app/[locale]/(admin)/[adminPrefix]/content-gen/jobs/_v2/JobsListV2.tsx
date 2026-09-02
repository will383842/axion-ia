// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Jobs list V2 — utilise AdminPageShell + AdminPageHeader + AdminCard.
// Filtres status + type + template + secteur + ville + search préservés.
// SP-04 P1 — prev/next pagination buttons.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badge statut → <AdminBadge>. Filtres / pagination / KPIs / server actions
// inchangés.

import Link from "next/link";
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
  listJobs,
  retryAllFailed,
  deleteFailedJobs,
  countDeletableFailedJobs,
} from "@/server/actions/content-gen/jobs";
// Fix 2026-08-15 (audit e2e, bonus) — classification transitoire/permanent des
// échecs (module pur partagé avec la reprise automatique) : permet de voir d'un
// coup d'œil ce que la reprise relancera seule et ce qui demande une intervention.
import { classifyFailure } from "@/server/content-gen/recovery/failure-classifier";
import { formatDateFr } from "@/lib/format-date-fr";
import { listTemplates } from "@/server/actions/content-gen/templates";
import { libelleInstructionIA } from "@/components/admin/content-gen/template-labels";
import {
  CONTENT_TYPE_LABELS_FR,
  JOB_STATUS_LABELS_FR,
  JOB_STATUS_TONE,
  contentTypeLabelFr,
} from "@/server/content-gen/shared/admin-labels";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import type {
  ContentGenJobStatus,
  ContentType,
  ServiceSector,
} from "../../../../../../../../prisma/generated/client";
import { ConfirmSubmitButton } from "@/components/admin/ui/ConfirmSubmitButton";

const STATUSES: ReadonlyArray<ContentGenJobStatus> = [
  "queued",
  "running",
  "quality_improving",
  "needs_review",
  "publishing",
  "published",
  "failed",
  "cancelled",
  // Fix 2026-08-15 (audit e2e, E8) — les quarantaines étaient absentes du
  // filtre : impossible d'isoler à l'écran les jobs bloqués par le LLM-judge
  // ou le fact-check, alors qu'ils exigent une décision humaine (relance ou
  // suppression définitive).
  "quarantined_critical",
  "quarantined_factcheck",
];

// 🔴 LE FILTRE « TYPE » PROPOSAIT 9 VALEURS RECOPIÉES À LA MAIN, alors que la
// liste affichait des jobs `case_study_local`, `what_is_x`, `vs_comparator`,
// `glossary_term`, `calculator_roi`… — 13 types sur 22 étaient infiltrables.
// La liste est désormais DÉRIVÉE du SSOT des libellés (`Record<ContentType,
// string>`, exhaustif par construction : un nouveau type de l'enum Prisma y
// entre à la compilation, et donc ici). Triée par libellé FR pour un menu de
// 22 entrées lisible.
const TYPES: ReadonlyArray<ContentType> = (
  Object.keys(CONTENT_TYPE_LABELS_FR) as ReadonlyArray<ContentType>
)
  .slice()
  .sort((a, b) => contentTypeLabelFr(a).localeCompare(contentTypeLabelFr(b), "fr"));

// Libellés FR + tonalités : centralisés dans `admin-labels.ts` (SSOT, exhaustif
// sur les enums Prisma, testé). On n'affiche plus jamais un slug technique.

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function JobsListV2({
  adminPrefix,
  searchParams: sp,
}: Props): Promise<React.ReactElement> {
  const page = sp["page"] ? parseInt(sp["page"], 10) : 1;
  // Fix 2026-08-15 (E3) — `deletableCount` alimente la confirmation chiffrée de
  // la suppression définitive (l'admin doit retaper ce nombre exact).
  const [result, templates, deletableCount] = await Promise.all([
    listJobs({
      ...(sp["status"] ? { status: sp["status"] as ContentGenJobStatus } : {}),
      ...(sp["contentType"] ? { contentType: sp["contentType"] as ContentType } : {}),
      ...(sp["templateId"] ? { templateId: sp["templateId"] } : {}),
      ...(sp["serviceSector"] ? { serviceSector: sp["serviceSector"] as ServiceSector } : {}),
      ...(sp["anchorVilleSlug"] ? { anchorVilleSlug: sp["anchorVilleSlug"] } : {}),
      ...(sp["search"] ? { search: sp["search"] } : {}),
      page,
    }),
    listTemplates({ isActive: true }),
    countDeletableFailedJobs(),
  ]);

  const base = `/fr/${adminPrefix}/content-gen/jobs`;

  async function retryAll() {
    "use server";
    await retryAllFailed();
  }

  // Fix 2026-08-15 (audit e2e, E3) — la suppression exige désormais le nombre
  // exact de jobs (validé côté serveur, rôle super_admin) : un POST accidentel
  // ou une page périmée ne détruit plus rien. NaN → -1, jamais égal au compte.
  async function deleteFailed(formData: FormData) {
    "use server";
    const raw = parseInt(String(formData.get("confirmationCount") ?? ""), 10);
    await deleteFailedJobs(Number.isFinite(raw) ? raw : -1);
  }

  type JobRow = (typeof result.rows)[number];

  const columns: ReadonlyArray<AdminTableColumn<JobRow>> = [
    {
      key: "date",
      header: "Date",
      cell: (r) => formatDateFr(r.createdAt),
    },
    // Audit UX 2026-08-01 (Défaut 1, P0) — sans titre, impossible de savoir ce
    // qu'on suit sans ouvrir chaque ligne. Le titre porte désormais le lien de
    // détail (le champ Date, lui, redevient du texte simple ci-dessus).
    {
      key: "title",
      header: "Titre",
      cell: (r) => (
        <Link href={`${base}/${r.id}`} className="admin-link">
          {r.title ??
            (r.status === "failed" || r.status === "cancelled"
              ? "Sans titre (génération interrompue)"
              : "Génération en cours…")}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span title={r.contentType}>{contentTypeLabelFr(r.contentType)}</span>,
    },
    {
      key: "secteur",
      header: "Secteur",
      cell: (r) =>
        r.serviceSector ? (
          <span className="admin-meta-small">{SERVICE_SECTOR_LABELS[r.serviceSector]}</span>
        ) : (
          <span className="admin-meta">—</span>
        ),
    },
    {
      key: "status",
      header: "Statut",
      cell: (r) => (
        <AdminBadge tone={JOB_STATUS_TONE[r.status] ?? "neutral"}>
          {JOB_STATUS_LABELS_FR[r.status] ?? r.status}
        </AdminBadge>
      ),
    },
    { key: "ville", header: "Ville", cell: (r) => r.anchorVilleSlug ?? "—" },
    { key: "score", header: "Score", cell: (r) => r.qualityScore ?? "—" },
    {
      key: "cost",
      header: "Coût",
      cell: (r) => (r.costUsd ? `$${Number(r.costUsd).toFixed(4)}` : "—"),
    },
    {
      key: "duration",
      header: "Durée",
      cell: (r) => (r.durationMs ? `${(r.durationMs / 1000).toFixed(1)} s` : "—"),
    },
    {
      key: "error",
      header: "Erreur",
      // Fix 2026-08-15 (audit e2e, bonus) — cause d'échec classifiée : une panne
      // « passagère » (quota/réseau provider) sera relancée automatiquement par
      // la reprise ; une cause « définitive » (qualité, doublon, config) demande
      // une intervention. Même classifieur que la reprise → l'écran dit
      // exactement ce que le système fera.
      cell: (r) => {
        if (!r.errorMessage) return "—";
        const cause = classifyFailure(r.errorMessage);
        return (
          <span title={r.errorMessage} className="flex items-center gap-[var(--space-admin-2)]">
            <AdminBadge
              tone={
                cause === "transient" ? "info" : cause === "permanent" ? "destructive" : "neutral"
              }
            >
              {cause === "transient"
                ? "Passagère (relance auto)"
                : cause === "permanent"
                  ? "Définitive"
                  : "Indéterminée"}
            </AdminBadge>
            <span>{r.errorMessage.slice(0, 40)}</span>
          </span>
        );
      },
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        // Audit UX 2026-08-01 — aligné sur le libellé sidebar (admin-nav.ts,
        // route /content-gen/jobs) : « Jobs content-gen » était un intitulé
        // technique divergent de ce que Will lit dans le menu.
        title="Générations en cours"
        description={`${result.total} job${result.total > 1 ? "s" : ""} · page ${result.page}/${result.totalPages}`}
        actions={
          <div className="flex flex-wrap gap-[var(--space-admin-2)]">
            <form action={retryAll}>
              <ConfirmSubmitButton
                className="admin-button-ghost"
                confirmMessage="Relancer TOUS les jobs en échec ? Chaque relance consomme un appel IA (≈ 0,05 à 0,11 $) sous le plafond quotidien. Les échecs de cause permanente resteront en échec."
              >
                Relancer tous les échecs
              </ConfirmSubmitButton>
            </form>
            {/* Fix 2026-08-15 (audit e2e, E3) — double étape avant suppression :
                un slot de campagne est consommé À VIE, supprimer un job en échec
                perd donc son contenu DÉFINITIVEMENT (il ne sera jamais régénéré).
                L'ancien bouton one-click au libellé anodin a détruit ce risque en
                silence. <details> = confirmation dépliable sans JS client, et
                l'admin doit retaper le nombre exact (revalidé côté serveur,
                rôle super_admin requis). */}
            {deletableCount > 0 ? (
              <details>
                <summary className="admin-button-ghost admin-button-ghost-danger cursor-pointer list-none">
                  Supprimer définitivement {deletableCount} job{deletableCount > 1 ? "s" : ""} en
                  échec/quarantaine…
                </summary>
                <form
                  action={deleteFailed}
                  className="mt-[var(--space-admin-2)] flex flex-wrap items-end gap-[var(--space-admin-2)]"
                >
                  <div className="admin-field">
                    <label htmlFor="confirmationCount" className="admin-label">
                      Suppression DÉFINITIVE : ces contenus ne seront JAMAIS régénérés (slots de
                      campagne consommés à vie). Tapez {deletableCount} pour confirmer.
                    </label>
                    <input
                      id="confirmationCount"
                      name="confirmationCount"
                      type="number"
                      required
                      min={0}
                      className="admin-input"
                      placeholder={String(deletableCount)}
                    />
                  </div>
                  <button type="submit" className="admin-button-ghost admin-button-ghost-danger">
                    Je confirme la suppression définitive
                  </button>
                </form>
              </details>
            ) : null}
          </div>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
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
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS_LABELS_FR[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
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
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {contentTypeLabelFr(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="templateId" className="admin-label">
                Instruction IA
              </label>
              <select
                id="templateId"
                name="templateId"
                defaultValue={sp["templateId"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {libelleInstructionIA(t.slug, t.name)} (v{t.version})
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
            <div className="admin-field">
              <label htmlFor="anchorVilleSlug" className="admin-label">
                Ville (slug)
              </label>
              <input
                id="anchorVilleSlug"
                name="anchorVilleSlug"
                defaultValue={sp["anchorVilleSlug"] ?? ""}
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche (id / ville)
              </label>
              <input
                id="search"
                name="search"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
              />
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

      <AdminCard variant="compact">
        {result.rows.length === 0 ? (
          <AdminEmptyState title="Aucune génération — lancez-en une depuis le tableau de bord." />
        ) : (
          <AdminTable
            columns={columns}
            rows={result.rows}
            getRowId={(r) => r.id}
            caption="Liste des jobs content-gen"
          />
        )}

        {/* Pagination P1 */}
        <AdminPagination
          page={result.page}
          totalPages={result.totalPages}
          baseHref={base}
          preservedParams={{
            status: sp["status"],
            contentType: sp["contentType"],
            templateId: sp["templateId"],
            serviceSector: sp["serviceSector"],
            anchorVilleSlug: sp["anchorVilleSlug"],
            search: sp["search"],
          }}
        />
      </AdminCard>
    </AdminPageShell>
  );
}
