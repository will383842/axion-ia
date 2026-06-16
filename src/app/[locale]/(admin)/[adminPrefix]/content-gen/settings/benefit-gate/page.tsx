/**
 * Content Generator — Benefit-gate & profils qualité (PH4, plan §6).
 *
 * Active/désactive le benefit-gate commercial (PH2) + son juge LLM (PH3) + seuil,
 * et affiche la table SSOT des profils qualité par type de contenu.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBenefitGateConfig } from "@/server/actions/content-gen/benefit-gate";
import { BenefitGateV2 } from "./_v2/BenefitGateV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function BenefitGatePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const config = await getBenefitGateConfig();

  return <BenefitGateV2 config={config} />;
}
