/**
 * Admin — Qualiopi · Détail / édition d&apos;une formation (T19 Cluster L1).
 *
 * Affiche :
 *   - Fiche de statut (statut, statutGeneration, ratioPratiquePct, score, validatedAt).
 *   - `FormationLifecycleButtons` (valider / publier / lancer génération / indicateurs).
 *   - `FormationForm` en mode édition (titre, méthodes, seuils).
 *   - Liens vers sous-pages supports et certification.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { FormationForm } from "@/components/admin/qualiopi/FormationForm";
import { FormationLifecycleButtons } from "@/components/admin/qualiopi/FormationLifecycleButtons";
import { getFormationById } from "@/server/qualiopi/formations/formations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Formation | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const GENERATION_LABELS: Record<string, string> = {
  intention: "Intention",
  structure_generee: "Structure générée",
  contenu_evalue: "Contenu évalué",
  structure_validee: "Structure validée",
  contenu_genere: "Contenu généré",
  contenu_valide: "Contenu validé",
  assemble: "Assemblé",
  publie: "Publié",
  archive: "Archivé",
};

const STATUT_LABELS: Record<string, string> = {
  actif: "Actif",
  publie: "Publié",
  archive: "Archivé",
};

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: "Hybride",
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function QualiopiFormationDetailPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const formation = await getFormationById(id);
  if (!formation) notFound();

  const formationsBase = `/${locale}/${adminPrefix}/qualiopi/formations`;
  const formationBase = `${formationsBase}/${id}`;

  const infoLabelCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const infoValueCls =
    "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";

  return (
    <AdminPageShell width="wide">
      {/* Fil d&apos;Ariane */}
      <div className="mb-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-3)]">
        <Link
          href={formationsBase}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Formations
        </Link>
      </div>

      <AdminPageHeader
        title={formation.titre}
        description={`Formation ${formation.numero} · ${MODALITE_LABELS[formation.modalite] ?? formation.modalite} · ${formation.dureeHeures} h`}
      />

      {/* ── Fiche de statut ───────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>État de la formation</h2>
        <div className="grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
          {/* Statut */}
          <div>
            <p className={infoLabelCls}>Statut</p>
            <p
              className={
                formation.statut === "publie"
                  ? `${infoValueCls} text-[color:var(--color-admin-success)]`
                  : formation.statut === "archive"
                    ? `${infoValueCls} text-[color:var(--color-admin-fg-muted)]`
                    : `${infoValueCls} text-[color:var(--color-admin-warning)]`
              }
            >
              {STATUT_LABELS[formation.statut] ?? formation.statut}
            </p>
          </div>

          {/* Statut génération */}
          <div>
            <p className={infoLabelCls}>Génération IA</p>
            <p
              className={
                formation.statutGeneration === "publie"
                  ? `${infoValueCls} text-[color:var(--color-admin-success)]`
                  : formation.statutGeneration === "archive"
                    ? `${infoValueCls} text-[color:var(--color-admin-fg-muted)]`
                    : `${infoValueCls} text-[color:var(--color-admin-warning)]`
              }
            >
              {GENERATION_LABELS[formation.statutGeneration] ?? formation.statutGeneration}
            </p>
          </div>

          {/* Ratio pratique */}
          <div>
            <p className={infoLabelCls}>Ratio pratique</p>
            <p className={infoValueCls}>
              {formation.ratioPratiquePct != null ? (
                `${formation.ratioPratiquePct} %`
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">Non défini</span>
              )}
            </p>
          </div>

          {/* Seuil de réussite */}
          <div>
            <p className={infoLabelCls}>Seuil de réussite</p>
            <p className={infoValueCls}>{formation.seuilReussitePct} %</p>
          </div>

          {/* Validation humaine */}
          <div>
            <p className={infoLabelCls}>Validée (AI Act art. 50)</p>
            <p className={infoValueCls}>
              {formation.validatedAt != null ? (
                <span className="text-[color:var(--color-admin-success)]">
                  Oui —{" "}
                  {new Date(formation.validatedAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              ) : (
                <span className="text-[color:var(--color-admin-error)]">Non validée</span>
              )}
            </p>
          </div>

          {/* Accessibilité handicap */}
          <div>
            <p className={infoLabelCls}>Accessible handicap</p>
            <p className={infoValueCls}>
              {formation.accessibleHandicap ? (
                <span className="text-[color:var(--color-admin-success)]">Oui</span>
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
              )}
            </p>
          </div>

          {/* Indicateurs publiés */}
          <div>
            <p className={infoLabelCls}>Indicateurs publiés</p>
            <p className={infoValueCls}>
              {formation.indicateursPubliesAt != null ? (
                <span className="text-[color:var(--color-admin-success)]">
                  Oui —{" "}
                  {new Date(formation.indicateursPubliesAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
              )}
            </p>
          </div>

          {/* CPF éligible */}
          <div>
            <p className={infoLabelCls}>Éligible CPF</p>
            <p className={infoValueCls}>
              {formation.cpfEligible ? (
                <span className="text-[color:var(--color-admin-success)]">Oui</span>
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ── Cycle de vie ─────────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Actions</h2>
        <FormationLifecycleButtons
          formationId={formation.id}
          statut={formation.statut}
          statutGeneration={formation.statutGeneration}
          validatedAt={formation.validatedAt ?? null}
          ratioPratiquePct={formation.ratioPratiquePct ?? null}
        />
      </section>

      {/* ── Formulaire d&apos;édition ─────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Modifier la formation</h2>
        <FormationForm
          id={formation.id}
          initial={{
            titre: formation.titre,
            methodesPedagogiques: formation.methodesPedagogiques || null,
            seuilReussitePct: formation.seuilReussitePct ?? null,
            ratioPratiquePct: formation.ratioPratiquePct ?? null,
            accessibleHandicap: formation.accessibleHandicap,
          }}
        />
      </section>

      {/* ── Liens sous-pages ──────────────────────────────────────────────── */}
      <section>
        <h2 className={sectionHeadCls}>Sous-sections</h2>
        <div className="flex flex-wrap gap-[var(--space-admin-4)]">
          <Link
            href={`${formationBase}/supports`}
            className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] hover:bg-[color:var(--color-admin-surface)]"
          >
            Supports pédagogiques →
          </Link>
          <Link
            href={`${formationBase}/certification`}
            className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] hover:bg-[color:var(--color-admin-surface)]"
          >
            Certification RS/RNCP →
          </Link>
        </div>
      </section>
    </AdminPageShell>
  );
}
