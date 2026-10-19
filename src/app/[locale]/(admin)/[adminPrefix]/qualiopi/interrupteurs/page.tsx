/**
 * Admin — Qualiopi · Interrupteurs (chantier QNC).
 *
 * Chaque lot du chantier se livre éteint derrière sa clé `qualiopi.<lot>.actif`.
 * Cet écran liste les lots connus, lit leur état en base et permet de le changer
 * (eteint / essai / actif) ; chaque bascule est journalisée. Les interrupteurs
 * `formateurs.*` ont leur propre écran et ne sont pas ici.
 */

import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { InterrupteurQualiopiSelecteur } from "@/components/admin/qualiopi/InterrupteurQualiopiSelecteur";
import { gardePage } from "@/server/auth/garde-page";
import { basculerInterrupteurQualiopiAction } from "@/server/actions/qualiopi/interrupteurs-qualiopi";
import { lireLignesInterrupteurs } from "@/server/qualiopi/socle/lire-interrupteurs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Interrupteurs | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiInterrupteursPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const accesEcriture = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  const lignes = await lireLignesInterrupteurs();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Interrupteurs Qualiopi"
        description="Chaque lot du chantier Qualiopi se livre éteint. Éteint : le comportement d'avant. Actif : le lot agit pour tous."
      />
      <AdminCard>
        <p className="admin-meta-small">
          <strong>
            Essai = uniquement sur les sessions marquées ESSAI, jamais sur de vrais clients.
          </strong>{" "}
          Une clé absente vaut « éteint ». Chaque changement est inscrit au journal d&apos;activité.
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Ce qu&apos;il allume</th>
              <th>État actuel</th>
              <th>Changer l&apos;état</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.lot}>
                <td>
                  <strong>{l.libelle}</strong>
                  <div className="admin-meta-small">qualiopi.{l.lot}.actif</div>
                </td>
                <td className="admin-meta-small">{l.description}</td>
                <td>
                  <AdminBadge
                    tone={
                      l.etat === "actif" ? "success" : l.etat === "essai" ? "warning" : "neutral"
                    }
                  >
                    {l.etat === "actif" ? "Actif" : l.etat === "essai" ? "Essai" : "Éteint"}
                  </AdminBadge>
                </td>
                <td>
                  <InterrupteurQualiopiSelecteur
                    lot={l.lot}
                    libelle={l.libelle}
                    etat={l.etat}
                    action={basculerInterrupteurQualiopiAction}
                    desactive={!accesEcriture.autorise}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>
    </AdminPageShell>
  );
}
