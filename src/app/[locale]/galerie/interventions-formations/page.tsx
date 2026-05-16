/**
 * Public gallery hub — /interventions-formations (module=interventions).
 * Wrapper around the main /galerie page with module pre-filter.
 */

import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ locale: "fr" | "en" }>;
}

export const revalidate = 3600;

export default async function interventionsHubPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/galerie?module=interventions`);
}
