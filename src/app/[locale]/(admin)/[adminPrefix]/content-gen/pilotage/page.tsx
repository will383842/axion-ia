/**
 * Console — « Pilotage SEO & IA » (P8). Lecture seule, mode observation.
 * Server Component, force-dynamic, noindex. Éteint sauf `CONTENT_PILOTAGE_SEO=true`.
 */

import type { Metadata } from "next";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { chargerPilotageSeo } from "@/server/actions/content-gen/pilotage";
import { gardePage } from "@/server/auth/garde-page";
import { PilotageV2 } from "./_v2/PilotageV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pilotage SEO & IA | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ onglet?: string; type?: string }>;
}

export default async function PilotageSeoPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}/content-gen`} />;
  }
  const modele = await chargerPilotageSeo({ type: sp.onglet === "pages" ? sp.type : undefined });
  return <PilotageV2 modele={modele} adminPrefix={adminPrefix} onglet={sp.onglet} type={sp.type} />;
}
