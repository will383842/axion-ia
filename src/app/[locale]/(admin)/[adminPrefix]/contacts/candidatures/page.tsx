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
import {
  AGE_MIN_JOURS,
  critereEligibleActuel,
  estActive as reponseAutoActive,
} from "@/server/careers/reponse-poste-pourvu";
import { basculerReponsePostePourvuAction } from "@/features/admin-job-applications/reponse-poste-pourvu-actions";
import { ApplicationsV2 } from "./_v2/ApplicationsV2";
import { PanneauMonteurs } from "./video/PanneauMonteurs";
import {
  lireOnglet,
  ongletDeLOffre,
  repartirOffres,
} from "@/features/admin-job-applications/onglets-candidatures";
import { AUCUNE_OFFRE_ID } from "@/features/admin-job-applications/reads";
import { FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { partagesActifs } from "@/server/partages/config";
import { fichiersPourComposeur } from "@/server/partages/suivi";

export const dynamic = "force-dynamic";

/** Un UUID qui ne désigne aucune offre : un onglet sans offre ne rend rien. */
const AUCUNE_UUID = "00000000-0000-4000-8000-000000000000";

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

  // ── L8b — LES ONGLETS (maquette v2) ─────────────────────────────────────
  // Les offres réellement présentes, rangées par onglet d'après leur adresse.
  // Sans `?vue=`, un lien `?offerId=X&status=new` s'ouvre dans l'onglet de
  // SON offre, filtres intacts.
  const offres = await getOffresAvecCandidatures();
  const slugs = new Map(
    (
      await prisma.jobOffer.findMany({
        where: { id: { in: offres.map((o) => o.id).filter((id) => id !== AUCUNE_OFFRE_ID) } },
        select: { id: true, slug: true },
      })
    ).map((o) => [o.id, o.slug]),
  );
  const offresSlug = offres.map((o) => ({
    ...o,
    slug: o.id === AUCUNE_OFFRE_ID ? null : (slugs.get(o.id) ?? ""),
  }));
  const repartition = repartirOffres(offresSlug);
  const offreFiltree = sp.offerId ? offresSlug.find((o) => o.id === sp.offerId) : undefined;
  const onglet = lireOnglet(sp.vue, offreFiltree ? ongletDeLOffre(offreFiltree.slug) : undefined);
  const offresDeLOnglet =
    onglet === "formulaire" ? offres : offresSlug.filter((o) => ongletDeLOffre(o.slug) === onglet);
  // Le périmètre de l'onglet, quand aucune offre précise n'est choisie.
  const perimetre =
    sp.offerId || onglet === "formulaire"
      ? {}
      : onglet === "spontanees"
        ? { offerId: AUCUNE_OFFRE_ID }
        : onglet === "autres"
          ? { offerIdNotIn: [...repartition.ids.monteurs, ...repartition.ids.formateurs] }
          : { offerIdIn: repartition.ids[onglet].length ? repartition.ids[onglet] : [AUCUNE_UUID] };

  // « Par le formulaire de contact » : les messages /contact « recrutement »
  // hors dossiers apporteurs (ils vivent dans « Autres »). Compteur seulement.
  const [recrutementContact, recrutementApporteurs] = await Promise.all([
    prisma.submission
      .count({
        where: {
          deletedAt: null,
          archivedAt: null,
          details: { path: ["unifiedType"], equals: "recrutement" },
        },
      })
      .catch(() => 0),
    prisma.submission
      .count({ where: { deletedAt: null, archivedAt: null, ...FILTRE_APPORTEUR_PRISMA } })
      .catch(() => 0),
  ]);

  const r = await listApplicationsAction({
    ...(sp.offerId ? { offerId: sp.offerId } : perimetre),
    status: sp.status as never,
    // Toutes les offres de l'onglet (monteur comprise), chronologiques —
    // `?tri=ancien` inverse l'ordre.
    view: "all",
    tri: sp.tri === "ancien" ? "ancien" : "recent",
    onlyAttention,
    ...(recherche ? { search: recherche } : {}),
    page,
  });
  // Les puces d'étapes de l'onglet (même périmètre, sans le filtre d'étape).
  const puces = await prisma.jobApplication
    .groupBy({
      by: ["status"],
      where: sp.offerId
        ? { offerId: sp.offerId === AUCUNE_OFFRE_ID ? null : sp.offerId }
        : "offerId" in perimetre
          ? { offerId: null }
          : "offerIdNotIn" in perimetre
            ? { offerId: { notIn: perimetre.offerIdNotIn } }
            : "offerIdIn" in perimetre
              ? { offerId: { in: perimetre.offerIdIn } }
              : {},
      _count: { _all: true },
    })
    .then((g) => g.map((x) => ({ statut: x.status as string, compte: x._count._all })))
    .catch(() => []);

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
  const alerteRepos = page === 1 && !sp.offerId && !recherche && !onlyAttention && !sp.vue;
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

  // Réponse automatique « poste pourvu » (Will, 2026-09-28) : son état et ce
  // qu'elle a devant elle, affichés là où on regarde les candidatures.
  const [autoActive, autoEnAttente] = await Promise.all([
    reponseAutoActive(),
    critereEligibleActuel(new Date())
      .then((where) => prisma.jobApplication.count({ where }))
      .catch(() => 0),
  ]);

  // L6b — les fichiers à joindre à une réponse groupée (bibliothèque allumée
  // seulement). Accessoire : une lecture qui échoue retire la section.
  const fichiersEnMasse = partagesActifs()
    ? await fichiersPourComposeur()
        .then((l) =>
          l.map((f) => ({ id: f.id, titre: f.titre, libelleCategorie: f.libelleCategorie })),
        )
        .catch(() => null)
    : null;

  return (
    <ApplicationsV2
      onglets={{
        courant: onglet,
        compte: {
          ...repartition.compte,
          formulaire: Math.max(0, recrutementContact - recrutementApporteurs),
        },
        hrefFormulaire: `/fr/${adminPrefix}/contacts/autres`,
      }}
      panneauMonteurs={
        onglet === "monteurs" && !sp.offerId ? (
          <PanneauMonteurs
            adminPrefix={adminPrefix}
            searchParams={sp}
            acteur={{
              role: (session.user as { role?: string }).role ?? null,
              acteurId: session.user.id ?? "",
            }}
          />
        ) : null
      }
      puces={puces}
      fichiersEnMasse={fichiersEnMasse}
      reponseAuto={{
        active: autoActive,
        enAttente: autoEnAttente,
        ageMinJours: AGE_MIN_JOURS,
        basculer: basculerReponsePostePourvuAction,
      }}
      adminPrefix={adminPrefix}
      searchParams={sp}
      offres={offresDeLOnglet}
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
