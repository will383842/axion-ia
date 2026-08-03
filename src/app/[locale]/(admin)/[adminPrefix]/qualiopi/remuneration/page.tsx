/**
 * Admin — Qualiopi · Rémunération des formateurs (pilier C).
 *
 * Lance le run mensuel et liste les relevés de la période. Server Component :
 * aucune ligne de JavaScript client — le sélecteur de période est un `<form>` en
 * GET, le run est une Server Action en POST.
 *
 * Le bouton « Simuler » est délibérément le PREMIER : un run réel écrit des
 * lignes d'honoraires, c'est-à-dire de l'argent dû. On regarde avant d'écrire.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Calculator, Euro, FileWarning, Users } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { runRemunerationFormAction } from "@/server/actions/qualiopi/trainer-remuneration";
import {
  honorairesSousTraitanceAnnee,
  listAnomaliesPeriode,
  listRelevesPeriode,
} from "@/server/qualiopi/remuneration/queries";
import { periodeDeRattachement } from "@/server/qualiopi/remuneration/run";
import {
  euros,
  libelleAnomalie,
  libellePrestation,
  LIBELLE_STATUT_RELEVE,
  MOIS_FR,
  TON_STATUT_RELEVE,
} from "./_labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Rémunération des formateurs | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ year?: string; month?: string; ok?: string; erreur?: string }>;
}

export default async function QualiopiRemunerationPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  // Par défaut : le mois écoulé. On calcule un mois APRÈS l'avoir vécu.
  const maintenant = periodeDeRattachement(new Date());
  const anneeDefaut = maintenant.month === 1 ? maintenant.year - 1 : maintenant.year;
  const moisDefaut = maintenant.month === 1 ? 12 : maintenant.month - 1;

  const year = Number(sp.year) || anneeDefaut;
  const month = Number(sp.month) || moisDefaut;
  const periode = { year, month };

  const base = `/${locale}/${adminPrefix}/qualiopi/remuneration`;
  const [releves, anomalies, bpf] = await Promise.all([
    listRelevesPeriode(periode),
    listAnomaliesPeriode(periode),
    honorairesSousTraitanceAnnee(year),
  ]);

  const totalTtc = releves.reduce((t, r) => t + r.totalTtcCents, 0);
  const aPayer = releves.filter((r) => r.statut !== "paye" && r.statut !== "annule").length;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Rémunération des formateurs"
        description="Relevés mensuels d'honoraires des indépendants. Un salarié produit des lignes analytiques, jamais de relevé."
      />

      {sp.ok !== undefined && (
        <div className="admin-alert admin-alert-success" role="status">
          {sp.ok}
        </div>
      )}
      {sp.erreur !== undefined && (
        <div className="admin-alert admin-alert-error" role="alert">
          {sp.erreur}
        </div>
      )}

      {/* ── Période + run ─────────────────────────────────────────────────── */}
      <AdminCard>
        <h2 className="admin-h2">Période</h2>

        <form method="GET" className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
          <div className="admin-field">
            <label className="admin-label" htmlFor="month">
              Mois
            </label>
            <select id="month" name="month" defaultValue={String(month)} className="admin-input">
              {MOIS_FR.map((nom, i) => (
                <option key={nom} value={i + 1}>
                  {nom}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="year">
              Année
            </label>
            <input
              id="year"
              type="number"
              name="year"
              defaultValue={year}
              min={2020}
              max={2100}
              className="admin-input"
            />
          </div>
          <button type="submit" className="admin-button-ghost">
            Afficher
          </button>
        </form>

        <form
          action={runRemunerationFormAction}
          className="mt-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-3)]"
        >
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="retour" value={base} />
          {/* Simuler d'abord : un run réel écrit des honoraires dus. */}
          <button type="submit" name="dryRun" value="1" className="admin-button-ghost">
            <Calculator size={16} aria-hidden />
            Simuler le run
          </button>
          <button type="submit" className="admin-button">
            Exécuter le run
          </button>
        </form>

        <p className="admin-muted mt-[var(--space-admin-2)]">
          Le run n&apos;écrase jamais un relevé validé, facturé ou payé : ces formateurs sont
          sautés. Relancer un mois recalculable est sans effet de bord.
        </p>
      </AdminCard>

      {/* ── Indicateurs ───────────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Relevés" value={releves.length} icon={Users} />
        <AdminStatCard
          label="Total TTC dû"
          value={euros(totalTtc)}
          icon={Euro}
          tone={totalTtc > 0 ? "info" : "default"}
        />
        <AdminStatCard
          label="Restant à payer"
          value={aPayer}
          icon={FileWarning}
          tone={aPayer > 0 ? "warning" : "success"}
        />
        <AdminStatCard
          label="Anomalies"
          value={anomalies.length}
          icon={AlertTriangle}
          tone={anomalies.length > 0 ? "destructive" : "success"}
        />
      </div>

      {/* ── Anomalies ─────────────────────────────────────────────────────── */}
      {anomalies.length > 0 && (
        <AdminCard>
          <h2 className="admin-h2">Anomalies du mois</h2>
          <p className="admin-muted">
            Chacune signale un montant que le moteur a refusé de deviner. Une ligne à 0 € qui
            n&apos;apparaît pas ici est un 0 € voulu.
          </p>
          <ul className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]">
            {anomalies.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                <AdminBadge tone="destructive" dot>
                  {libelleAnomalie(a.motif)}
                </AdminBadge>
                <span>{a.trainerNom}</span>
                <span className="admin-muted">
                  {libellePrestation(a.prestationType)} — {euros(a.montantHtCents)} HT
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      {/* ── Lien BPF ──────────────────────────────────────────────────────── */}
      <AdminCard>
        <h2 className="admin-h2">Charge de sous-traitance {year} (BPF)</h2>
        <p className="tabular-nums">{euros(bpf.totalHtCents)} HT</p>
        <p className="admin-muted">
          Honoraires des formateurs indépendants sur des relevés validés, facturés ou payés. Les
          lignes analytiques (salariés) en sont exclues : leur salaire est déclaré ailleurs. Ce
          montant n&apos;est PAS reporté automatiquement au BPF — déclarer une charge est un acte
          comptable, il se saisit à la main dans l&apos;écran BPF.
        </p>
        {bpf.parFormateur.length > 0 && (
          <ul className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-1)]">
            {bpf.parFormateur.map((f) => (
              <li key={f.trainerId} className="admin-muted">
                {f.trainerNom} — <span className="tabular-nums">{euros(f.totalHtCents)}</span> HT
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      {/* ── Relevés ───────────────────────────────────────────────────────── */}
      <AdminCard>
        <h2 className="admin-h2">
          Relevés — {MOIS_FR[month - 1]} {year}
        </h2>

        {releves.length === 0 ? (
          <AdminEmptyState
            icon={<Euro size={24} />}
            title="Aucun relevé sur cette période"
            description="Lancez le run, ou vérifiez qu'un formateur indépendant a bien un barème et un régime de TVA renseignés."
          />
        ) : (
          <table className="admin-table mt-[var(--space-admin-3)]">
            <thead>
              <tr>
                <th scope="col">Formateur</th>
                <th scope="col">Statut</th>
                <th scope="col">Lignes</th>
                <th scope="col" className="text-right">
                  HT
                </th>
                <th scope="col" className="text-right">
                  TVA
                </th>
                <th scope="col" className="text-right">
                  TTC
                </th>
                <th scope="col">
                  <span className="sr-only">Ouvrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {releves.map((r) => (
                <tr key={r.id}>
                  <td>{r.trainerNom}</td>
                  <td>
                    <AdminBadge tone={TON_STATUT_RELEVE[r.statut]} dot>
                      {LIBELLE_STATUT_RELEVE[r.statut]}
                    </AdminBadge>
                  </td>
                  <td>{r.nbLignes}</td>
                  <td className="text-right tabular-nums">{euros(r.totalHtCents)}</td>
                  <td className="text-right tabular-nums">{euros(r.tvaCents)}</td>
                  <td className="text-right tabular-nums">{euros(r.totalTtcCents)}</td>
                  <td>
                    <Link href={`${base}/${r.id}`} className="admin-button-ghost">
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
