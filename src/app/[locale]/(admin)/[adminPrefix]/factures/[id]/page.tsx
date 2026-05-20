// Détail facture admin (Sprint X.10 — Booking V1).
//
// Affiche les infos complètes Invoice + payments associés + actions
// (saisie paiement manuel, génération avoir). PDF V1.5+ (X.10b).

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { InvoiceActions } from "./InvoiceActions";
import type {
  InvoiceStatus,
  InvoiceType,
  PaymentProvider,
} from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

const TYPE_LABELS: Record<InvoiceType, string> = {
  deposit: "Acompte",
  balance: "Solde",
  installment: "Échéance",
  full: "Total",
  credit_note: "Avoir",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  issued: "Émise",
  paid: "Payée",
  partially_paid: "Partiellement payée",
  overdue: "En retard",
  cancelled: "Annulée",
  void: "Annulée (void)",
  refunded: "Remboursée",
};

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  manual_wire: "Virement",
  manual_check: "Chèque",
  manual_cash: "Espèces",
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatEur(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function FactureDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      paidAt: true,
      archivedUntil: true,
      installmentNumber: true,
      basePriceHtCents: true,
      travelFeeCents: true,
      accommodationFeeCents: true,
      mealFeeCents: true,
      additionalFeesCents: true,
      additionalFeesNotes: true,
      amountHtCents: true,
      amountTtcCents: true,
      vatRate: true,
      vatReverseCharge: true,
      vatMention: true,
      pdfUrl: true,
      hashSha256: true,
      locale: true,
      payerType: true,
      payerName: true,
      payerEmail: true,
      payerAddress: true,
      payerVatNumber: true,
      bookingId: true,
      booking: {
        select: {
          id: true,
          interventionType: true,
          bookingDate: true,
          status: true,
        },
      },
      creditNoteOfId: true,
      creditNoteOf: { select: { id: true, number: true } },
      creditNotes: { select: { id: true, number: true, amountTtcCents: true, issuedAt: true } },
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          provider: true,
          amountCents: true,
          paidAt: true,
          status: true,
          mode: true,
          receivedReference: true,
          notes: true,
        },
      },
    },
  });

  if (!invoice) notFound();

  const role = (session.user as { role?: string }).role ?? "reader";
  const paidTotal = invoice.payments
    .filter((p) => p.status === "succeeded")
    .reduce((acc, p) => acc + p.amountCents, 0);
  const remaining = Math.max(0, invoice.amountTtcCents - paidTotal);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={invoice.number}
        description={`${TYPE_LABELS[invoice.type]} · émise ${formatDate(invoice.issuedAt)}`}
        breadcrumbs={
          <Link href={`/fr/${adminPrefix}/factures`} className="admin-link admin-back">
            ← Factures
          </Link>
        }
        meta={
          <span className={`admin-badge admin-badge-${invoice.status}`}>
            {STATUS_LABELS[invoice.status]}
          </span>
        }
        actions={
          <a
            href={`/api/admin/invoices/${invoice.id}/pdf`}
            className="admin-button-ghost"
            target="_blank"
            rel="noreferrer"
          >
            📄 PDF
          </a>
        }
      />
      <div className="admin-detail-grid">
        <div className="admin-card">
          <h2 className="admin-h2">Émetteur · Conformité légale</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Mention TVA</dt>
            <dd className="admin-dd">{invoice.vatMention ?? "—"}</dd>
            <dt className="admin-dt">Taux TVA</dt>
            <dd className="admin-dd">{Number(invoice.vatRate).toFixed(2)} %</dd>
            <dt className="admin-dt">Reverse charge</dt>
            <dd className="admin-dd">{invoice.vatReverseCharge ? "Oui (UE)" : "Non"}</dd>
            <dt className="admin-dt">Archivage légal</dt>
            <dd className="admin-dd">jusqu&apos;au {formatDate(invoice.archivedUntil)} (10 ans)</dd>
          </dl>
        </div>
        <div className="admin-card">
          <h2 className="admin-h2">Client (payeur)</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Type</dt>
            <dd className="admin-dd">{invoice.payerType}</dd>
            <dt className="admin-dt">Nom</dt>
            <dd className="admin-dd">{invoice.payerName ?? "—"}</dd>
            <dt className="admin-dt">Email</dt>
            <dd className="admin-dd">
              {invoice.payerEmail ? (
                <a href={`mailto:${invoice.payerEmail}`} className="admin-link">
                  {invoice.payerEmail}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt className="admin-dt">Adresse</dt>
            <dd className="admin-dd">{invoice.payerAddress ?? "—"}</dd>
            <dt className="admin-dt">N° TVA intra</dt>
            <dd className="admin-dd">{invoice.payerVatNumber ?? "—"}</dd>
          </dl>
        </div>
        <div className="admin-card">
          <h2 className="admin-h2">Montants</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Base HT</dt>
            <dd className="admin-dd">{formatEur(invoice.basePriceHtCents)}</dd>
            <dt className="admin-dt">Frais trajet</dt>
            <dd className="admin-dd">{formatEur(invoice.travelFeeCents)}</dd>
            <dt className="admin-dt">Hébergement</dt>
            <dd className="admin-dd">{formatEur(invoice.accommodationFeeCents)}</dd>
            <dt className="admin-dt">Repas</dt>
            <dd className="admin-dd">{formatEur(invoice.mealFeeCents)}</dd>
            <dt className="admin-dt">Frais additionnels</dt>
            <dd className="admin-dd">
              {formatEur(invoice.additionalFeesCents)}
              {invoice.additionalFeesNotes ? ` · ${invoice.additionalFeesNotes}` : ""}
            </dd>
            <dt className="admin-dt">Montant HT</dt>
            <dd className="admin-dd">
              <strong>{formatEur(invoice.amountHtCents)}</strong>
            </dd>
            <dt className="admin-dt">Montant TTC</dt>
            <dd className="admin-dd">
              <strong>{formatEur(invoice.amountTtcCents)}</strong>
            </dd>
          </dl>
        </div>
        <div className="admin-card">
          <h2 className="admin-h2">Échéancier</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Émise le</dt>
            <dd className="admin-dd">{formatDate(invoice.issuedAt)}</dd>
            <dt className="admin-dt">Échéance</dt>
            <dd className="admin-dd">{formatDate(invoice.dueAt)}</dd>
            <dt className="admin-dt">Payée le</dt>
            <dd className="admin-dd">{formatDate(invoice.paidAt)}</dd>
            <dt className="admin-dt">Encaissé</dt>
            <dd className="admin-dd">{formatEur(paidTotal)}</dd>
            <dt className="admin-dt">Reste dû</dt>
            <dd className="admin-dd">
              <strong>{formatEur(remaining)}</strong>
            </dd>
          </dl>
        </div>
        {invoice.booking && (
          <div className="admin-card">
            <h2 className="admin-h2">Booking lié</h2>
            <dl className="admin-dl">
              <dt className="admin-dt">Intervention</dt>
              <dd className="admin-dd">{invoice.booking.interventionType}</dd>
              <dt className="admin-dt">Date</dt>
              <dd className="admin-dd">{formatDate(invoice.booking.bookingDate)}</dd>
              <dt className="admin-dt">Status</dt>
              <dd className="admin-dd">{invoice.booking.status}</dd>
              <dt className="admin-dt">Fiche</dt>
              <dd className="admin-dd">
                <Link
                  href={`/fr/${adminPrefix}/reservations/${invoice.booking.id}`}
                  className="admin-link"
                >
                  Ouvrir la réservation →
                </Link>
              </dd>
            </dl>
          </div>
        )}
        {invoice.creditNoteOf && (
          <div className="admin-card">
            <h2 className="admin-h2">Avoir lié à</h2>
            <p className="admin-meta-block">
              Facture origine :{" "}
              <Link
                href={`/fr/${adminPrefix}/factures/${invoice.creditNoteOf.id}`}
                className="admin-link"
              >
                <code>{invoice.creditNoteOf.number}</code>
              </Link>
            </p>
          </div>
        )}
        {invoice.creditNotes.length > 0 && (
          <div className="admin-card">
            <h2 className="admin-h2">Avoirs émis sur cette facture</h2>
            <ul className="admin-meta-block">
              {invoice.creditNotes.map((cn) => (
                <li key={cn.id}>
                  <Link href={`/fr/${adminPrefix}/factures/${cn.id}`} className="admin-link">
                    <code>{cn.number}</code>
                  </Link>{" "}
                  · {formatEur(cn.amountTtcCents)} · émis {formatDate(cn.issuedAt)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Paiements enregistrés</h2>
          {invoice.payments.length === 0 ? (
            <p className="admin-meta-block">Aucun paiement enregistré.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Provider</th>
                  <th>Mode</th>
                  <th>Référence</th>
                  <th>Montant</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.paidAt)}</td>
                    <td>{PROVIDER_LABELS[p.provider]}</td>
                    <td>{p.mode ?? "—"}</td>
                    <td>{p.receivedReference ?? "—"}</td>
                    <td>{formatEur(p.amountCents)}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Actions admin</h2>
          <InvoiceActions
            invoiceId={invoice.id}
            invoiceNumber={invoice.number}
            status={invoice.status}
            type={invoice.type}
            remainingCents={remaining}
            role={role}
            adminPrefix={adminPrefix}
          />
        </div>
      </div>
    </AdminPageShell>
  );
}
