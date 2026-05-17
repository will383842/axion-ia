/**
 * Content Generator — Landing variants (§ 12.1).
 *
 * V1 V2 V3 V4 V5 V6 = default + 5 sectoriels (industrie, tertiaire, public,
 * tourisme, retail). Admin peut activer/désactiver chaque variante depuis
 * ContentGenConfig.key="landing_variants_active".
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { LandingVariantsV2 } from "./_v2/LandingVariantsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

const V1_VARIANTS = [
  { slug: "default", label: "Default (toutes audiences)" },
  { slug: "secteur-industrie", label: "Secteur industrie" },
  { slug: "secteur-tertiaire", label: "Secteur tertiaire" },
  { slug: "secteur-public", label: "Secteur public" },
  { slug: "secteur-tourisme", label: "Secteur tourisme" },
  { slug: "secteur-retail", label: "Secteur retail" },
];

export default async function LandingVariantsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <LandingVariantsV2 adminPrefix={adminPrefix} />;
  }

  const active = await readContentGenConfig<ReadonlyArray<string>>("landing_variants_active", [
    "default",
  ]);

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Variantes landing ville</h1>
          <p className="admin-meta">
            6 variantes V1 (default + 5 sectoriels). Toggle ON/OFF + override par ville.
          </p>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Libellé</th>
              <th>Actif</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {V1_VARIANTS.map((v) => (
              <tr key={v.slug}>
                <td>
                  <code>{v.slug}</code>
                </td>
                <td>{v.label}</td>
                <td>{active.includes(v.slug) ? "✅" : "🚫"}</td>
                <td>
                  <a
                    href={`/fr/${adminPrefix}/content-gen/landing-variants/${v.slug}`}
                    className="admin-button-ghost"
                  >
                    Détail
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
