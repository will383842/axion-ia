// Landing du tunnel Facebook apporteurs d'affaires — servie à la RACINE
// (`/facebook`), de la même forme que `/leboncoin` et `/memo-isere`.
//
// Une route par canal, jamais un `[slug]` racine (il avalerait toutes les URL
// inconnues du site). Tout le contenu vit dans le gabarit ; ce fichier ne fait
// que nommer la page.

import type { Metadata } from "next";
import {
  FacebookLandingPage,
  buildFacebookLandingMetadata,
} from "@/components/recrutement/FacebookLandingPage";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildFacebookLandingMetadata(locale);
}

export default async function Page({ params }: Props) {
  return FacebookLandingPage({ params });
}
