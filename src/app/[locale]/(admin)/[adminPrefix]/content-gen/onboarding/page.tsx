/**
 * Content Generator — Onboarding wizard 1ʳᵉ visite (§ 12.1ter v1.9).
 *
 * V1 simplifié : checklist linéaire. La modale Stepper + Radix Dialog arrive
 * V1.5 si Will la veut.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingV2 } from "./_v2/OnboardingV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <OnboardingV2 adminPrefix={adminPrefix} />;
}
