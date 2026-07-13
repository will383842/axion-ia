/**
 * Admin — Qualiopi · Cockpit financier formateurs (Lot 6.3).
 *
 * Marge par session / formation, heures & coût par formateur, consolidation
 * mensuelle. Couche de lecture au-dessus des lignes de rémunération (pilier C)
 * déjà persistées : marge = CA HT − Σ coût formateur. Sessions RÉALISÉES.
 *
 * Server Component (force-dynamic + noindex). Filtres via searchParams (0 JS
 * client, chips liens — même pattern que /qualiopi/pilotage). Export CSV.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet, Coins, TrendingUp, Percent, AlertTriangle, Clock } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { CsvExportButton } from "@/components/admin/qualiopi/CsvExportButton";
import { genererMargeCsvAction } from "@/server/actions/qualiopi/cockpit-financier";
import {
  getMargeParSession,
  getMargeParFormation,
  getHeuresParFormateur,
  getConsolidationMensuelle,
} from "@/server/qualiopi/remuneration/marge";
import { periodeLabel, type PilotagePeriode } from "@/server/qualiopi/conformite/periode";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Cockpit financier | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const MOIS_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildHref(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return q.length > 0 ? `?${q}` : "?";
}

/** Centimes → « 1 234,56 € ». */
function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

const chipActive =
  "rounded bg-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-accent-fg)]";
const chipInactive =
  "rounded px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)] transition-colors hover:bg-[color:var(--color-admin-hover)]";
const chipLabel =
  "text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)]";
const headCls =
  "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";
const numHeadCls =
  "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-right text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";
const cellCls =
  "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const numCellCls =
  "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-right text-[length:var(--text-admin-sm)] tabular-nums text-[color:var(--color-admin-fg)]";

/** Couleur de la marge selon le signe. */
function margeCls(margeCents: number): string {
  if (margeCents < 0) return "font-semibold text-[color:var(--color-admin-error)]";
  return "font-semibold text-[color:var(--color-admin-fg)]";
}

export default async function QualiopiCockpitFinancierPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const sp = await searchParams;

  // ── Année ──────────────────────────────────────────────────────────────────
  const anneeActuelle = new Date().getFullYear();
  const anneeRaw = parseInt(firstParam(sp["annee"]) ?? "", 10);
  const annee =
    !isNaN(anneeRaw) && anneeRaw >= 2020 && anneeRaw <= anneeActuelle + 1
      ? anneeRaw
      : anneeActuelle;

  // ── Période (trimestre prioritaire sur mois) ────────────────────────────────
  const trimestreRaw = parseInt(firstParam(sp["trimestre"]) ?? "", 10);
  const moisRaw = parseInt(firstParam(sp["mois"]) ?? "", 10);
  const trimestre =
    !isNaN(trimestreRaw) && trimestreRaw >= 1 && trimestreRaw <= 4 ? trimestreRaw : undefined;
  const mois =
    trimestre === undefined && !isNaN(moisRaw) && moisRaw >= 1 && moisRaw <= 12
      ? moisRaw
      : undefined;
  const periode: PilotagePeriode =
    trimestre !== undefined
      ? { type: "trimestre", trimestre }
      : mois !== undefined
        ? { type: "mois", mois }
        : { type: "annee" };

  const options = { annee, periode };

  const [sessions, formations, formateurs, consolidation] = await Promise.all([
    getMargeParSession(options),
    getMargeParFormation(options),
    getHeuresParFormateur(options),
    getConsolidationMensuelle(annee),
  ]);

  // ── Totaux période ──────────────────────────────────────────────────────────
  const totalCa = sessions.reduce((a, s) => a + s.caHtCents, 0);
  const totalCout = sessions.reduce((a, s) => a + s.coutFormateurCents, 0);
  const totalMarge = totalCa - totalCout;
  const tauxMarge = totalCa > 0 ? Math.round((totalMarge / totalCa) * 100) : null;
  const nbSansCout = sessions.filter((s) => !s.coutCalcule).length;
  const totalHeures = sessions.reduce((a, s) => a + s.heuresAnimees, 0);

  const libellePeriode = periodeLabel(annee, periode);
  const exportInput = { annee, periode };

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Cockpit financier formateurs"
        description={`Marge (CA HT − coût formateur), heures animées et coût par session, formation et formateur — ${libellePeriode}. Sessions réalisées. Le coût formateur provient des lignes de rémunération (pilier C) : lancez le run mensuel de rémunération pour qu'il soit constaté.`}
        actions={
          <CsvExportButton
            label="Exporter la marge (CSV)"
            input={exportInput}
            action={genererMargeCsvAction}
          />
        }
      />

      {/* ── Filtres année / période ──────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <span className={chipLabel}>Année :</span>
        {Array.from({ length: 5 }, (_, i) => anneeActuelle - i).map((y) => (
          <a
            key={y}
            href={buildHref({ annee: y, trimestre, mois })}
            className={y === annee ? chipActive : chipInactive}
          >
            {y}
          </a>
        ))}
      </div>
      <div className="mb-[var(--space-admin-7)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <span className={chipLabel}>Période :</span>
        <a
          href={buildHref({ annee })}
          className={periode.type === "annee" ? chipActive : chipInactive}
        >
          Année entière
        </a>
        {[1, 2, 3, 4].map((t) => (
          <a
            key={t}
            href={buildHref({ annee, trimestre: t })}
            className={trimestre === t ? chipActive : chipInactive}
          >
            T{t}
          </a>
        ))}
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          ·
        </span>
        {MOIS_LABELS.map((label, i) => (
          <a
            key={label}
            href={buildHref({ annee, mois: i + 1 })}
            className={mois === i + 1 ? chipActive : chipInactive}
          >
            {label}
          </a>
        ))}
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="CA HT (sessions réalisées)" value={euros(totalCa)} icon={Wallet} />
        <AdminStatCard label="Coût formateur" value={euros(totalCout)} icon={Coins} />
        <AdminStatCard
          label="Marge"
          value={euros(totalMarge)}
          tone={totalMarge < 0 ? "destructive" : "success"}
          icon={TrendingUp}
        />
        <AdminStatCard
          label="Taux de marge"
          value={tauxMarge != null ? `${tauxMarge} %` : "—"}
          tone={
            tauxMarge == null
              ? "default"
              : tauxMarge >= 40
                ? "success"
                : tauxMarge >= 20
                  ? "warning"
                  : "destructive"
          }
          icon={Percent}
        />
      </div>

      {nbSansCout > 0 && (
        <p className="mb-[var(--space-admin-6)] flex items-center gap-2 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {nbSansCout} session(s) réalisée(s) sans coût formateur calculé — la marge affichée est
          surévaluée pour celles-ci. Lancez le run mensuel de rémunération pour les constater.
        </p>
      )}

      {/* ── Marge par session ────────────────────────────────────────────── */}
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Marge par session
      </h2>
      {sessions.length === 0 ? (
        <p className="mb-[var(--space-admin-8)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune session réalisée sur cette période.
        </p>
      ) : (
        <div className="mb-[var(--space-admin-8)] overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Session</th>
                <th className={headCls}>Formation</th>
                <th className={headCls}>Date</th>
                <th className={numHeadCls}>CA HT</th>
                <th className={numHeadCls}>Coût form.</th>
                <th className={numHeadCls}>Marge</th>
                <th className={numHeadCls}>Taux</th>
                <th className={numHeadCls}>Heures</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.sessionId}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <span className="font-medium">{s.numero}</span>
                    <span className="mt-1 block max-w-xs truncate text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {s.titre}
                    </span>
                  </td>
                  <td className={cellCls}>{s.formationTitre}</td>
                  <td className={cellCls}>{s.dateDebut.toLocaleDateString("fr-FR")}</td>
                  <td className={numCellCls}>{euros(s.caHtCents)}</td>
                  <td className={numCellCls}>
                    {euros(s.coutFormateurCents)}
                    {!s.coutCalcule ? (
                      <span
                        className="ml-1 text-[color:var(--color-admin-warning)]"
                        title="Aucune ligne de rémunération — coût non calculé"
                      >
                        *
                      </span>
                    ) : null}
                  </td>
                  <td className={`${numCellCls} ${margeCls(s.margeCents)}`}>
                    {euros(s.margeCents)}
                  </td>
                  <td className={numCellCls}>
                    {s.tauxMargePct != null ? `${s.tauxMargePct} %` : "—"}
                  </td>
                  <td className={numCellCls}>{s.heuresAnimees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Marge par formation ──────────────────────────────────────────── */}
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Marge par formation
      </h2>
      {formations.length === 0 ? (
        <p className="mb-[var(--space-admin-8)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune donnée.
        </p>
      ) : (
        <div className="mb-[var(--space-admin-8)] overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Formation</th>
                <th className={numHeadCls}>Sessions</th>
                <th className={numHeadCls}>CA HT</th>
                <th className={numHeadCls}>Coût form.</th>
                <th className={numHeadCls}>Marge</th>
                <th className={numHeadCls}>Taux</th>
                <th className={numHeadCls}>Heures</th>
              </tr>
            </thead>
            <tbody>
              {formations.map((f) => (
                <tr
                  key={f.formationId}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>{f.formationTitre}</td>
                  <td className={numCellCls}>{f.nbSessions}</td>
                  <td className={numCellCls}>{euros(f.caHtCents)}</td>
                  <td className={numCellCls}>{euros(f.coutFormateurCents)}</td>
                  <td className={`${numCellCls} ${margeCls(f.margeCents)}`}>
                    {euros(f.margeCents)}
                  </td>
                  <td className={numCellCls}>
                    {f.tauxMargePct != null ? `${f.tauxMargePct} %` : "—"}
                  </td>
                  <td className={numCellCls}>{f.heuresAnimees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Heures & coût par formateur ──────────────────────────────────── */}
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Heures & coût par formateur
      </h2>
      {formateurs.length === 0 ? (
        <p className="mb-[var(--space-admin-8)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune affectation de formateur sur cette période.
        </p>
      ) : (
        <div className="mb-[var(--space-admin-8)] overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Formateur</th>
                <th className={numHeadCls}>Sessions</th>
                <th className={numHeadCls}>Heures animées</th>
                <th className={numHeadCls}>Coût formateur</th>
              </tr>
            </thead>
            <tbody>
              {formateurs.map((f) => (
                <tr
                  key={f.trainerId}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <span className="inline-flex items-center gap-1">
                      <Clock
                        className="h-3.5 w-3.5 text-[color:var(--color-admin-fg-muted)]"
                        aria-hidden
                      />
                      {f.trainerNom}
                    </span>
                  </td>
                  <td className={numCellCls}>{f.nbSessions}</td>
                  <td className={numCellCls}>{f.heuresAnimees}</td>
                  <td className={numCellCls}>{euros(f.coutFormateurCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Consolidation mensuelle (année entière) ──────────────────────── */}
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Consolidation mensuelle {annee}
      </h2>
      <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
        <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
          <thead className="border-b border-[color:var(--color-admin-border)]">
            <tr>
              <th className={headCls}>Mois</th>
              <th className={numHeadCls}>CA HT</th>
              <th className={numHeadCls}>Coût formateur</th>
              <th className={numHeadCls}>Marge</th>
            </tr>
          </thead>
          <tbody>
            {consolidation.mois.map((m) => (
              <tr
                key={m.mois}
                className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
              >
                <td className={cellCls}>{MOIS_LABELS[m.mois - 1]}</td>
                <td className={numCellCls}>{euros(m.caHtCents)}</td>
                <td className={numCellCls}>{euros(m.coutFormateurCents)}</td>
                <td className={`${numCellCls} ${margeCls(m.margeCents)}`}>{euros(m.margeCents)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[color:var(--color-admin-border)] font-semibold">
              <td className={cellCls}>Total {annee}</td>
              <td className={numCellCls}>{euros(consolidation.totalCaHtCents)}</td>
              <td className={numCellCls}>{euros(consolidation.totalCoutFormateurCents)}</td>
              <td className={`${numCellCls} ${margeCls(consolidation.totalMargeCents)}`}>
                {euros(consolidation.totalMargeCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-[var(--space-admin-6)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Marge = CA HT (TrainingSession) − coût formateur (lignes de rémunération, salarié analytique
        + indépendant honoraires). Total heures période : {totalHeures} h. « * » = coût non encore
        calculé (run mensuel à lancer).
      </p>
    </AdminPageShell>
  );
}
