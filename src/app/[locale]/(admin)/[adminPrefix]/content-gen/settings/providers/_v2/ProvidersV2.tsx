// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Providers settings V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions updateProvider + resetProviderSpend préservées.
// Sprint correctif SP-01 : error UI via ProviderFormClient.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { resetProviderSpend, updateProvider } from "@/server/actions/content-gen/providers";
import { ProviderFormClient } from "@/components/admin/content-gen/ProviderFormClient";

interface ProviderRow {
  id: string;
  provider: string;
  role: string;
  apiKeyEnvVar: string;
  enabled: boolean;
  model: string;
  monthlyCapUsd: number;
  rateLimitRpm: number | null;
  currentMonthSpentUsd: number;
}

interface Props {
  rows: ReadonlyArray<ProviderRow>;
}

export function ProvidersV2({ rows }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    const rateLimitRpm = formData.get("rateLimitRpm")
      ? Number(formData.get("rateLimitRpm"))
      : undefined;
    await updateProvider({
      id: String(formData.get("id")),
      enabled: formData.get("enabled") === "on",
      model: String(formData.get("model")),
      monthlyCapUsd: Number(formData.get("monthlyCapUsd") ?? 0),
      ...(rateLimitRpm !== undefined ? { rateLimitRpm } : {}),
    });
  }

  async function resetSpend(formData: FormData) {
    "use server";
    await resetProviderSpend(String(formData.get("id")));
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Fournisseurs de modèles IA"
        description={`${rows.length} fournisseur${rows.length > 1 ? "s" : ""} configuré${rows.length > 1 ? "s" : ""} · plafond de dépense mensuel, remis à zéro le 1er du mois.`}
      />

      {/* 🔴 CET ÉTAT VIDE AFFICHAIT UNE COMMANDE DE TERMINAL, UN NOM DE TABLE
          ET UN IDENTIFIANT DE COMMIT : « Lance `pnpm content-gen:seed` pour
          seeder ProviderConfig (Sprint 1 Day 1 commit d174f83) ». Le lecteur de
          cette console n'a pas d'accès au serveur : on lui donnait une consigne
          qu'il ne peut pas suivre, dans un vocabulaire qui n'est pas le sien.
          Un état vide dit ce qui manque et à qui s'adresser — pas comment on
          le réparerait depuis une machine de développement. */}
      {rows.length === 0 ? (
        <AdminCard>
          <p className="admin-meta-block">
            Aucun fournisseur de modèles n&apos;est configuré : la génération de contenu ne peut pas
            démarrer tant qu&apos;il n&apos;y en a pas au moins un. Cette initialisation se fait
            côté serveur — signalez-le à votre équipe technique.
          </p>
        </AdminCard>
      ) : (
        rows.map((r) => (
          <AdminCard key={r.id} className="mb-[var(--space-admin-5)]">
            <ProviderFormClient row={r} saveAction={save} resetSpendAction={resetSpend} />
          </AdminCard>
        ))
      )}
    </AdminPageShell>
  );
}
