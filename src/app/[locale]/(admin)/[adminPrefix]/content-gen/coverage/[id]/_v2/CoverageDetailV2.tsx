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
import { ConfirmSubmitButton } from "@/components/admin/ui/ConfirmSubmitButton";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { Pause, RotateCcw } from "lucide-react";
import {
  WIZARD_COMPANY_SIZES,
  WIZARD_ORG_TYPES,
  WIZARD_SEARCH_INTENTS,
} from "@/server/actions/content-gen/campaign-wizard-constants";
import { contentTypeLabelFr } from "@/server/content-gen/shared/admin-labels";
import { perimetreCampagneLabelFr } from "@/server/content-gen/shared/campaign-labels";
import { SERVICE_SECTOR_LABELS } from "@/server/content-gen/shared/editorial-mix-rules";

type ServiceSector = keyof typeof SERVICE_SECTOR_LABELS;

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

/**
 * Une répartition en pourcentages, lisible.
 *
 * 🔴 Les trois cartes rendaient un `JSON.stringify(…, null, 2)` dans un
 * `<pre>` : `{ "blog_article": 18, "guide_pilier": 12 }`. Accolades,
 * guillemets et clés d'enum pour ce qui tient en une liste.
 */
/** Secteur client (axe 3) : clé d'enum → libellé lisible, la clé brute en repli. */
function libelleSecteurClient(cle: string): string {
  const libelles: Record<string, string> = {
    juridique: "Juridique",
    btp_immobilier: "BTP & immobilier",
    sante: "Santé",
    industrie: "Industrie",
    commerce: "Commerce",
    services: "Services",
    finance_assurance: "Finance & assurance",
    tourisme_restauration: "Tourisme & restauration",
    education_formation: "Éducation & formation",
    tech_numerique: "Tech & numérique",
    agriculture_agroalimentaire: "Agriculture & agroalimentaire",
    transport_logistique: "Transport & logistique",
    secteur_public: "Secteur public",
  };
  return libelles[cle] ?? cle.replace(/_/g, " ");
}

function Repartition({
  valeurs,
  libelle,
}: {
  valeurs: unknown;
  libelle: (cle: string) => string;
}): React.ReactElement {
  if (valeurs === null || typeof valeurs !== "object") {
    return <p className="admin-meta-small">Aucune répartition définie.</p>;
  }
  const entrees = Object.entries(valeurs as Record<string, unknown>).filter(
    ([, v]) => typeof v === "number",
  ) as Array<[string, number]>;
  if (entrees.length === 0) {
    return <p className="admin-meta-small">Aucune répartition définie.</p>;
  }
  entrees.sort((a, b) => b[1] - a[1]);
  return (
    <ul className="admin-inline-list">
      {entrees.map(([cle, part]) => (
        <li key={cle} title={cle}>
          {libelle(cle)} — {part} %
        </li>
      ))}
    </ul>
  );
}

/** Clé d'audience « TAILLE:ORGANISATION » → « PME · Association ». */
function libelleAudience(cle: string): string {
  const [taille = cle, org] = cle.split(":");
  const t = WIZARD_COMPANY_SIZES.find((x) => x.value === taille)?.labelFr ?? taille;
  const o = WIZARD_ORG_TYPES.find((x) => x.value === org)?.labelFr;
  return o === undefined ? t : `${t} · ${o}`;
}

