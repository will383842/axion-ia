// Listing admin des candidatures. Sous-onglets (demande Will 2026-08-13) :
// « Toutes » (emploi + commerciales fusionnées), « Monteur vidéo » (flux
// séparé, jamais mélangé), « Mémo Isère » (candidatures commerciales du
// tunnel /devenir-commercial-ia/candidature). `view=standard` reste accepté
// pour les anciens liens (emploi hors monteur).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listApplicationsAction,
  listCandidaturesUnifieesAction,
} from "@/features/admin-job-applications/actions";
import type { CandidatureUnifieeItem } from "@/features/admin-job-applications/actions";
import { ApplicationsV2 } from "./_v2/ApplicationsV2";
import type { CandidaturesView } from "./_v2/ApplicationsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ApplicationsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const view: CandidaturesView =
    sp.view === "monteur"
      ? "monteur"
      : sp.view === "memo"
        ? "memo"
        : sp.view === "standard"
          ? "standard"
          : "all";
  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const onlyAttention = sp.attention === "1";

  let result: {
    items: ReadonlyArray<CandidatureUnifieeItem>;
    total: number;
    page: number;
    totalPages: number;
  };
  if (view === "memo" || (view === "all" && !sp.offerId)) {
    result = await listCandidaturesUnifieesAction({
      scope: view === "memo" ? "memo" : "toutes",
      onlyAttention,
      page,
    });
  } else {
    // Vues mono-table (monteur / standard / lien depuis une fiche offre) :
    // l'action historique garde ses filtres statut + offre.
    const r = await listApplicationsAction({
      offerId: sp.offerId,
      status: sp.status as never,
      view,
      onlyAttention,
      page,
    });
    result = {
      ...r,
      items: r.items.map((a): CandidatureUnifieeItem => ({
        id: a.id,
        source: "emploi",
        offerLabel: a.offerTitleSnap,
        contactName: a.contactName,
        contactEmail: a.contactEmail,
        status: a.status,
        hasCv: a.hasCv,
        needsAttention: a.needsAttention,
        submittedAt: a.submittedAt,
      })),
    };
  }

  return (
    <ApplicationsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      view={view}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}
