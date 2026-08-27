/**
 * Admin — Qualiopi · Catalogue des formations (T3).
 *
 * Liste les formations issues du Formation Engine. Miroir du pattern
 * `qualiopi/offres/page.tsx` (auth, AdminPageShell, AdminStatCard,
 * force-dynamic, noindex). Server Component.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, GraduationCap, Hourglass, Archive } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { ImportCatalogFormationsButton } from "@/components/admin/qualiopi/ImportCatalogFormationsButton";
import {
  ARCHIVE_FILTER_PARAM,
  applyArchiveFilter,
  parseArchiveFilter,
} from "@/components/admin/qualiopi/archive-filter";
import { listFormations } from "@/server/qualiopi/formations/formations";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Formations | Axion-IA Admin",
  robots: { index: false, follow: false },
};

/** Libellés humains pour les statuts de génération. */
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

/** Libellés humains pour les statuts de formation. */
const STATUT_LABELS: Record<string, string> = {
  actif: "Actif",
  publie: "Publié",
  archive: "Archivé",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QualiopiFormationsPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const vue = parseArchiveFilter((await searchParams)[ARCHIVE_FILTER_PARAM]);

  // Une formation « vivante » n'est pas archivée. Attention : le statut porté par
  // les formations en service est `actif` (posé par l'import catalogue), PAS
  // `publie` — compter `publie` renvoyait 0 alors que 22 formations tournent.
  const toutes = await listFormations();
  const actives = toutes.filter((f) => f.statut !== "archive");
  const archivees = toutes.filter((f) => f.statut === "archive");

  const formations = applyArchiveFilter(vue, actives, archivees);

  // Compteurs sur la SEULE offre vivante : les archives sont hors console
  // (décision Will), les afficher dans une carte les remettrait sous les yeux.
  const brouillons = actives.filter((f) => f.statutGeneration !== "publie").length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Formations"
        // « Formation Engine » est un nom de module interne et « offres_site »
        // un nom de table : ni l'un ni l'autre ne dit quoi que ce soit au
        // lecteur de cette console.
        description="Catalogue des formations générées par l'atelier de contenu. Chaque formation est rattachée à une offre du référentiel commercial."
        actions={
          <div className="flex flex-wrap items-start justify-end gap-[var(--space-admin-3)]">
            <ImportCatalogFormationsButton />
            <Link
              href={`/${locale}/${adminPrefix}/qualiopi/formations/new`}
              className="admin-button shrink-0"
            >
              + Nouvelle formation
            </Link>
          </div>
        }
      />

      {/* 🔴 « Total » et « Actives » affichaient TOUTES DEUX `actives.length` :
          deux tuiles côte à côte qui ne pouvaient mathématiquement jamais
          différer. `toutes` contient les archivées EN PLUS des actives — c'est
          lui le total. La tuile « Archivées » remplace le doublon : c'est
          l'information qui manquait pour que la soustraction se lise. */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="Total" value={toutes.length} icon={GraduationCap} />
        <AdminStatCard label="Actives" value={actives.length} tone="success" icon={CheckCircle2} />
        <AdminStatCard label="Archivées" value={archivees.length} icon={Archive} />
        <AdminStatCard
          label="Contenu en cours de rédaction"
          value={brouillons}
          tone={brouillons > 0 ? "warning" : "default"}
          icon={Hourglass}
        />
      </div>

      {formations.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          {actives.length === 0 ? (
            <>
              Aucune formation active. Cliquez sur <strong>« Importer le catalogue »</strong> pour
              créer d&apos;un coup les formations du catalogue public (prêtes pour sessions,
              conventions et factures), ou lancez une génération depuis le Formation Engine.
            </>
          ) : (
            <>Aucune formation dans cette vue.</>
          )}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Numéro</th>
                <th className={headCls}>Titre</th>
                <th className={headCls}>Offre</th>
                <th className={headCls}>Durée (h)</th>
                {/* 🔴 Trois colonnes de statut se suivaient — « Statut
                    génération » (Publié), « Statut » (Actif), « Validée »
                    (Non) — sans qu'aucun libellé ne dise laquelle fait foi.
                    Question de Will le 2026-08-03 ; vérifié dans le code :

                    · `statut` est LA colonne opérationnelle. C'est sur elle
                      que cette page filtre les formations vivantes, et l'import
                      catalogue y pose `actif` (compter `publie` renvoyait 0
                      alors que 22 formations tournent — cf. plus haut). Elle
                      passe donc en tête et garde le nom court « Statut ».

                    · `statutGeneration` décrit l'avancement du CONTENU dans le
                      Formation Engine (intention → … → publié), pas la vente.
                      Renommée « Contenu » pour qu'on cesse de la confondre.

                    · ⚠️ `validatedAt` N'EST PAS DÉCORATIF et ne doit pas être
                      masqué : c'est la validation humaine exigée par l'AI Act
                      art. 50, et `publishFormationAction` la vérifie comme
                      PRÉRÉQUIS BLOQUANT de publication. « Non » sur les 22
                      formations est une information de conformité. Renommée
                      « Validation humaine », avec l'exigence en infobulle. */}
                <th className={headCls}>Statut</th>
                <th className={headCls}>Contenu</th>
                <th
                  className={headCls}
                  title="Validation humaine obligatoire avant publication (AI Act art. 50)"
                >
                  Validation humaine
                </th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {formations.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  {/* Numéro */}
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">{f.numero}</span>
                  </td>

                  {/* Titre + slug */}
                  <td className={cellCls}>
                    <div className="font-medium">{f.titre}</div>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      /formations/{f.slug}
                    </div>
                  </td>

                  {/* Offre — code lisible (AXI-OFF-NNN) résolu via la relation
                      offreSite, plutôt que l'UUID offreSiteId brut. */}
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">
                      {f.offreSite.code}
                    </span>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {f.offreSite.titreFr}
                    </div>
                  </td>

                  {/* Durée */}
                  <td className={cellCls}>{f.dureeHeures}</td>

                  {/* Statut — la colonne qui fait foi, désormais en tête.
                      `actif` tombait dans la branche « autre » et sortait donc
                      en ORANGE d'avertissement : les 22 formations en service
                      s'affichaient comme si quelque chose clochait. C'est
                      l'état normal d'une formation vivante — il passe au vert,
                      comme `publie`. */}
                  <td className={cellCls}>
                    {f.statut === "publie" ? (
                      <span className="font-medium text-[color:var(--color-admin-success)]">
                        ● {STATUT_LABELS[f.statut]}
                      </span>
                    ) : f.statut === "archive" ? (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        ○ {STATUT_LABELS[f.statut]}
                      </span>
                    ) : (
                      <span className="font-medium text-[color:var(--color-admin-success)]">
                        ● {STATUT_LABELS[f.statut] ?? f.statut}
                      </span>
                    )}
                  </td>

                  {/* Contenu (avancement Formation Engine) — secondaire. */}
                  <td className={cellCls}>
                    <span
                      className={
                        f.statutGeneration === "publie"
                          ? "text-[color:var(--color-admin-fg-muted)]"
                          : f.statutGeneration === "archive"
                            ? "text-[color:var(--color-admin-fg-muted)]"
                            : "text-[color:var(--color-admin-warning)]"
                      }
                    >
                      {GENERATION_LABELS[f.statutGeneration] ?? f.statutGeneration}
                    </span>
                  </td>

                  {/* Validation humaine */}
                  <td className={cellCls}>
                    {f.validatedAt != null ? (
                      <span className="text-[color:var(--color-admin-success)]">Oui</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className={cellCls}>
                    {/* Même forme que Sessions : trois destinations empilées en
                        texte souligné. On encadre les trois, « Éditer » en tête
                        car c'est le geste attendu depuis une liste. */}
                    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/formations/${f.id}`}
                        className="admin-button-secondary"
                      >
                        Éditer
                      </Link>
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/formations/${f.id}/supports`}
                        className="admin-button-ghost"
                      >
                        Supports
                      </Link>
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/formations/${f.id}/certification`}
                        className="admin-button-ghost"
                      >
                        Certification
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
