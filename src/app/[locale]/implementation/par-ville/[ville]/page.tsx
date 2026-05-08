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
  return buildPageMetadata("implementation", props);
}

export default async function ImplementationVillePage({ params }: Props) {
  const { locale, ville } = await params;
  return renderVilleServicePage({ service: "implementation", locale, villeSlug: ville });
}
