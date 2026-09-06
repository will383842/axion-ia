import type { Metadata } from "next";
import { AdHocDispatchV2 } from "./_v2/AdHocDispatchV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function AdHocPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }

  return <AdHocDispatchV2 adminPrefix={adminPrefix} />;
}
