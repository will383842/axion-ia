/**
 * Content Generator — Admin dashboard (Sprint 3 § 12.2 master prompt).
 *
 * Lecture KPIs 7j + état queue + KB health + kill-switch status + quick
 * actions vers les sous-sections. Server Component pur — `force-dynamic`
 * pour toujours afficher les dernières valeurs DB.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ContentGenDashboardV2 } from "./_v2/ContentGenDashboardV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ContentGenDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <ContentGenDashboardV2 adminPrefix={adminPrefix} />;
}
