/**
 * Content Generator — Geo batch new (§ 15.2 batch builder).
 *
 * V1 = redirige vers /coverage/new avec scope région pré-rempli. Le builder
 * complet (drag&drop ordres, modes 4) arrive V1.5 si Will demande.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { REGIONS } from "@/content/regions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function NewBatchPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const preselected = sp.region;

  return (
    <section>
      <div className="admin-dashboard-head">
        <h1 className="admin-h1-large">Nouveau batch géographique</h1>
      </div>

      <div className="admin-card">
        <p>
          Le batch builder complet (modes d&apos;ordre, drag&amp;drop, skip filters) arrive V1.5.
          Pour V1, créez une campagne depuis le formulaire campagne avec scope <code>region</code>{" "}
          ou <code>departement</code>.
        </p>
        <p>
          <a
            href={`/fr/${adminPrefix}/content-gen/coverage/new${
              preselected ? `?region=${preselected}` : ""
            }`}
            className="admin-button"
          >
            → Aller au formulaire campagne
          </a>
        </p>
      </div>

      <div className="admin-card">
        <h2>Régions disponibles (phase 1)</h2>
        <ul className="admin-quick-actions">
          {REGIONS.filter((r) => r.publicationPhase === 1).map((r) => (
            <li key={r.slug}>
              <a href={`/fr/${adminPrefix}/content-gen/coverage/new?region=${r.slug}`}>
                {r.nameFr} ({r.inseeCode})
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
