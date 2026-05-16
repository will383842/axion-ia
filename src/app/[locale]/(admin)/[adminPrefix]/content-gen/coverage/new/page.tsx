/**
 * Content Generator — Coverage campaign create (§ 25.2).
 *
 * V1 form simplifié : nom + scope + slugs (CSV) + total cible + distributions
 * JSON. Le launch immédiat ou en draft est laissé à l'admin via boutons distincts.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createCampaign,
  estimateCampaign,
  launchCampaign,
  type EstimateCampaignResult,
} from "@/server/actions/content-gen/coverage";
import {
  listAudienceMixProfiles,
  listDistributionProfiles,
} from "@/server/actions/content-gen/distribution";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import type {
  CoverageScope,
  ServiceSector,
} from "../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ dryRun?: string }>;
}

const SCOPES: ReadonlyArray<CoverageScope> = ["ville", "departement", "region", "multi"];

// § 25.3 — Distribution éditoriale uniquement. `landing_ville` et `blog_from_rss`
// ont leurs propres pipelines (coverage villes / RSS worker).
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

export default async function NewCampaignPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [distProfiles, audProfiles] = await Promise.all([
    listDistributionProfiles(),
    listAudienceMixProfiles(),
  ]);
  const dryRunResult = decodeDryRun(sp.dryRun);

  async function create(formData: FormData) {
    "use server";
    const csv = (key: string): ReadonlyArray<string> =>
      String(formData.get(key) ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const typeDistribution = JSON.parse(
      String(formData.get("typeDistribution") ?? "{}"),
    ) as Record<string, number>;
    const audienceMix = JSON.parse(String(formData.get("audienceMix") ?? "{}")) as Record<
      string,
      number
    >;

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
    const typeDistribution = JSON.parse(
      String(formData.get("typeDistribution") ?? "{}"),
    ) as Record<string, number>;
    const totalTargetCount = Number(formData.get("totalTargetCount") ?? 0);
    const estimate = await estimateCampaign({ totalTargetCount, typeDistribution });
    const encoded = Buffer.from(JSON.stringify(estimate)).toString("base64url");
    redirect(`/fr/${adminPrefix}/content-gen/coverage/new?dryRun=${encoded}`);
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <h1 className="admin-h1-large">Nouvelle campagne</h1>
      </div>

      {dryRunResult ? (
        <div
          className="admin-card"
          style={{ borderColor: "var(--color-terracotta)", marginBottom: 16 }}
        >
          <h2>Estimation dry-run</h2>
          <p>
            <strong>Coût estimé :</strong> ${dryRunResult.estimatedCostUsd.toFixed(2)} ·{" "}
            <strong>Durée estimée :</strong> {dryRunResult.estimatedDurationMinutes} min (concurrency
            5) · <strong>{dryRunResult.totalTargetCount}</strong> contenus.
          </p>
          <table className="admin-table" style={{ fontSize: 12 }}>
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
      ) : null}

      <form action={create} className="admin-card">
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="name" className="admin-label">
              Nom
            </label>
            <input id="name" name="name" required minLength={3} className="admin-input" />
          </div>
          <div className="admin-field">
            <label htmlFor="scope" className="admin-label">
              Scope
            </label>
            <select id="scope" name="scope" defaultValue="region" className="admin-input" required>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="serviceSector" className="admin-label">
              Secteur (campagne éditoriale)
            </label>
            <select
              id="serviceSector"
              name="serviceSector"
              defaultValue=""
              className="admin-input"
            >
              <option value="">— Aucun (campagne legacy multi-types) —</option>
              {SERVICE_SECTORS.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_SECTOR_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="totalTargetCount" className="admin-label">
              Volume cible
            </label>
            <input
              id="totalTargetCount"
              name="totalTargetCount"
              type="number"
              min="1"
              max="10000"
              defaultValue="100"
              required
              className="admin-input"
            />
          </div>
        </div>

        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="anchorVilleSlugs" className="admin-label">
              Villes (CSV slugs)
            </label>
            <input id="anchorVilleSlugs" name="anchorVilleSlugs" className="admin-input" />
          </div>
          <div className="admin-field">
            <label htmlFor="anchorDepartementCodes" className="admin-label">
              Départements (CSV codes)
            </label>
            <input
              id="anchorDepartementCodes"
              name="anchorDepartementCodes"
              className="admin-input"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="anchorRegionSlugs" className="admin-label">
              Régions (CSV slugs)
            </label>
            <input id="anchorRegionSlugs" name="anchorRegionSlugs" className="admin-input" />
          </div>
        </div>

        <div className="admin-field">
          <label htmlFor="typeDistribution" className="admin-label">
            Distribution types contenu (JSON, somme = 100). Profils existants :{" "}
            {distProfiles.length === 0
              ? "aucun"
              : distProfiles.map((p) => p.slug).join(", ")}
          </label>
          <p
            className="admin-meta"
            style={{ marginTop: -4, marginBottom: 8, fontSize: 12 }}
          >
            ⚠️ Si un <strong>secteur</strong> est sélectionné ci-dessus, les types{" "}
            <code>landing_ville</code> et <code>blog_from_rss</code> sont interdits
            (pipelines indépendants : cf. /content-gen/coverage scope=ville &amp;{" "}
            /content-gen/rss).
          </p>
          <textarea
            id="typeDistribution"
            name="typeDistribution"
            rows={10}
            defaultValue={DEFAULT_TYPE_DIST}
            className="admin-input"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
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
            className="admin-input"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
            required
          />
        </div>

        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="estimatedCostUsd" className="admin-label">
              Coût estimé (USD)
            </label>
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
            <label htmlFor="estimatedDurationMinutes" className="admin-label">
              Durée estimée (min)
            </label>
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
          <button type="submit" className="admin-button">
            Enregistrer
          </button>
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
    </section>
  );
}
