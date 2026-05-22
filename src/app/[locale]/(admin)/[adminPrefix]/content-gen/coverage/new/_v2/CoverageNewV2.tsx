// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// Wizard 5 étapes 2026-05-22 — vertical → géo → cibles → keywords → revue.

import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  createCampaign,
  estimateCampaign,
  launchCampaign,
  listCampaignTemplates,
  type EstimateCampaignResult,
  type CampaignTemplateRow,
} from "@/server/actions/content-gen/coverage";
import { prisma } from "@/lib/prisma";
import {
  listAudienceMixProfiles,
  listDistributionProfiles,
} from "@/server/actions/content-gen/distribution";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import { getCityEquityData } from "@/server/actions/content-gen/city-equity";
import { CoverageWizardClient } from "@/components/admin/content-gen/CoverageWizardClient";
import type {
  CoverageScope,
  ServiceSector,
} from "../../../../../../../../../prisma/generated/client";

const SCOPES: ReadonlyArray<CoverageScope> = ["ville", "departement", "region", "multi"];

const DEFAULT_TYPE_DIST = `{
  "blog_from_title": 30,
  "blog_from_keywords": 25,
  "comparison": 20,
  "guide_pilier": 15,
  "faq_standalone": 10
}`;
const DEFAULT_AUDIENCE_MIX = `{
  "TPE:entreprise_privee": 25,
  "PME:entreprise_privee": 40,
  "ETI:entreprise_privee": 20,
  "GE:entreprise_privee": 10,
  "PME:secteur_public": 5
}`;

function decodeDryRun(raw: string | undefined): EstimateCampaignResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as EstimateCampaignResult;
  } catch {
    return null;
  }
}

interface Props {
  adminPrefix: string;
  searchParams: { dryRun?: string; preset?: string; advanced?: string };
}

