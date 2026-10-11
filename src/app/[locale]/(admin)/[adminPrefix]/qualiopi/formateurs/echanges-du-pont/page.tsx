/**
 * Admin — Formateurs › Échanges du pont (U7-f, lot F-CAL-2).
 *
 * Les échanges formateur réservés depuis le 13/10, rattachés ou non à une candidature,
 * avec leur issue ou la mention « à trancher ». Le bouton fige la liste, relit auprès de
 * Calendly ceux qui n'ont pas de candidature, puis compare. Livré ÉTEINT : interrupteur
 * `formateurs.suivi_echange` absent = la page le dit et ne lit rien.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { formatDateFr } from "@/lib/format-date-fr";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import {
  listerEchangesDuPont,
  type EtatEchangePont,
} from "@/server/calendly/pont-echanges-formateur";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";

import { RelirePontForm } from "./RelirePontForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Échanges du pont | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const LIBELLE_ETAT: Readonly<Record<EtatEchangePont, string>> = {
  a_verifier: "À vérifier : aucune candidature rattachée",
  a_trancher: "À trancher : l'issue n'est pas notée",
  issue_notee: "Issue notée",
  a_venir: "À venir",
  annule: "Annulé",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function EchangesDuPontPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!peutEngager(acces.role, "habiliter_formateur")) {
    return (
      <AccesRefuse
        motif="Cette page est réservée à la direction et à la responsable qualité."
        retourHref={`/${locale}/${adminPrefix}`}
      />
    );
  }
  const allume = (await lireEtatsEntree()).suivi_echange;
  const lignes = allume
    ? await listerEchangesDuPont(new Date()).catch((err: unknown) => {
        console.error(
          "[formateurs/echanges-du-pont] lecture indisponible :",
          err instanceof Error ? err.name : "inconnue",
        );
        return null;
      })
    : [];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Échanges du pont"
        description="Les échanges formateur réservés depuis le 13 octobre : chacun doit avoir sa candidature et son issue."
      />
      {!allume ? (
        <p className="admin-alert admin-alert-info">
          Le suivi de l&apos;échange formateur n&apos;est pas encore allumé (écran Interrupteurs).
        </p>
      ) : lignes === null ? (
        <p className="admin-alert admin-alert-warning">Liste indisponible pour le moment.</p>
      ) : (
        <>
          <div className="admin-card">
            <RelirePontForm />
          </div>
          {lignes.length === 0 ? (
            <p className="admin-card">Aucun échange formateur depuis le 13 octobre.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Échange</th>
                  <th scope="col">État</th>
                  <th scope="col">Candidature</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/${locale}/${adminPrefix}/contacts/appels/${l.id}`}>
                        {l.debut ? formatDateFr(l.debut) : "Date inconnue"}
                      </Link>
                    </td>
                    <td>{LIBELLE_ETAT[l.etat]}</td>
                    <td>
                      {l.candidatureId ? (
                        <Link
                          href={`/${locale}/${adminPrefix}/contacts/candidatures/${l.candidatureId}`}
                        >
                          Ouvrir
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </AdminPageShell>
  );
}
