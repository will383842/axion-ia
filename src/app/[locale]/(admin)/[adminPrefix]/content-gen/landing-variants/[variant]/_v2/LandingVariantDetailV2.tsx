// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Landing variant detail V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEtatBooleen,
} from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
  variant: string;
}

export async function LandingVariantDetailV2({
  adminPrefix,
  variant,
}: Props): Promise<React.ReactElement> {
  const [templates, jobsCount] = await Promise.all([
    prisma.contentTemplate.findMany({
      where: { contentType: "landing_ville", variant },
      orderBy: { version: "desc" },
    }),
    prisma.contentGenJob.count({
      where: {
        contentType: "landing_ville",
        inputPayload: { path: ["variant"], equals: variant },
      },
    }),
  ]);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Variant ${variant}`}
        description={`${templates.length} template${templates.length > 1 ? "s" : ""} · ${jobsCount} job${jobsCount > 1 ? "s" : ""} générés`}
      />

      <AdminCard variant="compact">
        <h2 className="admin-h2">Templates ciblant ce variant</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Version</th>
                <th>Actif</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    Aucun template — créez-en un.
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <code>{t.slug}</code>
                    </td>
                    <td>v{t.version}</td>
                    <td>
                      <AdminEtatBooleen
                        actif={t.isActive}
                        libelles={{ vrai: "Variante active", faux: "Variante inactive" }}
                      />
                    </td>
                    <td>
                      <Link
                        href={`/fr/${adminPrefix}/content-gen/templates/${t.id}`}
                        className="admin-button-ghost"
                      >
                        Éditer
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