export async function CoverageNewV2({ adminPrefix, searchParams: sp }: Props): Promise<React.ReactElement> {
  const [distProfiles, audProfiles, equityData, campaignTemplates] = await Promise.all([
    listDistributionProfiles(),
    listAudienceMixProfiles(),
    getCityEquityData(),
    listCampaignTemplates(),
  ]);
  const dryRunResult = decodeDryRun(sp.dryRun);

  let presetData: { name: string; config: Record<string, unknown> } | null = null;
  if (sp.preset) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tmpl = await (prisma as any).campaignTemplate.findUnique({ where: { slug: sp.preset } });
      if (tmpl) presetData = { name: tmpl.name as string, config: tmpl.config as Record<string, unknown> };
    } catch { /* DB not seeded yet */ }
  }

  // P0-4 Sprint P5 follow-up — Calcul defaultValues depuis preset config
  const presetDefaults = presetData
    ? {
        name: `Campagne ${presetData.name}`,
        serviceSector: Array.isArray(presetData.config.verticals)
          ? String((presetData.config.verticals as string[])[0] ?? "")
          : "",
        totalTargetCount: String(
          typeof presetData.config.batchSize === "number" ? presetData.config.batchSize : 100,
        ),
        anchorVilleSlugs: typeof presetData.config.anchorVilleSlug === "string"
          ? presetData.config.anchorVilleSlug
          : "",
        typeDistribution: Array.isArray(presetData.config.types) && (presetData.config.types as string[]).length > 0
          ? JSON.stringify(
              Object.fromEntries(
                (presetData.config.types as string[]).map((t) => [
                  t,
                  Math.floor(100 / (presetData.config.types as string[]).length),
                ]),
              ),
              null,
              2,
            )
          : DEFAULT_TYPE_DIST,
      }
    : null;

  async function create(formData: FormData) {
    "use server";
    const csv = (key: string): ReadonlyArray<string> =>
      String(formData.get(key) ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    // P0-6 : JSON.parse protégé — erreur explicite si JSON invalide
    let typeDistribution: Record<string, number>;
    try {
      typeDistribution = JSON.parse(
        String(formData.get("typeDistribution") ?? "{}"),
      ) as Record<string, number>;
    } catch {
      throw new Error("JSON invalide dans le champ \"Distribution types contenu\".");
    }

    let audienceMix: Record<string, number>;
    try {
      audienceMix = JSON.parse(String(formData.get("audienceMix") ?? "{}")) as Record<
        string,
        number
      >;
    } catch {
      throw new Error("JSON invalide dans le champ \"Mix audiences\".");
    }

    const estimatedCostUsd = formData.get("estimatedCostUsd")
      ? Number(formData.get("estimatedCostUsd"))
      : undefined;
    const estimatedDurationMinutes = formData.get("estimatedDurationMinutes")
      ? Number(formData.get("estimatedDurationMinutes"))
      : undefined;
    const rawSector = String(formData.get("serviceSector") ?? "");
    const serviceSector =
      rawSector && (SERVICE_SECTORS as ReadonlyArray<string>).includes(rawSector)
        ? (rawSector as ServiceSector)
        : null;
    const id = await createCampaign({
      name: String(formData.get("name") ?? ""),
      scope: String(formData.get("scope")) as CoverageScope,
      serviceSector,
      anchorVilleSlugs: csv("anchorVilleSlugs"),
      anchorDepartementCodes: csv("anchorDepartementCodes"),
      anchorRegionSlugs: csv("anchorRegionSlugs"),
      totalTargetCount: Number(formData.get("totalTargetCount") ?? 0),
      typeDistribution,
      audienceMix,
      ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
      ...(estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes } : {}),
    });
    if (formData.get("launchNow") === "on") {
      await launchCampaign(id);
    }
    redirect(`/fr/${adminPrefix}/content-gen/coverage/${id}`);
  }

  async function dryRun(formData: FormData) {
    "use server";
    // P0-6 : JSON.parse protégé
    let typeDistribution: Record<string, number>;
    try {
      typeDistribution = JSON.parse(
        String(formData.get("typeDistribution") ?? "{}"),
      ) as Record<string, number>;
    } catch {
      throw new Error("JSON invalide dans le champ \"Distribution types contenu\".");
    }
    const totalTargetCount = Number(formData.get("totalTargetCount") ?? 0);
    const estimate = await estimateCampaign({ totalTargetCount, typeDistribution });
    const encoded = Buffer.from(JSON.stringify(estimate)).toString("base64url");
    redirect(`/fr/${adminPrefix}/content-gen/coverage/new?dryRun=${encoded}`);
  }

  return (
    <AdminPageShell>
      <AdminPageHeader title="Nouvelle campagne" />

      {/* Wizard guidé 5 étapes */}
      {!sp.advanced && (
        <AdminCard className="mb-[var(--space-admin-6)]">
          <div className="flex items-center justify-between mb-[var(--space-admin-4)]">
            <h2 className="admin-h2 mb-0">Assistant campagne</h2>
            <a
              href="?advanced=1"
              className="admin-button-ghost text-[length:var(--text-admin-xs)]"
            >
              Mode avancé (JSON)
            </a>
          </div>
          <CoverageWizardClient
            distProfiles={[...distProfiles]}
            audProfiles={[...audProfiles]}
            cityEquity={[...equityData.rows]}
            onSubmit={create}
            onDryRun={dryRun}
            adminPrefix={adminPrefix}
            templates={[...campaignTemplates]}
          />
        </AdminCard>
      )}

      {presetData ? (
        <div className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-surface-soft)] px-[var(--space-admin-5)] py-[var(--space-admin-3)]">
          <div className="flex items-center justify-between">
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Preset actif : <strong>{presetData.name}</strong>. Modifiez les champs ci-dessous.
            </p>
            <a href="?" className="admin-button-ghost text-[length:var(--text-admin-xs)]">
              Retirer preset
            </a>
          </div>
        </div>
      ) : null}

      {dryRunResult ? (
        <AdminCard className="mb-[var(--space-admin-4)] border-l-4 border-l-[color:var(--color-admin-warning)]">
          <h2 className="admin-h2">Estimation dry-run</h2>
          <p className="admin-meta-block">
            <strong>Coût estimé :</strong> ${dryRunResult.estimatedCostUsd.toFixed(2)} ·{" "}
            <strong>Durée estimée :</strong> {dryRunResult.estimatedDurationMinutes} min (concurrency
            5) · <strong>{dryRunResult.totalTargetCount}</strong> contenus.
          </p>
          <div className="admin-table-wrapper">
            <table className="admin-table text-[length:var(--text-admin-xs)]">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Volume</th>
                  <th>Coût unitaire</th>
                  <th>Durée unit. (s)</th>
                  <th>Sous-total $</th>
                </tr>
              </thead>
              <tbody>
                {dryRunResult.breakdown.map((b) => (
                  <tr key={b.contentType}>
                    <td>{b.contentType}</td>
                    <td>{b.count}</td>
                    <td>${b.unitCostUsd.toFixed(3)}</td>
                    <td>{b.unitDurationSec}</td>
                    <td>${(b.count * b.unitCostUsd).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      ) : null}

      {/* Mode avancé JSON — accès via ?advanced=1 */}
      {sp.advanced && <AdminCard>
        <div className="flex items-center justify-between mb-[var(--space-admin-4)]">
          <h2 className="admin-h2 mb-0">Mode avancé</h2>
          <a href="?" className="admin-button-ghost text-[length:var(--text-admin-xs)]">
            ← Retour au wizard
          </a>
        </div>
        <form action={create}>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="name" className="admin-label">Nom</label>
              <input id="name" name="name" required minLength={3} className="admin-input" defaultValue={presetDefaults?.name ?? ""} />
            </div>
            <div className="admin-field">
              <label htmlFor="scope" className="admin-label">Scope</label>
              <select id="scope" name="scope" defaultValue="region" className="admin-input" required>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="serviceSector" className="admin-label">Secteur (campagne éditoriale)</label>
              <select id="serviceSector" name="serviceSector" defaultValue={presetDefaults?.serviceSector ?? ""} className="admin-input">
                <option value="">— Aucun (campagne legacy multi-types) —</option>
                {SERVICE_SECTORS.map((s) => (
                  <option key={s} value={s}>{SERVICE_SECTOR_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="totalTargetCount" className="admin-label">Volume cible</label>
              <input
                id="totalTargetCount"
                name="totalTargetCount"
                type="number"
                min="1"
                max="10000"
                defaultValue={presetDefaults?.totalTargetCount ?? "100"}
                required
                className="admin-input"
              />
            </div>
          </div>

          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="anchorVilleSlugs" className="admin-label">Villes (CSV slugs)</label>
              <input id="anchorVilleSlugs" name="anchorVilleSlugs" className="admin-input" defaultValue={presetDefaults?.anchorVilleSlugs ?? ""} />
            </div>
            <div className="admin-field">
              <label htmlFor="anchorDepartementCodes" className="admin-label">Départements (CSV codes)</label>
              <input id="anchorDepartementCodes" name="anchorDepartementCodes" className="admin-input" />
            </div>
            <div className="admin-field">
              <label htmlFor="anchorRegionSlugs" className="admin-label">Régions (CSV slugs)</label>
              <input id="anchorRegionSlugs" name="anchorRegionSlugs" className="admin-input" />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="typeDistribution" className="admin-label">
              Distribution types contenu (JSON, somme = 100). Profils existants :{" "}
              {distProfiles.length === 0 ? "aucun" : distProfiles.map((p) => p.slug).join(", ")}
            </label>
            <p className="admin-meta-small">
              ⚠️ Si un <strong>secteur</strong> est sélectionné ci-dessus, les types{" "}
              <code>landing_ville</code> et <code>blog_from_rss</code> sont interdits (pipelines
              indépendants : cf. /content-gen/coverage scope=ville &amp; /content-gen/rss).
            </p>
            <textarea
              id="typeDistribution"
              name="typeDistribution"
              rows={10}
              defaultValue={presetDefaults?.typeDistribution ?? DEFAULT_TYPE_DIST}
              className="admin-input font-mono text-[length:var(--text-admin-sm)]"
              required
            />
          </div>

          <div className="admin-field">
            <label htmlFor="audienceMix" className="admin-label">
              Mix audiences (JSON, somme = 100). Profils existants :{" "}
              {audProfiles.length === 0 ? "aucun" : audProfiles.map((p) => p.slug).join(", ")}
            </label>
            <textarea
              id="audienceMix"
              name="audienceMix"
              rows={10}
              defaultValue={DEFAULT_AUDIENCE_MIX}
              className="admin-input font-mono text-[length:var(--text-admin-sm)]"
              required
            />
          </div>

          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="estimatedCostUsd" className="admin-label">Coût estimé (USD)</label>
              <input
                id="estimatedCostUsd"
                name="estimatedCostUsd"
                type="number"
                step="0.01"
                min="0"
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="estimatedDurationMinutes" className="admin-label">Durée estimée (min)</label>
              <input
                id="estimatedDurationMinutes"
                name="estimatedDurationMinutes"
                type="number"
                min="0"
                className="admin-input"
              />
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="launchNow" /> Lancer immédiatement (sinon = brouillon)
            </label>
          </div>

          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">Enregistrer</button>
            <button
              type="submit"
              formAction={dryRun}
              className="admin-button-ghost"
              title="Calcule coût + durée estimée sans insérer de campagne ni d'enqueue"
            >
              🧪 Dry-run (estimer)
            </button>
          </div>
        </form>
      </AdminCard>}
    </AdminPageShell>
  );
}
