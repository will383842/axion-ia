import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { type CalendarSlot } from "@/components/calendar/HouseCalendar";
import { BookingFlow } from "@/components/calendar/BookingFlow";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

// Fixtures-only slots — Sprint 15 reads from Prisma `calendar_options`.
function buildFixtureSlots(): CalendarSlot[] {
  const today = new Date();
  const slots: CalendarSlot[] = [];
  for (let offset = 1; offset <= 28; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // weekends excluded
    // Pseudo-deterministic distribution.
    const bucket = offset % 5;
    const status: CalendarSlot["status"] =
      bucket === 0 ? "reserved" : bucket === 1 ? "option" : "available";
    slots.push({ date: iso, time: "09:00", status });
    slots.push({ date: iso, time: "14:00", status });
  }
  return slots;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/reserver",
    title:
      locale === "fr"
        ? "Réserver une intervention · calendrier maison · AxionIA"
        : "Book a session · on-site calendar · AxionIA",
    description:
      locale === "fr"
        ? "Réservez une intervention IA en sélectionnant un créneau disponible. Calendrier 3 états (disponible / option / réservé)."
        : "Book an AI session by selecting an available slot. 3-state calendar (available / option / reserved).",
    alternates: { fr: "/reserver", en: "/book" },
  });
}

export default async function ReserverPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Réserver" : "Book", href: "/reserver" },
    ],
  });

  const calendarLabels = isFr
    ? {
        prevMonth: "Mois précédent",
        nextMonth: "Mois suivant",
        available: "Disponible",
        option: "Option",
        reserved: "Réservé",
        selectDate: "Sélectionnez une date",
        selectTime: "Choisir un créneau",
        confirm: "Confirmer la réservation",
        noSlots: "Aucun créneau ce jour.",
        weekDays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const,
      }
    : {
        prevMonth: "Previous month",
        nextMonth: "Next month",
        available: "Available",
        option: "Option",
        reserved: "Reserved",
        selectDate: "Select a date",
        selectTime: "Pick a slot",
        confirm: "Confirm booking",
        noSlots: "No slots this day.",
        weekDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const,
      };

  const formLabels = isFr
    ? {
        headerPrefix: "Créneau sélectionné :",
        contactName: "Nom & prénom",
        contactEmail: "Email professionnel",
        contactPhone: "Téléphone (optionnel)",
        consent:
          "J'accepte que mes données soient utilisées pour traiter cette réservation conformément à la politique de confidentialité.",
        cancel: "Changer de créneau",
        submit: "Confirmer la réservation",
        sending: "Envoi…",
        success: "Réservation reçue. Vous recevrez la confirmation par email sous 1 h ouvrée.",
        failure: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",
      }
    : {
        headerPrefix: "Selected slot:",
        contactName: "Full name",
        contactEmail: "Professional email",
        contactPhone: "Phone (optional)",
        consent:
          "I agree to my data being used to process this booking in accordance with the privacy policy.",
        cancel: "Change slot",
        submit: "Confirm booking",
        sending: "Sending…",
        success: "Booking received. You will receive confirmation by email within 1 business hour.",
        failure: "An error occurred. Try again or email contact@axion-ia.com.",
      };

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Calendrier maison" : "On-site calendar"}
        title={isFr ? "Réserver une intervention" : "Book a session"}
        description={
          isFr
            ? "Sélectionnez un créneau disponible puis renseignez vos coordonnées. Confirmation par email sous 1 h ouvrée."
            : "Pick an available slot then enter your details. Email confirmation within 1 business hour."
        }
      />

      <Section>
        <Container className="max-w-3xl">
          <BookingFlow
            slots={buildFixtureSlots()}
            calendarLabels={calendarLabels}
            formLabels={formLabels}
          />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "À noter" : "Note"}
        title={isFr ? "L'Essentielle 490 € HT" : "The Essential €490 (excl. VAT)"}
        description={
          isFr
            ? "Le créneau sélectionné est valide une fois la confirmation reçue. Annulation > 7 j avant : 100 % remboursé (cf. CGV)."
            : "The selected slot is valid once confirmation is received. Cancellation > 7 days before: 100% refund (see Terms)."
        }
        cta={
          <Cta href="/conditions-generales" variant="outline">
            {isFr ? "Voir les CGV" : "See Terms"} →
          </Cta>
        }
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
