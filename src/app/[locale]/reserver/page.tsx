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
import { INTERVENTION_TIERS, formatPrice, getTierById } from "@/content/pricing";
import { buildProductMetadata } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { enumToSlug } from "@/lib/intervention-type";

interface Props {
  params: Promise<{ locale: string }>;
}

// P0-3 fix — bookings réels depuis Prisma. Anonymisés (jamais le nom de la
// société publique côté visiteur) : on expose la ville (depuis Submission)
// + le secteur + une fourchette de taille déduite de participantsCount.
// Limité aux 4 interventions affichées dans le calendrier (essentielle /
// approfondie / conference / dirigeants). `gagner-du-temps` /
// `intervention-claude` ne s'affichent pas (pas de slot calendrier dédié).
async function loadDbBookedSlots(): Promise<BookedSlot[]> {
  if (!process.env["DATABASE_URL"]) return [];
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 90);

    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: { gte: today, lte: horizon },
        status: { not: "cancelled" },
      },
      select: {
        bookingDate: true,
        interventionType: true,
        participantsCount: true,
        submission: {
          select: {
            sector: true,
            address: true,
            employeesCount: true,
            details: true,
          },
        },
      },
      orderBy: { bookingDate: "asc" },
      take: 250,
    });

    const VISIBLE = new Set([
      "essentielle",
      "approfondie",
      "conference",
      "dirigeants",
      // Sprint 14.10.8 (Will 2026-05-12) — audit Flash terrain affichable
      // dans le calendrier social-proof feed.
      "audit-flash-onsite",
    ]);
    const out: BookedSlot[] = [];
    for (const b of bookings) {
      const slug = enumToSlug(b.interventionType);
      if (!VISIBLE.has(slug)) continue;
      const iso = b.bookingDate.toISOString().slice(0, 10);
      const det = b.submission?.details as Record<string, unknown> | null | undefined;
      const cityFromDetails =
        det && typeof det["companyCity"] === "string" ? (det["companyCity"] as string) : null;
      const city = cityFromDetails ?? b.submission?.address ?? "—";
      const sectorFromDetails =
        det && typeof det["companySector"] === "string" ? (det["companySector"] as string) : null;
      const sector = sectorFromDetails ?? b.submission?.sector ?? "—";
      const size = b.submission?.employeesCount ?? bracketParticipants(b.participantsCount);
      const duration: 1 | 2 = slug === "approfondie" ? 2 : 1;
      out.push({
        date: iso,
        intervention: slug as BookedSlot["intervention"],
        city,
        sector,
        companySize: size,
        duration,
      });
    }
    return out;
  } catch {
    // Fallback silencieux — la page doit toujours afficher les fixtures
    // social proof même si la DB est offline (résilience visiteur).
    return [];
  }
}

function bracketParticipants(n: number): string {
  if (n <= 9) return "1-9";
  if (n <= 49) return "10-49";
  if (n <= 249) return "50-249";
  if (n <= 999) return "250-999";
  return "1000+";
}

// Fixtures social proof — gardés en plus des bookings DB pour densifier
// l'affichage tant que le volume réel est faible. Anonymisé (jamais le nom
// d'entreprise). Inclut sam/dim depuis 2026-05-07.
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
      intervention: "conference",
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
      intervention: "essentielle",
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
      intervention: "conference",
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
      intervention: "essentielle",
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
      intervention: "conference",
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
      intervention: "essentielle",
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
      intervention: "conference",
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
      intervention: "essentielle",
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
        ? "Réserver une intervention IA · calendrier · Axion-IA"
        : "Book an on-site AI session · calendar · Axion-IA",
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

  // P0-3 fix : charger les bookings DB confirmés/pending pour les 90 prochains
  // jours et les fusionner avec les fixtures (social proof). Best-effort : si
  // la DB est indisponible (build statique sans DATABASE_URL), on retombe sur
  // les seules fixtures pour ne pas casser la SSG. La page reste dynamic via
  // les revalidatePath des admin-actions.
  const realBookedSlots = await loadDbBookedSlots();
  const bookedSlots: ReadonlyArray<BookedSlot> = [...realBookedSlots, ...buildFixtureBookedSlots()];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* Hero compact : padding réduit pour rapprocher le calendrier de la fold */}
      <section className="bg-halo-warm relative overflow-hidden pt-7 pb-12 sm:pt-8 sm:pb-14 lg:pt-10 lg:pb-16">
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

      {/* Calendrier — largeur standard (max-w-7xl ≈ 1280px) pour tenir sur un
          viewport laptop sans cellules géantes (Will 2026-05-08 — calendrier
          paraissait trop gros sur la page). */}
      <div className="bg-bg py-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <BookingCalendarLazy initialBookedSlots={bookedSlots} locale={loc} />
        </div>
      </div>

      <CtaBlock
        eyebrow={isFr ? "À noter" : "Note"}
        title={
          isFr
            ? `L'Essentielle ${formatPrice(getTierById(INTERVENTION_TIERS, "intervention-essentielle"), "fr")}`
            : `The Essential ${formatPrice(getTierById(INTERVENTION_TIERS, "intervention-essentielle"), "en")}`
        }
        description={
          isFr
            ? "Le créneau est verrouillé après le versement de l'acompte 50 %. Conditions de réservation détaillées dans les CGV."
            : "The slot is locked after the 50 % deposit is received. Booking conditions detailed in the Terms."
        }
        cta={
          <Cta href="/conditions-generales" variant="outline">
            {isFr ? "Voir les CGV" : "See Terms"} â†’
          </Cta>
        }
      />
    </>
  );
}
