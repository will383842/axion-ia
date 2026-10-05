// Réseau d'apporteurs (démarrage manuel, 2026-10-05) — la liste des apporteurs :
// à vérifier, dossiers en cours, signés. Chaque ligne ouvre la fiche.

import Link from "next/link";

import { AdminPageHeader, AdminStatCard } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { NouvelApporteurForm } from "@/components/admin/apporteurs/fiche/BlocsFiche";
import {
  LIBELLE_STATUT_APPORTEUR,
  listerApporteurs,
} from "@/features/apporteurs-reseau/requetes-console";
import { euros } from "@/features/apporteurs-reseau/regles";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const ONGLETS = [
  { cle: "a_verifier", libelle: "À vérifier", statuts: ["a_verifier"] },
  { cle: "en_cours", libelle: "Dossiers en cours", statuts: ["dossier_en_cours", "a_completer"] },
  { cle: "signes", libelle: "Signés", statuts: ["signe"] },
  { cle: "fermes", libelle: "Fermés", statuts: ["refuse", "resilie"] },
] as const;

const fr = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

export default async function ApporteursPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/apporteurs`;
  const tous = await listerApporteurs();
  const ongletParDefaut = tous.some((a) => a.statut === "a_verifier") ? "a_verifier" : "signes";
  const onglet =
    ONGLETS.find((o) => o.cle === sp.onglet) ?? ONGLETS.find((o) => o.cle === ongletParDefaut)!;
  const lignes = tous.filter((a) => (onglet.statuts as readonly string[]).includes(a.statut));
  const compte = (statuts: readonly string[]) =>
    tous.filter((a) => statuts.includes(a.statut)).length;

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Apporteurs"
        description="Les apporteurs du réseau : leur dossier, leur contrat, les entreprises qu'ils présentent et leurs commissions."
        actions={<NouvelApporteurForm base={base} />}
      />
      <div className="grid grid-cols-2 gap-[var(--space-admin-3)] md:grid-cols-4">
        <AdminStatCard
          label="À vérifier"
          value={compte(["a_verifier"])}
          href={`${base}?onglet=a_verifier`}
        />
        <AdminStatCard
          label="Dossiers en cours"
          value={compte(["dossier_en_cours", "a_completer"])}
          href={`${base}?onglet=en_cours`}
        />
        <AdminStatCard label="Signés" value={compte(["signe"])} href={`${base}?onglet=signes`} />
        <AdminStatCard
          label="Commissions à verser"
          value={euros(tous.reduce((s, a) => s + a.commissionsDuesCents, 0))}
          href={`${base}/commissions`}
        />
      </div>
      <nav aria-label="Filtrer" className="flex flex-wrap gap-[var(--space-admin-2)]">
        {ONGLETS.map((o) => (
          <Link
            key={o.cle}
            href={`${base}?onglet=${o.cle}`}
            aria-current={o.cle === onglet.cle ? "page" : undefined}
            className={o.cle === onglet.cle ? "admin-button" : "admin-button-secondary"}
          >
            {o.libelle} ({compte(o.statuts)})
          </Link>
        ))}
        <Link href={`${base}/entreprises`} className="admin-button-secondary">
          Entreprises présentées
        </Link>
      </nav>
      {lignes.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">
          Aucun apporteur ici pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full text-left text-[length:var(--text-admin-sm)]">
            <thead className="bg-[color:var(--color-admin-surface-sunken)]">
              <tr>
                <th className="p-[var(--space-admin-3)]">Apporteur</th>
                <th className="p-[var(--space-admin-3)]">État</th>
                <th className="p-[var(--space-admin-3)]">Entreprises</th>
                <th className="p-[var(--space-admin-3)]">À verser</th>
                <th className="p-[var(--space-admin-3)]">Versé</th>
                <th className="p-[var(--space-admin-3)]">Depuis</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((a) => (
                <tr key={a.id} className="border-t border-[color:var(--color-admin-border)]">
                  <td className="p-[var(--space-admin-3)]">
                    <Link
                      href={`${base}/${a.id}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {a.nom}
                    </Link>
                    {a.denomination ? (
                      <div className="text-[color:var(--color-admin-fg-muted)]">
                        {a.denomination}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-[var(--space-admin-3)]">{LIBELLE_STATUT_APPORTEUR[a.statut]}</td>
                  <td className="p-[var(--space-admin-3)]">{a.entreprises}</td>
                  <td className="p-[var(--space-admin-3)]">{euros(a.commissionsDuesCents)}</td>
                  <td className="p-[var(--space-admin-3)]">{euros(a.commissionsVerseesCents)}</td>
                  <td className="p-[var(--space-admin-3)]">
                    {fr(a.signeParSocieteAt ?? a.creeAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
