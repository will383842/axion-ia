// L8b — LE PANNEAU « MONTEURS & VIDÉASTES », onglet de la liste des
// candidatures (`/contacts/candidatures?vue=monteurs`).
//
// C'est la vue du lot L1 (tri par prix, filtres prix maximum / ville / statut,
// lecteur « ▶ N vidéos ») DÉPLACÉE dans l'onglet, à l'identique : mêmes
// composants (`TableauOffre`, `Filtres`), même lecture. L'ancienne adresse
// `/contacts/candidatures/video` redirige ici, paramètres compris.

import { AdminEmptyState } from "@/components/admin/ui";
import {
  listerCandidaturesVideoFreelance,
  lireEtape,
  type FiltresVideo,
} from "@/features/admin-job-applications/video-freelance";
import { montantEnCentimes } from "@/lib/careers/screening-answers";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { Filtres, TableauOffre, type Etat } from "./TableauVideo";

function un(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export async function PanneauMonteurs({
  adminPrefix,
  searchParams: sp,
  acteur,
}: {
  adminPrefix: string;
  searchParams: Record<string, string | string[] | undefined>;
  acteur: { role: string | null; acteurId: string };
}): Promise<React.ReactElement> {
  const etape = lireEtape(un(sp.etape));
  const prixMaxCentimes = montantEnCentimes(un(sp.prixMax));
  const etat: Etat = {
    vue: "monteurs",
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
  const offres = await listerCandidaturesVideoFreelance(acteur, filtres);
  const base = `/fr/${adminPrefix}/contacts/candidatures`;
  if (offres.length === 0) {
    return <AdminEmptyState title="Aucune offre vidéo freelance en base." />;
  }
  return (
    <>
      <Filtres etat={etat} chemin={base} ouvert={peutOuvrirDossierCandidat(acteur.role)} />
      {offres.map((o) => (
        <TableauOffre key={o.slug} offre={o} base={base} chemin={base} etat={etat} />
      ))}
    </>
  );
}
