// Page formation IA × ville — /formations/par-ville/[ville].
// Reprend la verticale per-ville historiquement nommée « interventions »
// (refonte 2026-06-11 : l'offre collective /interventions est devenue
// /formations). Le `service: "interventions"` reste la CLÉ INTERNE (copy ville
// `copy.services.interventions`, tiers, gate anti-doorway, drip) — seules les
// URL/naming publics passent à /formations (cf. SERVICE_META dans
// VilleServicePageTemplate). Gated : noindex si pas de copy unique + drip.
import type { Metadata } from "next";
import {
  buildPageMetadata,
  buildStaticParams,
  renderVilleServicePage,
} from "@/components/sections/VilleServicePageTemplate";

interface Props {
  params: Promise<{ locale: string; ville: string }>;
}

export const generateStaticParams = buildStaticParams;

// ISR sur pSEO villes (P1-13).
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata(props: Props): Promise<Metadata> {
  return buildPageMetadata("interventions", props);
}

export default async function FormationVillePage({ params }: Props) {
  const { locale, ville } = await params;
  return renderVilleServicePage({ service: "interventions", locale, villeSlug: ville });
}
