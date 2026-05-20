/**
 * Content Generator — Kill switch (§ 12 master prompt).
 *
 * 1 clic activate/deactivate. Lit l'état depuis `ContentGenConfig` table.
 * Quand actif → tous les workers content-gen rejettent les jobs au pick.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  activateKillSwitch,
  deactivateKillSwitch,
  getKillSwitch,
} from "@/server/actions/content-gen/kill-switch";
import { KillSwitchV2 } from "./_v2/KillSwitchV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function KillSwitchPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const state = await getKillSwitch();

  return (
    <KillSwitchV2
      state={{
        active: state.active,
        activatedAt: state.activatedAt ?? null,
        reason: state.reason ?? null,
      }}
    />
  );
}

