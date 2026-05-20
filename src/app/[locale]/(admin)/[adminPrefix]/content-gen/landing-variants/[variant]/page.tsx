/**
 * Content Generator — Landing variant detail.
 *
 * V1 minimal : affiche les ContentTemplate qui ciblent ce variant + nombre de
 * landings publiées avec ce variant.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LandingVariantDetailV2 } from "./_v2/LandingVariantDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; variant: string }>;
}

export default async function LandingVariantDetailPage({ params }: PageProps) {
  const { adminPrefix, variant } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <LandingVariantDetailV2 adminPrefix={adminPrefix} variant={variant} />;
}

