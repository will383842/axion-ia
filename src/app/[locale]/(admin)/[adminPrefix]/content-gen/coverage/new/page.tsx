/**
 * Content Generator — Coverage campaign create (§ 25.2).
 *
 * V1 form simplifié : nom + scope + slugs (CSV) + total cible + distributions
 * JSON. Le launch immédiat ou en draft est laissé à l'admin via boutons distincts.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createCampaign, launchCampaign } from "@/server/actions/content-gen/coverage";
import { listAudienceMixProfiles, listDistributionProfiles } from "@/server/actions/content-gen/distribution";
import type { CoverageScope } from "../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

const SCOPES: ReadonlyArray<CoverageScope> = ["ville", "departement", "region", "multi"];

const DEFAULT_TYPE_DIST = `{
  "landing_ville": 25,
  "blog_from_title": 25,
  "blog_from_keywords": 20,
  "comparison": 15,
  "guide_pilier": 10,
  "faq_standalone": 5
}`;
const DEFAULT_AUDIENCE_MIX = `{
  "TPE:entreprise_privee": 25,
  "PME:entreprise_privee": 40,
  "ETI:entreprise_privee": 20,
  "GE:entreprise_privee": 10,
  "PME:secteur_public": 5
}`;

export default async function NewCampaignPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [distProfiles, audProfiles] = await Promise.all([
    listDistributionProfiles(),
    listAudienceMixProfiles(),
  ]);

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
    const id = await createCampaign({
      name: String(formData.get("name") ?? ""),
      scope: String(formData.get("scope")) as CoverageScope,
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

  return (
    <section>
      <div className="admin-dashboard-head">
        <h1 className="admin-h1-large">Nouvelle campagne</h1>
      </div>

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
        </div>
      </form>
    </section>
  );
}
