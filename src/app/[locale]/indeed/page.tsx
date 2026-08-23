// Landing de réception de l'annonce indeed — servie à la RACINE, de la même forme
// que `/memo-isere` (demande Will 2026-08-23 : toutes les landings d'annonce
// portent une URL de même nature).
//
// 🔴 Une route par canal, et pas un `[slug]` racine : un segment dynamique
// posé ici avalerait toutes les URL inconnues du site — une faute de frappe
// rendrait cette landing au lieu d'un 404.
//
// Tout le contenu vit dans le gabarit partagé. Ce fichier ne fait que nommer
// le canal.

import type { Metadata } from "next";
import {
  PartenaireLandingPage,
  buildPartenaireMetadata,
} from "@/components/recrutement/PartenaireLandingPage";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPartenaireMetadata(locale, "indeed");
}

export default async function Page({ params }: Props) {
  return PartenaireLandingPage({ params, source: "indeed" });
}
