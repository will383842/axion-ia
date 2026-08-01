// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Coverage detail V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions launch/pause/resume/cancel/addSlots préservées.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
} from "@/components/admin/ui";
import {
  cancelCampaign,
  incrementCampaignTarget,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  archiveCampaign,
  unarchiveCampaign,
  deleteCampaignPermanently,
} from "@/server/actions/content-gen/coverage";
import { ConfirmSubmitButton } from "../../_v2/ConfirmSubmitButton";

const STATUS_LABELS_FR: Record<string, string> = {
  draft: "Brouillon",
  running: "En cours",
  paused: "En pause",
  completed: "Terminée",
  cancelled: "Annulée",
};

interface CampaignData {
  id: string;
  name: string;
  scope: string;
  totalTargetCount: number;
  status: string;
  createdAt: Date;
  generatedCount: number;
  publishedCount: number;
  failedCount: number;
  qualityImprovedCount: number;
  anchorVilleSlugs: ReadonlyArray<string>;
  anchorDepartementCodes: ReadonlyArray<string>;
  anchorRegionSlugs: ReadonlyArray<string>;
  typeDistribution: unknown;
  audienceMix: unknown;
  searchIntentMix: unknown | null;
  // Axes multi-axes (2026-06-21)
  serviceSectorWeights?: Record<string, number> | null;
  targetSecteurWeights?: Record<string, number> | null;
  villeSurroundingMode?: string | null;
  villeSurroundingRadiusKm?: number | null;
  durationMode?: string | null;
  estimatedCostUsd: unknown;
  estimatedDurationMinutes: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  /** Archivage explicite réversible (null = active). */
  archivedAt?: Date | null;
  // Sprint Campaign Controls (§ 25.2 v1.8)
  cityProcessingMode?: string | null;
  currentCityIndex?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  recurringSchedule?: string | null;
  completedReason?: string | null;
}

interface Props {
  campaign: CampaignData;
  adminPrefix?: string;
}

