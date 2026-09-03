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
import { getSourcesCandidatures } from "@/features/admin-job-applications/annonces-stats";
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

  // La recherche libre n'existe QUE sur les vues mono-table : elle porte sur
  // des colonnes chiffrées de `JobApplication`, et la vue fusionnée mélange
  // deux tables dont une seule sait la faire. Un champ qui ne filtrerait que la
  // moitié des lignes serait pire que pas de champ.
  const recherche = sp.q?.trim() || undefined;

  let result: {
    items: ReadonlyArray<CandidatureUnifieeItem>;
    total: number;
    page: number;
    totalPages: number;
    balayageTronque?: boolean;
  };
  // Sous-onglets par canal d'annonce — n'ont de sens que dans la vue
  // apporteurs. Ailleurs le paramètre est ignoré plutôt que rejeté : un lien
  // partagé qui traîne un `?source=` ne doit pas casser une autre vue.
  const source = view === "memo" && sp.source ? sp.source : undefined;
  if (view === "memo" || (view === "all" && !sp.offerId && !recherche)) {
    result = await listCandidaturesUnifieesAction({
      scope: view === "memo" ? "memo" : "toutes",
      ...(source ? { source } : {}),
      onlyAttention,
      page,
    });
  } else {
    // Vues mono-table (monteur / standard / lien depuis une fiche offre) :
    // l'action historique garde ses filtres statut + offre.
    const r = await listApplicationsAction({
      offerId: sp.offerId,
      status: sp.status as never,
      // Une recherche depuis l'onglet « Toutes » bascule sur la vue emploi
      // complète : c'est la seule où elle a un sens, et rendre zéro résultat
      // aurait laissé croire que le candidat n'existe pas.
      view: view === "all" && recherche ? "all" : view,
      onlyAttention,
      ...(recherche ? { search: recherche } : {}),
      page,
    });
    result = {
      ...r,
      balayageTronque: r.balayageTronque,
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
      sources={view === "memo" ? await getSourcesCandidatures() : []}
      activeSource={source}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      balayageTronque={result.balayageTronque ?? false}
    />
  );
}
