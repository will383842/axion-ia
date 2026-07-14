/**
 * Admin — Qualiopi · Détail d'une facture du Hub (FactureFormation).
 *
 * Affiche : fiche de statut (numéro, client, montants HT/TVA/TTC, reste dû net,
 * dates, canal réglementaire), lignes, encaissements, avoirs liés, puis
 * `FactureFormationActions` (émettre / payer / avoir / envoyer selon le statut).
 *
 * Server Component — auth + redirect, force-dynamic, noindex. Gaté par le même
 * flag que le Hub (`FACTURATION_HUB_ENABLED`).
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFacturationHubEnabled } from "@/server/qualiopi/config/flag";
import { ACTIVITE_LABELS } from "@/server/qualiopi/financements/facture-libre-pur";
import {
  classifierCanalReglementaire,
  CANAL_LABELS,
} from "@/server/qualiopi/financements/e-invoicing/canal";
import { isRegimeTva, REGIME_TVA_DEFAUT } from "@/server/qualiopi/legal/tva";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { FactureFormationActions } from "@/components/admin/qualiopi/FactureFormationActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Facture | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  emise: "Émise",
  partiellement_payee: "Partiellement payée",
  en_retard: "En retard",
  payee: "Payée",
  annulee: "Annulée",
};

const MODE_LABELS: Record<string, string> = {
  manual_wire: "Virement",
  sepa_credit_transfer: "Virement",
  manual_check: "Chèque",
  cheque: "Chèque",
  manual_cash: "Espèces",
  cash: "Espèces",
  card: "Carte",
};

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(d: Date | null): string {
  return d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d)
    : "—";
}

interface FactureLigne {
  designation: string;
  quantite: number;
  prixUnitaireHtCents: number;
  tauxTvaPercent?: number;
}

function parseLignes(raw: unknown): FactureLigne[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l): l is FactureLigne =>
      typeof l === "object" &&
      l !== null &&
      typeof (l as Record<string, unknown>).designation === "string",
  );
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function QualiopiFactureDetailPage({ params }: PageProps) {
  if (!isFacturationHubEnabled()) notFound();
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  const rolesAutorises = ["admin", "super_admin", "editor", "reader"];
  if (!session?.user || !rolesAutorises.includes(role ?? "")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const peutEcrire = role === "admin" || role === "super_admin";

  const facture = await prisma.factureFormation.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      activite: true,
      statut: true,
      refClient: true,
      destinataire: true,
      destinataireNom: true,
      destinataireSiret: true,
      montantHtCents: true,
      montantTvaCents: true,
      montantTtcCents: true,
      regimeTva: true,
      lignes: true,
      avoirDeId: true,
      documentId: true,
      emiseAt: true,
      echeanceAt: true,
      paidAt: true,
      client: {
        select: {
          raisonSociale: true,
          contactEmail: true,
          estPublic: true,
          type: true,
          adressePaysCode: true,
        },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amountCents: true,
          status: true,
          paidAt: true,
          mode: true,
          receivedReference: true,
        },
      },
      avoirs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          numero: true,
          statut: true,
          montantTtcCents: true,
          montantHtCents: true,
          documentId: true,
          createdAt: true,
        },
      },
    },
  });
  if (!facture) notFound();

  const encaisse = facture.payments
    .filter((p) => p.status === "succeeded")
    .reduce((acc, p) => acc + p.amountCents, 0);
  const avoirsTtc = facture.avoirs
    .filter((a) => a.statut !== "annulee")
    .reduce((acc, a) => acc + (a.montantTtcCents ?? a.montantHtCents), 0);
  const ttc = facture.montantTtcCents ?? facture.montantHtCents;
  const resteDuCents = ttc + avoirsTtc - encaisse;
  const estAvoir = facture.avoirDeId !== null;

  const canal =
    CANAL_LABELS[
      classifierCanalReglementaire({
        activite: facture.activite,
        regimeTva: isRegimeTva(facture.regimeTva) ? facture.regimeTva : REGIME_TVA_DEFAUT,
        clientEstPublic: facture.client?.estPublic === true,
        clientPaysCode: facture.client?.adressePaysCode ?? null,
        clientEstParticulier:
          facture.client?.type === "particulier" || facture.destinataire === "stagiaire",
      })
    ];

  const facturationBase = `/${locale}/${adminPrefix}/qualiopi/facturation`;
  const lignes = parseLignes(facture.lignes);

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
      <div className="mb-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-3)]">
        <Link
          href={facturationBase}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Facturation (Hub)
        </Link>
      </div>

      <AdminPageHeader
        title={`Facture ${facture.numero}${estAvoir ? " (avoir)" : ""}`}
        description={`${facture.destinataireNom} · ${STATUT_LABELS[facture.statut] ?? facture.statut}`}
      />

      {/* ── Téléchargement du PDF (route qualiopi/documents re-signe R2) ──── */}
      {/* Gaté peutEcrire : la route /api/qualiopi/documents n'autorise que
          admin/super_admin — on n'affiche pas un lien qui renverrait 403. */}
      {peutEcrire && facture.documentId !== null && (
        <div className="mb-[var(--space-admin-6)]">
          <a
            href={`/api/qualiopi/documents/${facture.documentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-button"
          >
            Télécharger le PDF
          </a>
        </div>
      )}

      {/* ── Fiche de statut ─────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Informations</h2>
        <div className="grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
          <div>
            <p className={infoLabelCls}>Statut</p>
            <p className={infoValueCls}>{STATUT_LABELS[facture.statut] ?? facture.statut}</p>
          </div>
          <div>
            <p className={infoLabelCls}>Activité</p>
            <p className={infoValueCls}>
              {facture.activite !== null ? ACTIVITE_LABELS[facture.activite] : "—"}
            </p>
          </div>
          <div>
            <p className={infoLabelCls}>Montant HT</p>
            <p className={infoValueCls}>
              <span className="tabular-nums">{eur(facture.montantHtCents)}</span>
            </p>
          </div>
          <div>
            <p className={infoLabelCls}>TVA</p>
            <p className={infoValueCls}>
              <span className="tabular-nums">{eur(facture.montantTvaCents)}</span>
            </p>
          </div>
          <div>
            <p className={infoLabelCls}>Montant TTC</p>
            <p className={infoValueCls}>
              <span className="tabular-nums">{eur(ttc)}</span>
            </p>
          </div>
          <div>
            <p className={infoLabelCls}>Reste dû (net)</p>
            <p
              className={
                resteDuCents > 0
                  ? `${infoValueCls} text-[color:var(--color-admin-warning)]`
                  : `${infoValueCls} text-[color:var(--color-admin-success)]`
              }
            >
              <span className="tabular-nums">{eur(resteDuCents)}</span>
            </p>
          </div>
          <div>
            <p className={infoLabelCls}>Réf. commande</p>
            <p className={infoValueCls}>{facture.refClient ?? "—"}</p>
          </div>
          <div>
            <p className={infoLabelCls}>Canal 2026</p>
            <p className={infoValueCls}>{canal}</p>
          </div>
          <div>
            <p className={infoLabelCls}>Émise le</p>
            <p className={infoValueCls}>{fmtDate(facture.emiseAt)}</p>
          </div>
          <div>
            <p className={infoLabelCls}>Échéance</p>
            <p className={infoValueCls}>{fmtDate(facture.echeanceAt)}</p>
          </div>
          {facture.paidAt !== null && (
            <div>
              <p className={infoLabelCls}>Soldée le</p>
              <p className={`${infoValueCls} text-[color:var(--color-admin-success)]`}>
                {fmtDate(facture.paidAt)}
              </p>
            </div>
          )}
          {facture.client?.estPublic === true && (
            <div>
              <p className={infoLabelCls}>Secteur public</p>
              <p className={infoValueCls}>Chorus Pro obligatoire</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Lignes ──────────────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Lignes</h2>
        {lignes.length === 0 ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune ligne détaillée (facture importée ou historique).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
            <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <thead className="border-b border-[color:var(--color-admin-border)]">
                <tr>
                  <th className={headCls}>Désignation</th>
                  <th className={`${headCls} text-right`}>Qté</th>
                  <th className={`${headCls} text-right`}>PU HT</th>
                  <th className={`${headCls} text-right`}>TVA</th>
                  <th className={`${headCls} text-right`}>Total HT</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[color:var(--color-admin-border)] last:border-0"
                  >
                    <td className={cellCls}>{ligne.designation}</td>
                    <td className={`${cellCls} text-right tabular-nums`}>{ligne.quantite}</td>
                    <td className={`${cellCls} text-right tabular-nums`}>
                      {eur(ligne.prixUnitaireHtCents)}
                    </td>
                    <td className={`${cellCls} text-right tabular-nums`}>
                      {ligne.tauxTvaPercent !== undefined ? `${ligne.tauxTvaPercent} %` : "—"}
                    </td>
                    <td className={`${cellCls} text-right font-medium tabular-nums`}>
                      {eur(Math.round(ligne.quantite * ligne.prixUnitaireHtCents))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Encaissements ───────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Encaissements</h2>
        {facture.payments.length === 0 ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucun encaissement enregistré.
          </p>
        ) : (
          <ul className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            {facture.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <span className="font-medium tabular-nums">{eur(p.amountCents)}</span>
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  {fmtDate(p.paidAt)}
                  {p.mode ? ` · ${MODE_LABELS[p.mode] ?? p.mode}` : ""}
                  {p.receivedReference ? ` · réf. ${p.receivedReference}` : ""}
                  {p.status !== "succeeded" ? ` · ${p.status}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Avoirs liés ─────────────────────────────────────────────────── */}
      {facture.avoirs.length > 0 && (
        <section className="mb-[var(--space-admin-8)]">
          <h2 className={sectionHeadCls}>Avoirs</h2>
          <ul className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            {facture.avoirs.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <Link
                  href={`${facturationBase}/${a.id}`}
                  className="font-mono text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                >
                  {a.numero}
                </Link>
                <span className="tabular-nums">{eur(a.montantTtcCents ?? a.montantHtCents)}</span>
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  {STATUT_LABELS[a.statut] ?? a.statut} · {fmtDate(a.createdAt)}
                </span>
                {peutEcrire && a.documentId !== null && (
                  <a
                    href={`/api/qualiopi/documents/${a.documentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] hover:underline"
                  >
                    PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className={sectionHeadCls}>Actions</h2>
        <FactureFormationActions
          // key = reste dû : re-monte le composant après un paiement (router.refresh)
          // pour re-dériver les valeurs par défaut des champs (montant à encaisser).
          key={`fa-${resteDuCents}`}
          factureId={facture.id}
          statut={facture.statut}
          resteDuCents={resteDuCents}
          montantHtCents={facture.montantHtCents}
          estAvoir={estAvoir}
          contactEmail={facture.client?.contactEmail ?? null}
          canWrite={peutEcrire}
        />
      </section>
    </AdminPageShell>
  );
}
