/**
 * Public gallery hub — /audits (module=audits).
 * Wrapper around the main /galerie page with module pre-filter.
 */

import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ locale: "fr" | "en" }>;
}

export const revalidate = 3600;

export default async function auditsHubPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/galerie?module=audits`);
}
