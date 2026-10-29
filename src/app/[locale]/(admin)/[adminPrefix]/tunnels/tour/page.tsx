// Tunnel Tour France IA — de la landing au rendez-vous tenu (2026-10-26).
//
// Page SERVEUR, aucun composant client. Le rendu vit dans `VueTour`, affichable
// sans session. Garde : celle des appels réservés (`gardeLectureAppels`) — les
// compteurs viennent des mêmes réservations que l'écran « Appels réservés ».
//
// FR uniquement (CLAUDE.md §14 admin FR).

import type { Metadata } from "next";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardeLectureAppels } from "@/features/admin-calendly/acces";
import { lireFenetre } from "@/features/admin-tunnels/query";
import { chargerTableauTour } from "@/features/admin-tunnels/tour";
import { VueTour } from "../_components/VueTour";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tunnel Tour France IA",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TunnelTourPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const acces = await gardeLectureAppels(`/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;

  const jours = lireFenetre((await searchParams).fenetre);
  const { tableau, tronquee } = await chargerTableauTour(jours);

  return <VueTour tableau={tableau} jours={jours} tronquee={tronquee} adminPrefix={adminPrefix} />;
}
