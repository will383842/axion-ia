// Suivi des candidatures — ancienne adresse.
//
// L8b/L8e (Candidatures unifiées, 2026-10-09) : l'écran quitte le menu. Ce
// qu'il servait à rattraper — le dossier le plus ancien resté sans réponse —
// est dit en tête de la liste des candidatures (bandeau rouge, « Ouvrir le
// dossier »), et « À traiter » y filtre les dossiers qui attendent. Cette
// adresse REDIRIGE donc vers la liste : un favori ou une notification déjà
// envoyée ne tombe jamais sur une page morte.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SuiviCandidaturesPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  redirect(`/fr/${adminPrefix}/contacts/candidatures`);
}
