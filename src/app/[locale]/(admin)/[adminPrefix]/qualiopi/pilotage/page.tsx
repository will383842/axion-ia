/**
 * Admin — Qualiopi · Pilotage — 14 métriques (T12).
 *
 * Server Component : lit `getPilotage(annee)` côté serveur.
 * Sélecteur année via searchParam `?annee=<AAAA>`.
 * Affiche les 14 métriques de pilotage en AdminStatCard.
 * Force-dynamic + noindex.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { getPilotage, type MetriqueValeur } from "@/server/qualiopi/conformite/pilotage-service";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Target,
  Smile,
  MessageSquareWarning,
  Wrench,
  FileText,
  GraduationCap,
  Accessibility,
  Handshake,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Pilotage | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Formate la valeur d'une métrique pour l'affichage. */
function afficherValeur(m: MetriqueValeur): string {
  if (m.valeur === "—" || m.valeur === 0) return "—";
  const unite = m.unite !== undefined ? ` ${m.unite}` : "";
  return `${m.valeur}${unite}`;
}

/** Détermine si une valeur numérique est disponible (non nulle, non "—"). */
function toNum(m: MetriqueValeur): number | null {
  if (typeof m.valeur === "number") return m.valeur;
  const n = parseFloat(String(m.valeur));
  return isNaN(n) ? null : n;
}

