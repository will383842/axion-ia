/**
 * Content Generator — Console « Équipe éditoriale » (PR 17).
 * Marche / arrêt, quotas, articles à relire. Réservé à l'administration.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPilotageEquipe } from "@/server/actions/content-gen/equipe-editoriale";
import { EquipeEditorialeClient } from "./EquipeEditorialeClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function EquipeEditorialePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  let pilotage;
  try {
    pilotage = await getPilotageEquipe();
  } catch {
    // Non administrateur (ex. lecteur) : même repli que les autres pages console.
    redirect(`/fr/${adminPrefix}`);
  }

  return (
    <EquipeEditorialeClient
      adminPrefix={adminPrefix}
      etat={pilotage.etat}
      quotas={pilotage.quotas}
      delais={
        pilotage.delaisIndexation && {
          medianeHeures30j: pilotage.delaisIndexation.medianeHeures30j,
          articles: pilotage.delaisIndexation.articles.map((a) => ({
            id: a.id,
            titre: a.titre,
            publieLe: a.publieLe.toISOString(),
            delaiHeures: a.delaiHeures,
          })),
        }
      }
      aRelire={pilotage.aRelire.map((a) => ({ ...a, creeLe: a.creeLe.toISOString() }))}
    />
  );
}
