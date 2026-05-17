/**
 * Content Generator — Similarity monitor (§ 25.5 couche C v1.7).
 *
 * V1 = squelette. Table `SimilarityPair` + worker cron quotidien arrivent
 * Sprint 4. Pour V1 on affiche un placeholder + lien vers le settings.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { SimilarityMonitorV2 } from "./_v2/SimilarityMonitorV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function SimilarityMonitorPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <SimilarityMonitorV2 />;
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Anti-doublon (similarity monitor)</h1>
          <p className="admin-meta">
            § 25.5 couche C v1.7. Worker cron quotidien + table SimilarityPair arrivent Sprint 4.
          </p>
        </div>
      </div>

      <div className="admin-card">
        <h2>Statut V1</h2>
        <ul>
          <li>Couche A — Idempotency key sur ContentGenJob (✅ Sprint 1)</li>
          <li>Couche B — Dedup-guard pré-IA (✅ Sprint 1 `quality/dedup-guard.ts`)</li>
          <li>
            Couche C — Surveillance similarité cosine + Jaccard post-publi (⏳ Sprint 4 cron
            <code>04:30</code> + table <code>SimilarityPair</code>)
          </li>
        </ul>
      </div>

      <div className="admin-card">
        <h2>Top paires les plus similaires (Sprint 4)</h2>
        <p>
          Une fois Sprint 4 livré, ce tableau listera les 100 paires (cosine, Jaccard) les plus
          similaires avec bulk actions « archiver le moins performant » / « fusionner avec 301 » / «
          ignorer la paire ».
        </p>
      </div>
    </section>
  );
}
