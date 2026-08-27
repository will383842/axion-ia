/**
 * Admin — Qualiopi · Pilotage — 14 métriques (T12 + filtres LOT 4).
 *
 * Server Component : lit `getPilotage({ annee, periode?, typeAction? })` côté
 * serveur. Sélecteurs via searchParams : `?annee=<AAAA>&trimestre=<1-4>` OU
 * `&mois=<1-12>` + `&typeAction=<TypeActionQualiopi>` (liens — pattern du
 * sélecteur année existant). Exports CSV + PDF (LOT 4). Check-list des
 * cadences qualité (mensuel/trimestriel/annuel) avec états calculés.
 * Force-dynamic + noindex.
 */

import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";
import { CsvExportButton } from "@/components/admin/qualiopi/CsvExportButton";
import {
  genererPilotagePdfAction,
  exportPilotageCsvAction,
  type PilotageExportInput,
} from "@/server/actions/qualiopi/exports-pdf";
import {
  getPilotage,
  periodeLabel,
  type MetriqueValeur,
  type PilotageOptions,
  type PilotagePeriode,
} from "@/server/qualiopi/conformite/pilotage-service";
import { getRevue } from "@/server/qualiopi/registres/revue-direction-service";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
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
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Pilotage | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// `alternance_afest` retiré des filtres le 2026-08-10 : le 1-to-1 est du
// conseil, hors Qualiopi (décision 2026-07-17). Le type est aligné sur l'union
// acceptée par les actions d'export (sans `alternance_afest`), plus étroite que
// l'enum Prisma hérité.
const TYPES_ACTION: Array<{
  value: NonNullable<PilotageExportInput["typeAction"]>;
  label: string;
}> = [
  { value: "classique", label: "Classique" },
  { value: "certifiante", label: "Certifiante" },
  { value: "foad", label: "FOAD" },
  { value: "sous_traitance", label: "Sous-traitance" },
  { value: "cpf", label: "CPF" },
  { value: "opco", label: "OPCO" },
  { value: "france_travail", label: "France Travail" },
  { value: "handicap", label: "Handicap" },
];

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

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Construit une query string en omettant les paramètres indéfinis. */
function buildHref(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return q.length > 0 ? `?${q}` : "?";
}

const chipActive =
  "rounded bg-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-accent-fg)]";
const chipInactive =
  "rounded px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)] transition-colors hover:bg-[color:var(--color-admin-hover)]";
const chipLabel =
  "text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)]";

