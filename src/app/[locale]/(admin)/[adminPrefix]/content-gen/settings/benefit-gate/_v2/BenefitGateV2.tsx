// Benefit-gate V2 (PH4) — AdminPageShell + AdminPageHeader + AdminCard.
// Server component + form server-action (mirror KillSwitchV2). 0 JS client.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updateBenefitGateConfig } from "@/server/actions/content-gen/benefit-gate";
import {
  PROFILE_BY_CONTENT_TYPE,
  QUALITY_PROFILE_GATES,
  QUALITY_PROFILES,
} from "@/server/content-gen/profiles/quality-profile-table";

interface Config {
  enabled: boolean;
  llmJudge: boolean;
  minScore: number;
}

interface Props {
  config: Config;
}

export function BenefitGateV2({ config }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    await updateBenefitGateConfig({
      enabled: formData.get("enabled") === "on",
      llmJudge: formData.get("llmJudge") === "on",
      minScore: Number(formData.get("minScore") ?? 70),
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Benefit-gate & profils qualité"
        description="Active le gate « bénéfice concret » (commercial uniquement) et son juge LLM cost-tracké (PH3). N'a d'effet que si l'env QUALITY_PROFILES_ENABLED=true est aussi posée (Coolify web+worker)."
      />

      <AdminCard>
        <form action={save} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={config.enabled} />
            Activer le benefit-gate (profil commercial — checks regex chiffres/avant-après)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="llmJudge" defaultChecked={config.llmJudge} />
            Activer le juge LLM (PH3, via provider-router cost-tracké ; requiert
            targetSecteur+vertical sur le job)
          </label>
          <label className="flex items-center gap-2 text-sm">
            Score minimal de blocage (0-100)
            <input
              type="number"
              name="minScore"
              min={0}
              max={100}
              defaultValue={config.minScore}
              className="w-20 rounded border border-[color:var(--color-admin-border)] px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded bg-[color:var(--color-admin-accent,#1a4dd9)] px-4 py-2 text-sm text-white"
          >
            Enregistrer
          </button>
        </form>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-2 text-sm font-semibold">
          Profils qualité par type de contenu (SSOT code — quality-profile-table.ts)
        </h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
              <th className="py-1">contentType</th>
              <th className="py-1">profil</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PROFILE_BY_CONTENT_TYPE)
              .sort(([, a], [, b]) => a.localeCompare(b))
              .map(([type, profile]) => (
                <tr key={type} className="border-t border-[color:var(--color-admin-border)]">
                  <td className="py-1 font-mono">{type}</td>
                  <td className="py-1">{profile}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-2 text-sm font-semibold">Seuils par profil (defaults SSOT)</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
              <th className="py-1">profil</th>
              <th className="py-1">benefitMin</th>
              <th className="py-1">qualityThreshold</th>
              <th className="py-1">mutation tier ville</th>
            </tr>
          </thead>
          <tbody>
            {QUALITY_PROFILES.map((p) => {
              const g = QUALITY_PROFILE_GATES[p];
              return (
                <tr key={p} className="border-t border-[color:var(--color-admin-border)]">
                  <td className="py-1">{p}</td>
                  <td className="py-1">{g.benefitMin === null ? "—" : g.benefitMin}</td>
                  <td className="py-1">{g.qualityThresholdMode}</td>
                  <td className="py-1">{g.mayMutateVilleTier ? "oui" : "non (log-only)"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>
    </AdminPageShell>
  );
}
