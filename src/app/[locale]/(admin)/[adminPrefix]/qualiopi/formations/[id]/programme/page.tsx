/**
 * Admin — Qualiopi · Programme pédagogique d&apos;une formation.
 *
 * ## Pourquoi cet écran existe
 *
 * `Formation.programmeDetaille` est le programme OPPOSABLE : c&apos;est lui qui
 * part dans la convention, dans le programme remis au client et à l&apos;OPCO, et
 * c&apos;est lui qu&apos;un auditeur Qualiopi ouvre. Il alimente aussi les fiches
 * publiques. Et jusqu&apos;ici, AUCUN écran de la console ne l&apos;affichait :
 * `FormationForm` ne le mentionne pas une seule fois. On vendait, imprimait et
 * publiait un contenu que personne ne pouvait relire sans ouvrir la base.
 *
 * ## D&apos;où vient le contenu affiché
 *
 * Du catalogue `src/content/formations/catalog-v2.ts`, déversé par le bouton
 * « Importer le catalogue ». L&apos;import fait un merge 3-way contre
 * `Formation.catalogSnapshot` : une valeur modifiée ici est PRÉSERVÉE et
 * signalée comme divergence, jamais réécrite en silence. C&apos;est ce qui rend
 * la console utilisable comme surface de relecture — et, demain, d&apos;édition.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { getFormationById } from "@/server/qualiopi/formations/formations";
import {
  lireModulesProgramme,
  formaterDuree,
  type ModuleProgramme,
} from "@/server/qualiopi/documents/programme-modules";
import {
  calculerRatioPratiquePourMinutes,
  BLOCS_COMPTES_COMME_PRATIQUE,
} from "@/server/qualiopi/formations/ratio-pratique";
import { deriveProgrammeSchedule } from "@/content/formations/catalog-v2-schedule";
import type { FormationProgrammeSection } from "@/content/formations/catalog-v2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Programme pédagogique | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Nature des séquences
// ─────────────────────────────────────────────────────────────────────────────

type Tone = "neutral" | "info" | "success" | "warning" | "destructive" | "outline";

/**
 * Libellé et ton par nature de séquence.
 *
 * Les deux natures comptées comme de la pratique (`pratique`, `verification`)
 * portent le ton `success` : la lecture visuelle de la colonne doit donner le
 * ratio avant qu&apos;on lise le chiffre. C&apos;est le seul endroit où la
 * couleur porte de l&apos;information, pas de la décoration.
 */
const NATURES: Record<string, { libelle: string; tone: Tone }> = {
  objectif: { libelle: "Objectif", tone: "neutral" },
  cadre: { libelle: "Cadre", tone: "info" },
  demonstration: { libelle: "Démonstration", tone: "info" },
  pratique: { libelle: "Atelier", tone: "success" },
  verification: { libelle: "Vérification", tone: "success" },
  synthese: { libelle: "Synthèse", tone: "neutral" },
  pause: { libelle: "Pause", tone: "outline" },
};

/** Une nature inconnue se montre telle quelle plutôt que de disparaître. */
function natureDe(type: string | null): { libelle: string; tone: Tone } {
  if (type === null) return { libelle: "Non qualifiée", tone: "warning" };
  return NATURES[type] ?? { libelle: type, tone: "warning" };
}

/** Somme des durées connues d&apos;un module. `null` si aucune ne l&apos;est. */
function dureeModuleMin(module: ModuleProgramme): number | null {
  const connues = module.sequences.map((s) => s.dureeMin).filter((d): d is number => d !== null);
  return connues.length > 0 ? connues.reduce((a, b) => a + b, 0) : module.dureeMin;
}

/**
 * Le programme, converti dans la forme qu&apos;attend la dérivation horaire.
 *
 * On réutilise `deriveProgrammeSchedule` — la même fonction que la fiche
 * publique — plutôt que de recalculer des heures ici : deux calculs d&apos;horaire
 * finiraient par diverger, et l&apos;écran de contrôle afficherait alors autre
 * chose que ce que le client a sous les yeux.
 */
