// Tunnel de prospects — le détail actionnable.
//
// La vue d'ensemble dit COMBIEN on perd. Cette page dit OÙ et POUR QUI :
// l'écran exact qui fait décrocher, la campagne qui amène du monde sans
// convertir, l'appareil sur lequel le parcours casse.
//
// Le rendu vit dans `VueProspects`, affichable sans session — c'est ce qui rend
// le contrôle visuel possible sans identifiants.
//
// FR uniquement (CLAUDE.md §14 admin FR).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { chargerTunnels, lireFenetre, lireTunnel } from "@/features/admin-tunnels/query";
import { VueProspects } from "../_components/VueProspects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tunnel de prospects",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TunnelProspectsPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const params_ = await searchParams;
  const jours = lireFenetre(params_.fenetre);
  const tunnel = lireTunnel(params_.tunnel);
  const { synthese } = await chargerTunnels(jours, tunnel);

  return (
    <VueProspects synthese={synthese} jours={jours} tunnel={tunnel} adminPrefix={adminPrefix} />
  );
}
