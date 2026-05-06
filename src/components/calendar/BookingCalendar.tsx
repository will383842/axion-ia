"use client";
// use-client: stateful calendar with month nav + modal popup + form submit
// + useSearchParams for ?intervention=slug pre-fill.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Clock, Calendar, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// 5 interventions Module 1 — slug + label FR/EN.
const INTERVENTION_OPTIONS = [
  { slug: "essentielle", fr: "L'Essentielle (490 €)", en: "The Essential (€490)" },
  { slug: "equipes", fr: "Intervention équipes", en: "Team session" },
  { slug: "managers", fr: "Intervention managers", en: "Manager session" },
  { slug: "conference", fr: "Conférence ½ journée", en: "Half-day talk" },
  { slug: "dirigeants", fr: "Intervention dirigeants", en: "Executive session" },
] as const;
type InterventionSlug = (typeof INTERVENTION_OPTIONS)[number]["slug"];

// Villes courantes (libre saisie possible aussi).
const CITY_OPTIONS = [
  "Paris",
  "Lyon",
  "Marseille",
  "Bordeaux",
  "Nantes",
  "Lille",
  "Toulouse",
  "Strasbourg",
  "Rennes",
  "Bruxelles",
  "Genève",
  "Luxembourg",
] as const;

export interface BookedSlot {
  date: string; // ISO yyyy-mm-dd
  intervention: InterventionSlug;
  city: string;
  duration: 1 | 2; // 1 jour ou 2 jours
}

interface BookingCalendarProps {
  /** Slots déjà pris (fixtures démo, Sprint 17 connectera Prisma). */
  initialBookedSlots?: ReadonlyArray<BookedSlot>;
  /** Locale courante. */
  locale: "fr" | "en";
}

