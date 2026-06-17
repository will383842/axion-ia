/**
 * Observatoire IA 2026 — dashboard admin.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ObservatoireV2 } from "./_v2/ObservatoireV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ObservatoireAdminPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <ObservatoireV2 />;
}
