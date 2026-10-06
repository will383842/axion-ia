// Tunnel apporteurs — de la publicité à l'apporteur actif (2026-10-06).
//
// Page SERVEUR, aucun composant client. Le rendu vit dans `VueApporteurs`.
// Garde : session de console obligatoire (`gardePage`) ; la saisie des dépenses
// exige en plus un rôle qui peut écrire.
//
// FR uniquement (CLAUDE.md §14 admin FR).

import type { Metadata } from "next";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { chargerTableauApporteurs, lirePeriode } from "@/features/admin-tunnels/apporteurs";
import { gardePage } from "@/server/auth/garde-page";
import { VueApporteurs } from "../_components/VueApporteurs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tunnel apporteurs",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const MESSAGES: Record<string, string> = {
  ok: "Dépense enregistrée.",
  supprimee: "Dépense supprimée.",
};

export default async function TunnelApporteursPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;

  const sp = await searchParams;
  const tableau = await chargerTableauApporteurs(lirePeriode(sp["periode"]));
  const aujourdhui = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <VueApporteurs
      t={tableau}
      adminPrefix={adminPrefix}
      peutEcrire={acces.peutEcrire}
      message={sp["depense"] ? MESSAGES[sp["depense"]] : undefined}
      erreur={sp["erreur"]?.slice(0, 200)}
      aujourdhui={aujourdhui}
    />
  );
}
