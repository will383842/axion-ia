// Detail réservation admin (Sprint X.8 — Booking V1 V2).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.8
//        Périmètre — Drawer admin (rendu ici en page séparée — drawer V1.5+).
//
// Affiche toutes les infos booking + bloc « Décision admin » qui expose
// dynamiquement les actions valides selon le status et le rôle.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { BookingActions } from "./BookingActions";
import type { BookingStatus } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

const STATUS_LABELS: Partial<Record<BookingStatus, string>> = {
  option_pending: "Option en attente",
  cadrage_scheduled: "Cadrage planifié",
  cadrage_held: "Cadrage tenu",
  quote_required: "Devis requis",
  quote_sent: "Devis envoyé",
  quote_signed: "Devis signé",
  contract_pending: "Contrat en préparation",
  contract_payment_sent: "Contrat & acompte envoyés",
  contract_signed: "Contrat signé",
  awaiting_admin_validation: "Acompte reçu — à valider",
  confirmed: "Confirmée",
  paused: "En pause",
  reminded_j7: "Rappel J-7 envoyé",
  in_progress: "En cours",
  completed: "Terminée",
  invoiced_balance: "Solde facturé",
  installment_overdue: "Échéance en retard",
  paid_balance: "Soldée",
  disputed: "Recouvrement",
  archived: "Archivée",
  cancelled: "Annulée",
  cancelled_by_user: "Annulée client",
  cancelled_by_admin: "Annulée admin",
  no_show: "No-show",
  force_majeure: "Force majeure",
  refunded_partial: "Remboursée partiellement",
  refunded_full: "Remboursée intégralement",
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
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function ReservationDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  // Pattern V1/V2 §3 (audit verif-fix-deploy 2026-05-18).

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      bookingDate: true,
      interventionType: true,
      participantsCount: true,
      participantsTier: true,
      basePriceHtCents: true,
      depositAmountCents: true,
      depositPaidAt: true,
      balanceAmountCents: true,
      balancePaidAt: true,
      travelFeeCents: true,
      accommodationFeeCents: true,
      mealFeeCents: true,
      additionalFeesCents: true,
      additionalFeesNotes: true,
      companyCityNormalized: true,
      companySize: true,
      travelBufferDays: true,
      pausedAt: true,
      pausedUntil: true,
      pauseReason: true,
      cancellationReason: true,
      cancellationWindow: true,
      cancelledAt: true,
      confirmedAt: true,
      completedAt: true,
      internalNotes: true,
      createdAt: true,
      updatedAt: true,
      originPath: true,
      locale: true,
      slot: { select: { id: true, slotDate: true, status: true } },
      submission: {
        select: {
          id: true,
          companyName: true,
          sector: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          contactRole: true,
        },
      },
      fromSubmission: {
        select: {
          id: true,
          companyName: true,
          sector: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          contactRole: true,
        },
      },
      cadrageMeeting: {
        select: { id: true, scheduledAt: true, status: true, visioUrl: true, heldAt: true },
      },
      // ContractDocument actif sur ce booking (pour exposer cancel-and-reissue
      // ou create-addendum dans BookingActions). NULL si pas encore envoyé.
      contractDocument: {
        select: { id: true, status: true, version: true, isAddendum: true },
      },
      // Existe-t-il un contrat principal signé sur ce booking ? Si oui →
      // l'admin peut créer un avenant (D62).
      contractDocuments: {
        where: { status: "signed", isAddendum: false },
        take: 1,
        select: { id: true },
      },
      transitions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          trigger: true,
          triggeredBy: true,
          createdAt: true,
        },
      },
    },
  });

  if (!booking) notFound();

  const role = (session.user as { role?: string }).role ?? "reader";
  const submission = booking.fromSubmission ?? booking.submission ?? null;
  const company = submission?.companyName ?? "Société inconnue";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`Réservation · ${booking.id.slice(0, 8)}`}
        description={
          booking.submission?.companyName ?? booking.fromSubmission?.companyName ?? "—"
        }
        breadcrumbs={
          <Link href={`/fr/${adminPrefix}/reservations`} className="admin-link admin-back">
            ← Réservations
          </Link>
        }
        meta={
          <span className={`admin-badge admin-badge-${booking.status}`}>
            {STATUS_LABELS[booking.status] ?? booking.status}
          </span>
        }
      />

      <div className="admin-detail-grid">
        <div className="admin-card">
          <h2 className="admin-h2">Société</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Raison sociale</dt>
            <dd className="admin-dd">{submission?.companyName ?? "—"}</dd>
            <dt className="admin-dt">Secteur</dt>
            <dd className="admin-dd">{submission?.sector ?? "—"}</dd>
            <dt className="admin-dt">Taille (INSEE)</dt>
            <dd className="admin-dd">{booking.companySize ?? "—"}</dd>
            <dt className="admin-dt">Ville</dt>
            <dd className="admin-dd">{booking.companyCityNormalized ?? "—"}</dd>
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Contact</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Nom</dt>
            <dd className="admin-dd">{submission?.contactName ?? "—"}</dd>
            <dt className="admin-dt">Rôle</dt>
            <dd className="admin-dd">{submission?.contactRole ?? "—"}</dd>
            <dt className="admin-dt">Email</dt>
            <dd className="admin-dd">
              {submission?.contactEmail ? (
                <a href={`mailto:${submission.contactEmail}`} className="admin-link">
                  {submission.contactEmail}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt className="admin-dt">Téléphone</dt>
            <dd className="admin-dd">{submission?.contactPhone ?? "—"}</dd>
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Intervention</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Type</dt>
            <dd className="admin-dd">{booking.interventionType}</dd>
            <dt className="admin-dt">Date</dt>
            <dd className="admin-dd">{formatDate(booking.bookingDate)}</dd>
            <dt className="admin-dt">Participants</dt>
            <dd className="admin-dd">
              {booking.participantsCount}
              {booking.participantsTier ? ` · tier ${booking.participantsTier}` : ""}
            </dd>
            <dt className="admin-dt">Buffer trajet</dt>
            <dd className="admin-dd">{booking.travelBufferDays} j</dd>
            <dt className="admin-dt">Slot calendrier</dt>
            <dd className="admin-dd">
              {booking.slot ? (
                <>
                  {formatDate(booking.slot.slotDate)} · {booking.slot.status}
                </>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Tarification</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Base HT</dt>
            <dd className="admin-dd">{formatEur(booking.basePriceHtCents)}</dd>
            <dt className="admin-dt">Acompte attendu</dt>
            <dd className="admin-dd">
              {formatEur(booking.depositAmountCents)}
              {booking.depositPaidAt
                ? ` · payé le ${formatDate(booking.depositPaidAt)}`
                : booking.depositAmountCents
                  ? " · non payé"
                  : ""}
            </dd>
            <dt className="admin-dt">Solde attendu</dt>
            <dd className="admin-dd">
              {formatEur(booking.balanceAmountCents)}
              {booking.balancePaidAt ? ` · payé le ${formatDate(booking.balancePaidAt)}` : ""}
            </dd>
            <dt className="admin-dt">Frais trajet</dt>
            <dd className="admin-dd">{formatEur(booking.travelFeeCents)}</dd>
            <dt className="admin-dt">Hébergement</dt>
            <dd className="admin-dd">{formatEur(booking.accommodationFeeCents)}</dd>
            <dt className="admin-dt">Repas</dt>
            <dd className="admin-dd">{formatEur(booking.mealFeeCents)}</dd>
            <dt className="admin-dt">Frais additionnels</dt>
            <dd className="admin-dd">
              {formatEur(booking.additionalFeesCents)}
              {booking.additionalFeesNotes ? ` · ${booking.additionalFeesNotes}` : ""}
            </dd>
          </dl>
        </div>

        {booking.cadrageMeeting && (
          <div className="admin-card">
            <h2 className="admin-h2">Cadrage</h2>
            <dl className="admin-dl">
              <dt className="admin-dt">Planifié</dt>
              <dd className="admin-dd">{formatDate(booking.cadrageMeeting.scheduledAt)}</dd>
              <dt className="admin-dt">Status</dt>
              <dd className="admin-dd">{booking.cadrageMeeting.status}</dd>
              {booking.cadrageMeeting.visioUrl && (
                <>
                  <dt className="admin-dt">Lien visio</dt>
                  <dd className="admin-dd">
                    <a
                      href={booking.cadrageMeeting.visioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-link"
                    >
                      Ouvrir →
                    </a>
                  </dd>
                </>
              )}
              {booking.cadrageMeeting.heldAt && (
                <>
                  <dt className="admin-dt">Tenu</dt>
                  <dd className="admin-dd">{formatDate(booking.cadrageMeeting.heldAt)}</dd>
                </>
              )}
            </dl>
          </div>
        )}

        {(booking.pausedAt || booking.pausedUntil || booking.pauseReason) && (
          <div className="admin-card">
            <h2 className="admin-h2">Pause active</h2>
            <dl className="admin-dl">
              <dt className="admin-dt">Mise en pause</dt>
              <dd className="admin-dd">{formatDate(booking.pausedAt)}</dd>
              <dt className="admin-dt">Reprise prévue</dt>
              <dd className="admin-dd">{formatDate(booking.pausedUntil)}</dd>
              <dt className="admin-dt">Motif</dt>
              <dd className="admin-dd">{booking.pauseReason ?? "—"}</dd>
            </dl>
          </div>
        )}

        {(booking.cancelledAt || booking.cancellationReason) && (
          <div className="admin-card">
            <h2 className="admin-h2">Annulation</h2>
            <dl className="admin-dl">
              <dt className="admin-dt">Date</dt>
              <dd className="admin-dd">{formatDate(booking.cancelledAt)}</dd>
              <dt className="admin-dt">Fenêtre</dt>
              <dd className="admin-dd">{booking.cancellationWindow ?? "—"}</dd>
              <dt className="admin-dt">Motif</dt>
              <dd className="admin-dd">{booking.cancellationReason ?? "—"}</dd>
            </dl>
          </div>
        )}

        <div className="admin-card">
          <h2 className="admin-h2">Cycle de vie</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Créée</dt>
            <dd className="admin-dd">{formatDate(booking.createdAt)}</dd>
            <dt className="admin-dt">Mise à jour</dt>
            <dd className="admin-dd">{formatDate(booking.updatedAt)}</dd>
            {booking.confirmedAt && (
              <>
                <dt className="admin-dt">Confirmée</dt>
                <dd className="admin-dd">{formatDate(booking.confirmedAt)}</dd>
              </>
            )}
            {booking.completedAt && (
              <>
                <dt className="admin-dt">Terminée</dt>
                <dd className="admin-dd">{formatDate(booking.completedAt)}</dd>
              </>
            )}
          </dl>
        </div>

        {booking.internalNotes && (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Notes internes</h2>
            <p>{booking.internalNotes}</p>
          </div>
        )}

        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Décision admin</h2>
          <BookingActions
            bookingId={booking.id}
            status={booking.status}
            adminPrefix={adminPrefix}
            role={role}
            activeContract={booking.contractDocument ?? null}
            hasSignedMainContract={booking.contractDocuments.length > 0}
          />
        </div>

        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Transitions récentes</h2>
          {booking.transitions.length === 0 ? (
            <p className="admin-meta-block">Aucune transition enregistrée.</p>
          ) : (
            <ul className="admin-meta-block">
              {booking.transitions.map((t) => (
                <li key={t.id}>
                  <strong>
                    {t.fromStatus ?? "—"} → {t.toStatus}
                  </strong>{" "}
                  · {t.trigger} ({t.triggeredBy}) · {formatDate(t.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}

