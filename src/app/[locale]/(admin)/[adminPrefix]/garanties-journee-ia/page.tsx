/**
 * Admin — Garantie Journée IA · suivi des remboursements (CGV art. 47.10, PR 2/3).
 *
 * Une ligne par échéance OUVERTE, la plus proche en tête. Les échéances sont CALCULÉES depuis les
 * dates saisies (jamais stockées). Couleur ET texte. Server Component, force-dynamic, noindex.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  BadgeEcheance,
  BadgeHorsDelai,
} from "@/components/admin/garanties-journee-ia/BadgeEcheance";
import { gardePage } from "@/server/auth/garde-page";
import { listerGaranties } from "@/server/garanties-journee-ia/lecture";
import { aujourdhuiParis, jourFr, lignesDeListe } from "@/lib/garantie-journee-ia/presentation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Garantie Journée IA — remboursements | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ clos?: string; archives?: string }>;
}

export default async function GarantiesJourneeIaPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const q = await searchParams;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const base = `/${locale}/${adminPrefix}/garanties-journee-ia`;
  const inclureClos = q.clos === "1";
  const { dossiers, tableAbsente } = await listerGaranties(q.archives === "1");
  const lignes = lignesDeListe(dossiers, aujourdhuiParis(), inclureClos);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Garantie Journée IA — remboursements"
        description="Échéances calculées depuis les dates saisies : rapport, demande écrite du client, réponse (15 j, sinon réputée acceptée ; demande hors délai : décision au cas par cas, jamais d'acceptation tacite) et virement (30 j)."
        actions={
          acces.peutEcrire ? (
            <AdminButton href={`${base}/nouveau`}>Nouveau dossier</AdminButton>
          ) : null
        }
      />
      {tableAbsente ? (
        <p role="alert" className="mb-4 rounded border border-[color:var(--color-admin-warning-fg)] bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)] p-3 text-sm">
          La table des garanties n&apos;est pas encore créée sur cette base (migration en attente).
        </p>
      ) : null}
      <p className="mb-3 text-sm">
        <Link href={inclureClos ? base : `${base}?clos=1`} className="underline">
          {inclureClos ? "Masquer les échéances closes" : "Afficher les échéances closes"}
        </Link>
      </p>
      {lignes.length === 0 ? (
        <p className="text-sm">Aucune échéance ouverte.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">Client</th>
              <th className="p-2">Échéance</th>
              <th className="p-2">Date</th>
              <th className="p-2">État</th>
              <th className="p-2">Prochaine action</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={`${l.dossierId}-${l.echeance.type}`} className="border-t">
                <td className="p-2">
                  <Link href={`${base}/${l.dossierId}`} className="underline">
                    {l.clientNom}
                  </Link>
                </td>
                <td className="p-2">
                  {l.echeance.libelle}
                  {l.reputeeAcceptee && l.echeance.type === "reponse"
                    ? " — demande réputée acceptée"
                    : ""}
                </td>
                <td className="p-2">{jourFr(l.echeance.date)}</td>
                <td className="p-2">
                  <BadgeEcheance etat={l.etat} />
                  {l.horsDelai ? (
                    <>
                      {" "}
                      <BadgeHorsDelai />
                    </>
                  ) : null}
                </td>
                <td className="p-2">{l.prochaineAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminPageShell>
  );
}
