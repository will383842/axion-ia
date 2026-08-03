// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Quality loop V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Sprint correctif SP-01 : error UI via QualityLoopFormClient.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updateQualityLoop } from "@/server/actions/content-gen/policies";
import { QualityLoopFormClient } from "@/components/admin/content-gen/QualityLoopFormClient";

interface QualityLoopConfig {
  enabled: boolean;
  minScoreThreshold: number;
  targetScore: number;
  maxAttemptsAuto: number;
  monthlyBudgetCapUsd: number;
}

interface Props {
  cfg: QualityLoopConfig;
}

export function QualityLoopV2({ cfg }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    await updateQualityLoop({
      enabled: formData.get("enabled") === "on",
      minScoreThreshold: Number(formData.get("minScoreThreshold") ?? 0),
      targetScore: Number(formData.get("targetScore") ?? 0),
      maxAttemptsAuto: Number(formData.get("maxAttemptsAuto") ?? 0),
      monthlyBudgetCapUsd: Number(formData.get("monthlyBudgetCapUsd") ?? 0),
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Boucle qualité"
        description="Relance automatique de la rédaction quand le score qualité est insuffisant."
      />

      <AdminCard>
        <QualityLoopFormClient cfg={cfg} saveAction={save} />
      </AdminCard>
    </AdminPageShell>
  );
}
