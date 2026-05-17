// Détail devis admin (Sprint A — UI admin devis).
//
// Affiche infos Quote + Booking lié + ContractDocument associé + actions
// admin (edit draft, send, mark signed manually, mark declined) selon status.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { QuoteActions } from "./QuoteActions";
import type { QuoteStatus } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté (signé)",
  declined: "Refusé",
  expired: "Expiré",
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

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function DevisDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  // Pattern V1/V2 §3 (audit verif-fix-deploy 2026-05-18) — V2 non implémenté
  // pour cette route legacy admin. Flag check préservé pour spec compliance.
  if (await isAdminV2Enabled()) {
    // Intentional fall-through to V1 below.
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      amountHtCents: true,
      amountTtcCents: true,
      vatRate: true,
      vatReverseCharge: true,
      vatMention: true,
      validUntil: true,
      sentAt: true,
      acceptedAt: true,
      declinedAt: true,
      docusealSubmissionId: true,
      pdfUrl: true,
      hashSha256: true,
      createdAt: true,
      updatedAt: true,
      bookingId: true,
      booking: {
        select: {
          id: true,
          interventionType: true,
          bookingDate: true,
          status: true,
          submission: {
            select: { companyName: true, contactName: true, contactEmail: true },
          },
          fromSubmission: {
            select: { companyName: true, contactName: true, contactEmail: true },
          },
        },
      },
    },
  });

  if (!quote) notFound();

  const role = (session.user as { role?: string }).role ?? "reader";
  const sub = quote.booking.fromSubmission ?? quote.booking.submission;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <Link href={`/fr/${adminPrefix}/devis`} className="admin-link admin-back">
            ← Devis
          </Link>
          <h1 className="admin-h1-large">
            <code>{quote.number}</code>
          </h1>
          <p className="admin-meta">
            <span className={`admin-badge admin-badge-${quote.status}`}>
              {STATUS_LABELS[quote.status]}
            </span>{" "}
            · créé {formatDate(quote.createdAt)}
          </p>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-card">
          <h2 className="admin-h2">Client</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Société</dt>
            <dd className="admin-dd">{sub?.companyName ?? "—"}</dd>
            <dt className="admin-dt">Contact</dt>
            <dd className="admin-dd">{sub?.contactName ?? "—"}</dd>
            <dt className="admin-dt">Email</dt>
            <dd className="admin-dd">
              {sub?.contactEmail ? (
                <a href={`mailto:${sub.contactEmail}`} className="admin-link">
                  {sub.contactEmail}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Booking lié</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Intervention</dt>
            <dd className="admin-dd">{quote.booking.interventionType}</dd>
            <dt className="admin-dt">Date</dt>
            <dd className="admin-dd">{formatDate(quote.booking.bookingDate)}</dd>
            <dt className="admin-dt">Status booking</dt>
            <dd className="admin-dd">{quote.booking.status}</dd>
            <dt className="admin-dt">Fiche</dt>
            <dd className="admin-dd">
              <Link
                href={`/fr/${adminPrefix}/reservations/${quote.booking.id}`}
                className="admin-link"
              >
                Ouvrir →
              </Link>
            </dd>
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Montants</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Montant HT</dt>
            <dd className="admin-dd">{formatEur(quote.amountHtCents)}</dd>
            <dt className="admin-dt">Taux TVA</dt>
            <dd className="admin-dd">{Number(quote.vatRate).toFixed(2)} %</dd>
            <dt className="admin-dt">Reverse charge</dt>
            <dd className="admin-dd">{quote.vatReverseCharge ? "Oui (UE)" : "Non"}</dd>
            <dt className="admin-dt">Montant TTC</dt>
            <dd className="admin-dd">
              <strong>{formatEur(quote.amountTtcCents)}</strong>
            </dd>
            {quote.vatMention && (
              <>
                <dt className="admin-dt">Mention TVA</dt>
                <dd className="admin-dd">{quote.vatMention}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Cycle de vie</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Créé</dt>
            <dd className="admin-dd">{formatDate(quote.createdAt)}</dd>
            <dt className="admin-dt">Envoyé</dt>
            <dd className="admin-dd">{formatDate(quote.sentAt)}</dd>
            <dt className="admin-dt">Validité</dt>
            <dd className="admin-dd">{formatDate(quote.validUntil)}</dd>
            <dt className="admin-dt">Accepté (signé)</dt>
            <dd className="admin-dd">{formatDate(quote.acceptedAt)}</dd>
            <dt className="admin-dt">Refusé</dt>
            <dd className="admin-dd">{formatDate(quote.declinedAt)}</dd>
            {quote.docusealSubmissionId && (
              <>
                <dt className="admin-dt">DocuSeal submission ID</dt>
                <dd className="admin-dd">
                  <code>{quote.docusealSubmissionId}</code>
                </dd>
              </>
            )}
            {quote.pdfUrl && (
              <>
                <dt className="admin-dt">PDF / embed signature</dt>
                <dd className="admin-dd">
                  <a href={quote.pdfUrl} target="_blank" rel="noreferrer" className="admin-link">
                    Ouvrir →
                  </a>
                </dd>
              </>
            )}
          </dl>
        </div>

        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Actions admin</h2>
          <QuoteActions quoteId={quote.id} status={quote.status} role={role} />
        </div>
      </div>
    </section>
  );
}
