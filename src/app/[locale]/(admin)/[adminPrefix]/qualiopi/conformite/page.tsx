// Qualiopi — « Conformité » fusionnée dans « Conformité & mode auditeur »
// (audit UX console 2026-08-01, phase 2) : les deux pages affichaient la même
// matrice de 32 indicateurs sous deux entrées de nav. La page canonique
// /qualiopi/mode-auditeur reprend la vue tableau dense (défaut) et les 3
// stat cards de cette page. Redirect 308, URL conservée (favoris, docs _AUDIT).

import { permanentRedirect, redirect } from "next/navigation";

import { auth } from "@/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function LegacyConformiteRedirect({ params }: PageProps): Promise<never> {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  permanentRedirect(`/fr/${adminPrefix}/qualiopi/mode-auditeur`);
}
