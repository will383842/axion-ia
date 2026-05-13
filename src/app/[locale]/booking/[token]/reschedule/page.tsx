// Page publique self-service — reschedule via magic-link (Sprint X.15).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { verifyMagicToken } from "@/lib/magic-token";
import { prisma } from "@/lib/prisma";
import { RescheduleForm } from "./RescheduleForm";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Reprogrammer — Axion-IA",
};

export default async function ReschedulePage({ params }: Props) {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  const v = await verifyMagicToken(token, { scope: "reschedule" });
  if (!v.ok) {
    return (
      <Container className="max-w-xl py-16">
        <Alert variant="danger" role="alert">
          <AlertDescription>
            {isFr
              ? `Lien invalide ou expiré (${v.reason}). Contactez-nous pour reprogrammer.`
              : `Invalid or expired link (${v.reason}). Contact us to reschedule.`}
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
      interventionType: true,
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

  // Règle métier : reschedule self-service ≥ J-7 par rapport à la date actuelle.
  // Date.now() est OK ici : Server Component re-render à chaque requête HTTP.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysUntil = (booking.bookingDate.getTime() - nowMs) / (24 * 60 * 60 * 1000);
  if (daysUntil < 7) {
    return (
      <Container className="max-w-xl py-16">
        <Alert variant="warning" role="alert">
          <AlertDescription>
            {isFr
              ? "Reprogrammation self-service indisponible à moins de 7 jours de la date. Contactez-nous directement."
              : "Self-service rescheduling not available within 7 days of the date. Please contact us directly."}
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  // Date minimum = J+7 à partir d'aujourd'hui.
  const minDate = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <section className="bg-halo-warm py-12 sm:py-16">
      <Container className="max-w-xl">
        <div className="bg-paper border-border shadow-card rounded-3xl border-2 p-8 sm:p-10">
          <h1 className="display-editorial text-fg">
            {isFr ? "Reprogrammer ma réservation" : "Reschedule my booking"}
          </h1>
          <p className="text-fg-soft mt-5 text-base leading-relaxed">
            {isFr
              ? `Date actuelle : ${booking.bookingDate.toISOString().slice(0, 10)} pour l'intervention « ${booking.interventionType} ». Choisissez une nouvelle date (≥ 7 jours dans le futur).`
              : `Current date: ${booking.bookingDate.toISOString().slice(0, 10)} for the "${booking.interventionType}" session. Pick a new date (≥ 7 days in the future).`}
          </p>
          <div className="mt-8">
            <RescheduleForm token={token} isFr={isFr} minDate={minDate} />
          </div>
        </div>
      </Container>
    </section>
  );
}
