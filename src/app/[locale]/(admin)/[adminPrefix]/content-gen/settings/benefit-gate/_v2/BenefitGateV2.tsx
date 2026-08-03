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
      {/* 🔴 Cette page était rédigée en jargon de développement de bout en
          bout : nom de variable d'environnement, nom de la plateforme
          d'hébergement, référence de phase interne (« PH3 »), nom de fichier
          source, et des en-têtes de tableau qui étaient les noms de champs du
          code (`contentType`, `benefitMin`, `qualityThreshold`). Rien de tout
          cela n'est actionnable depuis la console. */}
      <AdminPageHeader
        title="Contrôle du bénéfice concret"
        description="Refuse de publier un contenu commercial qui ne promet aucun bénéfice mesurable au lecteur. Un second contrôle, plus fin, peut être confié à un modèle IA — il est facturé à l'usage."
      />

      <AdminCard>
        <form action={save} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={config.enabled} />
            Activer le contrôle (contenus commerciaux : présence de chiffres, de comparaisons
            avant/après)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="llmJudge" defaultChecked={config.llmJudge} />
            Confier un second contrôle à un modèle IA (facturé à l&apos;usage ; ne s&apos;applique
            qu&apos;aux contenus ciblant un secteur)
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
            className="w-fit rounded bg-[color:var(--color-admin-accent)] px-4 py-2 text-sm text-white"
          >
            Enregistrer
          </button>
        </form>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-2 text-sm font-semibold">
          Niveau d&apos;exigence appliqué à chaque type de contenu
        </h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
              <th className="py-1">Type de contenu</th>
              <th className="py-1">Niveau d&apos;exigence</th>
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
        <h2 className="mb-2 text-sm font-semibold">Seuils appliqués par niveau d&apos;exigence</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
              <th className="py-1">Niveau d&apos;exigence</th>
              <th className="py-1">Bénéfice minimal exigé</th>
              <th className="py-1">Mode de seuil qualité</th>
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
                  <td className="py-1">
                    {g.mayMutateVilleTier ? "oui" : "non (journalisé seulement)"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>
    </AdminPageShell>
  );
}
