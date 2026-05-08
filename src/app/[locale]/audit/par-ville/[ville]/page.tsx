// Sprint 14.10.1 Commit B — page audit IA × ville (~2150 routes SSG).
// Toute la logique est dans `VilleServicePageTemplate` (server component
// partagé par les 3 services). Ce fichier ne fait que câbler la route.
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

export async function generateMetadata(props: Props): Promise<Metadata> {
  return buildPageMetadata("audit", props);
}

export default async function AuditVillePage({ params }: Props) {
  const { locale, ville } = await params;
  return renderVilleServicePage({ service: "audit", locale, villeSlug: ville });
}
