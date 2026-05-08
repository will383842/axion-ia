import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import type { BookedSlot } from "@/components/calendar/BookingCalendar";
import { BookingCalendarLazy } from "@/components/calendar/BookingCalendarLazy";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

// Fixtures-only — Sprint 17 connectera Prisma `calendar_bookings`.
// Distribution dense (social proof) avec ville/pays/secteur/taille publics
// (anonymisé : pas de nom d'entreprise). Inclut sam/dim depuis 2026-05-07.
function buildFixtureBookedSlots(): BookedSlot[] {
  const today = new Date();
  const fixtures: Array<{
    offsetDays: number;
    intervention: BookedSlot["intervention"];
    city: string;
    country: string;
    sector: string;
    companySize: string;
    duration: 1 | 2;
  }> = [
    {
      offsetDays: 2,
      intervention: "essentielle",
      city: "Paris",
      country: "FR",
      sector: "Conseil",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 4,
      intervention: "managers",
      city: "Lyon",
      country: "FR",
      sector: "Industrie",
      companySize: "50-249",
      duration: 1,
    },
    {
      offsetDays: 6,
      intervention: "essentielle",
      city: "Bordeaux",
      country: "FR",
      sector: "Tech",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 8,
      intervention: "equipes",
      city: "Nantes",
      country: "FR",
      sector: "Distribution",
      companySize: "250-999",
      duration: 1,
    },
    {
      offsetDays: 11,
      intervention: "dirigeants",
      city: "Paris",
      country: "FR",
      sector: "Finance",
      companySize: "1000+",
      duration: 1,
    },
    {
      offsetDays: 13,
      intervention: "essentielle",
      city: "Marseille",
      country: "FR",
      sector: "Hôtellerie",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 15,
      intervention: "conference",
      city: "Lille",
      country: "FR",
      sector: "Santé",
      companySize: "50-249",
      duration: 1,
    },
    {
      offsetDays: 17,
      intervention: "essentielle",
      city: "Toulouse",
      country: "FR",
      sector: "Aérospatial",
      companySize: "1000+",
      duration: 1,
    },
    {
      offsetDays: 19,
      intervention: "managers",
      city: "Strasbourg",
      country: "FR",
      sector: "Public",
      companySize: "250-999",
      duration: 1,
    },
    {
      offsetDays: 22,
      intervention: "essentielle",
      city: "Genève",
      country: "CH",
      sector: "Finance",
      companySize: "50-249",
      duration: 1,
    },
    {
      offsetDays: 24,
      intervention: "equipes",
      city: "Bruxelles",
      country: "BE",
      sector: "Conseil",
      companySize: "50-249",
      duration: 1,
    },
    {
      offsetDays: 26,
      intervention: "essentielle",
      city: "Rennes",
      country: "FR",
      sector: "Tech",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 29,
      intervention: "dirigeants",
      city: "Luxembourg",
      country: "LU",
      sector: "Finance",
      companySize: "250-999",
      duration: 1,
    },
    {
      offsetDays: 32,
      intervention: "essentielle",
      city: "Paris",
      country: "FR",
      sector: "Immobilier",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 34,
      intervention: "managers",
      city: "Lyon",
      country: "FR",
      sector: "Industrie",
      companySize: "250-999",
      duration: 1,
    },
    {
      offsetDays: 37,
      intervention: "essentielle",
      city: "Bordeaux",
      country: "FR",
      sector: "Vin & spiritueux",
      companySize: "50-249",
      duration: 1,
    },
    {
      offsetDays: 40,
      intervention: "conference",
      city: "Nantes",
      country: "FR",
      sector: "Tech",
      companySize: "1000+",
      duration: 1,
    },
    {
      offsetDays: 42,
      intervention: "essentielle",
      city: "Marseille",
      country: "FR",
      sector: "Logistique",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 45,
      intervention: "equipes",
      city: "Toulouse",
      country: "FR",
      sector: "Aérospatial",
      companySize: "250-999",
      duration: 1,
    },
    {
      offsetDays: 48,
      intervention: "essentielle",
      city: "Strasbourg",
      country: "FR",
      sector: "Industrie",
      companySize: "50-249",
      duration: 1,
    },
    {
      offsetDays: 51,
      intervention: "dirigeants",
      city: "Bruxelles",
      country: "BE",
      sector: "Public",
      companySize: "1000+",
      duration: 1,
    },
    {
      offsetDays: 54,
      intervention: "essentielle",
      city: "Genève",
      country: "CH",
      sector: "Tech",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 57,
      intervention: "managers",
      city: "Paris",
      country: "FR",
      sector: "Distribution",
      companySize: "250-999",
      duration: 1,
    },
    {
      offsetDays: 60,
      intervention: "essentielle",
      city: "Lille",
      country: "FR",
      sector: "Santé",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 64,
      intervention: "equipes",
      city: "Lyon",
      country: "FR",
      sector: "Conseil",
      companySize: "50-249",
      duration: 1,
    },
    {
      offsetDays: 68,
      intervention: "essentielle",
      city: "Bordeaux",
      country: "FR",
      sector: "Hôtellerie",
      companySize: "10-49",
      duration: 1,
    },
    {
      offsetDays: 72,
      intervention: "conference",
      city: "Marseille",
      country: "FR",
      sector: "Tech",
      companySize: "1000+",
      duration: 1,
    },
  ];
  return fixtures.map((f) => {
    const d = new Date(today);
    d.setDate(today.getDate() + f.offsetDays);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      date: iso,
      intervention: f.intervention,
      city: f.city,
      country: f.country,
      sector: f.sector,
      companySize: f.companySize,
      duration: f.duration,
    };
  });
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

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: isFr ? "/reserver" : "/book",
      label: isFr ? "Réserver" : "Book",
    },
  ];

  const bookedSlots = buildFixtureBookedSlots();

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* Hero compact : padding réduit pour rapprocher le calendrier de la fold */}
      <section className="bg-halo-warm relative overflow-hidden py-12 sm:py-14 lg:py-16">
        <Container className="relative">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Calendrier" : "Calendar"}
          </p>
          <h1
            className="text-fg mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[1.04] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Réserver une" : "Book an"}{" "}
            <span className="text-terracotta italic">
              {isFr ? "intervention IA" : "AI intervention"}
            </span>
          </h1>
          <p className="text-fg-soft mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
            {isFr
              ? "Choisissez la formation, puis cliquez sur une date libre. Réservation finalisée après call de cadrage + acompte 50 %."
              : "Pick the training, then click an open date. Booking finalised after framing call + 50 % deposit."}
          </p>
        </Container>
      </section>

      {/* Calendrier — page quasi-pleine largeur (override Container max-w-1520) */}
      <div className="bg-bg py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
          <BookingCalendarLazy initialBookedSlots={bookedSlots} locale={loc} />
        </div>
      </div>

      <CtaBlock
        eyebrow={isFr ? "À noter" : "Note"}
        title={isFr ? "L'Essentielle 490 € HT" : "The Essential €490 (excl. VAT)"}
        description={
          isFr
            ? "Le créneau est verrouillé après le versement de l'acompte 50 %. Conditions de réservation détaillées dans les CGV."
            : "The slot is locked after the 50 % deposit is received. Booking conditions detailed in the Terms."
        }
        cta={
          <Cta href="/conditions-generales" variant="outline">
            {isFr ? "Voir les CGV" : "See Terms"} →
          </Cta>
        }
      />
    </>
  );
}
