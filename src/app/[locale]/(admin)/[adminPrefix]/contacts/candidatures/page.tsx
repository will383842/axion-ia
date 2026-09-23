// Listing admin des candidatures EMPLOI, uniquement.
//
// 🔴 2026-09-23 — REFONTE (mesure prod) : cet écran fusionnait 164
// candidatures emploi (34 offres) avec les 12 candidatures « Apporteurs
// d'affaires », qui ont pourtant DÉJÀ leur propre onglet
// (`/contacts/commercial`, table `Submission`) — deux portes vers les mêmes
// lignes, avec deux vocabulaires de statut mélangés dans la vue « Toutes ».
// La fusion (`listCandidaturesUnifieesAction`) est retirée de CET écran ;
// elle reste utilisable ailleurs (voir son propre test). L'onglet « Monteur
// vidéo » — une offre sur 34 promue au rang d'onglet — est remplacé par un
// sélecteur qui liste TOUTES les offres ayant au moins une candidature.
//
// Les deux anciens paramètres `?view=memo` et `?view=monteur` restent
// compris : ils redirigent vers l'équivalent actuel plutôt que de casser un
// lien déjà partagé (favori, message Telegram, etc.).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listApplicationsAction } from "@/features/admin-job-applications/actions";
import { getOffresAvecCandidatures } from "@/features/admin-job-applications/reads";
import { VIDEO_EDITOR_OFFER_SLUG } from "@/lib/careers/video-editor-offer";
import { ApplicationsV2 } from "./_v2/ApplicationsV2";

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

  // Bookmark historique « Apporteurs d'affaires » (retiré 2026-09-23) : ses
  // lignes vivent dans `/contacts/commercial`, jamais ici.
  if (sp.view === "memo") {
    redirect(`/fr/${adminPrefix}/contacts/commercial`);
  }
  // Bookmark historique « Monteur vidéo » (retiré 2026-09-23, remplacé par le
  // sélecteur d'offre) : converti en filtre `offerId`, pour ne pas perdre un
  // lien déjà partagé. Offre introuvable (dépubliée depuis) → liste complète.
  if (sp.view === "monteur" && !sp.offerId) {
    const offre = await prisma.jobOffer.findUnique({
      where: { slug: VIDEO_EDITOR_OFFER_SLUG },
      select: { id: true },
    });
    redirect(
      offre
        ? `/fr/${adminPrefix}/contacts/candidatures?offerId=${offre.id}`
        : `/fr/${adminPrefix}/contacts/candidatures`,
    );
  }

  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const onlyAttention = sp.attention === "1";
  const recherche = sp.q?.trim() || undefined;

  const [r, offres] = await Promise.all([
    listApplicationsAction({
      offerId: sp.offerId,
      status: sp.status as never,
      // Toutes les offres, monteur vidéo comprise : l'ancienne exclusion
      // n'avait de sens que face à un onglet dédié, qui n'existe plus. Le
      // filtre par offre (sélecteur) remplace la distinction d'onglet.
      view: "all",
      onlyAttention,
      ...(recherche ? { search: recherche } : {}),
      page,
    }),
    // Alimente le sélecteur — indépendant de la page/du filtre courants : la
    // liste des offres proposées ne doit pas rétrécir quand on en choisit une.
    getOffresAvecCandidatures(),
  ]);

  return (
    <ApplicationsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      offres={offres}
      items={r.items}
      total={r.total}
      page={r.page}
      totalPages={r.totalPages}
      balayageTronque={r.balayageTronque ?? false}
    />
  );
}
