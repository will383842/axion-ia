// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Onboarding V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { ArrowRight } from "lucide-react";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminButton } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import {
  readContentGenConfig,
  writeContentGenConfig,
} from "@/server/actions/content-gen/_settings";
import { requireAdmin } from "@/server/actions/content-gen/_auth";

interface Props {
  adminPrefix: string;
}

export async function OnboardingV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const [onboarded, providersConfigured, manon, distribProfiles] = await Promise.all([
    readContentGenConfig<boolean>("onboarded", false),
    prisma.providerConfig.count(),
    prisma.authorProfile.findUnique({ where: { slug: "manon" } }),
    prisma.coverageDistributionProfile.count({ where: { isDefault: true } }),
  ]);

  async function markDone() {
    "use server";
    const s = await requireAdmin();
    await writeContentGenConfig("onboarded", true, s.userId, "Onboarding terminé");
  }

  const base = `/fr/${adminPrefix}/content-gen`;
  const allOk = providersConfigured >= 4 && manon !== null && distribProfiles >= 1 && onboarded;

  return (
    <AdminPageShell>
      <AdminPageHeader title="Onboarding content-gen" description="5 étapes — § 12.1ter v1.9." />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Statut</h2>
        <ul className="admin-meta-block">
          <li>
            {providersConfigured >= 4 ? "✅" : "⏳"} <strong>Étape 1 — Providers IA</strong> ·{" "}
            {providersConfigured}/4 minimum
            {providersConfigured < 4 ? (
              <>
                {" · "}
                <AdminButton
                  href={`${base}/settings/providers`}
                  variant="ghost"
                  size="sm"
                  iconAfter={ArrowRight}
                >
                  Configurer
                </AdminButton>
              </>
            ) : null}
          </li>
          <li>
            {manon ? "✅" : "⏳"} <strong>Étape 2 — Profil auteur Manon</strong>
            {!manon ? (
              // Audit UX 2026-08-01 (Défaut 3, P0) — cette étape crée la ligne
              // AuthorProfile en base ; aucun bouton console ne le fait (la
              // page /author/manon ne peut qu'ÉDITER une ligne existante, pas
              // en créer une). Une commande `pnpm` était inatteignable pour
              // Will (pas d'accès serveur) : on renvoie vers l'équipe technique
              // plutôt que d'afficher une commande terminal.
              <>{" · "}Contactez l&apos;équipe technique pour cette étape.</>
            ) : (
              <>
                {" · "}
                <AdminButton
                  href={`${base}/author/manon`}
                  variant="ghost"
                  size="sm"
                  iconAfter={ArrowRight}
                >
                  Éditer
                </AdminButton>
              </>
            )}
          </li>
          <li>
            {distribProfiles >= 1 ? "✅" : "⏳"}{" "}
            <strong>Étape 3 — Profil distribution par défaut</strong>
            {distribProfiles < 1 ? (
              <>
                {" · "}
                <AdminButton
                  href={`${base}/settings/coverage-distribution`}
                  variant="ghost"
                  size="sm"
                  iconAfter={ArrowRight}
                >
                  Créer un profil
                </AdminButton>
              </>
            ) : null}
          </li>
          <li>
            <strong>Étape 4 — Première campagne test</strong> ·{" "}
            <AdminButton
              href={`${base}/campaigns/new`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Lancer une campagne
            </AdminButton>
          </li>
          <li>
            <strong>Étape 5 — Vérifier le kill switch</strong> ·{" "}
            <AdminButton
              href={`${base}/settings/kill-switch`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Tester
            </AdminButton>
          </li>
        </ul>
      </AdminCard>

      {!onboarded ? (
        <AdminCard>
          <form action={markDone}>
            <p className="admin-meta-block">
              Une fois les 5 étapes complétées, marquez l&apos;onboarding comme terminé.
            </p>
            <button type="submit" className="admin-button">
              Marquer l&apos;onboarding comme terminé
            </button>
          </form>
        </AdminCard>
      ) : (
        <AdminCard
          className={
            allOk
              ? "border-l-4 border-l-[color:var(--color-admin-success)]"
              : "border-l-4 border-l-[color:var(--color-admin-warning)]"
          }
        >
          <p className="admin-meta-block">
            Onboarding marqué comme terminé. Vous pouvez revenir ici à tout moment via le menu.
          </p>
        </AdminCard>
      )}
    </AdminPageShell>
  );
}
