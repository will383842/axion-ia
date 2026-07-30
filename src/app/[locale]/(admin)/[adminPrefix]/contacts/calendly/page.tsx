// Redirection de compatibilité — ancien onglet « Appels Calendly ».
// Fusionné le 2026-07-29 dans `/contacts/appels` (cf. ../appels/page.tsx).

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function CalendlyLegacyRedirect({ params }: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  redirect(`/fr/${adminPrefix}/contacts/appels`);
}
