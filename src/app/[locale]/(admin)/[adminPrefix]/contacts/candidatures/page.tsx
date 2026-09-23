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
// 🔑 Résolution du rebase (2026-09-23) : `listCandidaturesUnifieesAction`,
//    `CandidatureUnifieeItem` et `getSourcesCandidatures` NE reviennent PAS.
//    Ils servaient la vue « Apporteurs d'affaires », retirée de cet écran parce
//    qu'elle montrait une seconde fois les 12 lignes de `/contacts/commercial`
//    et mêlait deux vocabulaires de statut. Le bandeau du dossier le plus
//    ancien, lui, s'ajoute.
import {
  listerDossiersEnSommeil,
  plusAncienJamaisRepondu,
} from "@/server/careers/dossiers-en-sommeil";
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

  // ── LE PLUS ANCIEN DOSSIER JAMAIS RÉPONDU — visible LÀ OÙ ON TRAVAILLE ────
  //
  // 🔴 `/pilotage` porte déjà ce chiffre, et c'est un écran que personne
  // n'ouvre : un dossier oublié depuis deux mois s'y perd au milieu d'une
  // médiane et d'un tableau par statut. La liste, elle, se recharge à chaque
  // filtre — c'est ici qu'on regarde en travaillant.
  //
  // Calculé seulement sur l'atterrissage NORMAL (première page, aucun filtre
  // actif) : c'est l'écran que tout le monde voit d'abord, et la requête
  // (bornée à 500 lignes) n'a pas de raison de tourner sur chaque page filtrée
  // qu'on visite ensuite.
  //
  // 🔑 Le test `view === "all"` a disparu au rebase du 2026-09-23, et ce n'est
  //    pas une perte : depuis la PR 1148 cet écran n'a plus de vues du tout — les
  //    onglets « Monteur vidéo » et « Apporteurs d'affaires » ont cédé la place
  //    à un sélecteur d'offre. Il n'y a donc plus qu'un atterrissage possible,
  //    et c'est celui-ci.
  const alerteRepos = page === 1 && !sp.offerId && !recherche && !onlyAttention;
  const plusAncien = alerteRepos
    ? plusAncienJamaisRepondu(
        (
          await listerDossiersEnSommeil(
            new Date(),
            (session.user as { role?: string }).role ?? null,
          )
        ).dossiers,
      )
    : null;

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
      plusAncienJamaisRepondu={
        plusAncien
          ? {
              id: plusAncien.id,
              offerTitleSnap: plusAncien.offerTitleSnap,
              jours: plusAncien.jours,
            }
          : null
      }
    />
  );
}