const FR_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Calendrier 2026 — grille mois éditoriale, slots pris affichent ville+durée+nom.
// Click jour dispo → modal popup pour choisir intervention + ville + durée + contact.
// Submit → ajoute au state local (démo). Sprint 17 branchera Prisma + email PowerMTA.
export function BookingCalendar({ initialBookedSlots = [], locale }: BookingCalendarProps) {
  const isFr = locale === "fr";
  const months = isFr ? FR_MONTHS : EN_MONTHS;
  const weekDays = isFr
    ? (["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const)
    : (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const);

  const searchParams = useSearchParams();
  const preselectedIntervention =
    (searchParams.get("intervention") as InterventionSlug | null) ?? INTERVENTION_OPTIONS[0].slug;

  const today = React.useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());
  const [bookedSlots, setBookedSlots] =
    React.useState<ReadonlyArray<BookedSlot>>(initialBookedSlots);

  // Modal state
  const [openSlot, setOpenSlot] = React.useState<string | null>(null);
  const [submittingState, setSubmittingState] = React.useState<"idle" | "submitting" | "success">(
    "idle",
  );
  const [formIntervention, setFormIntervention] =
    React.useState<InterventionSlug>(preselectedIntervention);
  const [formCity, setFormCity] = React.useState<string>("Paris");
  const [formDuration, setFormDuration] = React.useState<1 | 2>(1);
  const [formEmail, setFormEmail] = React.useState<string>("");
  const [formCompany, setFormCompany] = React.useState<string>("");

  // Calendrier helpers
  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday=0

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m += 12;
      y -= 1;
    } else if (m > 11) {
      m -= 12;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function getBookingsForDate(key: string): BookedSlot[] {
    // Inclut le 2e jour pour les durées 2j
    return bookedSlots.filter((s) => {
      if (s.date === key) return true;
      if (s.duration === 2) {
        const next = new Date(s.date);
        next.setDate(next.getDate() + 1);
        return dateKey(next.getFullYear(), next.getMonth(), next.getDate()) === key;
      }
      return false;
    });
  }

  function interventionLabel(slug: InterventionSlug) {
    const opt = INTERVENTION_OPTIONS.find((o) => o.slug === slug);
    if (!opt) return slug;
    return isFr ? opt.fr : opt.en;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!openSlot) return;
    setSubmittingState("submitting");
    // Simulate async (Sprint 17 = vrai API)
    setTimeout(() => {
      const newSlot: BookedSlot = {
        date: openSlot,
        intervention: formIntervention,
        city: formCity,
        duration: formDuration,
      };
      setBookedSlots((prev) => [...prev, newSlot]);
      setSubmittingState("success");
      // Auto-close après 1.5s
      setTimeout(() => {
        setOpenSlot(null);
        setSubmittingState("idle");
        setFormEmail("");
        setFormCompany("");
      }, 1800);
    }, 600);
  }

  return (
    <div className="border-border bg-paper shadow-card rounded-3xl border p-6 sm:p-8 lg:p-10">
      {/* Header : navigation mois + légende */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={isFr ? "Mois précédent" : "Previous month"}
            className="text-fg-soft hover:text-terracotta hover:bg-sand border-border focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-full border transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h3
            className="text-fg text-2xl leading-none font-medium"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {months[viewMonth]} {viewYear}
          </h3>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={isFr ? "Mois suivant" : "Next month"}
            className="text-fg-soft hover:text-terracotta hover:bg-sand border-border focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-full border transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="text-fg-muted flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="bg-bg border-border-strong inline-block h-3 w-3 rounded-md border"
            />
            {isFr ? "Disponible" : "Available"}
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="bg-terracotta-soft border-terracotta inline-block h-3 w-3 rounded-md border"
            />
            {isFr ? "Réservé" : "Booked"}
          </span>
        </div>
      </header>

      {/* Grille : weekdays + jours */}
      <div
        role="grid"
        aria-label={isFr ? "Calendrier" : "Calendar"}
        className="grid grid-cols-7 gap-2"
      >
        {weekDays.map((d) => (
          <div
            key={d}
            role="columnheader"
            className="text-fg-muted py-2 text-center text-[11px] font-semibold tracking-[0.16em] uppercase"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: startWeekday }).map((_, i) => (
          <div key={`empty-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = dateKey(viewYear, viewMonth, day);
          const date = new Date(viewYear, viewMonth, day);
          const dow = date.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isPast = date < new Date(today.toDateString());
          const bookings = getBookingsForDate(key);
          const isBooked = bookings.length > 0;
          const disabled = isPast || isWeekend;

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              disabled={disabled || isBooked}
              onClick={() => !disabled && !isBooked && setOpenSlot(key)}
              aria-label={
                isBooked
                  ? `${day} — ${isFr ? "Réservé" : "Booked"}: ${interventionLabel(bookings[0]!.intervention)} · ${bookings[0]!.city}`
                  : disabled
                    ? `${day} — ${isFr ? "Indisponible" : "Unavailable"}`
                    : `${day} — ${isFr ? "Cliquez pour réserver" : "Click to book"}`
              }
              className={cn(
                "group focus-visible:ring-primary relative flex min-h-[88px] flex-col items-stretch rounded-xl border p-2 text-left transition focus-visible:ring-2 focus-visible:outline-none",
                disabled && "text-fg-muted/40 cursor-not-allowed border-transparent bg-transparent",
                !disabled &&
                  !isBooked &&
                  "border-border bg-bg hover:border-terracotta hover:bg-terracotta-soft/50 hover:shadow-card cursor-pointer",
                isBooked && "border-terracotta bg-terracotta-soft cursor-not-allowed",
              )}
            >
              {/* Numéro du jour */}
              <span
                className={cn(
                  "text-base font-semibold tabular-nums",
                  isBooked ? "text-terracotta-deep" : "text-fg",
                )}
              >
                {day}
              </span>

              {/* Si réservé : afficher intervention + ville + durée */}
              {isBooked && bookings[0] ? (
                <div className="text-terracotta-deep mt-1 space-y-0.5 text-[10px] leading-tight">
                  <p className="font-semibold italic" style={{ fontFamily: "var(--font-serif)" }}>
                    {interventionLabel(bookings[0].intervention).split(" (")[0]}
                  </p>
                  <p className="text-terracotta-deep/85 flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{bookings[0].city}</span>
                  </p>
                  <p className="text-terracotta-deep/85 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    <span>
                      {bookings[0].duration}
                      {isFr ? " jour" : " day"}
                      {bookings[0].duration > 1 ? "s" : ""}
                    </span>
                  </p>
                </div>
              ) : null}

              {/* Si dispo : indication subtile au hover */}
              {!disabled && !isBooked ? (
                <span
                  aria-hidden="true"
                  className="text-fg-muted mt-auto text-[10px] opacity-0 transition group-hover:opacity-100"
                >
                  {isFr ? "+ réserver" : "+ book"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Note bas */}
      <p className="text-fg-muted mt-6 text-xs">
        {isFr
          ? "Les week-ends et jours passés sont indisponibles. Cliquez sur une case libre pour ouvrir le formulaire."
          : "Weekends and past days are unavailable. Click an empty cell to open the form."}
      </p>

      {/* MODAL — formulaire de réservation */}
      <Dialog
        open={openSlot !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenSlot(null);
            setSubmittingState("idle");
          }
        }}
      >
        <DialogContent className="max-w-xl rounded-2xl">
          {submittingState === "success" ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="bg-sage-soft text-sage inline-flex h-14 w-14 items-center justify-center rounded-full">
                <Check className="h-6 w-6" aria-hidden="true" />
              </span>
              <DialogTitle className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "Réservation confirmée" : "Booking confirmed"}
              </DialogTitle>
              <DialogDescription>
                {isFr
                  ? "Vous recevrez la confirmation par email sous 1 h ouvrée."
                  : "You will receive confirmation by email within 1 business hour."}
              </DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                  {isFr ? "Réserver une " : "Book an "}
                  <span className="text-terracotta italic">
                    {isFr ? "intervention" : "intervention"}
                  </span>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Calendar className="text-terracotta h-4 w-4" aria-hidden="true" />
                  <span>
                    {openSlot
                      ? new Date(openSlot).toLocaleDateString(isFr ? "fr-FR" : "en-US", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="mt-2 space-y-5">
                {/* Intervention */}
                <div className="space-y-2">
                  <Label
                    htmlFor="bk-intervention"
                    className="text-fg text-xs font-semibold tracking-wide uppercase"
                  >
                    {isFr ? "Quelle intervention ?" : "Which intervention?"}
                  </Label>
                  <select
                    id="bk-intervention"
                    value={formIntervention}
                    onChange={(e) => setFormIntervention(e.target.value as InterventionSlug)}
                    className="border-border bg-bg text-fg focus:border-terracotta focus:ring-terracotta/30 h-11 w-full rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
                  >
                    {INTERVENTION_OPTIONS.map((opt) => (
                      <option key={opt.slug} value={opt.slug}>
                        {isFr ? opt.fr : opt.en}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Durée + Ville en grid 2 cols */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="bk-duration"
                      className="text-fg text-xs font-semibold tracking-wide uppercase"
                    >
                      {isFr ? "Durée" : "Duration"}
                    </Label>
                    <div role="radiogroup" className="flex gap-2">
                      {[1, 2].map((d) => (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={formDuration === d}
                          onClick={() => setFormDuration(d as 1 | 2)}
                          className={cn(
                            "h-11 flex-1 rounded-md border text-sm font-semibold transition",
                            formDuration === d
                              ? "border-terracotta bg-terracotta-soft text-terracotta-deep"
                              : "border-border text-fg-soft hover:border-fg-muted",
                          )}
                        >
                          {d}
                          {isFr ? (d > 1 ? " jours" : " jour") : d > 1 ? " days" : " day"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="bk-city"
                      className="text-fg text-xs font-semibold tracking-wide uppercase"
                    >
                      {isFr ? "Ville" : "City"}
                    </Label>
                    <select
                      id="bk-city"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      className="border-border bg-bg text-fg focus:border-terracotta focus:ring-terracotta/30 h-11 w-full rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
                    >
                      {CITY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label
                    htmlFor="bk-email"
                    className="text-fg text-xs font-semibold tracking-wide uppercase"
                  >
                    {isFr ? "Email professionnel" : "Professional email"}
                  </Label>
                  <Input
                    id="bk-email"
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder={isFr ? "vous@entreprise.com" : "you@company.com"}
                  />
                </div>

                {/* Entreprise */}
                <div className="space-y-2">
                  <Label
                    htmlFor="bk-company"
                    className="text-fg text-xs font-semibold tracking-wide uppercase"
                  >
                    {isFr ? "Entreprise" : "Company"}
                  </Label>
                  <Input
                    id="bk-company"
                    type="text"
                    required
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder={isFr ? "Votre entreprise" : "Your company"}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenSlot(null)}
                    disabled={submittingState === "submitting"}
                  >
                    {isFr ? "Annuler" : "Cancel"}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={submittingState === "submitting"}
                  >
                    {submittingState === "submitting"
                      ? isFr
                        ? "Envoi…"
                        : "Sending…"
                      : isFr
                        ? "Confirmer la réservation"
                        : "Confirm booking"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
