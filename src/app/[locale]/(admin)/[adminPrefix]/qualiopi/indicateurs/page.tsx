/**
 * Admin — Qualiopi · Indicateurs KPIs + BPF (T10).
 *
 * Server Component : lit `getIndicateurs(annee)` et `computeBpf(annee)` côté serveur.
 * Sélecteur année via searchParam `?annee=<AAAA>`.
 * Force-dynamic + noindex.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { BpfExportButton } from "@/components/admin/qualiopi/BpfExportButton";
import { BpfDepenseForm } from "@/components/admin/qualiopi/BpfDepenseForm";
import { RecomputeIndicateursButton } from "@/components/admin/qualiopi/RecomputeIndicateursButton";
import { getIndicateurs } from "@/server/qualiopi/indicateurs/service";
import { computeBpf } from "@/server/qualiopi/bpf/service";
import {
  Gauge,
  CheckCircle2,
  UserCheck,
  Clock,
  CalendarDays,
  Wallet,
  Coins,
  Users,
  Handshake,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Indicateurs & BPF | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Formate une date ISO en DD/MM/YYYY HH:MM. */
function formatDateHeure(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formate un montant en centimes vers euros. */
function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));
}

export default async function QualiopiIndicateursPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const sp = await searchParams;
  const anneeParam = Array.isArray(sp["annee"]) ? sp["annee"][0] : sp["annee"];
  const anneeActuelle = new Date().getFullYear();
  const annee = anneeParam ? parseInt(anneeParam, 10) : anneeActuelle;
  const anneeValide = !isNaN(annee) && annee >= 2020 && annee <= anneeActuelle + 1;
  const anneeFinale = anneeValide ? annee : anneeActuelle;

  // Lecture côté serveur uniquement
  const [indicateurs, bpf] = await Promise.all([
    getIndicateurs(anneeFinale),
    computeBpf(anneeFinale),
  ]);

  // Sélecteur années (5 ans glissants)
  const anneesDisponibles: number[] = [];
  for (let y = anneeActuelle; y >= anneeActuelle - 4; y--) {
    anneesDisponibles.push(y);
  }

  const sectionTitleCls =
    "mb-[var(--space-admin-5)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]";

  const methodeCls =
    "mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] leading-relaxed";

  const badgeEnCours = (
    <span className="inline-flex items-center gap-1 rounded bg-[color:var(--color-admin-warning-subtle,color-mix(in_srgb,var(--color-admin-warning)_15%,transparent))] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-warning)]">
      ⚠ en cours de constitution
    </span>
  );

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Indicateurs Qualiopi & BPF"
        description={`Tableau de bord des indicateurs de résultats — année ${anneeFinale}. Données calculées en temps réel sur la base des sessions réalisées, évaluations et présences enregistrées.`}
        actions={<RecomputeIndicateursButton annee={anneeFinale} />}
      />

      {/* ── Sélecteur d'année ──────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-7)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <span className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)]">
          Année :
        </span>
        {anneesDisponibles.map((y) => (
          <a
            key={y}
            href={`?annee=${y}`}
            className={
              y === anneeFinale
                ? "rounded bg-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-accent-fg)]"
                : "rounded px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)] transition-colors hover:bg-[color:var(--color-admin-hover)]"
            }
          >
            {y}
          </a>
        ))}
      </div>

      {/* ── Date de dernière mise à jour ───────────────────────────────── */}
      <p className="mb-[var(--space-admin-6)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Calculé le{" "}
        <time
          dateTime={
            indicateurs.calculeAt instanceof Date
              ? indicateurs.calculeAt.toISOString()
              : indicateurs.calculeAt
          }
        >
          {formatDateHeure(indicateurs.calculeAt)}
        </time>{" "}
        · Cache Redis 1 h.
      </p>

      {/* ── Section : Indicateurs KPIs ─────────────────────────────────── */}
      <h2 className={sectionTitleCls}>Indicateurs de résultats</h2>

      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        {/* Taux de satisfaction */}
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <AdminStatCard
            label="Taux de satisfaction"
            value={
              indicateurs.tauxSatisfaction.nb > 0
                ? `${indicateurs.tauxSatisfaction.tauxPct} %`
                : "—"
            }
            meta={`${indicateurs.tauxSatisfaction.nb} évaluation(s)`}
            tone={
              !indicateurs.tauxSatisfaction.fiable
                ? "warning"
                : indicateurs.tauxSatisfaction.tauxPct >= 80
                  ? "success"
                  : indicateurs.tauxSatisfaction.tauxPct >= 60
                    ? "warning"
                    : "destructive"
            }
            icon={Gauge}
          />
          {!indicateurs.tauxSatisfaction.fiable && badgeEnCours}
          <p className={methodeCls}>{indicateurs.methodes.satisfaction}</p>
        </div>

        {/* Taux de réussite */}
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <AdminStatCard
            label="Taux de réussite"
            value={indicateurs.tauxReussite.nb > 0 ? `${indicateurs.tauxReussite.tauxPct} %` : "—"}
            meta={`${indicateurs.tauxReussite.nb} évaluation(s) finale(s)`}
            tone={
              !indicateurs.tauxReussite.fiable
                ? "warning"
                : indicateurs.tauxReussite.tauxPct >= 80
                  ? "success"
                  : indicateurs.tauxReussite.tauxPct >= 60
                    ? "warning"
                    : "destructive"
            }
            icon={CheckCircle2}
          />
          {!indicateurs.tauxReussite.fiable && badgeEnCours}
          <p className={methodeCls}>{indicateurs.methodes.reussite}</p>
        </div>

        {/* Taux de complétion (présence) */}
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <AdminStatCard
            label="Taux de complétion"
            value={
              indicateurs.tauxCompletion.nb > 0 ? `${indicateurs.tauxCompletion.tauxPct} %` : "—"
            }
            meta={`${indicateurs.tauxCompletion.nb} inscription(s) évaluée(s)`}
            tone={
              !indicateurs.tauxCompletion.fiable
                ? "warning"
                : indicateurs.tauxCompletion.tauxPct >= 80
                  ? "success"
                  : indicateurs.tauxCompletion.tauxPct >= 60
                    ? "warning"
                    : "destructive"
            }
            icon={UserCheck}
          />
          {!indicateurs.tauxCompletion.fiable && badgeEnCours}
          <p className={methodeCls}>{indicateurs.methodes.completion}</p>
        </div>

        {/* Délai d'accès moyen */}
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <AdminStatCard
            label="Délai d'accès moyen"
            value={
              indicateurs.delaiAccesMoyen.nb > 0
                ? `${Math.round(indicateurs.delaiAccesMoyen.jours)} j`
                : "—"
            }
            meta={`${indicateurs.delaiAccesMoyen.nb} session(s) réalisée(s)`}
            tone="info"
            icon={Clock}
          />
          <p className={methodeCls}>{indicateurs.methodes.delaiAcces}</p>
        </div>
      </div>

      {/* ── Section : BPF ──────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)] flex items-center justify-between gap-[var(--space-admin-5)]">
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Bilan Pédagogique et Financier (BPF) — {anneeFinale}
        </h2>
        <BpfExportButton annee={anneeFinale} />
      </div>

      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Sessions réalisées"
          value={bpf.nbSessions}
          tone="default"
          icon={CalendarDays}
        />
        <AdminStatCard
          label="Stagiaires (distincts)"
          value={bpf.nbStagiairesDistincts}
          tone="default"
          icon={UserCheck}
        />
        <AdminStatCard
          label="Heures-stagiaires"
          value={
            bpf.nbHeuresStagiaires > 0 ? `${bpf.nbHeuresStagiaires.toLocaleString("fr-FR")} h` : "—"
          }
          tone="default"
          icon={Clock}
        />
        <AdminStatCard
          label="CA total HT"
          value={bpf.caTotalHtCents > 0 ? formatEuros(bpf.caTotalHtCents) : "—"}
          tone="default"
          icon={Wallet}
        />
      </div>

      {/* Répartition par financeur */}
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Répartition par financeur
      </h3>
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-5">
        <AdminStatCard
          label="OPCO"
          value={bpf.caParFinanceur.opco > 0 ? formatEuros(bpf.caParFinanceur.opco) : "—"}
          tone="default"
          icon={Coins}
        />
        <AdminStatCard
          label="CPF"
          value={bpf.caParFinanceur.cpf > 0 ? formatEuros(bpf.caParFinanceur.cpf) : "—"}
          tone="default"
          icon={Coins}
        />
        <AdminStatCard
          label="France Travail"
          value={
            bpf.caParFinanceur.france_travail > 0
              ? formatEuros(bpf.caParFinanceur.france_travail)
              : "—"
          }
          tone="default"
          icon={Coins}
        />
        <AdminStatCard
          label="Direct"
          value={bpf.caParFinanceur.direct > 0 ? formatEuros(bpf.caParFinanceur.direct) : "—"}
          tone="default"
          icon={Coins}
        />
        <AdminStatCard
          label="Mixte"
          value={bpf.caParFinanceur.mixte > 0 ? formatEuros(bpf.caParFinanceur.mixte) : "—"}
          tone="default"
          icon={Coins}
        />
      </div>

      {/* Formateurs */}
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Intervenants
      </h3>
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2">
        <AdminStatCard
          label="Formateurs internes (salariés)"
          value={bpf.nbFormateursInternes}
          tone="default"
          icon={Users}
        />
        <AdminStatCard
          label="Formateurs externes (sous-traitants)"
          value={bpf.nbFormateursExternes}
          tone="default"
          icon={Handshake}
        />
      </div>

      {/* Dépenses BPF */}
      <div className="mb-[var(--space-admin-4)] flex items-center justify-between gap-[var(--space-admin-5)]">
        <h3 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Dépenses BPF
        </h3>
        {bpf.depenses.totalHtCents > 0 && (
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Total :{" "}
            <strong className="text-[color:var(--color-admin-fg)]">
              {formatEuros(bpf.depenses.totalHtCents)}
            </strong>
          </span>
        )}
      </div>
      <BpfDepenseForm annee={anneeFinale} depenses={bpf.depenses.items} />
    </AdminPageShell>
  );
}