function versSectionsHoraire(modules: ModuleProgramme[]): FormationProgrammeSection[] {
  return modules.map((m) => ({
    titreFr: m.titre,
    steps: m.sequences.map((s) =>
      s.dureeMin === null ? { titre: s.titre } : { temps: `${s.dureeMin}'`, titre: s.titre },
    ),
  }));
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function QualiopiFormationProgrammePage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;

  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const formation = await getFormationById(id);
  if (!formation) notFound();

  const formationBase = `/${locale}/${adminPrefix}/qualiopi/formations/${id}`;

  const modules = lireModulesProgramme(formation.programmeDetaille);
  const dureeVendueMin = Math.round(formation.dureeHeures * 60);
  const ratio = calculerRatioPratiquePourMinutes(modules, dureeVendueMin);
  const horaires = deriveProgrammeSchedule(versSectionsHoraire(modules));
  const sequencesTotal = modules.reduce((n, m) => n + m.sequences.length, 0);
  const nonQualifiees = modules.reduce(
    (n, m) => n + m.sequences.filter((s) => s.type === null).length,
    0,
  );

  /**
   * Le programme en base diffère-t-il de la dernière valeur importée ?
   *
   * `catalogSnapshot` est la baseline du merge 3-way. Un écart signifie qu&apos;on
   * a édité ici — donc que le catalogue n&apos;est PLUS la source de cette
   * formation, et qu&apos;une ré-importation préservera la version console.
   * L&apos;écran doit le dire : « où est la source » est précisément la question
   * qu&apos;on vient poser ici.
   */
  const snapshot = formation.catalogSnapshot as { programmeDetaille?: unknown } | null;
  const baseline = snapshot?.programmeDetaille;
  const editeEnConsole =
    baseline !== undefined &&
    JSON.stringify(baseline) !== JSON.stringify(formation.programmeDetaille);

  const ecartDureeMin = ratio.minutesProgrammees - dureeVendueMin;
  const labelCls = "text-[13px] font-medium text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-5)]">
        <Link
          href={formationBase}
          className="text-[13px] text-[color:var(--color-admin-fg-muted)] hover:underline"
        >
          ← {formation.titre}
        </Link>
      </div>

      <AdminPageHeader
        title="Programme pédagogique"
        description={`${formation.titre} · ${formation.dureeHeures} h vendues · ${modules.length} module${modules.length > 1 ? "s" : ""}`}
      />

      {modules.length === 0 ? (
        <AdminEmptyState
          variant="card"
          title="Aucun programme structuré"
          description="Cette formation n'a pas de programme détaillé exploitable en base. Il est produit par l'import du catalogue, depuis la liste des formations."
          primaryAction={
            <Link
              href={`/${locale}/${adminPrefix}/qualiopi/formations`}
              className="text-[14px] font-medium underline"
            >
              Aller à la liste des formations
            </Link>
          }
        />
      ) : (
        <>
          <section className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label="Temps programmé"
              value={formaterDuree(ratio.minutesProgrammees) ?? "—"}
              meta={
                ecartDureeMin === 0
                  ? `Exactement les ${formation.dureeHeures} h vendues`
                  : ecartDureeMin > 0
                    ? `${ecartDureeMin} min de plus que les ${formation.dureeHeures} h vendues`
                    : `${Math.abs(ecartDureeMin)} min vendues et non écrites`
              }
              tone={ecartDureeMin === 0 ? "success" : "warning"}
            />
            <AdminStatCard
              label="Part de pratique"
              value={ratio.pct === null ? "Inconnue" : `${ratio.pct} %`}
              meta={
                ratio.pct === null
                  ? "Le programme ne porte aucune durée exploitable"
                  : `Seuil attendu pour ce format : ${ratio.seuilPct} %`
              }
              tone={ratio.pct === null ? "warning" : ratio.atteintSeuil ? "success" : "destructive"}
            />
            <AdminStatCard
              label="Temps de pratique"
              value={formaterDuree(ratio.minutesPratique) ?? "—"}
              meta="Ateliers et vérifications, hors démonstrations et exposés"
            />
            <AdminStatCard
              label="Séquences"
              value={sequencesTotal}
              meta={
                nonQualifiees === 0
                  ? "Toutes qualifiées"
                  : `${nonQualifiees} sans nature — non comptées dans la pratique`
              }
              tone={nonQualifiees === 0 ? "success" : "warning"}
            />
          </section>

          <AdminCard variant="informational" as="section" className="mb-[var(--space-admin-7)]">
            <h2 className="mb-[var(--space-admin-4)] text-[15px] font-semibold">
              D&apos;où vient ce programme
            </h2>
            <dl className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
              <div>
                <dt className={labelCls}>Source</dt>
                <dd className="mt-1 text-[14px]">
                  <code className="text-[13px]">src/content/formations/catalog-v2.ts</code>
                  <span className="block text-[13px] text-[color:var(--color-admin-fg-muted)]">
                    Déversé en base par « Importer le catalogue », depuis la liste des formations.
                  </span>
                </dd>
              </div>
              <div>
                <dt className={labelCls}>État</dt>
                <dd className="mt-1 text-[14px]">
                  {baseline === undefined ? (
                    <>
                      <AdminBadge tone="warning">Jamais importée</AdminBadge>
                      <span className="mt-1 block text-[13px] text-[color:var(--color-admin-fg-muted)]">
                        Aucune référence catalogue enregistrée : une importation reporterait tout
                        écart au lieu d&apos;écraser.
                      </span>
                    </>
                  ) : editeEnConsole ? (
                    <>
                      <AdminBadge tone="info">Modifiée depuis l&apos;import</AdminBadge>
                      <span className="mt-1 block text-[13px] text-[color:var(--color-admin-fg-muted)]">
                        Le programme en base diffère du catalogue. Une ré-importation le préservera
                        et signalera la divergence.
                      </span>
                    </>
                  ) : (
                    <>
                      <AdminBadge tone="success">Conforme au catalogue</AdminBadge>
                      <span className="mt-1 block text-[13px] text-[color:var(--color-admin-fg-muted)]">
                        Pour modifier ce programme, modifier le catalogue puis ré-importer.
                      </span>
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </AdminCard>

          <section className="flex flex-col gap-[var(--space-admin-6)]">
            {modules.map((module, iModule) => {
              const duree = dureeModuleMin(module);
              const items = horaires[iModule]?.items ?? [];
              return (
                <AdminCard key={`${module.titre}-${iModule}`} variant="informational" as="article">
                  <header className="mb-[var(--space-admin-5)] flex flex-wrap items-baseline justify-between gap-[var(--space-admin-3)]">
                    <h3 className="text-[15px] font-semibold">{module.titre}</h3>
                    <span className={labelCls}>
                      {formaterDuree(duree) ?? "durée inconnue"}
                      {items[0] !== undefined && ` · à partir de ${items[0].time}`}
                    </span>
                  </header>

                  <ol className="flex flex-col">
                    {module.sequences.map((sequence, iSequence) => {
                      const nature = natureDe(sequence.type);
                      const compteCommePratique =
                        sequence.type !== null &&
                        (BLOCS_COMPTES_COMME_PRATIQUE as readonly string[]).includes(sequence.type);
                      return (
                        <li
                          key={`${sequence.titre}-${iSequence}`}
                          className="flex flex-wrap items-baseline gap-x-[var(--space-admin-4)] gap-y-1 border-t border-[color:var(--color-admin-border)] py-[var(--space-admin-3)] first:border-t-0"
                        >
                          <span
                            className={`w-[62px] shrink-0 text-[13px] tabular-nums ${compteCommePratique ? "font-semibold" : "text-[color:var(--color-admin-fg-muted)]"}`}
                          >
                            {items[iSequence]?.time ?? "—"}
                          </span>
                          <span className="w-[52px] shrink-0 text-[13px] text-[color:var(--color-admin-fg-muted)] tabular-nums">
                            {sequence.dureeMin === null ? "—" : `${sequence.dureeMin} min`}
                          </span>
                          <span className="w-[118px] shrink-0">
                            <AdminBadge tone={nature.tone} compact>
                              {nature.libelle}
                            </AdminBadge>
                          </span>
                          <span className="min-w-[220px] flex-1 text-[14px]">{sequence.titre}</span>
                        </li>
                      );
                    })}
                  </ol>
                </AdminCard>
              );
            })}
          </section>
        </>
      )}
    </AdminPageShell>
  );
}
