// Tunnels — vue d'ensemble.
//
// Répond à une seule question : combien de personnes entrent, combien
// ressortent en prospect, et où part le reste.
//
// La page ne fait que garder l'accès et charger la donnée : tout le rendu vit
// dans `VueEnsemble`, qui ne dépend que de ses propriétés et reste donc
// affichable — donc vérifiable à l'écran — sans session.
//
// FR uniquement (CLAUDE.md §14 admin FR). `force-dynamic` : la donnée est du
// temps réel, une page mise en cache y serait trompeuse.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { chargerTunnels, lireFenetre } from "@/features/admin-tunnels/query";
import { VueEnsemble } from "./_components/VueEnsemble";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tunnels",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TunnelsPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const jours = lireFenetre((await searchParams).fenetre);
  const { synthese, lignes, tronquee } = await chargerTunnels(jours);

  return (
    <VueEnsemble
      synthese={synthese}
      jours={jours}
      lignes={lignes}
      tronquee={tronquee}
      adminPrefix={adminPrefix}
    />
  );
}
