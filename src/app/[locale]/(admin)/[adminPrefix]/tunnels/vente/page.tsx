// Tunnel de vente — la jonction entre le haut et le bas du tunnel.
//
// Ce qui manquait, et que cette page apporte : le lien entre les demandes
// entrantes (dont les leads du simulateur) et les clients réellement signés.
// L'entonnoir commercial lui-même vit dans « Planning → Pipeline » et n'est pas
// dupliqué ici.
//
// Le rendu vit dans `VueVente`, affichable sans session.
//
// FR uniquement (CLAUDE.md §14 admin FR).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { lireFenetre } from "@/features/admin-tunnels/query";
import { chargerTunnelVente } from "@/features/admin-tunnels/vente";
import { VueVente } from "../_components/VueVente";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tunnel de vente",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TunnelVentePage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const jours = lireFenetre((await searchParams).fenetre);
  const s = await chargerTunnelVente(jours);

  return <VueVente s={s} jours={jours} adminPrefix={adminPrefix} />;
}
