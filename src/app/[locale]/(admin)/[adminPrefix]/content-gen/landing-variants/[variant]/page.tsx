/**
 * Content Generator — Landing variant detail.
 *
 * V1 minimal : affiche les ContentTemplate qui ciblent ce variant + nombre de
 * landings publiées avec ce variant.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; variant: string }>;
}

export default async function LandingVariantDetailPage({ params }: PageProps) {
  const { adminPrefix, variant } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">
            Variant <code>{variant}</code>
          </h1>
          <p className="admin-meta">
            {templates.length} template{templates.length > 1 ? "s" : ""} · {jobsCount} job
            {jobsCount > 1 ? "s" : ""} générés
          </p>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <h2>Templates ciblant ce variant</h2>
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
                <td colSpan={4}>Aucun template — créez-en un.</td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <code>{t.slug}</code>
                  </td>
                  <td>v{t.version}</td>
                  <td>{t.isActive ? "✅" : "🚫"}</td>
                  <td>
                    <a
                      href={`/fr/${adminPrefix}/content-gen/templates/${t.id}`}
                      className="admin-button-ghost"
                    >
                      Éditer
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
