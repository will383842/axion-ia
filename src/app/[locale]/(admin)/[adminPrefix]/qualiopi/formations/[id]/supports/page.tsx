/**
 * Admin — Qualiopi · Supports de formation (T13).
 *
 * Liste les SupportFormation rattachés à une formation et propose des boutons
 * de génération par type. Server Component (auth + redirect, force-dynamic).
 *
 * Pattern : formations/page.tsx (AdminPageShell, auth, redirect, stub-safe).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { getFormationById } from "@/server/qualiopi/formations/formations";
import { SUPPORT_TYPE_LABELS } from "@/server/qualiopi/supports/support-builder";
import {
  GenererSupportButton,
  type SupportTypeValue,
} from "@/components/admin/qualiopi/GenererSupportButton";
import { GenererTousSupportsButton } from "@/components/admin/qualiopi/GenererTousSupportsButton";
import {
  genererSupportAction,
  regenererSupportAction,
  supprimerSupportAction,
  genererTousSupportsAction,
} from "@/server/actions/qualiopi/supports";
import type {
  SupportType,
  SupportStatut,
} from "../../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Supports de formation | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

// Libellés = SSOT SUPPORT_TYPE_LABELS (support-builder.ts) : mêmes mots à
// l'écran, dans le titre persisté et sur le badge PDF. Avant le 2026-08-05,
// trois tables divergeaient (« Diapositives » ici, « Diaporama » au titre,
// « SLIDES » au PDF). Les supports générés avant gardent l'ancien titre
// jusqu'à régénération (version++).
const TYPE_LABELS_RAW: Record<SupportType, string> = SUPPORT_TYPE_LABELS;

const STATUT_LABELS: Record<SupportStatut, string> = {
  brouillon: "Brouillon",
  genere: "Généré",
  archive: "Archivé",
};

/**
 * Les types que le Formation Engine sait GÉNÉRER — d'où `SupportTypeValue` et
 * non `SupportType`.
 *
 * `kit_formateur_imprime` en est volontairement absent : le kit est écrit à la
 * main dans `_KIT/<slug>/` et publié par `scripts/kit-formateur/publier-vers-r2.ts`.
 * Lui donner un bouton « Générer » ici produirait un classeur vide qui
 * écraserait le vrai. Il apparaît plus bas, en lecture seule.
 */
const ALL_TYPES: SupportTypeValue[] = [
  "slides_formateur",
  "slides_stagiaire",
  "livret_stagiaire",
  "memo",
  "guide_animation",
  "exercices",
  "grille_eval",
];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function QualiopiFormationSupportsPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;

  // Auth
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  // Formation
  const formation = await getFormationById(id);
  if (formation === null) {
    redirect(`/${locale}/${adminPrefix}/qualiopi/formations`);
  }

  // Supports existants
  let supports: Array<{
    id: string;
    type: SupportType;
    titre: string;
    version: number;
    statut: SupportStatut;
    pdfUrl: string | null;
    aiGenerated: boolean;
    generatedAt: Date | null;
  }> = [];

  try {
    supports = await prisma.supportFormation.findMany({
      where: { formationId: id },
      orderBy: { type: "asc" },
      select: {
        id: true,
        type: true,
        titre: true,
        version: true,
        statut: true,
        pdfUrl: true,
        aiGenerated: true,
        generatedAt: true,
      },
    });
  } catch {
    // stub-safe : stub Proxy → [] au build
  }

  // Index des supports existants par type
  const supportByType = new Map(supports.map((s) => [s.type, s]));

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={`/${locale}/${adminPrefix}/qualiopi/formations`}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-accent)]"
        >
          ← Formations
        </Link>
      </div>

      <AdminPageHeader
        title={`Supports — ${formation.titre}`}
        description={`7 types de supports pédagogiques à la charte pour la formation ${formation.numero}. Chaque type peut être généré indépendamment, ou tous d'un coup ci-dessous.`}
      />

      <GenererTousSupportsButton formationId={id} genererTousAction={genererTousSupportsAction} />

      <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
        <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <thead className="border-b border-[color:var(--color-admin-border)]">
            <tr>
              <th className={headCls}>Type</th>
              <th className={headCls}>Titre</th>
              <th className={headCls}>Version</th>
              <th className={headCls}>Statut</th>
              <th className={headCls}>IA</th>
              <th className={headCls}>PDF</th>
              <th className={headCls}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ALL_TYPES.map((type) => {
              const support = supportByType.get(type);
              return (
                <tr
                  key={type}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  {/* Type */}
                  <td className={cellCls}>
                    <span className="font-medium">{TYPE_LABELS_RAW[type]}</span>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {type}
                    </div>
                  </td>

                  {/* Titre */}
                  <td className={cellCls}>
                    {support != null ? (
                      <span>{support.titre}</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>

                  {/* Version */}
                  <td className={cellCls}>
                    {support != null ? (
                      <span className="font-mono text-[length:var(--text-admin-xs)]">
                        v{support.version}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>

                  {/* Statut */}
                  <td className={cellCls}>
                    {support != null ? (
                      <span
                        className={
                          support.statut === "genere"
                            ? "text-[color:var(--color-admin-success)]"
                            : support.statut === "archive"
                              ? "text-[color:var(--color-admin-fg-muted)]"
                              : "text-[color:var(--color-admin-warning)]"
                        }
                      >
                        {STATUT_LABELS[support.statut]}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">Non généré</span>
                    )}
                  </td>

                  {/* IA */}
                  <td className={cellCls}>
                    {support != null ? (
                      support.aiGenerated ? (
                        <span className="text-[color:var(--color-admin-accent)]">Oui</span>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
                      )
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>

                  {/* PDF — `pdfUrl` = témoin d'upload R2, pas cible : l'URL stockée
                      est pré-signée 900 s et périmée. La route re-signe à la
                      demande depuis `pdfKey`. Cf. `/api/qualiopi/supports/[id]`. */}
                  <td className={cellCls}>
                    {support?.pdfUrl != null ? (
                      <a
                        href={`/api/qualiopi/supports/${support.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-button-ghost"
                      >
                        Télécharger
                      </a>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className={cellCls}>
                    <GenererSupportButton
                      formationId={id}
                      type={type}
                      supportId={support?.id}
                      genererAction={genererSupportAction}
                      regenererAction={regenererSupportAction}
                      supprimerAction={supprimerSupportAction}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Le kit imprimé — présent en base mais absent du tableau ci-dessus,
          parce qu'il ne se génère pas : il s'écrit dans `_KIT/<slug>/` et se
          publie par script. Affiché ici pour qu'il soit récupérable depuis la
          console, sans laisser croire qu'un bouton « Générer » le produirait. */}
      {(() => {
        const kit = supportByType.get("kit_formateur_imprime");
        if (!kit) return null;
        return (
          <div className="mt-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
            <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
              Kit formateur imprimé — version {kit.version}
            </h2>
            <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Le classeur des plans B, écrit à la main et publié par{" "}
              <code>scripts/kit-formateur/publier-vers-r2.ts</code>. Il ne se génère pas depuis
              cette page : le produire depuis le moteur donnerait un classeur vide. Les formateurs
              affectés le récupèrent seuls depuis leur session.
            </p>
            <a
              href={`/api/qualiopi/supports/${kit.id}`}
              className="mt-[var(--space-admin-3)] inline-block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline"
            >
              Télécharger le PDF
            </a>
          </div>
        );
      })()}
    </AdminPageShell>
  );
}
