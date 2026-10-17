/**
 * Admin — Formateurs › Rattrapage des candidatures (U7 b, lot L-INV).
 *
 * La liste NOMINATIVE, figée et datée, des candidatures de formateur indépendant reçues
 * depuis le 9 octobre qui n'ont reçu aucune invitation : une ligne par personne. Le bouton
 * envoie F55 (« nous revenons vers vous ») à CETTE liste seulement — si elle a changé
 * depuis l'affichage, rien ne part. Une seule fois, sans rappel. Livré ÉTEINT.
 */

import type { Metadata } from "next";
import Link from "next/link";

import {
  INTERRUPTEURS,
  INTERRUPTEURS_ENTREE,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { formatDateFr } from "@/lib/format-date-fr";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { invitationAutoFormateursAllumee } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { listerRattrapage } from "@/server/qualiopi/formateurs-independants/invitation-formateurs";

import { EnvoyerRattrapageForm } from "./EnvoyerRattrapageForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Rattrapage des candidatures | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function RattrapagePage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!peutEngager(acces.role, "contresigner")) {
    return (
      <AccesRefuse
        motif="Cette page est réservée à l'administrateur."
        retourHref={`/${locale}/${adminPrefix}`}
      />
    );
  }
  const allume = await invitationAutoFormateursAllumee();
  const maintenant = new Date();
  const liste = allume
    ? await listerRattrapage(maintenant).catch((err: unknown) => {
        console.error(
          "[formateurs/rattrapage] lecture indisponible :",
          err instanceof Error ? err.name : "inconnue",
        );
        return null;
      })
    : null;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Rattrapage des candidatures"
        description="Les candidatures de formateur indépendant reçues depuis le 9 octobre, jamais invitées : une seule invitation, sans rappel, après votre relecture."
      />
      {!allume ? (
        <p className="admin-alert admin-alert-info">
          Cet écran n&apos;est pas encore ouvert : il s&apos;allume avec les interrupteurs «{" "}
          {INTERRUPTEURS.invitation_auto.libelle} » et «{" "}
          {INTERRUPTEURS_ENTREE.suivi_echange.libelle} », dans{" "}
          <Link href={`/${locale}/${adminPrefix}/qualiopi/formateurs/interrupteurs`}>
            l&apos;écran Interrupteurs
          </Link>
          .
        </p>
      ) : liste === null ? (
        <p className="admin-alert admin-alert-warning">Liste indisponible pour le moment.</p>
      ) : (
        <>
          <p className="admin-card">
            Liste figée le {formatDateFr(maintenant)} : {liste.lignes.length} personne(s). Si elle
            change avant votre clic, rien ne part.
          </p>
          {liste.lignes.length > 0 ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Personne</th>
                  <th scope="col">Candidature reçue le</th>
                </tr>
              </thead>
              <tbody>
                {liste.lignes.map((l) => (
                  <tr key={l.candidatureId}>
                    <td>
                      <Link
                        href={`/${locale}/${adminPrefix}/contacts/candidatures/${l.candidatureId}`}
                      >
                        {l.nom}
                      </Link>
                    </td>
                    <td>{formatDateFr(l.recueLe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <div className="admin-card">
            <EnvoyerRattrapageForm empreinte={liste.empreinte} nombre={liste.lignes.length} />
          </div>
        </>
      )}
    </AdminPageShell>
  );
}