export default async function QualiopiPilotagePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const sp = await searchParams;
  const anneeParam = Array.isArray(sp["annee"]) ? sp["annee"][0] : sp["annee"];
  const anneeActuelle = new Date().getFullYear();
  const anneeRaw = anneeParam ? parseInt(anneeParam, 10) : anneeActuelle;
  const anneeValide = !isNaN(anneeRaw) && anneeRaw >= 2020 && anneeRaw <= anneeActuelle + 1;
  const annee = anneeValide ? anneeRaw : anneeActuelle;

  const pilotage = await getPilotage(annee);

  // Sélecteur années (5 ans glissants)
  const anneesDisponibles: number[] = [];
  for (let y = anneeActuelle; y >= anneeActuelle - 4; y--) {
    anneesDisponibles.push(y);
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Pilotage Qualiopi"
        description={`Tableau de bord des 14 métriques de pilotage — année ${annee}. Données calculées en temps réel sur la base des sessions, réclamations, sous-traitants et dossiers enregistrés.`}
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
              y === annee
                ? "rounded bg-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-accent-fg)]"
                : "rounded px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)] transition-colors hover:bg-[color:var(--color-admin-hover)]"
            }
          >
            {y}
          </a>
        ))}
      </div>

      {/* ── Section 1 : Activité prestations ──────────────────────────── */}
      <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Activité des prestations
      </h2>
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        {/* M1 — Prestations ouvertes / terminées */}
        <AdminStatCard
          label={pilotage.m1_prestations.libelle}
          value={afficherValeur(pilotage.m1_prestations)}
          tone="default"
          icon={Briefcase}
        />
        {/* M2 — Taux d'entrée dans le délai */}
        <AdminStatCard
          label={pilotage.m2_taux_entree_delai.libelle}
          value={afficherValeur(pilotage.m2_taux_entree_delai)}
          tone={(() => {
            const n = toNum(pilotage.m2_taux_entree_delai);
            if (n === null) return "default";
            return n >= 80 ? "success" : n >= 60 ? "warning" : "destructive";
          })()}
          icon={Clock}
        />
        {/* M3 — Taux de complétion */}
        <AdminStatCard
          label={pilotage.m3_taux_completion.libelle}
          value={afficherValeur(pilotage.m3_taux_completion)}
          tone={(() => {
            const n = toNum(pilotage.m3_taux_completion);
            if (n === null) return "default";
            return n >= 80 ? "success" : n >= 60 ? "warning" : "destructive";
          })()}
          icon={CheckCircle2}
        />
        {/* M4 — Taux d'abandon */}
        <AdminStatCard
          label={pilotage.m4_taux_abandon.libelle}
          value={afficherValeur(pilotage.m4_taux_abandon)}
          tone={(() => {
            const n = toNum(pilotage.m4_taux_abandon);
            if (n === null) return "default";
            return n <= 10 ? "success" : n <= 25 ? "warning" : "destructive";
          })()}
          icon={AlertTriangle}
        />
      </div>

      {/* ── Section 2 : Résultats et satisfaction ─────────────────────── */}
      <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Résultats et satisfaction
      </h2>
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-3">
        {/* M5 — Taux d'atteinte des objectifs */}
        <AdminStatCard
          label={pilotage.m5_taux_reussite.libelle}
          value={afficherValeur(pilotage.m5_taux_reussite)}
          tone={(() => {
            const n = toNum(pilotage.m5_taux_reussite);
            if (n === null) return "default";
            return n >= 80 ? "success" : n >= 60 ? "warning" : "destructive";
          })()}
          icon={Target}
        />
        {/* M6 — Satisfaction globale */}
        <AdminStatCard
          label={pilotage.m6_satisfaction.libelle}
          value={afficherValeur(pilotage.m6_satisfaction)}
          tone={(() => {
            const n = toNum(pilotage.m6_satisfaction);
            if (n === null) return "default";
            return n >= 80 ? "success" : n >= 60 ? "warning" : "destructive";
          })()}
          icon={Smile}
        />
        {/* M7 — Incidents */}
        <AdminStatCard
          label={pilotage.m7_incidents.libelle}
          value={afficherValeur(pilotage.m7_incidents)}
          tone={(() => {
            const n = toNum(pilotage.m7_incidents);
            if (n === null || n === 0) return "success";
            return n <= 3 ? "warning" : "destructive";
          })()}
          icon={AlertTriangle}
        />
      </div>

      {/* ── Section 3 : Réclamations et actions correctives ───────────── */}
      <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Réclamations et amélioration continue
      </h2>
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-3">
        {/* M8 — Réclamations */}
        <AdminStatCard
          label={pilotage.m8_reclamations.libelle}
          value={afficherValeur(pilotage.m8_reclamations)}
          tone={(() => {
            const n = toNum(pilotage.m8_reclamations);
            if (n === null || n === 0) return "success";
            return n <= 3 ? "warning" : "destructive";
          })()}
          icon={MessageSquareWarning}
        />
        {/* M9 — Actions correctives */}
        <AdminStatCard
          label={pilotage.m9_actions_correctives.libelle}
          value={afficherValeur(pilotage.m9_actions_correctives)}
          tone="warning"
          icon={Wrench}
        />
        {/* M10 — Mise à jour documentaire */}
        <AdminStatCard
          label={pilotage.m10_maj_documentaire.libelle}
          value={afficherValeur(pilotage.m10_maj_documentaire)}
          tone="default"
          icon={FileText}
        />
      </div>

      {/* ── Section 4 : Ressources humaines et sous-traitance ─────────── */}
      <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Ressources humaines et sous-traitance
      </h2>
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        {/* M11 — Formateurs à jour */}
        <AdminStatCard
          label={pilotage.m11_formateurs_a_jour.libelle}
          value={afficherValeur(pilotage.m11_formateurs_a_jour)}
          tone="default"
          icon={GraduationCap}
        />
        {/* M12 — Adaptations handicap */}
        <AdminStatCard
          label={pilotage.m12_adaptations_handicap.libelle}
          value={afficherValeur(pilotage.m12_adaptations_handicap)}
          tone="default"
          icon={Accessibility}
        />
        {/* M13 — Sous-traitances évaluées */}
        <AdminStatCard
          label={pilotage.m13_sous_traitances_evaluees.libelle}
          value={afficherValeur(pilotage.m13_sous_traitances_evaluees)}
          tone="default"
          icon={Handshake}
        />
        {/* M14 — Conformité dossiers */}
        <AdminStatCard
          label={pilotage.m14_conformite_dossiers.libelle}
          value={afficherValeur(pilotage.m14_conformite_dossiers)}
          tone={(() => {
            const n = toNum(pilotage.m14_conformite_dossiers);
            if (n === null) return "default";
            return n >= 90 ? "success" : n >= 70 ? "warning" : "destructive";
          })()}
          icon={ShieldCheck}
        />
      </div>

      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Données calculées en temps réel · Cache Redis 1 h · Année {annee}
      </p>
    </AdminPageShell>
  );
}
