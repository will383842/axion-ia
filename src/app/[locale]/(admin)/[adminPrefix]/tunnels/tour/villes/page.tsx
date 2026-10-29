// Villes du Tour France IA : une ligne par ville, avec la jauge « n sur 5 » (2026-10-29).
//
// Page SERVEUR, aucun composant client, LECTURE SEULE. Le rendu vit dans `VueVillesTour`,
// affichable sans session. Garde : celle des appels réservés (`gardeLectureAppels`), comme la page
// des demandes ; elle passe AVANT toute lecture (garde `la-lecture-est-gardee-comme-l-ecriture`).
//
// FR uniquement (CLAUDE.md §14 admin FR).

import type { Metadata } from "next";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardeLectureAppels } from "@/features/admin-calendly/acces";
import { compteurParVille } from "@/features/tour-de-france/lectures";
import { VueVillesTour } from "../../_components/VueVillesTour";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Villes du Tour France IA",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function VillesTourPage({ params }: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const acces = await gardeLectureAppels(`/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;

  const villes = await compteurParVille();
  return <VueVillesTour adminPrefix={adminPrefix} villes={villes} />;
}
