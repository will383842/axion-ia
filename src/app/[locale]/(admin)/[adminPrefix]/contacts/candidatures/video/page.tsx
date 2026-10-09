// Monteurs & vidéastes — ancienne adresse (lot L1, 2026-09-26).
//
// L8b (Candidatures unifiées, 2026-10-09) : le panneau des prix est devenu
// l'onglet « Monteurs & vidéastes » de la liste des candidatures
// (`PanneauMonteurs.tsx`, mêmes composants, même tri). Cette adresse
// REDIRIGE vers l'onglet, paramètres compris : un favori ou un lien partagé
// ouvre la même vue, filtres et tri conservés.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CandidaturesVideoPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams({ vue: "monteurs" });
  for (const cle of ["tri", "sens", "prixMax", "ville", "etape"]) {
    const v = sp[cle];
    const un = Array.isArray(v) ? v[0] : v;
    if (un) q.set(cle, un);
  }
  redirect(`/fr/${adminPrefix}/contacts/candidatures?${q.toString()}`);
}
