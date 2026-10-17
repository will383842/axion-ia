/**
 * Admin — Qualiopi · Registre de veille (T12 / off.23-25).
 *
 * Liste les entrées de veille et expose le formulaire de création.
 * Server Component — auth + lecture DB. Composants clients pour les mutations.
 *
 * Chantier QNC, L10 — chaque ligne montre la date de l'INFORMATION et la date
 * de SAISIE (serveur, heure de Paris). `qualiopi.veille.actif` allumé : la
 * décision humaine (auteur, pièce modifiée) et les gestes tracés remplacent
 * « Modifier » et « Supprimer » ; les versions archivées restent lisibles.
 */

import type { Metadata } from "next";
import { CheckCircle2, GraduationCap, Hash, ShieldCheck } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { formatSaisieParis, lireRegistreVeille } from "@/server/qualiopi/veille/registre-veille";
import {
  archiverVeilleAction,
  corrigerVeilleAction,
  creerVeilleAction,
  deciderVeilleAction,
  updateVeilleAction,
  supprimerVeilleAction,
} from "@/server/actions/qualiopi/veille";
import { VeilleTraceeActions } from "@/components/admin/qualiopi/VeilleTraceeActions";
import { genererRegistrePdfAction } from "@/server/actions/qualiopi/exports-pdf";
import { VeilleForm } from "@/components/admin/qualiopi/VeilleForm";
import { VeilleRowActions } from "@/components/admin/qualiopi/VeilleRowActions";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Veille | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const TYPE_LABELS: Record<string, string> = {
  legale: "Légale / réglementaire",
  metiers: "Emplois / métiers",
  pedagogique: "Pédagogique / technologique",
  handicap: "Handicap",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiVeillePage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const registre = await lireRegistreVeille({ take: 300 });
  const { tracee } = registre;
  // Veille tracée : une version archivée (corrigée, décidée, retirée) n'est plus
  // « en vigueur » ; elle reste lisible plus bas, jamais effacée.
  const veilles = registre.lignes.filter((v) => v.archivage === null).slice(0, 100);
  const archivees = tracee ? registre.lignes.filter((v) => v.archivage !== null) : [];

  const parType = (type: string) => veilles.filter((v) => v.type === type).length;
  // Veille tracée : seule une décision PRISE PAR UNE PERSONNE compte.
  const avecAction = veilles.filter((v) =>
    tracee ? v.decision !== null : v.actionDecidee != null,
  ).length;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Veille"
        description="Registre de veille réglementaire, métiers et pédagogique (indicateurs 23 à 25). Chaque entrée doit préciser l'action décidée (preuve d'exploitation)."
        actions={
          <PdfExportButton
            label="Exporter le journal (PDF)"
            input={{ type: "veille" as const }}
            action={genererRegistrePdfAction}
          />
        }
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total entrées" value={veilles.length} icon={Hash} />
        <AdminStatCard
          label="Avec action décidée"
          value={avecAction}
          tone={avecAction < veilles.length ? "warning" : "success"}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="Légale / réglementaire"
          value={parType("legale")}
          icon={ShieldCheck}
        />
        <AdminStatCard label="Pédagogique" value={parType("pedagogique")} icon={GraduationCap} />
      </div>

      {/* Formulaire création */}
      <div className="mb-[var(--space-admin-8)]">
        <VeilleForm creerAction={creerVeilleAction} tracee={tracee} />
      </div>

      {/* Liste */}
      {veilles.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune entrée de veille. Créez la première via le formulaire ci-dessus.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Date de l&apos;information</th>
                <th className={headCls}>Saisie le</th>
                <th className={headCls}>Type</th>
                <th className={headCls}>Titre</th>
                <th className={headCls}>Source</th>
                <th className={headCls}>Impact</th>
                <th className={headCls}>Action décidée</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {veilles.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    {v.dateVeille.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                  </td>
                  <td className={cellCls}>
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {formatSaisieParis(v.saisieLe)}
                    </span>
                  </td>
                  <td className={cellCls}>
                    <span className="text-[length:var(--text-admin-xs)] font-medium">
                      {TYPE_LABELS[v.type] ?? v.type}
                    </span>
                  </td>
                  <td className={cellCls}>
                    <div className="font-medium">{v.titre}</div>
                    <div
                      className="line-clamp-2 max-w-sm text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                      title={v.contenu}
                    >
                      {v.contenu}
                    </div>
                  </td>
                  <td className={cellCls}>
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {v.source}
                    </span>
                  </td>
                  <td className={cellCls}>
                    {v.impact != null ? (
                      <span className="text-[length:var(--text-admin-xs)]">{v.impact}</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {tracee && v.decision !== null ? (
                      <div className="text-[length:var(--text-admin-xs)]">
                        <span className="text-[color:var(--color-admin-success)]">
                          {v.actionDecidee}
                        </span>
                        <div className="text-[color:var(--color-admin-fg-muted)]">
                          Décidée par {v.decision.par}, le {formatSaisieParis(v.decision.le)} ·
                          pièce modifiée : {v.decision.pieceModifiee}
                        </div>
                      </div>
                    ) : tracee && v.actionDecidee != null ? (
                      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                        {v.actionDecidee} — sans décision tracée : à décider
                      </span>
                    ) : v.actionDecidee != null ? (
                      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]">
                        {v.actionDecidee}
                      </span>
                    ) : (
                      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                        À définir
                      </span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {tracee ? (
                      <VeilleTraceeActions
                        veille={{
                          id: v.id,
                          source: v.source,
                          titre: v.titre,
                          contenu: v.contenu,
                          impact: v.impact,
                          decidee: v.decision !== null,
                        }}
                        deciderAction={deciderVeilleAction}
                        corrigerAction={corrigerVeilleAction}
                        archiverAction={archiverVeilleAction}
                      />
                    ) : (
                      <VeilleRowActions
                        veille={{
                          id: v.id,
                          type: v.type,
                          source: v.source,
                          titre: v.titre,
                          contenu: v.contenu,
                          dateVeille: v.dateVeille,
                          impact: v.impact ?? null,
                          actionDecidee: v.actionDecidee ?? null,
                        }}
                        updateAction={updateVeilleAction}
                        supprimerAction={supprimerVeilleAction}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {archivees.length > 0 && (
        <details className="mt-[var(--space-admin-8)]">
          <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
            Versions archivées ({archivees.length}) — rien ne s&apos;efface du registre
          </summary>
          <ul className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]">
            {archivees.map((v) => (
              <li
                key={v.id}
                className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
              >
                <span className="font-medium text-[color:var(--color-admin-fg)]">{v.titre}</span> —
                information du{" "}
                {v.dateVeille.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}, saisie le{" "}
                {formatSaisieParis(v.saisieLe)} · archivée le {formatSaisieParis(v.archivage?.le)} :{" "}
                {v.archivage?.motif}
              </li>
            ))}
          </ul>
        </details>
      )}
    </AdminPageShell>
  );
}
