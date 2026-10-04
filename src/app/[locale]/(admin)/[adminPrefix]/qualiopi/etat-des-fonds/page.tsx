/**
 * Admin — Qualiopi · État des fonds OPCO (lot OPCO A5).
 *
 * Les enveloppes OPCO s'épuisent en cours d'année : suspensions par branche et
 * dates limites de dépôt. Chaque relevé est AJOUTÉ (jamais modifié ni
 * supprimé) ; pour un couple (OPCO, IDCC), le plus récent fait foi. Les fiches
 * client et devis en tirent un bandeau.
 *
 * Server Component — auth + lecture DB. Ajout via composant client.
 */

import type { Metadata } from "next";
import { Ban, CalendarClock, History } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { EtatFondsOpcoForm } from "@/components/admin/qualiopi/EtatFondsOpcoForm";
import { gardePage } from "@/server/auth/garde-page";
import { ajouterReleveEtatFondsAction } from "@/server/actions/qualiopi/etat-fonds-opco";
import { OPCO_IDS, opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";
import {
  STATUTS_FONDS,
  STATUT_FONDS_LABELS,
  formatJourDate,
  relevesEnVigueur,
} from "@/server/qualiopi/financements/etat-fonds-opco";
import { listerRelevesEtatFonds } from "@/server/qualiopi/financements/etat-fonds-opco-lecture";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — État des fonds OPCO | Axion-IA Admin",
  robots: { index: false, follow: false },
};

/** Nom d'hôte de la source, ou l'adresse brute si elle ne se lit pas. */
function hote(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

const STATUT_CLS: Record<string, string> = {
  suspendu: "font-semibold text-[color:var(--color-admin-danger)]",
  reduit: "font-semibold text-[color:var(--color-admin-warning)]",
  ouvert: "text-[color:var(--color-admin-success)]",
};

export default async function QualiopiEtatDesFondsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const tous = await listerRelevesEtatFonds();
  const enVigueur = relevesEnVigueur(tous).sort(
    (a, b) => a.opco.localeCompare(b.opco) || (a.idcc ?? "").localeCompare(b.idcc ?? ""),
  );
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nbSuspensions = enVigueur.filter((r) => r.statut === "suspendu").length;
  const nbDatesAVenir = enVigueur.filter(
    (r) => r.dateLimiteDepot && r.dateLimiteDepot.toISOString().slice(0, 10) >= aujourdhui,
  ).length;
  const dernier = tous[0];

  const opcoOptions = OPCO_IDS.map((id) => ({ id, label: opcoLabel(id) }));
  const statutOptions = STATUTS_FONDS.map((id) => ({ id, label: STATUT_FONDS_LABELS[id] }));

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="État des fonds OPCO"
        description="Suspensions de financement par branche et dates limites de dépôt, relevées sur les sites des OPCO. Chaque relevé s'ajoute aux précédents : le plus récent d'un couple OPCO × IDCC fait foi, rien n'est jamais modifié ni supprimé. Les fiches client et devis affichent un bandeau dès que l'OPCO du client est concerné. Un dernier relevé de plus de 31 jours lève une alerte de veille."
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard
          label="Suspensions en vigueur"
          value={nbSuspensions}
          tone={nbSuspensions > 0 ? "warning" : "success"}
          icon={Ban}
        />
        <AdminStatCard label="Dates limites à venir" value={nbDatesAVenir} icon={CalendarClock} />
        <AdminStatCard
          label="Dernier relevé"
          value={dernier ? formatJourDate(dernier.releveLe) : "—"}
          icon={History}
        />
      </div>

      <div className="mb-[var(--space-admin-8)]">
        <EtatFondsOpcoForm
          ajouterAction={ajouterReleveEtatFondsAction}
          opcoOptions={opcoOptions}
          statutOptions={statutOptions}
        />
      </div>

      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Relevés en vigueur
      </h2>
      {enVigueur.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun relevé. Ajoutez le premier via le formulaire ci-dessus.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>OPCO</th>
                <th className={headCls}>IDCC</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Date limite</th>
                <th className={headCls}>Relevé le</th>
                <th className={headCls}>Source</th>
              </tr>
            </thead>
            <tbody>
              {enVigueur.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <span className="font-medium">{opcoLabel(r.opco)}</span>
                    {r.perimetre ? (
                      <span className="mt-1 block max-w-xs text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {r.perimetre}
                      </span>
                    ) : null}
                  </td>
                  <td className={cellCls}>{r.idcc ?? "Tout l'OPCO"}</td>
                  <td className={cellCls}>
                    <span className={STATUT_CLS[r.statut]}>{STATUT_FONDS_LABELS[r.statut]}</span>
                    {r.note ? (
                      <span className="mt-1 block max-w-sm text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {r.note}
                      </span>
                    ) : null}
                  </td>
                  <td className={cellCls}>
                    {r.dateLimiteDepot ? formatJourDate(r.dateLimiteDepot) : "—"}
                  </td>
                  <td className={cellCls}>{formatJourDate(r.releveLe)}</td>
                  <td className={cellCls}>
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                    >
                      {hote(r.sourceUrl)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {tous.length} relevé{tous.length > 1 ? "s" : ""} au total, historique compris.
      </p>
    </AdminPageShell>
  );
}
