// Monteurs & vidéastes — les candidatures VIDÉO FREELANCE, prix côte à côte.
//
// Demande Will 2026-09-26 : « que les monteurs et ceux qui filment soient bien
// visibles » dans la console. L'onglet « Monteur vidéo » retiré le 2026-09-23
// ne montrait qu'une liste de noms, comme toutes les autres offres ; ce qui
// manquait, c'était de LIRE LES PRIX sans ouvrir chaque fiche. Cette vue a une
// raison d'exister que le sélecteur d'offre n'a pas : une colonne par question
// de l'offre (tarifs, matériel, déplacement, liens), un tableau par offre.
//
// Lot L1 « Candidatures unifiées » (2026-10-07) : la liste se CLASSE par prix
// (clic sur l'en-tête d'un prix ; par défaut le prix obligatoire, du moins cher
// au plus cher), se filtre par prix maximum, ville et étape (paramètres
// d'adresse : la vue reste un composant serveur, sans JavaScript pour trier), et
// le bouton « ▶ N vidéos » ouvre un panneau qui les lit sans quitter la liste.
// Sur téléphone, le tableau défile horizontalement (comme les autres tableaux).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader, AdminEmptyState } from "@/components/admin/ui";
import {
  listerCandidaturesVideoFreelance,
  lireEtape,
  type FiltresVideo,
} from "@/features/admin-job-applications/video-freelance";
import { montantEnCentimes } from "@/lib/careers/screening-answers";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { Filtres, TableauOffre, type Etat } from "./TableauVideo";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function un(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function CandidaturesVideoPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  const etape = lireEtape(un(sp.etape));
  const prixMaxCentimes = montantEnCentimes(un(sp.prixMax));
  const etat: Etat = {
    tri: un(sp.tri).slice(0, 80),
    sens: un(sp.sens) === "desc" ? "desc" : "asc",
    prixMax: prixMaxCentimes !== null ? un(sp.prixMax).slice(0, 20) : "",
    ville: un(sp.ville).slice(0, 80),
    etape: etape ?? "",
  };
  const filtres: FiltresVideo = {
    tri: etat.tri || null,
    sens: etat.sens,
    prixMaxCentimes,
    ville: etat.ville || null,
    etape,
  };

  const role = (session.user as { role?: string }).role ?? null;
  const offres = await listerCandidaturesVideoFreelance(
    { role, acteurId: session.user.id },
    filtres,
  );
  const base = `/fr/${adminPrefix}/contacts/candidatures`;
  const chemin = `${base}/video`;
  const total = offres.reduce((n, o) => n + o.total, 0);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Monteurs & vidéastes"
        description={`${total} candidature${total > 1 ? "s" : ""} vidéo freelance · tarifs, matériel et exemples côte à côte`}
      />
      {offres.length === 0 ? (
        <AdminEmptyState title="Aucune offre vidéo freelance en base." />
      ) : (
        <>
          <Filtres etat={etat} chemin={chemin} ouvert={peutOuvrirDossierCandidat(role)} />
          {offres.map((o) => (
            <TableauOffre key={o.slug} offre={o} base={base} chemin={chemin} etat={etat} />
          ))}
        </>
      )}
    </AdminPageShell>
  );
}
