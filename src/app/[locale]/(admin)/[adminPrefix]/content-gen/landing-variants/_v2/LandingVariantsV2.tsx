// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Landing variants V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminTable } from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";

const V1_VARIANTS = [
  { slug: "default", label: "Default (toutes audiences)" },
  { slug: "secteur-industrie", label: "Secteur industrie" },
  { slug: "secteur-tertiaire", label: "Secteur tertiaire" },
  { slug: "secteur-public", label: "Secteur public" },
  { slug: "secteur-tourisme", label: "Secteur tourisme" },
  { slug: "secteur-retail", label: "Secteur retail" },
];

interface VariantRow {
  slug: string;
  label: string;
}

interface Props {
  adminPrefix: string;
}

export async function LandingVariantsV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const active = await readContentGenConfig<ReadonlyArray<string>>("landing_variants_active", [
    "default",
  ]);

  const columns: ReadonlyArray<AdminTableColumn<VariantRow>> = [
    { key: "slug", header: "Slug", cell: (v) => <code>{v.slug}</code> },
    { key: "label", header: "Libellé", cell: (v) => v.label },
    { key: "active", header: "Actif", cell: (v) => (active.includes(v.slug) ? "✅" : "🚫") },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Variantes landing ville"
        description="6 variantes V1 (default + 5 sectoriels). Toggle ON/OFF + override par ville."
      />

      <AdminTable
        columns={columns}
        rows={V1_VARIANTS}
        getRowId={(v) => v.slug}
        caption="Liste des variantes de landing ville"
        rowAction={(v) => (
          <Link
            href={`/fr/${adminPrefix}/content-gen/landing-variants/${v.slug}`}
            className="admin-button-ghost"
          >
            Détail
          </Link>
        )}
      />
    </AdminPageShell>
  );
}
