// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Similarity monitor V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

export function SimilarityMonitorV2(): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Anti-doublon (similarity monitor)"
        description="§ 25.5 couche C v1.7. Worker cron quotidien + table SimilarityPair arrivent Sprint 4."
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Statut V1</h2>
        <ul className="admin-meta-block">
          <li>Couche A — Idempotency key sur ContentGenJob (livré — Sprint 1)</li>
          <li>Couche B — Dedup-guard pré-IA (livré — Sprint 1 `quality/dedup-guard.ts`)</li>
          <li>
            Couche C — Surveillance similarité cosine + Jaccard post-publi (à venir — Sprint 4 cron{" "}
            <code>04:30</code> + table <code>SimilarityPair</code>)
          </li>
        </ul>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Top paires les plus similaires (Sprint 4)</h2>
        <p className="admin-meta-block">
          Une fois Sprint 4 livré, ce tableau listera les 100 paires (cosine, Jaccard) les plus
          similaires avec bulk actions « archiver le moins performant » / « fusionner avec 301 » / «
          ignorer la paire ».
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
