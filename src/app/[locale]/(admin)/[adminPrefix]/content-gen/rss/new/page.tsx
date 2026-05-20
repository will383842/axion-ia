/**
 * Content Generator — RSS source create.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { addRssSource } from "@/server/actions/content-gen/rss";
import { RssNewV2 } from "./_v2/RssNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function NewRssPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <RssNewV2 adminPrefix={adminPrefix} />;
}