export function CoverageDetailV2({ campaign, adminPrefix }: Props): React.ReactElement {
  const id = campaign.id;

  async function launch() {
    "use server";
    await launchCampaign(id);
  }
  async function pause() {
    "use server";
    await pauseCampaign(id);
  }
  async function resume() {
    "use server";
    await resumeCampaign(id);
  }
  async function cancelRunningOnly() {
    "use server";
    await cancelCampaign(id, "running_only");
  }
  async function cancelAll() {
    "use server";
    await cancelCampaign(id, "all");
  }
  async function addSlots(formData: FormData) {
    "use server";
    const delta = Number(formData.get("delta") ?? 50);
    await incrementCampaignTarget(id, delta);
  }
  async function archive() {
    "use server";
    await archiveCampaign(id);
  }
  async function unarchive() {
    "use server";
    await unarchiveCampaign(id);
  }
  async function del() {
    "use server";
    await deleteCampaignPermanently(id);
    // La campagne n'existe plus → retour à la liste.
    redirect(`/fr/${adminPrefix ?? "admin"}/content-gen/coverage`);
  }

  const progressPct =
    campaign.totalTargetCount > 0
      ? Math.round((campaign.generatedCount / campaign.totalTargetCount) * 100)
      : 0;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={campaign.name}
        description={`${campaign.scope} · cible ${campaign.totalTargetCount} · statut ${STATUS_LABELS_FR[campaign.status] ?? campaign.status} · créée ${campaign.createdAt.toISOString().slice(0, 10)}`}
        actions={
          <div className="flex flex-wrap gap-[var(--space-admin-3)]">
            {campaign.status === "draft" ? (
              <form action={launch}>
                <button type="submit" className="admin-button">▶️ Lancer</button>
              </form>
            ) : null}
            {campaign.status === "running" ? (
              <form action={pause}>
                <button type="submit" className="admin-button-ghost">⏸️ Pause</button>
              </form>
            ) : null}
            {campaign.status === "paused" ? (
              <form action={resume}>
                <button type="submit" className="admin-button">▶️ Reprendre</button>
              </form>
            ) : null}
            {(campaign.status === "running" || campaign.status === "paused") && (
              <form action={addSlots} className="flex items-center gap-[var(--space-admin-2)]">
                <input
                  type="number"
                  name="delta"
                  defaultValue={50}
                  min={1}
                  max={1000}
                  className="admin-input w-[70px]"
                />
                <button type="submit" className="admin-button-ghost">+ slots</button>
              </form>
            )}
            {campaign.status !== "completed" && campaign.status !== "cancelled" ? (
              <>
                <form action={cancelRunningOnly}>
                  <button
                    type="submit"
                    className="admin-button-ghost"
                    title="Cancel les jobs queued/running uniquement — préserve les contenus déjà générés en review"
                  >
                    Annuler (running only)
                  </button>
                </form>
                <form action={cancelAll}>
                  <button
                    type="submit"
                    className="admin-button-ghost text-[color:var(--color-admin-destructive)]"
                    title="Cancel TOUS les jobs non publiés — incluant needs_review/approved"
                  >
                    Annuler (all)
                  </button>
                </form>
              </>
            ) : null}
            {/* Archivage réversible (masque de la liste) vs suppression définitive. */}
            {campaign.archivedAt ? (
              <form action={unarchive}>
                <button type="submit" className="admin-button-ghost">
                  ♻️ Réactiver (désarchiver)
                </button>
              </form>
            ) : (
              <form action={archive}>
                <button
                  type="submit"
                  className="admin-button-ghost"
                  title="Masquer de la liste par défaut — réversible"
                >
                  🗄️ Archiver
                </button>
              </form>
            )}
            <form action={del}>
              <ConfirmSubmitButton
                confirmMessage={`Supprimer DÉFINITIVEMENT « ${campaign.name} » ? Cette action est irréversible (la campagne ne pourra plus être réactivée). Ses jobs et articles publiés sont conservés. Pour la masquer temporairement, préférez « Archiver ».`}
                title="Supprimer définitivement cette campagne"
                className="admin-button-ghost text-[color:var(--color-admin-destructive)]"
              >
                🗑️ Supprimer
              </ConfirmSubmitButton>
            </form>
          </div>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Avancement</h2>
        <p className="admin-meta-block">
          {campaign.generatedCount} / {campaign.totalTargetCount} générés ({progressPct} %)
        </p>
        <progress
          value={campaign.generatedCount}
          max={campaign.totalTargetCount}
          aria-label={`${progressPct}% généré`}
          style={{
            width: "100%",
            height: 10,
            appearance: "none",
            borderRadius: "var(--radius-admin-sm)",
            overflow: "hidden",
            accentColor:
              progressPct < 33
                ? "var(--color-admin-destructive)"
                : progressPct < 66
                  ? "var(--color-admin-warning)"
                  : "var(--color-admin-success)",
          }}
        />
        <p className="admin-meta-block">
          Publiés {campaign.publishedCount} · Échoués {campaign.failedCount} · Re-boucle qualité{" "}
          {campaign.qualityImprovedCount}
        </p>
        {adminPrefix ? (
          <Link
            href={`/fr/${adminPrefix}/content-gen/jobs?campaignId=${encodeURIComponent(id)}`}
            className="admin-link text-[length:var(--text-admin-sm)]"
          >
            → Voir les jobs de cette campagne
          </Link>
        ) : null}
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Scope</h2>
        <ul className="admin-inline-list">
          <li>Villes : {campaign.anchorVilleSlugs.join(", ") || "—"}</li>
          <li>Départements : {campaign.anchorDepartementCodes.join(", ") || "—"}</li>
          <li>Régions : {campaign.anchorRegionSlugs.join(", ") || "—"}</li>
        </ul>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Distribution types contenu</h2>
        <pre className="whitespace-pre-wrap text-[length:var(--text-admin-sm)]">
          {JSON.stringify(campaign.typeDistribution, null, 2)}
        </pre>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Mix audiences</h2>
        <pre className="whitespace-pre-wrap text-[length:var(--text-admin-sm)]">
          {JSON.stringify(campaign.audienceMix, null, 2)}
        </pre>
      </AdminCard>

      {campaign.searchIntentMix ? (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <h2 className="admin-h2">Mix intentions</h2>
          <pre className="whitespace-pre-wrap text-[length:var(--text-admin-sm)]">
            {JSON.stringify(campaign.searchIntentMix, null, 2)}
          </pre>
        </AdminCard>
      ) : null}

      {/* Axes multi-axes (2026-06-21) — affichés s'ils sont renseignés */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Ciblage multi-axes</h2>
        <ul className="admin-inline-list">
          <li>
            Activités (axe 2) :{" "}
            {campaign.serviceSectorWeights &&
            Object.keys(campaign.serviceSectorWeights).length > 0
              ? JSON.stringify(campaign.serviceSectorWeights)
              : "activité unique (serviceSector)"}
          </li>
          <li>
            Secteurs clients (axe 3) :{" "}
            {campaign.targetSecteurWeights &&
            Object.keys(campaign.targetSecteurWeights).length > 0
              ? JSON.stringify(campaign.targetSecteurWeights)
              : "non ciblé"}
          </li>
          <li>
            Ville &amp; alentours (axe 6) :{" "}
            {campaign.villeSurroundingMode === "radius"
              ? `rayon ${campaign.villeSurroundingRadiusKm ?? 50} km`
              : campaign.villeSurroundingMode === "same_departement"
                ? "tout le département"
                : "villes choisies"}
          </li>
          <li>
            Durée (axe 8) :{" "}
            {campaign.durationMode === "unlimited"
              ? "sans limite (arrêt manuel)"
              : "fixe (s'arrête à la cible)"}
          </li>
        </ul>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Coût &amp; durée</h2>
        <ul className="admin-inline-list">
          <li>
            Estimé : {campaign.estimatedCostUsd ? `$${Number(campaign.estimatedCostUsd).toFixed(2)}` : "—"}
          </li>
          <li>
            Durée est. :{" "}
            {campaign.estimatedDurationMinutes ? `${campaign.estimatedDurationMinutes} min` : "—"}
          </li>
          <li>Démarrée : {campaign.startedAt?.toISOString() ?? "—"}</li>
          <li>Terminée : {campaign.completedAt?.toISOString() ?? "—"}</li>
        </ul>
      </AdminCard>

      {/* Sprint Campaign Controls badges */}
      {(campaign.startDate || campaign.endDate || campaign.recurringSchedule || campaign.cityProcessingMode === "sequential") ? (
        <AdminCard className="mt-[var(--space-admin-5)]">
          <h2 className="admin-h2">Planification</h2>
          <div className="flex flex-wrap gap-2 pt-2">
            {campaign.startDate && campaign.status === "scheduled" && (
              <span className="rounded-full bg-[color:var(--color-admin-info-soft)] px-2 py-0.5 text-xs text-[color:var(--color-admin-info)]">
                Programmée le {new Date(campaign.startDate).toLocaleString("fr-FR")}
              </span>
            )}
            {campaign.endDate && (
              <span className="rounded-full bg-[color:var(--color-admin-warning-soft)] px-2 py-0.5 text-xs text-[color:var(--color-admin-warning-fg)]">
                Auto-stop le {new Date(campaign.endDate).toLocaleString("fr-FR")}
              </span>
            )}
            {campaign.recurringSchedule && (
              <span className="rounded-full bg-[color:var(--color-admin-info-soft)] px-2 py-0.5 text-xs text-[color:var(--color-admin-info)]">
                Récurrente : {campaign.recurringSchedule}
              </span>
            )}
            {campaign.cityProcessingMode === "sequential" && (
              <span className="rounded-full bg-[color:var(--color-admin-neutral-soft)] px-2 py-0.5 text-xs text-[color:var(--color-admin-fg)]">
                Séquentiel — ville {(campaign.currentCityIndex ?? 0) + 1} /{" "}
                {campaign.anchorVilleSlugs.length}
              </span>
            )}
            {campaign.completedReason && (
              <span className="rounded-full bg-[color:var(--color-admin-destructive-soft)] px-2 py-0.5 text-xs text-[color:var(--color-admin-destructive-fg)]">
                Raison arrêt : {campaign.completedReason}
              </span>
            )}
          </div>
        </AdminCard>
      ) : null}
    </AdminPageShell>
  );
}
