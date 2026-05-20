/**
 * Content Generator — Settings llms.txt (§ 9bis indexation perfection 2026).
 *
 * Édition manuelle du fichier servi à `/llms.txt`. La route Next 16
 * (`src/app/llms.txt/route.ts`) lit ContentGenConfig.key="llms_txt" et fallback
 * sur le default codé. Sprint 5 ajoute génération auto (`enrichi`).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLlmsTxt } from "@/server/actions/content-gen/policies";
import { LlmsTxtV2 } from "./_v2/LlmsTxtV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function LlmsTxtPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const content = await getLlmsTxt();

  return <LlmsTxtV2 content={content} />;
}
