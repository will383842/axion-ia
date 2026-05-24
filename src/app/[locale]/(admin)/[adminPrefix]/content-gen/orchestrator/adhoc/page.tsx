import type { Metadata } from "next";
import { AdHocDispatchV2 } from "./_v2/AdHocDispatchV2";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function AdHocPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  return <AdHocDispatchV2 adminPrefix={adminPrefix} />;
}
