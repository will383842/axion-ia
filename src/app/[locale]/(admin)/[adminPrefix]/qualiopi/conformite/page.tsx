// Qualiopi — « Conformité » fusionnée dans « Conformité & mode auditeur »
// (audit UX console 2026-08-01, phase 2) : les deux pages affichaient la même
// matrice de 32 indicateurs sous deux entrées de nav. La page canonique
// /qualiopi/mode-auditeur reprend la vue tableau dense (défaut) et les 3
// stat cards de cette page. Redirect 308, URL conservée (favoris, docs _AUDIT).

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function LegacyConformiteRedirect({ params }: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  permanentRedirect(`/fr/${adminPrefix}/qualiopi/mode-auditeur`);
}
