/**
 * Admin — Formateurs freelance › À faire maintenant (lot F, écran W-2).
 *
 * Les gestes que l'outil ne fait pas seul, rangés par rubrique : la liste vient du REGISTRE
 * des gestes humains (`gestes-humains.ts`), pas d'une copie. En tête, les deux compteurs
 * qui attendent l'équipe (dossiers à vérifier, missions à traiter), quand leur page est
 * ouverte ; en pied, les liens vers les pages que le menu ne montre pas.
 *
 * 🔴 LIVRÉ ÉTEINT : `formateurs.menu_freelance` coupé ou absent = la page l'annonce et ne lit
 * rien d'autre.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { EcranPasEncoreOuvert } from "@/components/admin/qualiopi/EcranPasEncoreOuvert";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { compterFormateursNav } from "@/server/qualiopi/formateurs-independants/nav-counts";
import { gardePage } from "@/server/auth/garde-page";
import { INTERRUPTEURS_ENTREE } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import {
  blocsAFaire,
  liensAnnexes,
} from "@/server/qualiopi/formateurs-independants/a-faire-maintenant";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — À faire maintenant | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function AFaireMaintenantPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const entree = await lireEtatsEntree();
  if (!entree.menu_freelance) {
    return (
      <EcranPasEncoreOuvert
        titre="À faire maintenant"
        interrupteurs={[INTERRUPTEURS_ENTREE.menu_freelance.libelle]}
        base={`/${locale}/${adminPrefix}`}
      />
    );
  }

  const [missionsOuvertes, miseANiveau] = await Promise.all([
    interrupteurAllume("missions_console"),
    interrupteurAllume("mise_a_niveau"),
  ]);
  const compteurs = await compterFormateursNav({
    dossiers: entree.dossiers_contrats,
    missions: missionsOuvertes,
    honoraires: false,
  });
  const adminBase = `/${locale}/${adminPrefix}`;
  const blocs = blocsAFaire(adminBase);
  const liens = liensAnnexes(adminBase, {
    suivi_echange: entree.suivi_echange,
    mise_a_niveau: miseANiveau,
  });

  return (
    <AdminPageShell>
      <AdminPageHeader title="À faire maintenant" description="Formateurs freelance" />
      {entree.dossiers_contrats || missionsOuvertes ? (
        <div className="grid grid-cols-2 gap-[var(--space-admin-2)] md:grid-cols-3">
          {entree.dossiers_contrats ? (
            <AdminStatCard label="Dossiers à vérifier" value={compteurs.dossiers} />
          ) : null}
          {missionsOuvertes ? (
            <AdminStatCard label="Missions à traiter" value={compteurs.missions} />
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-[var(--space-admin-3)] md:grid-cols-2">
        {blocs.map((b) => (
          <AdminCard key={b.rubrique}>
            <div className="flex items-center justify-between gap-[var(--space-admin-2)]">
              <h2 className="font-semibold">{b.titre}</h2>
              <AdminBadge tone="outline">{b.gestes.length}</AdminBadge>
            </div>
            <ul className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]">
              {b.gestes.map((g) => (
                <li key={g.id}>
                  <span>{g.geste}</span> <span className="admin-meta-small">{g.frequence}</span>
                </li>
              ))}
            </ul>
            <div className="mt-[var(--space-admin-3)]">
              <Link className="admin-button-ghost" href={b.href}>
                Ouvrir
              </Link>
            </div>
          </AdminCard>
        ))}
      </div>
      <nav className="flex flex-wrap gap-[var(--space-admin-2)]" aria-label="Autres écrans">
        {liens.map((l) => (
          <Link key={l.href} className="admin-button-ghost" href={l.href}>
            {l.libelle}
          </Link>
        ))}
      </nav>
    </AdminPageShell>
  );
}
