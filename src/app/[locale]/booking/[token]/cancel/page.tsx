// Page publique self-service — annulation via magic-link (Sprint X.15).
//
// Validation token côté SSR + affichage récap + bouton confirmation.
// Noindex (page transactionnelle privée par token).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { verifyMagicToken } from "@/lib/magic-token";
import { prisma } from "@/lib/prisma";
import { computeRefundFromCancellation } from "@/features/booking/refund-calc";
import { CancelForm } from "./CancelForm";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Annulation — Axion-IA",
};

export default async function CancelPage({ params }: Props) {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  const v = await verifyMagicToken(token, { scope: "cancel" });
  if (!v.ok) {
    return (
      <Container className="max-w-xl py-16">
        <Alert variant="danger" role="alert">
          <AlertDescription>
            {isFr
              ? `Lien invalide ou expiré (${v.reason}). Contactez-nous si vous souhaitez annuler.`
              : `Invalid or expired link (${v.reason}). Contact us if you wish to cancel.`}
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: v.resourceId },
    select: {
      id: true,
      bookingDate: true,
      status: true,
      interventionType: true,
      submission: { select: { contactName: true } },
    },
  });
  if (!booking) {
    return (
      <Container className="max-w-xl py-16">
        <Alert variant="danger" role="alert">
          <AlertDescription>
            {isFr ? "Réservation introuvable." : "Booking not found."}
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  const refund = computeRefundFromCancellation({
    bookingDate: booking.bookingDate,
    now: new Date(),
  });

  return (
    <section className="bg-halo-warm py-12 sm:py-16">
      <Container className="max-w-xl">
        <div className="bg-paper border-border shadow-card rounded-3xl border-2 p-8 sm:p-10">
          <h1 className="display-editorial text-fg">
            {isFr ? "Annuler ma réservation" : "Cancel my booking"}
          </h1>
          <p className="text-fg-soft mt-5 text-base leading-relaxed">
            {isFr
              ? `Vous êtes sur le point d'annuler votre intervention « ${booking.interventionType} » prévue le ${booking.bookingDate.toISOString().slice(0, 10)}.`
              : `You are about to cancel your "${booking.interventionType}" session scheduled on ${booking.bookingDate.toISOString().slice(0, 10)}.`}
          </p>
          <div className="bg-halo-warm border-terracotta/20 mt-6 rounded-2xl border p-5">
            <p className="text-fg-muted text-[12px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Fenêtre d'annulation" : "Cancellation window"}
            </p>
            <p className="text-fg mt-2 text-lg font-semibold">
              {refund.cancellationWindow === "more_than_15d"
                ? isFr
                  ? "Plus de 15 jours avant la date"
                  : "More than 15 days before the date"
                : refund.cancellationWindow === "between_15d_and_2d"
                  ? isFr
                    ? "Entre 15 jours et 2 jours avant"
                    : "Between 15 days and 2 days before"
                  : isFr
                    ? "Moins de 2 jours avant"
                    : "Less than 2 days before"}
            </p>
            <p className="text-fg-soft mt-3 text-sm">
              {refund.refundPercentage > 0
                ? isFr
                  ? `Remboursement de l'acompte : ${refund.refundPercentage} %.`
                  : `Deposit refund: ${refund.refundPercentage}%.`
                : isFr
                  ? "Selon nos CGV, l'acompte est conservé pour cette fenêtre."
                  : "Per our Terms, the deposit is retained for this window."}
            </p>
          </div>
          <div className="mt-8">
            <CancelForm token={token} isFr={isFr} refundPercentage={refund.refundPercentage} />
          </div>
        </div>
      </Container>
    </section>
  );
}
