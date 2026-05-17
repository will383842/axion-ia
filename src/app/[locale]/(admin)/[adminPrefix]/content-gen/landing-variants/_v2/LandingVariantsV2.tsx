// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Landing variants V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";

const V1_VARIANTS = [
  { slug: "default", label: "Default (toutes audiences)" },
  { slug: "secteur-industrie", label: "Secteur industrie" },
  { slug: "secteur-tertiaire", label: "Secteur tertiaire" },
  { slug: "secteur-public", label: "Secteur public" },
  { slug: "secteur-tourisme", label: "Secteur tourisme" },
  { slug: "secteur-retail", label: "Secteur retail" },
];

interface Props {
  adminPrefix: string;
}

export async function LandingVariantsV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const active = await readContentGenConfig<ReadonlyArray<string>>("landing_variants_active", [
    "default",
  ]);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Variantes landing ville"
        description="6 variantes V1 (default + 5 sectoriels). Toggle ON/OFF + override par ville."
      />

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
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
                    <Link
                      href={`/fr/${adminPrefix}/content-gen/landing-variants/${v.slug}`}
                      className="admin-button-ghost"
                    >
                      Détail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
