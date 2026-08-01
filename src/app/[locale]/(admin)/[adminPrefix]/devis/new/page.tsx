// Module Booking (mort) — redirection vers le module réel équivalent.
//
// Audit UX console du 2026-08-01 (phase 2) : l'ancien module Booking (site
// public éteint, tables orphelines) portait les mêmes noms que les vrais
// modules Qualiopi/Finances avec d'autres données — accessible par ⌘K sans
// bannière. Redirect 308 ; le garde auth() est conservé (les tests E2E
// assertent le renvoi /login sans session). Les Server Actions et modèles
// Prisma restent en place (suppression dure = lot séparé).

import { permanentRedirect, redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function LegacyBookingRedirect({ params }: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  permanentRedirect(`/fr/${adminPrefix}/qualiopi/devis`);
}
