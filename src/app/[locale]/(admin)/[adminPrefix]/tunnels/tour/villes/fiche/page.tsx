// Fiche d'une ville du Tour France IA : mini-demandes, visios et réponses de l'étape 2
// (2026-10-29). `?ville=<clé>` (le slug du référentiel, ou `?<texte>` hors liste).
//
// Page SERVEUR, aucun composant client, LECTURE SEULE. Garde : `gardeLectureAppels`, AVANT toute
// lecture. Une ville invalide dans l'adresse n'ouvre AUCUNE lecture.
//
// FR uniquement (CLAUDE.md §14 admin FR).

import type { Metadata } from "next";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardeLectureAppels } from "@/features/admin-calendly/acces";
import { lireFicheVille } from "@/features/tour-de-france/lectures";
import { villeDeLAdresse } from "@/features/tour-de-france/parametres";
import { VueVilleTour } from "../../../_components/VueVilleTour";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ville du Tour France IA",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function FicheVilleTourPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const acces = await gardeLectureAppels(`/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;

  const ville = villeDeLAdresse((await searchParams)["ville"]);
  if (ville === null) return <VueVilleTour adminPrefix={adminPrefix} fiche={null} />;

  return <VueVilleTour adminPrefix={adminPrefix} fiche={await lireFicheVille(ville)} />;
}
