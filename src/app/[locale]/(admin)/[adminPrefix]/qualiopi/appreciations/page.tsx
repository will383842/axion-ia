/**
 * Admin — Qualiopi · Appréciations multi-parties (T14 / off.30).
 *
 * Liste les appréciations + statistiques de notes par source +
 * formulaire de création. Server Component.
 *
 * off.30 : recueil structuré des retours stagiaire/entreprise/financeur/formateur
 *          (≠ réclamations off.31).
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import {
  creerAppreciationAction,
  listAppreciationsAction,
  statsAppreciationsAction,
} from "@/server/actions/qualiopi/appreciations";
import { AppreciationForm } from "@/components/admin/qualiopi/AppreciationForm";
import { listerOptionsAppreciation } from "@/server/qualiopi/appreciations/options";
import {
  resoudreRattachementsAppreciations,
  type RattachementsAppreciation,
} from "@/server/qualiopi/appreciations/rattachements";
import { Hash, Gauge, UserCheck, Users, GraduationCap } from "lucide-react";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Appréciations | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const SOURCE_LABELS: Record<string, string> = {
  stagiaire: "Stagiaire",
  entreprise: "Entreprise",
  financeur: "Financeur",
  formateur: "Formateur",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiAppreciationsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const [appreciations, stats, options] = await Promise.all([
    listAppreciationsAction({ limit: 100 }),
    statsAppreciationsAction(),
    // Listes de rattachement — remplacent la saisie d'UUID à la main.
    listerOptionsAppreciation(),
  ]);
  // Libellés de la colonne « Rattachée à » : une requête groupée par table,
  // jamais une par ligne.
  const rattachements = await resoudreRattachementsAppreciations(appreciations);
  const base = `/${locale}/${adminPrefix}`;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  function renderNote(note: number | null) {
    if (note === null) return <span className="text-[color:var(--color-admin-fg-muted)]">—</span>;
    return (
      <span className="font-medium">
        {note}
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          /5
        </span>
      </span>
    );
  }

  const lienCls =
    "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline focus-visible:underline";

  function renderRattachements(r: RattachementsAppreciation | undefined) {
    const liens: { cle: string; prefixe: string; href: string; libelle: string }[] = [];
    if (r?.stagiaire) {
      liens.push({
        cle: "stagiaire",
        prefixe: "Stagiaire",
        href: `${base}/qualiopi/stagiaires/${r.stagiaire.id}`,
        libelle: r.stagiaire.libelle,
      });
    }
    if (r?.session) {
      liens.push({
        cle: "session",
        prefixe: "Session",
        href: `${base}/qualiopi/sessions/${r.session.id}`,
        libelle: r.session.libelle,
      });
    }
    if (r?.seance) {
      liens.push({
        cle: "seance",
        prefixe: "Accompagnement",
        href: `${base}/coaching/seances/${r.seance.id}`,
        libelle: r.seance.libelle,
      });
    }
    if (r?.client) {
      liens.push({
        cle: "client",
        prefixe: "Client",
        href: `${base}/qualiopi/clients/${r.client.id}`,
        libelle: r.client.libelle,
      });
    }
    if (r?.formateur) {
      liens.push({
        cle: "formateur",
        prefixe: "Formateur",
        href: `${base}/qualiopi/formateurs/${r.formateur.id}`,
        libelle: r.formateur.libelle,
      });
    }
    if (liens.length === 0) {
      return <span className="text-[color:var(--color-admin-fg-muted)]">Non rattachée</span>;
    }
    return (
      <ul className="space-y-0.5">
        {liens.map((l) => (
          <li key={l.cle}>
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {l.prefixe} :{" "}
            </span>
            <Link href={l.href} className={lienCls}>
              {l.libelle}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  function renderMoyenne(m: number | null, count: number) {
    if (count === 0 || m === null) return "—";
    return `${m.toFixed(1)}/5`;
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Appréciations"
        description="Recueil des appréciations des parties prenantes (indicateur 30) : stagiaires, entreprises, financeurs et formateurs."
      />

      {/* KPIs globaux */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-5)] sm:grid-cols-5">
        <AdminStatCard label="Total" value={stats.global.count} icon={Hash} />
        <AdminStatCard
          label="Moyenne globale"
          value={renderMoyenne(stats.global.moyenne, stats.global.count)}
          icon={Gauge}
        />
        <AdminStatCard
          label="Stagiaires"
          value={renderMoyenne(stats.parSource.stagiaire.moyenne, stats.parSource.stagiaire.count)}
          tone="default"
          icon={UserCheck}
        />
        <AdminStatCard
          label="Entreprises"
          value={renderMoyenne(
            stats.parSource.entreprise.moyenne,
            stats.parSource.entreprise.count,
          )}
          tone="default"
          icon={Users}
        />
        <AdminStatCard
          label="Formateurs"
          value={renderMoyenne(stats.parSource.formateur.moyenne, stats.parSource.formateur.count)}
          tone="default"
          icon={GraduationCap}
        />
      </div>

      {/* Formulaire création */}
      <div className="mb-[var(--space-admin-8)]">
        <AppreciationForm
          creerAction={creerAppreciationAction}
          stagiaires={options.stagiaires}
          inscriptions={options.inscriptions}
          clients={options.clients}
          formateurs={options.formateurs}
        />
      </div>

      {/* Liste */}
      {appreciations.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune appréciation enregistrée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Date</th>
                <th className={headCls}>Source</th>
                <th className={headCls}>Note</th>
                <th className={headCls}>Commentaire</th>
                <th className={headCls}>Rattachée à</th>
              </tr>
            </thead>
            <tbody>
              {appreciations.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>{a.dateAppreciation.toLocaleDateString("fr-FR")}</td>
                  <td className={cellCls}>{SOURCE_LABELS[a.source] ?? a.source}</td>
                  <td className={cellCls}>{renderNote(a.note)}</td>
                  <td className={cellCls}>
                    {a.commentaire ? (
                      <span className="line-clamp-2 max-w-xs" title={a.commentaire ?? ""}>
                        {a.commentaire}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                  <td className={cellCls}>{renderRattachements(rattachements.get(a.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
