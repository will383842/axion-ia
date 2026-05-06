import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { BookingCalendar, type BookedSlot } from "@/components/calendar/BookingCalendar";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

// Fixtures-only — Sprint 17 connectera Prisma `calendar_bookings`.
// Distribution réaliste : quelques dates prises sur les 60 prochains jours
// avec différentes interventions, villes et durées (mix 1j/2j).
function buildFixtureBookedSlots(): BookedSlot[] {
  const today = new Date();
  const fixtures: Array<{
    offsetDays: number;
    intervention: BookedSlot["intervention"];
    city: string;
    duration: 1 | 2;
  }> = [
    { offsetDays: 3, intervention: "essentielle", city: "Paris", duration: 1 },
    { offsetDays: 7, intervention: "equipes", city: "Lyon", duration: 2 },
    { offsetDays: 10, intervention: "managers", city: "Bordeaux", duration: 1 },
    { offsetDays: 14, intervention: "essentielle", city: "Nantes", duration: 1 },
    { offsetDays: 17, intervention: "dirigeants", city: "Paris", duration: 1 },
    { offsetDays: 21, intervention: "conference", city: "Marseille", duration: 1 },
    { offsetDays: 24, intervention: "essentielle", city: "Lille", duration: 1 },
    { offsetDays: 28, intervention: "equipes", city: "Toulouse", duration: 2 },
    { offsetDays: 32, intervention: "essentielle", city: "Strasbourg", duration: 1 },
    { offsetDays: 38, intervention: "managers", city: "Genève", duration: 1 },
    { offsetDays: 42, intervention: "essentielle", city: "Bruxelles", duration: 1 },
  ];
  return fixtures
    .map((f) => {
      const d = new Date(today);
      d.setDate(today.getDate() + f.offsetDays);
      const dow = d.getDay();
      // Skip weekends (5/6 → 8/9 si fixe nécessaire; ici on suppose les fixtures
      // sont déjà sur jours ouvrés. Skip si week-end pour rester safe).
      if (dow === 0 || dow === 6) return null;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        date: iso,
        intervention: f.intervention,
        city: f.city,
        duration: f.duration,
      };
    })
    .filter((s): s is BookedSlot => s !== null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/reserver",
    title:
      locale === "fr"
        ? "Réserver une intervention IA · calendrier · AxionIA"
        : "Book an on-site AI session · calendar · AxionIA",
    description:
      locale === "fr"
        ? "Sélectionnez une date disponible, choisissez l'intervention IA souhaitée, la ville et la durée. Confirmation par email sous 1 h ouvrée."
        : "Pick an available date, choose the AI intervention, city and duration. Email confirmation within 1 business hour.",
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

  const bookedSlots = buildFixtureBookedSlots();

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Calendrier" : "Calendar"}
        title={isFr ? "Réserver une" : "Book an"}
        titleEm={isFr ? "intervention IA" : "AI intervention"}
        description={
          isFr
            ? "Cliquez sur une date libre dans le calendrier. Une fenêtre s'ouvre pour choisir l'intervention, la ville et la durée. Confirmation par email sous 1 h ouvrée."
            : "Click an open date in the calendar. A window opens to choose the intervention, city and duration. Email confirmation within 1 business hour."
        }
      />

      <Section>
        <Container className="max-w-5xl">
          <BookingCalendar initialBookedSlots={bookedSlots} locale={loc} />
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
