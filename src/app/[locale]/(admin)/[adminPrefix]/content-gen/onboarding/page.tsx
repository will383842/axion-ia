/**
 * Content Generator — Onboarding wizard 1ʳᵉ visite (§ 12.1ter v1.9).
 *
 * V1 simplifié : checklist linéaire. La modale Stepper + Radix Dialog arrive
 * V1.5 si Will la veut.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  readContentGenConfig,
  writeContentGenConfig,
} from "@/server/actions/content-gen/_settings";
import { requireAdmin } from "@/server/actions/content-gen/_auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { OnboardingV2 } from "./_v2/OnboardingV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <OnboardingV2 adminPrefix={adminPrefix} />;
  }

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Onboarding content-gen</h1>
          <p className="admin-meta">5 étapes — § 12.1ter v1.9.</p>
        </div>
      </div>

      <div className="admin-card">
        <h2>Statut</h2>
        <ul>
          <li>
            {providersConfigured >= 4 ? "✅" : "⏳"} <strong>Étape 1 — Providers IA</strong> ·{" "}
            {providersConfigured}/4 minimum
            {providersConfigured < 4 ? (
              <>
                {" "}
                · <a href={`${base}/settings/providers`}>Configurer →</a>
              </>
            ) : null}
          </li>
          <li>
            {manon ? "✅" : "⏳"} <strong>Étape 2 — Profil auteur Manon</strong>
            {!manon ? (
              <>
                {" "}
                · Seed via <code>pnpm tsx prisma/seeds/content-gen/author-manon.ts</code>
              </>
            ) : (
              <>
                {" "}
                · <a href={`${base}/author/manon`}>Éditer →</a>
              </>
            )}
          </li>
          <li>
            {distribProfiles >= 1 ? "✅" : "⏳"}{" "}
            <strong>Étape 3 — Profil distribution par défaut</strong>
            {distribProfiles < 1 ? (
              <>
                {" "}
                · <a href={`${base}/settings/coverage-distribution`}>Créer un profil →</a>
              </>
            ) : null}
          </li>
          <li>
            <strong>Étape 4 — Première campagne test</strong> ·{" "}
            <a href={`${base}/coverage/new`}>Lancer une campagne →</a>
          </li>
          <li>
            <strong>Étape 5 — Vérifier le kill switch</strong> ·{" "}
            <a href={`${base}/settings/kill-switch`}>Tester →</a>
          </li>
        </ul>
      </div>

      {!onboarded ? (
        <form action={markDone} className="admin-card">
          <p>Une fois les 5 étapes complétées, marquez l&apos;onboarding comme terminé.</p>
          <button type="submit" className="admin-button">
            ✅ Marquer l&apos;onboarding comme terminé
          </button>
        </form>
      ) : (
        <div
          className="admin-card"
          style={{ borderColor: allOk ? "var(--color-success)" : "var(--color-terracotta)" }}
        >
          <p>
            ✅ Onboarding marqué comme terminé. Vous pouvez revenir ici à tout moment via le menu.
          </p>
        </div>
      )}
    </section>
  );
}
