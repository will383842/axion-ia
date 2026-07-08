/**
 * Admin — Qualiopi · Formation Engine · File de validations humaines (T4).
 *
 * Liste les FileValidation en_attente : formation, étape, date, contenuPropose résumé.
 * La validation (approve/reject) est portée par les Server Actions
 * approveFileValidationAction / rejectFileValidationAction, câblées ici via le
 * composant client `ValidationActions` (point de contrôle humain — AI Act art. 50).
 *
 * Server Component — force-dynamic, noindex. Les boutons d'action sont un îlot
 * client (`ValidationActions`) recevant les server actions en props.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import {
  ValidationActions,
  type EtapeValidation,
} from "@/components/admin/qualiopi/ValidationActions";
import {
  approveFileValidationAction,
  rejectFileValidationAction,
} from "@/server/actions/qualiopi/engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Validations Engine | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const ETAPE_LABELS: Record<string, string> = {
  structure: "Structure pédagogique",
  contenu: "Contenu complet",
  assemblage: "Assemblage final",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function FormationEngineValidationsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  let validations: Array<{
    id: string;
    etape: string;
    statut: string;
    contenuPropose: unknown;
    createdAt: Date;
    formation: { id: string; numero: string; titre: string; statutGeneration: string };
  }> = [];

  try {
    validations = await prisma.fileValidation.findMany({
      where: { statut: "en_attente" },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        etape: true,
        statut: true,
        contenuPropose: true,
        createdAt: true,
        formation: {
          select: {
            id: true,
            numero: true,
            titre: true,
            statutGeneration: true,
          },
        },
      },
    });
  } catch {
    // Stub-aware : dégradé silencieux au build
  }

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Validations en attente"
        description="File des contenus générés par l'IA en attente de validation humaine. La validation est obligatoire (AI Act art. 50 — ADR 0024). Approuvez ou rejetez chaque étape depuis la fiche de formation."
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2">
        <AdminStatCard
          label="Validations en attente"
          value={validations.length}
          tone={validations.length > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Formations concernées"
          value={new Set(validations.map((v) => v.formation.id)).size}
          tone="default"
        />
      </div>

      {validations.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune validation en attente. Le pipeline de génération IA est à jour.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Formation</th>
                <th className={headCls}>Étape</th>
                <th className={headCls}>Date</th>
                <th className={headCls}>Aperçu contenu proposé</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {validations.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  {/* Formation */}
                  <td className={cellCls}>
                    <div className="font-medium">{v.formation.titre}</div>
                    <div className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {v.formation.numero}
                    </div>
                    <div className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      Statut : {v.formation.statutGeneration}
                    </div>
                  </td>

                  {/* Étape */}
                  <td className={cellCls}>
                    <span className="inline-block rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-warning-subtle,theme(colors.amber.50))] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-warning)]">
                      {ETAPE_LABELS[v.etape] ?? v.etape}
                    </span>
                  </td>

                  {/* Date */}
                  <td className={cellCls}>
                    <time
                      dateTime={v.createdAt.toISOString()}
                      className="font-mono text-[length:var(--text-admin-xs)]"
                    >
                      {v.createdAt.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </td>

                  {/* Aperçu contenu proposé */}
                  <td className={cellCls}>
                    <div className="max-w-xs">
                      {v.contenuPropose !== null && v.contenuPropose !== undefined ? (
                        <pre className="max-h-32 overflow-y-auto rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-canvas)] p-[var(--space-admin-2)] font-mono text-[length:var(--text-admin-xs)] whitespace-pre-wrap text-[color:var(--color-admin-fg-muted)]">
                          {summarizeContenu(v.contenuPropose)}
                        </pre>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                      )}
                    </div>
                  </td>

                  {/* Actions — approuver / rejeter (point de contrôle humain) */}
                  <td className={cellCls}>
                    <ValidationActions
                      id={v.id}
                      etape={v.etape as EtapeValidation}
                      approuverAction={approveFileValidationAction}
                      rejeterAction={rejectFileValidationAction}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Approuver fait avancer la génération (contenu → contenu validé → assemblage → publication).
        Rejeter renvoie l&apos;étape en correction avec votre consigne. Retour aux{" "}
        <a
          href={`/${locale}/${adminPrefix}/qualiopi/formations`}
          className="underline hover:no-underline"
        >
          Formations
        </a>
        .
      </p>
    </AdminPageShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function summarizeContenu(contenuPropose: unknown): string {
  if (typeof contenuPropose === "string") {
    return contenuPropose.slice(0, 300) + (contenuPropose.length > 300 ? "…" : "");
  }
  if (typeof contenuPropose === "object" && contenuPropose !== null) {
    const snap = (contenuPropose as Record<string, unknown>)["snapshot"];
    if (typeof snap === "string") {
      return snap.slice(0, 300) + (snap.length > 300 ? "…" : "");
    }
    const str = JSON.stringify(contenuPropose, null, 2);
    return str.slice(0, 300) + (str.length > 300 ? "…" : "");
  }
  return "—";
}