function libelleIntention(cle: string): string {
  return WIZARD_SEARCH_INTENTS.find((x) => x.value === cle)?.labelFr ?? `« ${cle} »`;
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

  // 2026-09-02 — « 324 % de la cible » : en durée « sans limite », la cible
  // n'est qu'une estimation initiale et le worker continue au-delà. La barre
  // clampait déjà à 100 %, le texte non : les deux se contredisaient.
  const pctBrut =
    campaign.totalTargetCount > 0
      ? Math.round((campaign.generatedCount / campaign.totalTargetCount) * 100)
      : 0;
  const progressPct = Math.min(100, pctBrut);
  const depassement = Math.max(0, campaign.generatedCount - campaign.totalTargetCount);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={campaign.name}
        description={`${campaign.scope} · cible ${campaign.totalTargetCount} · statut ${STATUS_LABELS_FR[campaign.status] ?? campaign.status} · créée ${formatDateFrShort(campaign.createdAt)}`}
        actions={
          <div className="flex flex-wrap gap-[var(--space-admin-3)]">
            {campaign.status === "draft" ? (
              <form action={launch}>
                <button type="submit" className="admin-button">Lancer</button>
              </form>
            ) : null}
            {campaign.status === "running" ? (
              <form action={pause}>
                <button type="submit" className="admin-button-ghost"><Pause size={14} aria-hidden="true" className="inline-block shrink-0 align-[-0.125em]" /> Pause</button>
              </form>
            ) : null}
            {campaign.status === "paused" ? (
              <form action={resume}>
                <button type="submit" className="admin-button">Reprendre</button>
              </form>
            ) : null}
            {(campaign.status === "running" || campaign.status === "paused") && (
              <form action={addSlots} className="flex items-center gap-[var(--space-admin-2)]">
                <input aria-label="Nombre de villes à ajouter"
                  type="number"
                  name="delta"
                  defaultValue={50}
                  min={1}
                  max={1000}
                  className="admin-input" style={{ width: 70 }}
                />
                <button type="submit" className="admin-button-ghost">+ Ajouter des villes</button>
              </form>
            )}
            {campaign.status !== "completed" && campaign.status !== "cancelled" ? (
              <>
                <form action={cancelRunningOnly}>
                  <button
                    type="submit"
                    className="admin-button-ghost"
                    title="Annule uniquement les générations en file ou en cours — les contenus déjà générés et en relecture sont conservés"
                  >
                    Annuler les générations en cours
                  </button>
                </form>
                <form action={cancelAll}>
                  <ConfirmSubmitButton
                    className="admin-button-ghost admin-button-ghost-danger"
                    title="Annule TOUS les contenus non publiés — y compris ceux en relecture ou approuvés"
                    confirmMessage={`Tout annuler sur « ${campaign.name} » ? Les contenus en file, en cours, en relecture ET approuvés seront annulés. Les articles déjà publiés sont conservés.`}
                  >
                    Tout annuler
                  </ConfirmSubmitButton>
                </form>
              </>
            ) : null}
            {/* Archivage réversible (masque de la liste) vs suppression définitive. */}
            {campaign.archivedAt ? (
              <form action={unarchive}>
                <button type="submit" className="admin-button-ghost">
                  <RotateCcw size={14} aria-hidden="true" className="inline-block shrink-0 align-[-0.125em]" /> Réactiver (désarchiver)
                </button>
              </form>
            ) : (
              <form action={archive}>
                <button
                  type="submit"
                  className="admin-button-ghost"
                  title="Masquer de la liste par défaut — réversible"
                >
                  Archiver
                </button>
              </form>
            )}
            <form action={del}>
              <ConfirmSubmitButton
                confirmMessage={`Supprimer DÉFINITIVEMENT « ${campaign.name} » ? Cette action est irréversible (la campagne ne pourra plus être réactivée). Ses jobs et articles publiés sont conservés. Pour la masquer temporairement, préférez « Archiver ».`}
                title="Supprimer définitivement cette campagne"
                className="admin-button-ghost admin-button-ghost-danger"
              >
                Supprimer
              </ConfirmSubmitButton>
            </form>
          </div>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Avancement</h2>
        <p className="admin-meta-block">
          {campaign.generatedCount} / {campaign.totalTargetCount} générés{" "}
          {depassement > 0
            ? `(cible dépassée de ${depassement}${campaign.durationMode === "unlimited" ? ", durée sans limite" : ""})`
            : `(${progressPct} %)`}
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
        <h2 className="admin-h2">Périmètre</h2>
        <ul className="admin-inline-list">
          {/* 2026-09-02 — une campagne nationale n'a pas d'ancres par
              construction : trois tirets sans le mot « national » se lisaient
              comme un périmètre vide. */}
          <li>Périmètre : {perimetreCampagneLabelFr(campaign.scope)}</li>
          {campaign.scope !== "national" ? (
            <>
              <li>Villes : {campaign.anchorVilleSlugs.join(", ") || "—"}</li>
              <li>Départements : {campaign.anchorDepartementCodes.join(", ") || "—"}</li>
              <li>Régions : {campaign.anchorRegionSlugs.join(", ") || "—"}</li>
            </>
          ) : null}
        </ul>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Répartition par type de contenu</h2>
        <Repartition valeurs={campaign.typeDistribution} libelle={contentTypeLabelFr} />
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Répartition par audience</h2>
        <Repartition valeurs={campaign.audienceMix} libelle={libelleAudience} />
      </AdminCard>

      {campaign.searchIntentMix ? (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <h2 className="admin-h2">Répartition par intention de recherche</h2>
          <Repartition valeurs={campaign.searchIntentMix} libelle={libelleIntention} />
        </AdminCard>
      ) : null}

      {/* Axes multi-axes (2026-06-21) — affichés s'ils sont renseignés */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Ciblage multi-axes</h2>
        <ul className="admin-inline-list">
          <li>
            Activités (axe 2) :{" "}
            {campaign.serviceSectorWeights &&
            Object.keys(campaign.serviceSectorWeights).length > 0 ? (
              <Repartition
                valeurs={campaign.serviceSectorWeights}
                libelle={(cle) => SERVICE_SECTOR_LABELS[cle as ServiceSector] ?? cle}
              />
            ) : (
              "activité unique"
            )}
          </li>
          <li>
            Secteurs clients (axe 3) :{" "}
            {campaign.targetSecteurWeights &&
            Object.keys(campaign.targetSecteurWeights).length > 0 ? (
              <Repartition valeurs={campaign.targetSecteurWeights} libelle={libelleSecteurClient} />
            ) : (
              "non ciblé"
            )}
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
          <li>Démarrée : {campaign.startedAt ? formatDateFrShort(campaign.startedAt) : "—"}</li>
          <li>Terminée : {campaign.completedAt ? formatDateFrShort(campaign.completedAt) : "—"}</li>
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
