/**
 * Admin — Formateurs freelance › Dossiers et contrats (lot L8).
 *
 * Une ligne = un formateur indépendant et son étape calculée ; trois cartes
 * de compteurs ; des onglets. Maquette : `maquette-formateurs-freelance-console.html`.
 *
 * 🔴 LIVRÉ ÉTEINT : `formateurs.dossiers_contrats` (ou le groupe
 * `formateurs.menu_freelance`) coupé ou absent = la page l'annonce et ne lit rien.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { gardePage } from "@/server/auth/garde-page";
import { lireDossiersEtContrats } from "@/server/qualiopi/formateurs-independants/dossiers-et-contrats-lecture";
import {
  LIBELLES_ONGLETS,
  ORDRE_ONGLETS,
  compterParOnglet,
  estOnglet,
} from "@/server/qualiopi/formateurs-independants/etape-parcours-independant";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Dossiers et contrats | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ onglet?: string }>;
}

export default async function DossiersEtContratsPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const entree = await lireEtatsEntree();
  if (!entree.dossiers_contrats || !entree.menu_freelance) {
    return (
      <AdminPageShell>
        <AdminPageHeader title="Dossiers et contrats" />
        <AdminCard>
          <p>Cet écran n&apos;est pas encore ouvert.</p>
        </AdminCard>
      </AdminPageShell>
    );
  }

  const { onglet: brut } = await searchParams;
  const onglet = estOnglet(brut) ? brut : "a_verifier";
  const lignes = await lireDossiersEtContrats();
  const compteurs = compterParOnglet(lignes.map((l) => l.etape));
  const visibles = lignes.filter((l) => l.etape.onglet === onglet);
  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;

  return (
    <AdminPageShell>
      <AdminPageHeader title="Dossiers et contrats" description="Formateurs freelance" />
      <div className="grid grid-cols-2 gap-[var(--space-admin-2)] md:grid-cols-3">
        <AdminStatCard label="Actifs" value={compteurs.actifs} />
        <AdminStatCard label="À vérifier" value={compteurs.a_verifier} />
        <AdminStatCard label="Dossier en cours" value={compteurs.dossier_en_cours} />
      </div>
      <nav className="flex flex-wrap gap-[var(--space-admin-2)]" aria-label="Onglets">
        {ORDRE_ONGLETS.map((o) => (
          <Link
            key={o}
            href={`${base}/dossiers?onglet=${o}`}
            className={o === onglet ? "admin-button" : "admin-button-ghost"}
            aria-current={o === onglet ? "page" : undefined}
          >
            {LIBELLES_ONGLETS[o]} ({compteurs[o]})
          </Link>
        ))}
      </nav>
      <AdminCard>
        {visibles.length === 0 ? (
          <p className="admin-meta-small">Rien dans cet onglet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Formateur</th>
                <th>Étape</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={l.trainerId}>
                  <td>
                    <Link href={`${base}/${l.trainerId}`}>{l.nomAffiche}</Link>
                    {l.estTestInterne ? <AdminBadge tone="outline">Test</AdminBadge> : null}
                  </td>
                  <td>{l.etape.libelle}</td>
                  <td>
                    <Link className="admin-button-ghost" href={`${base}/${l.trainerId}`}>
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
