/**
 * Content Generator — Page Couverture villes pilote.
 *
 * Sprint City Quality 6 pilote 2026-05-18.
 * Route : /fr/<adminPrefix>/content-gen/city-coverage
 *
 * Convention V2 only (admin-v2 cookie ou env ADMIN_V2_ENABLED=true).
 * En V1 : message d'invitation à activer V2 (pas de duplication de markup).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { CityCoverageV2 } from "./_v2/CityCoverageV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CityCoveragePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <CityCoverageV2 adminPrefix={adminPrefix} />;
  }

  // V1 fallback minimal : dashboard est natif V2 (cf. ADR 0028).
  return (
    <section>
      <div className="admin-dashboard-head">
        <h1 className="admin-h1-large">Couverture villes pilote</h1>
        <p className="admin-meta">
          Ce tableau de bord est uniquement disponible dans la console V2 (refonte mai 2026).
        </p>
      </div>
      <div className="admin-card">
        <p>
          Activez la V2 via le cookie <code>admin_v2=1</code> ou la variable d&apos;environnement
          Coolify <code>ADMIN_V2_ENABLED=true</code> pour accéder à la couverture villes.
        </p>
      </div>
    </section>
  );
}