export default async function QualiopiPilotagePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const sp = await searchParams;

  // ── Année ──────────────────────────────────────────────────────────────────
  const anneeParam = firstParam(sp["annee"]);
  const anneeActuelle = new Date().getFullYear();
  const anneeRaw = anneeParam ? parseInt(anneeParam, 10) : anneeActuelle;
  const anneeValide = !isNaN(anneeRaw) && anneeRaw >= 2020 && anneeRaw <= anneeActuelle + 1;
  const annee = anneeValide ? anneeRaw : anneeActuelle;

  // ── Période (trimestre prioritaire sur mois si les deux sont passés) ──────
  const trimestreRaw = parseInt(firstParam(sp["trimestre"]) ?? "", 10);
  const moisRaw = parseInt(firstParam(sp["mois"]) ?? "", 10);
  const trimestre =
    !isNaN(trimestreRaw) && trimestreRaw >= 1 && trimestreRaw <= 4 ? trimestreRaw : undefined;
  const mois =
    trimestre === undefined && !isNaN(moisRaw) && moisRaw >= 1 && moisRaw <= 12
      ? moisRaw
      : undefined;
  const periode: PilotagePeriode | undefined =
    trimestre !== undefined
      ? { type: "trimestre", trimestre }
      : mois !== undefined
        ? { type: "mois", mois }
        : undefined;

  // ── Type d'action ──────────────────────────────────────────────────────────
  const typeActionParam = firstParam(sp["typeAction"]);
  const typeAction = TYPES_ACTION.find((t) => t.value === typeActionParam)?.value;

  const options: PilotageOptions = {
    annee,
    ...(periode !== undefined ? { periode } : {}),
    ...(typeAction !== undefined ? { typeAction } : {}),
  };

  // ── Données : pilotage + check-list de cadences ────────────────────────────
  const [pilotage, revueAnnee, bpfAnneeDeposee, revueTrimestrielleActivee, derniereVeille] =
    await Promise.all([
      getPilotage(options),
      getRevue(annee),
      getQualiopiConfig("bpf_annee_deposee").catch(() => 0),
      getQualiopiConfig("revue_trimestrielle_activee").catch(() => true),
      prisma.veille.findFirst({
        orderBy: { dateVeille: "desc" },
        select: { dateVeille: true },
      }),
    ]);

  // Sélecteur années (5 ans glissants)
  const anneesDisponibles: number[] = [];
  for (let y = anneeActuelle; y >= anneeActuelle - 4; y--) {
    anneesDisponibles.push(y);
  }

  const libellePeriode = periodeLabel(annee, pilotage.periode);
  const libelleType =
    typeAction !== undefined
      ? (TYPES_ACTION.find((t) => t.value === typeAction)?.label ?? typeAction)
      : undefined;

  // États calculés de la check-list (réutilise les données déjà chargées)
  const revueValideeAnnee = revueAnnee !== null && revueAnnee.statut === "validee";
  const revueCreeeAnnee = revueAnnee !== null;
  const bpfDepose = typeof bpfAnneeDeposee === "number" && bpfAnneeDeposee >= annee - 1;
  const veilleRecente =
    derniereVeille !== null &&
    // Date.now() est OK ici : Server Component re-render à chaque requête HTTP.
    // eslint-disable-next-line react-hooks/purity
    derniereVeille.dateVeille.getTime() >= Date.now() - 45 * 24 * 60 * 60 * 1000;

  const exportInput = {
    annee,
    ...(trimestre !== undefined ? { trimestre } : {}),
    ...(mois !== undefined ? { mois } : {}),
    ...(typeAction !== undefined ? { typeAction } : {}),
  };

  const cadences: Array<{
    cadence: string;
    taches: string;
    etat: boolean | null;
    etatLabel: string;
  }> = [
    {
      cadence: "Mensuel",
      taches: "Relever les indicateurs de pilotage (cette page) et traiter les alertes.",
      etat: null,
      etatLabel: "Suivi manuel",
    },
    {
      cadence: "Trimestriel",
      taches: `Revue trimestrielle non bloquante (mise à jour de la revue de direction)${revueTrimestrielleActivee === true ? " — alerte de cadence active" : " — alerte de cadence désactivée"} · relever les barèmes OPCO des dossiers en cours.`,
      etat: null,
      etatLabel: "Suivi via l'alerte « Revue trimestrielle à réaliser »",
    },
    {
      cadence: "Annuel",
      taches: `Revue de direction ${annee} validée.`,
      etat: revueValideeAnnee,
      etatLabel: revueValideeAnnee
        ? "Validée"
        : revueCreeeAnnee
          ? "Créée — à valider"
          : "Manquante",
    },
    {
      cadence: "Annuel",
      taches: `BPF ${annee - 1} déposé (DREETS, avant le 31 mai ${annee}).`,
      etat: bpfDepose,
      etatLabel: bpfDepose
        ? `Déposé (dernière année : ${String(bpfAnneeDeposee)})`
        : "Non déposé (marqueur config bpf_annee_deposee)",
    },
    {
      cadence: "Annuel",
      taches: "Veille légale/métiers/pédagogique tenue à jour (dernière entrée < 45 jours).",
      etat: veilleRecente,
      etatLabel: derniereVeille
        ? `Dernière entrée : ${derniereVeille.dateVeille.toLocaleDateString("fr-FR")}`
        : "Aucune entrée de veille",
    },
  ];

  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Pilotage Qualiopi"
        description={`Tableau de bord des 14 métriques de pilotage — ${libellePeriode}${libelleType !== undefined ? ` · type d'action : ${libelleType}` : ""}. Données calculées en temps réel sur la base des sessions, incidents, réclamations, sous-traitants et dossiers enregistrés.`}
        actions={
          <div className="flex flex-wrap gap-[var(--space-admin-3)]">
            <CsvExportButton
              label="Exporter (CSV)"
              input={exportInput}
              action={exportPilotageCsvAction}
            />
            <PdfExportButton
              label="Exporter (PDF)"
              input={exportInput}
              action={genererPilotagePdfAction}
            />
          </div>
        }
      />

      {/* ── Sélecteur d'année ──────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <span className={chipLabel}>Année :</span>
        {anneesDisponibles.map((y) => (
          <a
            key={y}
            href={buildHref({ annee: y, trimestre, mois, typeAction })}
            className={y === annee ? chipActive : chipInactive}
          >
            {y}
          </a>
        ))}
      </div>

      {/* ── Sélecteur de période (année entière / trimestre / mois) ───── */}
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <span className={chipLabel}>Période :</span>
        <a
          href={buildHref({ annee, typeAction })}
          className={periode === undefined ? chipActive : chipInactive}
        >
          Année entière
        </a>
        {[1, 2, 3, 4].map((t) => (
          <a
            key={t}
            href={buildHref({ annee, trimestre: t, typeAction })}
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
            href={buildHref({ annee, mois: i + 1, typeAction })}
            className={mois === i + 1 ? chipActive : chipInactive}
          >
            {label}
          </a>
        ))}
      </div>

      {/* ── Sélecteur type d'action Qualiopi ──────────────────────────── */}
      <div className="mb-[var(--space-admin-7)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <span className={chipLabel}>Type d&apos;action :</span>
        <a
          href={buildHref({ annee, trimestre, mois })}
          className={typeAction === undefined ? chipActive : chipInactive}
        >
          Tous
        </a>
        {TYPES_ACTION.map((t) => (
          <a
            key={t.value}
            href={buildHref({ annee, trimestre, mois, typeAction: t.value })}
            className={typeAction === t.value ? chipActive : chipInactive}
          >
            {t.label}
          </a>
        ))}
      </div>

      {typeAction !== undefined && (
        <p className="mb-[var(--space-admin-6)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Le filtre type d&apos;action s&apos;applique aux métriques liées aux sessions (M1-M7, M12,
          M14). Les métriques transverses (M8-M11, M13) restent calculées sur tout le périmètre.
        </p>
      )}

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

      {/* 🔴 M4 SANS SES MOTIFS N'EST PAS UN INDICATEUR, C'EST UN CHIFFRE.
          Le taux existait et s'affichait depuis toujours ; rien ne disait
          POURQUOI. Un auditeur qui demande « pourquoi abandonne-t-on chez vous,
          et qu'avez-vous fait ? » n'avait rien à lire. */}
      {pilotage.m4_motifs_abandon.length > 0 && (
        <section className="mb-[var(--space-admin-6)]">
          <h2 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Pourquoi ils abandonnent
          </h2>
          <ul className="flex flex-col gap-[var(--space-admin-2)]">
            {pilotage.m4_motifs_abandon.map((m) => (
              <li
                key={m.motif}
                className="flex items-start gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
              >
                <span className="min-w-[2.5rem] shrink-0 font-semibold text-[color:var(--color-admin-warning-fg)]">
                  {m.nombre}×
                </span>
                <span>{m.motif}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        {/* M7 — Incidents (registre réel + ancien proxy en détail) */}
        <AdminStatCard
          label={pilotage.m7_incidents.libelle}
          value={afficherValeur(pilotage.m7_incidents)}
          {...(pilotage.m7_incidents.detail !== undefined
            ? { meta: pilotage.m7_incidents.detail }
            : {})}
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
        {/* M9 — Actions correctives (incidents + réclamations) */}
        <AdminStatCard
          label={pilotage.m9_actions_correctives.libelle}
          value={afficherValeur(pilotage.m9_actions_correctives)}
          {...(pilotage.m9_actions_correctives.detail !== undefined
            ? { meta: pilotage.m9_actions_correctives.detail }
            : {})}
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
          {...(pilotage.m11_formateurs_a_jour.detail !== undefined
            ? { meta: pilotage.m11_formateurs_a_jour.detail }
            : {})}
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

      {/* ── Check-list des cadences qualité (LOT 4) ───────────────────── */}
      <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Check-list des cadences qualité
      </h2>
      <div className="mb-[var(--space-admin-8)] overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
        <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
          <thead className="border-b border-[color:var(--color-admin-border)]">
            <tr>
              <th className={headCls}>Cadence</th>
              <th className={headCls}>À faire</th>
              <th className={headCls}>État</th>
            </tr>
          </thead>
          <tbody>
            {cadences.map((ligne, idx) => (
              <tr
                key={idx}
                className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
              >
                <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top font-medium text-[color:var(--color-admin-fg)]">
                  {ligne.cadence}
                </td>
                <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[color:var(--color-admin-fg-soft)]">
                  {ligne.taches}
                </td>
                <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top">
                  <span
                    className={
                      ligne.etat === null
                        ? "text-[color:var(--color-admin-fg-muted)]"
                        : ligne.etat
                          ? "font-medium text-[color:var(--color-admin-success)]"
                          : "font-medium text-[color:var(--color-admin-warning)]"
                    }
                  >
                    {ligne.etatLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Données calculées en temps réel · Cache Redis 1 h · {libellePeriode}
        {libelleType !== undefined ? ` · Type d'action : ${libelleType}` : ""}
      </p>
    </AdminPageShell>
  );
}
