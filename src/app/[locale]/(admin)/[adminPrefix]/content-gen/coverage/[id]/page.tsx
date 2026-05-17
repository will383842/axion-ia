/**
 * Content Generator — Coverage campaign detail (§ 25).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  cancelCampaign,
  getCampaign,
  incrementCampaignTarget,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
} from "@/server/actions/content-gen/coverage";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { CoverageDetailV2 } from "./_v2/CoverageDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  if (await isAdminV2Enabled()) {
    return <CoverageDetailV2 campaign={campaign} />;
  }

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

  const progressPct =
    campaign.totalTargetCount > 0
      ? Math.round((campaign.generatedCount / campaign.totalTargetCount) * 100)
      : 0;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">{campaign.name}</h1>
          <p className="admin-meta">
            {campaign.scope} · cible {campaign.totalTargetCount} · statut{" "}
            <strong>{campaign.status}</strong> · créée{" "}
            {campaign.createdAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="admin-dashboard-actions">
          {campaign.status === "draft" ? (
            <form action={launch}>
              <button type="submit" className="admin-button">
                ▶️ Lancer
              </button>
            </form>
          ) : null}
          {campaign.status === "running" ? (
            <form action={pause}>
              <button type="submit" className="admin-button-ghost">
                ⏸️ Pause
              </button>
            </form>
          ) : null}
          {campaign.status === "paused" ? (
            <form action={resume}>
              <button type="submit" className="admin-button">
                ▶️ Reprendre
              </button>
            </form>
          ) : null}
          {(campaign.status === "running" || campaign.status === "paused") && (
            <form
              action={addSlots}
              style={{ display: "flex", gap: 4, alignItems: "center" }}
            >
              <input
                type="number"
                name="delta"
                defaultValue={50}
                min={1}
                max={1000}
                className="admin-input"
                style={{ width: 70 }}
              />
              <button type="submit" className="admin-button-ghost">
                + slots
              </button>
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
                  className="admin-button-ghost"
                  title="Cancel TOUS les jobs non publiés — incluant needs_review/approved"
                  style={{ color: "var(--color-terracotta)" }}
                >
                  Annuler (all)
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <div className="admin-card">
        <h2>Avancement</h2>
        <p>
          {campaign.generatedCount} / {campaign.totalTargetCount} générés ({progressPct} %)
        </p>
        <p>
          Publiés {campaign.publishedCount} · Failed {campaign.failedCount} · Quality re-loop{" "}
          {campaign.qualityImprovedCount}
        </p>
      </div>

      <div className="admin-card">
        <h2>Scope</h2>
        <ul className="admin-inline-list">
          <li>Villes : {campaign.anchorVilleSlugs.join(", ") || "—"}</li>
          <li>Départements : {campaign.anchorDepartementCodes.join(", ") || "—"}</li>
          <li>Régions : {campaign.anchorRegionSlugs.join(", ") || "—"}</li>
        </ul>
      </div>

      <div className="admin-card">
        <h2>Distribution types contenu</h2>
        <pre style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(campaign.typeDistribution, null, 2)}
        </pre>
      </div>

      <div className="admin-card">
        <h2>Mix audiences</h2>
        <pre style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(campaign.audienceMix, null, 2)}
        </pre>
      </div>

      {campaign.searchIntentMix ? (
        <div className="admin-card">
          <h2>Mix intentions</h2>
          <pre style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(campaign.searchIntentMix, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="admin-card">
        <h2>Coût &amp; durée</h2>
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
      </div>
    </section>
  );
}
