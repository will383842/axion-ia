// Une rubrique du dossier société — route dynamique adossée à la SSOT.
//
// POURQUOI UNE ROUTE DYNAMIQUE plutôt que cinq pages jumelles : ajouter une
// rubrique doit se faire à UN endroit (`rubriques.ts`). Cinq fichiers recopiés
// auraient divergé au premier écran qui gagne une option — ce dépôt a déjà payé
// ce motif plusieurs fois.
//
// Les segments STATIQUES voisins (`identite`, `fichiers`) l'emportent sur ce
// segment dynamique dans le routeur Next : ils ne passent jamais ici. Un
// segment inconnu tombe en 404 plutôt que d'afficher une page vide.

import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { SocieteDocRubriqueView } from "@/components/admin/societe-documents/SocieteDocRubriqueView";
import { SocieteTabs } from "@/components/admin/societe-documents/SocieteTabs";
import { getRubriqueBySegment } from "@/server/societe-documents/rubriques";

export const dynamic = "force-dynamic";

const ROLES_LECTURE = new Set(["super_admin", "admin", "editor"]);

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; rubrique: string }>;
}

export default async function SocieteRubriquePage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { locale, adminPrefix, rubrique } = await params;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !ROLES_LECTURE.has(role ?? "")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  if (!getRubriqueBySegment(rubrique)) notFound();

  return (
    <>
      <SocieteTabs adminPrefix={adminPrefix} actif={rubrique} />
      <SocieteDocRubriqueView segment={rubrique} adminPrefix={adminPrefix} />
    </>
  );
}
