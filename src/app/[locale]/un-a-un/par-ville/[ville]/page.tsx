// Sprint S+2 City Domination — 4e verticale `un-a-un` × ville (~2150 routes SSG).
// Décision Will Option A 2026-05-18 : naming brand canonique "un-a-un" en URL,
// sémantique = coaching dirigeant 1-to-1. Tarif d'entrée 990 € HT (UN_A_UN_TIERS).
//
// Toute la logique est dans `VilleServicePageTemplate` (server component
// partagé par les 4 services). Ce fichier ne fait que câbler la route.
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

// Cohérence avec audit/interventions/implementation par-ville :
// ISR 24h + dynamicParams pour nouvelles villes on-demand.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata(props: Props): Promise<Metadata> {
  return buildPageMetadata("un-a-un", props);
}

export default async function UnAUnVillePage({ params }: Props) {
  const { locale, ville } = await params;
  return renderVilleServicePage({ service: "un-a-un", locale, villeSlug: ville });
}
