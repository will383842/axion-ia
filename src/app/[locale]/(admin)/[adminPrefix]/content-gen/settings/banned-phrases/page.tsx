/**
 * Content Generator — Settings banned phrases (§ 21 doctrine).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createBannedPhrase,
  deleteBannedPhrase,
  listBannedPhrases,
  toggleBannedPhrase,
} from "@/server/actions/content-gen/banned-phrases";
import { BannedPhrasesV2 } from "./_v2/BannedPhrasesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function BannedPhrasesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listBannedPhrases();

  return <BannedPhrasesV2 rows={rows} />;
}

