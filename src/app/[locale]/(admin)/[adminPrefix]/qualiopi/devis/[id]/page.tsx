/**
 * Admin — Qualiopi · Détail d&apos;un devis (T19 Cluster E4a).
 *
 * Affiche :
 *   - Fiche de statut (numéro, client, montant, financement, validité, mention TVA).
 *   - Lignes du devis.
 *   - `DevisLifecycleButtons` (envoyer / accepter / refuser selon statut).
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { DevisLifecycleButtons } from "@/components/admin/qualiopi/DevisLifecycleButtons";
import { getDevis } from "@/server/qualiopi/crm/devis";
import { getClient } from "@/server/qualiopi/crm/clients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Devis | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & libellés
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  transforme_convention: "Transformé en convention",
};

const FINANCEMENT_LABELS: Record<string, string> = {
  direct: "Direct (entreprise)",
  opco: "OPCO",
  cpf: "CPF / EDOF",
  france_travail: "France Travail",
};

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types des lignes JSON
// ─────────────────────────────────────────────────────────────────────────────

interface DevisLigne {
  designation: string;
  quantite: number;
  prixUnitaireHtCents: number;
  offreTierId?: string;
}

function parseLignes(raw: unknown): DevisLigne[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l): l is DevisLigne =>
      typeof l === "object" &&
      l !== null &&
      typeof (l as Record<string, unknown>).designation === "string",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function QualiopiDevisDetailPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const devis = await getDevis(id);
  if (!devis) notFound();

  const client = await getClient(devis.clientId);

  const devisBase = `/${locale}/${adminPrefix}/qualiopi/devis`;
  const lignes = parseLignes(devis.lignes);

  const isExpired =
    (devis.statut === "brouillon" || devis.statut === "envoye") && devis.dateValidite < new Date();

  const infoLabelCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const infoValueCls =
    "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";
  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      {/* Fil d&apos;Ariane */}
      <div className="mb-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-3)]">
        <Link
          href={devisBase}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Devis
        </Link>
      </div>

      <AdminPageHeader
        title={`Devis ${devis.numero}`}
        description={
          client
            ? `${client.raisonSociale} · ${STATUT_LABELS[devis.statut] ?? devis.statut}`
            : `Client inconnu · ${STATUT_LABELS[devis.statut] ?? devis.statut}`
        }
      />

      {/* ── Fiche de statut ─────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Informations</h2>
        <div className="grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
          {/* Statut */}
          <div>
            <p className={infoLabelCls}>Statut</p>
            <p
              className={
                devis.statut === "accepte"
                  ? `${infoValueCls} text-[color:var(--color-admin-success)]`
                  : devis.statut === "refuse" || devis.statut === "expire"
                    ? `${infoValueCls} text-[color:var(--color-admin-fg-muted)]`
                    : devis.statut === "envoye"
                      ? `${infoValueCls} text-[color:var(--color-admin-warning)]`
                      : infoValueCls
              }
            >
              {STATUT_LABELS[devis.statut] ?? devis.statut}
            </p>
          </div>

          {/* Montant HT */}
          <div>
            <p className={infoLabelCls}>Montant HT</p>
            <p className={infoValueCls}>
              <span className="tabular-nums">{formatEur(devis.montantTotalHtCents)}</span>
            </p>
          </div>

          {/* Financement */}
          <div>
            <p className={infoLabelCls}>Financement suggéré</p>
            <p className={infoValueCls}>
              {devis.financementSuggere ? (
                (FINANCEMENT_LABELS[devis.financementSuggere] ?? devis.financementSuggere)
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
              )}
            </p>
          </div>

          {/* Validité */}
          <div>
            <p className={infoLabelCls}>Validité</p>
            <p
              className={
                isExpired ? `${infoValueCls} text-[color:var(--color-admin-warning)]` : infoValueCls
              }
            >
              {formatDate(devis.dateValidite)}
              {isExpired && (
                <span className="ml-[var(--space-admin-1)] text-[length:var(--text-admin-xs)]">
                  (expiré)
                </span>
              )}
            </p>
          </div>

          {/* OPCO estimé */}
          {devis.montantOpcoEstimeCents != null && (
            <div>
              <p className={infoLabelCls}>Prise en charge OPCO estimée</p>
              <p className={infoValueCls}>
                <span className="tabular-nums">{formatEur(devis.montantOpcoEstimeCents)}</span>
              </p>
            </div>
          )}

          {/* Reste à charge */}
          {devis.resteAChargeCents != null && (
            <div>
              <p className={infoLabelCls}>Reste à charge</p>
              <p className={infoValueCls}>
                <span className="tabular-nums">{formatEur(devis.resteAChargeCents)}</span>
              </p>
            </div>
          )}

          {/* Envoyé le */}
          {devis.sentAt != null && (
            <div>
              <p className={infoLabelCls}>Envoyé le</p>
              <p className={infoValueCls}>{formatDate(devis.sentAt)}</p>
            </div>
          )}

          {/* Accepté / refusé le */}
          {devis.acceptedAt != null && (
            <div>
              <p className={infoLabelCls}>Accepté le</p>
              <p className={`${infoValueCls} text-[color:var(--color-admin-success)]`}>
                {formatDate(devis.acceptedAt)}
              </p>
            </div>
          )}
          {devis.declinedAt != null && (
            <div>
              <p className={infoLabelCls}>Refusé le</p>
              <p className={`${infoValueCls} text-[color:var(--color-admin-fg-muted)]`}>
                {formatDate(devis.declinedAt)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Mention TVA ─────────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Mention TVA</h2>
        <p className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {devis.mentionTva}
        </p>
      </section>

      {/* ── Lignes ──────────────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Lignes</h2>
        {lignes.length === 0 ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune ligne.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
            <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <thead className="border-b border-[color:var(--color-admin-border)]">
                <tr>
                  <th className={headCls}>Désignation</th>
                  <th className={`${headCls} text-right`}>Qté</th>
                  <th className={`${headCls} text-right`}>PU HT</th>
                  <th className={`${headCls} text-right`}>Total HT</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[color:var(--color-admin-border)] last:border-0"
                  >
                    <td className={cellCls}>
                      {ligne.designation}
                      {ligne.offreTierId && (
                        <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          Offre : {ligne.offreTierId}
                        </div>
                      )}
                    </td>
                    <td className={`${cellCls} text-right tabular-nums`}>{ligne.quantite}</td>
                    <td className={`${cellCls} text-right tabular-nums`}>
                      {formatEur(ligne.prixUnitaireHtCents)}
                    </td>
                    <td className={`${cellCls} text-right font-medium tabular-nums`}>
                      {formatEur(Math.round(ligne.quantite * ligne.prixUnitaireHtCents))}
                    </td>
                  </tr>
                ))}
                {/* Ligne de total */}
                <tr className="border-t-2 border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
                  <td colSpan={3} className={`${cellCls} font-semibold`}>
                    Total HT
                  </td>
                  <td className={`${cellCls} text-right font-semibold tabular-nums`}>
                    {formatEur(devis.montantTotalHtCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Actions de cycle de vie ──────────────────────────────────────── */}
      <section>
        <h2 className={sectionHeadCls}>Actions</h2>
        <DevisLifecycleButtons devisId={devis.id} statut={devis.statut} />
      </section>
    </AdminPageShell>
  );
}
