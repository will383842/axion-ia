// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Geo batches new V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { REGIONS } from "@/content/regions";

interface Props {
  adminPrefix: string;
  preselected: string | undefined;
}

export function GeoBatchesNewV2({ adminPrefix, preselected }: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader title="Nouveau batch géographique" />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <p className="admin-meta-block">
          Le batch builder complet (modes d&apos;ordre, glisser-déposer, filtres d&apos;exclusion) arrive V1.5.
          Pour V1, créez une campagne depuis le formulaire campagne avec scope <code>region</code>{" "}
          ou <code>departement</code>.
        </p>
        <p>
          <Link
            href={`/fr/${adminPrefix}/content-gen/coverage/new${
              preselected ? `?region=${preselected}` : ""
            }`}
            className="admin-button"
          >
            → Aller au formulaire campagne
          </Link>
        </p>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Régions disponibles (phase 1)</h2>
        <ul className="admin-quick-actions">
          {REGIONS.filter((r) => r.publicationPhase === 1).map((r) => (
            <li key={r.slug}>
              <Link href={`/fr/${adminPrefix}/content-gen/coverage/new?region=${r.slug}`}>
                {r.nameFr} ({r.inseeCode})
              </Link>
            </li>
          ))}
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
