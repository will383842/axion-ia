"use client";
// use-client: calendrier statefull (mois nav + modal multi-step + form state
// + useSearchParams pour pré-fill intervention).
//
// Calendrier 2026 — best practices :
// - Tous jours ouverts (Lun-Dim, samedi/dimanche compris).
// - Mois passé verrouillé (bouton prev disabled si on est sur le mois courant).
// - Jours passés rayés (line-through + opacity 30 + disabled).
// - Multi-jour auto : la durée est lue depuis ?intervention=slug. Pas
//   demandée à l'utilisateur. Vérification anti-chevauchement (le 2ème jour
//   d'une 2j doit aussi être libre, sinon la date est marquée 'partiel'.)
// - Social proof : badge réservations + créneaux dispos.
// - Click date dispo → modal multi-step 4 étapes (Entreprise / Vous /
//   Contexte IA / Récap+submit). Submit stub pour Sprint 17 (Prisma + emails).

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  Sparkles,
  Building2,
  User,
  Brain,
  ArrowRight,
  ArrowLeft,
  Mic,
  Crown,
  Star,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// 5 interventions Module 1 — slug + label FR/EN + durationDays + scheduleHint.
// `durationDays` typé 1|2 large pour permettre l'évolution future (formation
// 2 jours), sans figer le type à `1`.
type InterventionOption = {
  slug: "essentielle" | "conference" | "dirigeants";
  fr: string;
  en: string;
  durationDays: 1 | 2;
  scheduleHintFr: string;
  scheduleHintEn: string;
};

const INTERVENTION_OPTIONS: ReadonlyArray<InterventionOption> = [
  {
    slug: "essentielle",
    fr: "L'Essentielle",
    en: "The Essential",
    durationDays: 1,
    scheduleHintFr: "Journée · 9 h – 17 h · dès 490 €",
    scheduleHintEn: "Day · 9 a.m. – 5 p.m. · from €490",
  },
  {
    slug: "conference",
    fr: "Conférence ½ journée",
    en: "Half-day talk",
    durationDays: 1,
    scheduleHintFr: "Après-midi · 14 h – 17 h · format collectif",
    scheduleHintEn: "Afternoon · 2 p.m. – 5 p.m. · collective format",
  },
  {
    slug: "dirigeants",
    fr: "Dirigeants & CODIR",
    en: "Executives & leadership",
    durationDays: 1,
    scheduleHintFr: "Journée · 9 h – 17 h · 2 dirigeants et +",
    scheduleHintEn: "Day · 9 a.m. – 5 p.m. · 2+ executives",
  },
];

type InterventionSlug = InterventionOption["slug"];

// Icônes + accent + preview hover par formation. Le preview s'affiche au
// hover sur la card (mini-résumé conversion-friendly).
const INTERVENTION_VISUAL: Record<
  InterventionSlug,
  {
    icon: typeof Sparkles;
    accentBg: string;
    accentFg: string;
    priceFr: string;
    priceEn: string;
    previewFr: string;
    previewEn: string;
  }
> = {
  essentielle: {
    icon: Sparkles,
    accentBg: "bg-terracotta-soft",
    accentFg: "text-terracotta-deep",
    priceFr: "dès 490 €",
    priceEn: "from €490",
    previewFr:
      "Découvrir les outils IA · 5 à 10 usages identifiés · automatisations dès le lendemain",
    previewEn: "Discover AI tools · 5 to 10 uses identified · automations from day two",
  },
  conference: {
    icon: Mic,
    accentBg: "bg-terracotta-soft",
    accentFg: "text-terracotta-deep",
    priceFr: "Sur devis",
    priceEn: "On request",
    previewFr: "Sensibiliser toute l'entreprise · panorama IA 2026 · démos live + Q&A",
    previewEn: "Upskill the whole company · 2026 AI panorama · live demos + Q&A",
  },
  dirigeants: {
    icon: Crown,
    accentBg: "bg-mocha-rich",
    accentFg: "text-mocha-fg",
    priceFr: "Sur devis",
    priceEn: "On request",
    previewFr:
      "Vision claire de l'IA en 2026 · usages prioritaires identifiés · référentiel d'arbitrage",
    previewEn: "Clear AI vision for 2026 · priority uses identified · decision framework",
  },
};

// Essentielle uniquement : 3 tranches selon nb participants. Synchro
// avec content/interventions.ts → INTERVENTIONS[0].summary.priceTiers.
export type EssentielleTier = "intimiste" | "standard" | "complete";

const ESSENTIELLE_TIERS: ReadonlyArray<{
  id: EssentielleTier;
  labelFr: string;
  labelEn: string;
  sizeFr: string;
  sizeEn: string;
  priceEur: number;
  isFeatured?: boolean;
}> = [
  {
    id: "intimiste",
    labelFr: "Intimiste",
    labelEn: "Intimate",
    sizeFr: "2 à 4 personnes",
    sizeEn: "2 to 4 people",
    priceEur: 490,
  },
  {
    id: "standard",
    labelFr: "Standard",
    labelEn: "Standard",
    sizeFr: "5 à 6 personnes",
    sizeEn: "5 to 6 people",
    priceEur: 790,
    isFeatured: true,
  },
  {
    id: "complete",
    labelFr: "Complète",
    labelEn: "Complete",
    sizeFr: "7 à 8 personnes",
    sizeEn: "7 to 8 people",
    priceEur: 1190,
  },
];

const SECTOR_OPTIONS = [
  "Tech / SaaS",
  "Industrie / Manufacturing",
  "Conseil / Services pro",
  "Distribution / Retail",
  "Santé / Médical",
  "Finance / Assurance",
  "Immobilier / BTP",
  "Hôtellerie / Restauration",
  "Éducation / Formation",
  "Public / Associatif",
  "Autre",
] as const;

const SIZE_OPTIONS = [
  { value: "1-9", labelFr: "TPE · 1-9 personnes", labelEn: "Small · 1-9 people" },
  { value: "10-49", labelFr: "PME · 10-49 personnes", labelEn: "SMB · 10-49 people" },
  { value: "50-249", labelFr: "ETI · 50-249 personnes", labelEn: "Mid · 50-249 people" },
  {
    value: "250-999",
    labelFr: "Grande · 250-999 personnes",
    labelEn: "Enterprise · 250-999 people",
  },
  { value: "1000+", labelFr: "Très grande · 1000+", labelEn: "Very large · 1000+" },
] as const;

export interface BookedSlot {
  date: string; // ISO yyyy-mm-dd
  intervention: InterventionSlug;
  city: string;
  /** Pays — affiché à côté de la ville pour les interventions internationales. */
  country?: string;
  /** Secteur d'activité — visible publiquement (sans nom de l'entreprise). */
  sector: string;
  /** Taille de l'entreprise — affichée comme social proof (« 50-249 »). */
  companySize: string;
  duration: 1 | 2;
}

interface BookingCalendarProps {
  initialBookedSlots?: ReadonlyArray<BookedSlot>;
  locale: "fr" | "en";
}

const FR_MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
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

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d! + n);
  return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function BookingCalendar({ initialBookedSlots = [], locale }: BookingCalendarProps) {
  const isFr = locale === "fr";
  const months = isFr ? FR_MONTHS : EN_MONTHS;
  const weekDays = isFr
    ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const interventionFromUrl = searchParams.get("intervention") as InterventionSlug | null;

  // INTERVENTION_OPTIONS est garanti non-vide par construction.
  const defaultOpt: InterventionOption = INTERVENTION_OPTIONS[0]!;
  const initialOpt: InterventionOption =
    (interventionFromUrl && INTERVENTION_OPTIONS.find((o) => o.slug === interventionFromUrl)) ||
    defaultOpt;

  // L'utilisateur peut changer l'intervention DANS le calendrier (override URL).
  // Re-render des dates bloquées quand la durée change.
  const [selectedOpt, setSelectedOpt] = React.useState<InterventionOption>(initialOpt);
  const preselectedOpt = selectedOpt;

  // Tier Essentielle (effectif → prix). Lu depuis ?tier= ou défaut "standard".
  // Visible uniquement si selectedOpt.slug === "essentielle".
  const tierFromUrl = searchParams.get("tier") as EssentielleTier | null;
  const initialTier: EssentielleTier =
    (tierFromUrl && ESSENTIELLE_TIERS.find((t) => t.id === tierFromUrl)?.id) || "standard";
  const [selectedTier, setSelectedTier] = React.useState<EssentielleTier>(initialTier);

  // Flash titre calendrier + auto-scroll mobile. Re-déclenchés à chaque
  // pickOpt — `flashKey` change → key React re-mount → animation rejoue.
  const [flashKey, setFlashKey] = React.useState(0);
  const calendarFrameRef = React.useRef<HTMLDivElement>(null);

  // Synchronisation URL ↔ state. Si on quitte Essentielle, on retire ?tier=.
  function pickOpt(opt: InterventionOption) {
    const isChange = opt.slug !== selectedOpt.slug;
    setSelectedOpt(opt);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("intervention", opt.slug);
    if (opt.slug !== "essentielle") {
      sp.delete("tier");
    } else if (!sp.get("tier")) {
      sp.set("tier", selectedTier);
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });

    if (isChange) {
      // Trigger flash titre Mai 2026
      setFlashKey((k) => k + 1);

      // Auto-scroll vers le calendrier sur mobile uniquement (< lg = 1024 px)
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        window.setTimeout(() => {
          calendarFrameRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 150);
      }
    }
  }

  function pickTier(t: EssentielleTier) {
    setSelectedTier(t);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tier", t);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const today = React.useMemo(() => new Date(), []);
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());
  const [bookedSlots, setBookedSlots] =
    React.useState<ReadonlyArray<BookedSlot>>(initialBookedSlots);

  // Index booked dates → l'indexe par date pour O(1) lookup, en tenant compte
  // des durations (slot 2j bloque date AND date+1).
  const bookedByDate = React.useMemo(() => {
    const map = new Map<string, BookedSlot>();
    for (const slot of bookedSlots) {
      map.set(slot.date, slot);
      if (slot.duration === 2) {
        // Bloque le J+1 aussi pour la durée 2 jours
        const next = addDays(slot.date, 1);
        if (!map.has(next)) {
          map.set(next, { ...slot, date: next });
        }
      }
    }
    return map;
  }, [bookedSlots]);

  // Modal state
  const [openSlot, setOpenSlot] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [submittingState, setSubmittingState] = React.useState<"idle" | "submitting" | "success">(
    "idle",
  );

  // === Save & resume — localStorage autosave du form ===
  // Permet à l'utilisateur de fermer accidentellement le popup sans perdre
  // son travail. Restauré au prochain ouverture.
  const STORAGE_KEY = "axionia.booking.draft.v1";
  const draftRestored = React.useRef<boolean>(false);

  // Form fields — 4 étapes
  const [companyName, setCompanyName] = React.useState("");
  const [companySize, setCompanySize] = React.useState<string>(SIZE_OPTIONS[1].value);
  const [companySector, setCompanySector] = React.useState<string>(SECTOR_OPTIONS[0]);
  const [companyCity, setCompanyCity] = React.useState("");

  const [contactFirstName, setContactFirstName] = React.useState("");
  const [contactLastName, setContactLastName] = React.useState("");
  const [contactRole, setContactRole] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");

  const [aiUsage, setAiUsage] = React.useState<"none" | "tested" | "active">("none");
  const [aiTools, setAiTools] = React.useState("");
  const [hasAutomations, setHasAutomations] = React.useState<"yes" | "no">("no");
  const [auditInterest, setAuditInterest] = React.useState<"yes" | "maybe" | "no">("maybe");
  const [comments, setComments] = React.useState("");

  const [consent, setConsent] = React.useState(false);

  const [hasDraft, setHasDraft] = React.useState(false);
  const [draftDismissed, setDraftDismissed] = React.useState(false);

  // Détection brouillon : appelée depuis l'event handler `onCellClick`
  // (pas dans un useEffect) — évite la règle React `set-state-in-effect`
  // et garantit que la check ne se déclenche qu'au moment où le user
  // ouvre la popup. La fonction est définie ici pour avoir accès au
  // setState ; elle est appelée dans onCellClick juste après setOpenSlot.
  function detectExistingDraft() {
    if (draftRestored.current || draftDismissed) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      // Critère "draft significatif" : entreprise renseignée (> 1 char).
      if (draft?.companyName && draft.companyName.length > 1) {
        setHasDraft(true);
      }
    } catch {
      // localStorage indisponible (mode privé) — silently no-op
    }
  }

  // P-202 — Autosave debounced 400 ms.
  // Avant : chaque keystroke (companyName, contactFirstName, comments…)
  // déclenchait un `localStorage.setItem` synchrone (~2-5 ms sur mobile bas
  // de gamme) → INP +30-80 ms par frappe sur les 8 champs texte. Désormais
  // on coalesce dans un timeout 400 ms — si l'utilisateur tape vite, une
  // seule écriture en fin de salve. La fenêtre 400 ms reste safe vs perte
  // de données (un crash navigateur < 400 ms après dernière frappe est
  // rare ; en pratique, chaque clic suivant déclenche aussi un flush
  // implicite avant). Pas de cleanup à l'unmount strict — `clearTimeout`
  // garantit déjà qu'on n'écrit pas après destruction.
  React.useEffect(() => {
    if (!openSlot || typeof window === "undefined") return;
    if (!companyName) return; // évite d'écrire un draft vide
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            companyName,
            companySize,
            companySector,
            companyCity,
            contactFirstName,
            contactLastName,
            contactRole,
            contactEmail,
            contactPhone,
            aiUsage,
            aiTools,
            hasAutomations,
            auditInterest,
            comments,
            step,
            ts: Date.now(),
          }),
        );
      } catch {
        // no-op
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    openSlot,
    companyName,
    companySize,
    companySector,
    companyCity,
    contactFirstName,
    contactLastName,
    contactRole,
    contactEmail,
    contactPhone,
    aiUsage,
    aiTools,
    hasAutomations,
    auditInterest,
    comments,
    step,
  ]);

  function restoreDraft() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setCompanyName(draft.companyName ?? "");
      setCompanySize(draft.companySize ?? SIZE_OPTIONS[1].value);
      setCompanySector(draft.companySector ?? SECTOR_OPTIONS[0]);
      setCompanyCity(draft.companyCity ?? "");
      setContactFirstName(draft.contactFirstName ?? "");
      setContactLastName(draft.contactLastName ?? "");
      setContactRole(draft.contactRole ?? "");
      setContactEmail(draft.contactEmail ?? "");
      setContactPhone(draft.contactPhone ?? "");
      setAiUsage(draft.aiUsage ?? "none");
      setAiTools(draft.aiTools ?? "");
      setHasAutomations(draft.hasAutomations ?? "no");
      setAuditInterest(draft.auditInterest ?? "maybe");
      setComments(draft.comments ?? "");
      setStep(draft.step ?? 1);
      setHasDraft(false);
      draftRestored.current = true;
    } catch {
      // no-op
    }
  }

  function dismissDraft() {
    setHasDraft(false);
    setDraftDismissed(true);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* no-op */
      }
    }
  }

  function clearDraftOnSuccess() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* no-op */
      }
    }
  }

  // Reset modal au close
  function closeModal() {
    setOpenSlot(null);
    setStep(1);
    setSubmittingState("idle");
  }

  // === Calendar grid build ===
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  // Décalage : Lun=0, Dim=6
  const dayOffset = (firstOfMonth.getDay() + 6) % 7;

  const cells: Array<{ key: string; day: number | null }> = [];
  for (let i = 0; i < dayOffset; i++) cells.push({ key: `empty-${i}`, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: dateKey(viewYear, viewMonth, d), day: d });
  }

  // Mois passé navigable seulement vers le futur depuis le mois courant
  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

  function prevMonth() {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  // === Stats social proof + urgence légitime ===
  const slotsThisMonthBooked = bookedSlots.filter((s) => {
    const [y, m] = s.date.split("-").map(Number);
    return y === viewYear && m! - 1 === viewMonth;
  }).length;
  const totalDaysThisMonth = daysInMonth;
  // Estimation jours encore dispos = total - booked - jours passés
  const isViewingCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const passedDaysIfCurrent = isViewingCurrentMonth ? today.getDate() : 0;
  const availableSlots = Math.max(
    0,
    totalDaysThisMonth - slotsThisMonthBooked - passedDaysIfCurrent,
  );

  // « Réservations cette semaine » — compte des bookings dans les 7 derniers jours
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const sevenDaysAgoKey = dateKey(
    sevenDaysAgo.getFullYear(),
    sevenDaysAgo.getMonth(),
    sevenDaysAgo.getDate(),
  );
  // ATTENTION : "cette semaine" = bookings sur la semaine en cours.
  // Approximation pragmatique : count dates dans [today-7, today+7].
  const sevenDaysAfter = new Date(today);
  sevenDaysAfter.setDate(today.getDate() + 7);
  const sevenDaysAfterKey = dateKey(
    sevenDaysAfter.getFullYear(),
    sevenDaysAfter.getMonth(),
    sevenDaysAfter.getDate(),
  );
  const bookingsThisWeek = bookedSlots.filter(
    (s) => s.date >= sevenDaysAgoKey && s.date <= sevenDaysAfterKey,
  ).length;

  // « Prochain créneau dispo » — premier jour futur non réservé compte tenu
  // de la durée de l'intervention selectionnée
  const dur = preselectedOpt.durationDays;
  let nextAvailableKey: string | null = null;
  for (let offset = 0; offset < 60; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (bookedByDate.has(k)) continue;
    if (dur === 2 && bookedByDate.has(addDays(k, 1))) continue;
    nextAvailableKey = k;
    break;
  }
  const nextAvailableLabel = React.useMemo(() => {
    if (!nextAvailableKey) return null;
    const [y, m, d] = nextAvailableKey.split("-").map(Number);
    const dt = new Date(y!, m! - 1, d!);
    const dayName = isFr
      ? ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][dt.getDay()]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
    const monthShort = isFr
      ? [
          "janv.",
          "févr.",
          "mars",
          "avr.",
          "mai",
          "juin",
          "juil.",
          "août",
          "sept.",
          "oct.",
          "nov.",
          "déc.",
        ][m! - 1]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
          m! - 1
        ];
    return `${dayName} ${d} ${monthShort}`;
  }, [nextAvailableKey, isFr]);

  // Click sur une cellule
  function onCellClick(iso: string) {
    if (iso < todayKey) return;
    if (bookedByDate.has(iso)) return;
    // Vérifier que le J+1 est libre si la durée est 2
    const dur = preselectedOpt.durationDays;
    if (dur === 2) {
      const next = addDays(iso, 1);
      if (bookedByDate.has(next)) {
        // Le 2ème jour est pris — pas d'ouverture modal, feedback
        return;
      }
    }
    setOpenSlot(iso);
    setStep(1);
    // Check brouillon localStorage en event handler (pas useEffect).
    detectExistingDraft();
  }

  // === SUBMIT (stub) ===
  function handleSubmit() {
    if (!openSlot) return;
    setSubmittingState("submitting");
    // Calcul prix selon tier pour Essentielle uniquement.
    const tier =
      preselectedOpt.slug === "essentielle"
        ? ESSENTIELLE_TIERS.find((t) => t.id === selectedTier)
        : undefined;
    // [booking:submit:stub] — Sprint 17 branchera Server Action + Prisma + Telegram + email.
    // P-509 — gated `NODE_ENV !== "production"` pour ne pas polluer la console
    // en prod (Lighthouse Best Practices déduit des points pour les logs prod).
    if (process.env.NODE_ENV !== "production") {
      console.warn("[booking:submit:stub]", {
        date: openSlot,
        duration: preselectedOpt.durationDays,
        intervention: preselectedOpt.slug,
        ...(tier ? { tier: tier.id, priceEur: tier.priceEur } : {}),
        company: {
          name: companyName,
          size: companySize,
          sector: companySector,
          city: companyCity,
        },
        contact: {
          firstName: contactFirstName,
          lastName: contactLastName,
          role: contactRole,
          email: contactEmail,
          phone: contactPhone,
        },
        ai: { usage: aiUsage, tools: aiTools, hasAutomations, auditInterest, comments },
      });
    }

    // Ajout local (simulation) — slot anonymisé avec infos publiques
    setBookedSlots((prev) => [
      ...prev,
      {
        date: openSlot,
        intervention: preselectedOpt.slug,
        city: companyCity || "—",
        sector: companySector,
        companySize,
        duration: preselectedOpt.durationDays,
      },
    ]);

    setTimeout(() => {
      setSubmittingState("success");
      // Draft consommé : on nettoie le localStorage.
      clearDraftOnSuccess();
    }, 600);
  }

  // === Validation par step ===
  const canStep1 = companyName.length > 1 && companyCity.length > 1;
  const canStep2 =
    contactFirstName.length > 1 &&
    contactLastName.length > 1 &&
    /^\S+@\S+\.\S+$/.test(contactEmail) &&
    contactPhone.length > 5;
  const canStep3 = true; // libre
  const canStep4 = consent;

  // === Render ===
  return (
    <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-10">
      {/* COLONNE GAUCHE (lg+) / TOP (mobile) — sélecteur d'intervention.
          List view 1 par ligne PARTOUT pour clarté maximale. Sticky desktop. */}
      <aside className="mb-8 lg:sticky lg:top-24 lg:mb-0 lg:self-start">
        {/* Header étape 1 — explicite et numéroté */}
        <div className="mb-5 flex items-start gap-3">
          <span className="bg-terracotta text-mocha-fg shadow-subtle flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
            1
          </span>
          <div>
            <p className="text-terracotta-deep text-[11px] font-bold tracking-[0.16em] uppercase">
              {isFr ? "Étape 1" : "Step 1"}
            </p>
            <p className="text-fg mt-0.5 text-base leading-tight font-bold sm:text-lg">
              {isFr ? "Quelle intervention vous intéresse ?" : "Which intervention?"}
            </p>
          </div>
        </div>

        {/* List 1 par ligne · cards horizontales icône+texte+prix+check */}
        <ul className="space-y-2.5">
          {INTERVENTION_OPTIONS.map((opt) => {
            const isSel = opt.slug === selectedOpt.slug;
            const visual = INTERVENTION_VISUAL[opt.slug];
            const Icon = visual.icon;
            return (
              <li key={opt.slug}>
                <button
                  type="button"
                  onClick={() => pickOpt(opt)}
                  aria-pressed={isSel}
                  className={cn(
                    "group flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all",
                    isSel
                      ? "border-terracotta bg-halo-warm shadow-card scale-[1.01]"
                      : "border-border bg-paper hover:border-terracotta/60 hover:bg-halo-warm/40 hover:shadow-subtle",
                  )}
                >
                  {/* Icône à gauche dans pastille accent */}
                  <span
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      visual.accentBg,
                      visual.accentFg,
                    )}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>

                  {/* Bloc central — titre + hint + preview hover */}
                  <div className="min-w-0 flex-1">
                    <p className="text-fg text-base leading-tight font-bold">
                      {isFr ? opt.fr : opt.en}
                    </p>
                    <p className="text-fg-muted mt-1 text-[12px] leading-snug">
                      {opt.durationDays === 1
                        ? isFr
                          ? "1 jour · "
                          : "1 day · "
                        : isFr
                          ? "2 jours · "
                          : "2 days · "}
                      {isFr ? opt.scheduleHintFr : opt.scheduleHintEn}
                    </p>
                    <p
                      className={cn(
                        "mt-1.5 text-[12px] font-bold tracking-wide tabular-nums",
                        isSel ? "text-terracotta-deep" : "text-fg-soft",
                      )}
                    >
                      {isFr ? visual.priceFr : visual.priceEn}
                    </p>
                    {/* Preview hover — révélé au group-hover (motion safe).
                        Affiche un mini-résumé conversion-friendly. */}
                    <p
                      className={cn(
                        "text-terracotta-deep max-h-0 overflow-hidden text-[11.5px] leading-snug font-medium opacity-0 transition-all duration-300",
                        "group-hover:mt-2 group-hover:max-h-20 group-hover:opacity-100",
                        isSel && "mt-2 max-h-20 opacity-100",
                      )}
                    >
                      <span aria-hidden="true">→ </span>
                      {isFr ? visual.previewFr : visual.previewEn}
                    </p>
                  </div>

                  {/* Indicateur sélection à droite */}
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all",
                      isSel
                        ? "bg-terracotta text-mocha-fg shadow-subtle"
                        : "border-border-strong bg-paper group-hover:border-terracotta/60 border-2 text-transparent",
                    )}
                  >
                    <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Aide contextuelle sous la liste */}
        <p className="text-fg-muted mt-4 flex items-start gap-2 text-[12px] leading-snug">
          <ArrowRight
            aria-hidden="true"
            className="text-terracotta-deep mt-0.5 h-3.5 w-3.5 shrink-0"
          />
          {isFr
            ? "Une fois choisie, sélectionnez votre date dans le calendrier →"
            : "Once picked, select your date in the calendar →"}
        </p>
      </aside>

      {/* COLONNE DROITE (lg+) / BOTTOM (mobile) — calendrier complet */}
      <div>
        {/* Header social proof + urgence légitime — calculé live */}
        <div className="border-border bg-paper mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border px-5 py-3 text-sm">
          <span className="inline-flex items-center gap-2">
            <Calendar aria-hidden="true" className="text-terracotta-deep h-4 w-4" />
            <span className="text-fg font-semibold tabular-nums">{bookingsThisWeek}</span>
            <span className="text-fg-muted">
              {isFr ? "réservations cette semaine" : "bookings this week"}
            </span>
          </span>
          <span className="bg-border-strong h-4 w-px" aria-hidden="true" />
          <span className="inline-flex items-center gap-2">
            <Sparkles aria-hidden="true" className="text-terracotta-deep h-4 w-4" />
            <span className="text-terracotta-deep font-semibold tabular-nums">
              {availableSlots}
            </span>
            <span className="text-fg-muted">
              {isFr ? "dispos ce mois" : "available this month"}
            </span>
          </span>
          {nextAvailableLabel ? (
            <>
              <span
                className="bg-border-strong hidden h-4 w-px sm:inline-block"
                aria-hidden="true"
              />
              <span className="hidden items-center gap-2 sm:inline-flex">
                <Check aria-hidden="true" className="text-terracotta-deep h-4 w-4" />
                <span className="text-fg-muted">
                  {isFr ? "Prochain dispo : " : "Next available: "}
                </span>
                <span className="text-fg font-semibold">{nextAvailableLabel}</span>
              </span>
            </>
          ) : null}
        </div>

        {/* CADRE CALENDRIER — bordure 2px + shadow + gradient halo-warm.
          ref pour auto-scroll mobile au changement d'intervention. */}
        <div
          ref={calendarFrameRef}
          className="border-border-strong bg-paper shadow-card relative overflow-hidden rounded-3xl border-2 p-6 sm:p-8 lg:p-10"
        >
          {/* Halo décoratif top-right */}
          <div
            aria-hidden="true"
            className="bg-halo-warm pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-60 blur-3xl"
          />

          {/* Calendar header — étape 2 (cohérent avec étape 1 sidebar) */}
          <div className="relative mb-7 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="bg-terracotta text-mocha-fg shadow-subtle flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                2
              </span>
              <div>
                <p className="text-terracotta-deep text-[11px] font-bold tracking-[0.16em] uppercase">
                  {isFr ? "Étape 2" : "Step 2"}
                </p>
                <h2
                  key={`title-${flashKey}`}
                  className="text-fg title-flash mt-1 text-[clamp(2rem,3.5vw,3.25rem)] leading-tight font-medium tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {months[viewMonth]} <span className="text-terracotta italic">{viewYear}</span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={prevMonth}
                disabled={!canGoPrev}
                aria-label={isFr ? "Mois précédent" : "Previous month"}
                className="border-border-strong text-fg bg-paper hover:border-terracotta hover:text-terracotta-deep hover:shadow-card flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all disabled:cursor-not-allowed disabled:opacity-25"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label={isFr ? "Mois suivant" : "Next month"}
                className="border-border-strong text-fg bg-paper hover:border-terracotta hover:text-terracotta-deep hover:shadow-card flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Weekday header — plus visible */}
          <div className="relative mb-4 grid grid-cols-7 gap-2.5 sm:gap-4">
            {weekDays.map((d) => (
              <div
                key={d}
                className="text-terracotta-deep text-center text-sm font-bold tracking-[0.14em] uppercase sm:text-base"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid — cells plus grandes, contraste +++ */}
          <ol className="relative grid grid-cols-7 gap-2.5 sm:gap-4">
            {cells.map((cell) => {
              if (cell.day === null) {
                return <li key={cell.key} className="aspect-square" />;
              }
              const iso = cell.key;
              const isPast = iso < todayKey;
              const isToday = iso === todayKey;
              const booked = bookedByDate.get(iso);
              const isBooked = !!booked;
              const dur = preselectedOpt.durationDays;
              const nextDayBooked = dur === 2 && bookedByDate.has(addDays(iso, 1));
              const isBlockedByOverlap = !isBooked && !isPast && nextDayBooked;
              const isAvailable = !isPast && !isBooked && !isBlockedByOverlap;

              return (
                <li key={cell.key} className="relative">
                  <button
                    type="button"
                    onClick={() => onCellClick(iso)}
                    disabled={!isAvailable}
                    aria-label={
                      isBooked
                        ? isFr
                          ? `${cell.day} — réservé`
                          : `${cell.day} — booked`
                        : isPast
                          ? isFr
                            ? `${cell.day} — passé`
                            : `${cell.day} — past`
                          : isAvailable
                            ? isFr
                              ? `${cell.day} — disponible`
                              : `${cell.day} — available`
                            : isFr
                              ? `${cell.day} — non disponible (chevauchement)`
                              : `${cell.day} — unavailable (overlap)`
                    }
                    title={
                      isBooked && booked
                        ? `${isFr ? "Réservé" : "Booked"} · ${booked.city}${booked.country ? ` (${booked.country})` : ""} · ${booked.sector} · ${booked.companySize}`
                        : undefined
                    }
                    className={cn(
                      "group relative flex aspect-square w-full flex-col items-stretch justify-start rounded-2xl text-left transition-all",
                      // Passé : SIMPLE — line-through opacity 40
                      isPast &&
                        "text-fg-muted cursor-not-allowed p-3 line-through opacity-40 sm:p-4",
                      // Réservé : LUMINEUX (halo-warm + accent terracotta) avec infos publiques
                      isBooked &&
                        "bg-halo-warm border-terracotta/40 text-fg shadow-subtle cursor-not-allowed border-2 p-2 sm:p-3",
                      // Chevauchement (2j et J+1 pris) — neutre
                      isBlockedByOverlap &&
                        "border-border bg-paper text-fg-muted cursor-not-allowed border-2 p-3 opacity-40 sm:p-4",
                      // Dispo : lumineux, hover halo-warm + lift fort
                      isAvailable &&
                        "border-border-strong bg-paper hover:border-terracotta hover:bg-halo-warm hover:shadow-card text-fg cursor-pointer border-2 p-3 hover:-translate-y-1 sm:p-4",
                      isToday &&
                        isAvailable &&
                        "ring-terracotta/40 ring-offset-paper ring-4 ring-offset-2",
                    )}
                  >
                    {/* Numéro du jour — gros, lisible à 2m */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          isBooked
                            ? "text-fg text-lg sm:text-xl"
                            : "text-2xl sm:text-3xl lg:text-4xl",
                          isToday && isAvailable && "text-terracotta-deep",
                        )}
                      >
                        {cell.day}
                      </span>
                      {isBooked ? (
                        <span
                          aria-hidden="true"
                          className="bg-terracotta shadow-subtle inline-block h-2.5 w-2.5 rounded-full"
                        />
                      ) : null}
                    </div>

                    {isBooked && booked ? (
                      /* Cell réservée : ville + secteur + taille en chips compactes.
                       Anonymat : pas de nom d'entreprise. */
                      <div className="mt-auto flex flex-col gap-1 text-left">
                        <p className="text-fg truncate text-[12px] leading-tight font-bold sm:text-[13px]">
                          <span aria-hidden="true">📍 </span>
                          {booked.city}
                          {booked.country && booked.country !== "FR" ? (
                            <span className="text-fg-muted ml-0.5 font-semibold">
                              · {booked.country}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-fg-soft truncate text-[11px] leading-tight font-medium sm:text-[12px]">
                          {booked.sector}
                        </p>
                        <p className="text-fg-muted truncate text-[11px] leading-tight font-semibold sm:text-[12px]">
                          {booked.companySize}
                        </p>
                      </div>
                    ) : isAvailable ? (
                      <span className="text-terracotta-deep mt-auto text-[13px] font-bold opacity-0 transition-opacity group-hover:opacity-100 sm:text-sm">
                        {isFr ? "Réserver →" : "Book →"}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Témoignage flottant — social proof concret juste sous la grille
            pour rassurer au moment du clic. Anonymisé : prénom + initiale,
            rôle B2B crédible (DRH, taille entreprise), citation focus
            conversion (réservation simple + résultat concret). */}
          <FloatingTestimonial isFr={isFr} />

          {/* Légende — plus contrastée */}
          <div className="text-fg relative mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm font-medium">
            <span className="inline-flex items-center gap-2.5">
              <span className="bg-paper border-border-strong h-4 w-4 rounded-md border-2" />
              {isFr ? "Disponible" : "Available"}
            </span>
            <span className="inline-flex items-center gap-2.5">
              <span className="bg-halo-warm border-terracotta/40 h-4 w-4 rounded-md border-2" />
              {isFr
                ? "Réservé (ville · secteur · taille visibles)"
                : "Booked (city · sector · size visible)"}
            </span>
            <span className="inline-flex items-center gap-2.5">
              <span className="text-fg-muted text-base line-through opacity-40">—</span>
              {isFr ? "Passé" : "Past"}
            </span>
            <span className="inline-flex items-center gap-2.5">
              <span className="ring-terracotta/40 bg-paper ring-offset-paper h-4 w-4 rounded-md ring-4 ring-offset-1" />
              {isFr ? "Aujourd'hui" : "Today"}
            </span>
          </div>
        </div>

        {/* === Modal multi-step — UX 2026, popup grand format ===
          Best practices : sur desktop, max-w-4xl pour respiration. Sur mobile,
          full-screen avec bordures arrondies douces. Padding aéré, transitions
          smooth, glassmorphism subtil sur l'overlay. */}
        <Dialog open={openSlot !== null} onOpenChange={(o) => !o && closeModal()}>
          <DialogContent
            className={cn(
              "bg-paper shadow-card rounded-3xl border-0 p-0",
              // Mobile : quasi plein écran, marges minimales (97vh)
              "max-h-[97vh] w-[calc(100%-0.75rem)] max-w-none overflow-hidden",
              // Tablet
              "sm:max-w-3xl sm:rounded-3xl",
              // Desktop : très large + très haut pour éviter tout scroll
              "lg:max-w-6xl xl:max-w-[1320px]",
            )}
          >
            {/* Bandeau header — bg halo-warm signature, compact pour laisser
              de la place au body et éviter le scroll. */}
            <div className="bg-halo-warm border-terracotta/15 relative border-b px-6 py-5 sm:px-9 sm:py-6 lg:px-12">
              {/* Halo décoratif top-right */}
              <div
                aria-hidden="true"
                className="bg-terracotta/15 pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full blur-3xl"
              />
              <DialogHeader className="relative">
                <p className="text-fg-muted text-[12px] font-semibold tracking-[0.16em] uppercase">
                  <span
                    aria-hidden="true"
                    className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  />
                  {submittingState === "success"
                    ? isFr
                      ? "Demande enregistrée"
                      : "Request saved"
                    : isFr
                      ? "Réservation"
                      : "Booking"}
                </p>
                <DialogTitle
                  className="text-fg mt-2 text-[clamp(1.4rem,2.6vw,2rem)] leading-tight font-medium tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {submittingState === "success" ? (
                    isFr ? (
                      <>
                        On vous <span className="text-terracotta italic">rappelle sous 48 h</span>
                      </>
                    ) : (
                      <>
                        We&apos;ll <span className="text-terracotta italic">call you back</span>
                      </>
                    )
                  ) : isFr ? (
                    <>
                      Votre <span className="text-terracotta italic">créneau</span>
                    </>
                  ) : (
                    <>
                      Your <span className="text-terracotta italic">slot</span>
                    </>
                  )}
                </DialogTitle>
                {openSlot && submittingState !== "success" ? (
                  <DialogDescription className="text-fg-soft mt-3 text-base sm:text-lg">
                    {isFr
                      ? `${formatDateFr(openSlot, preselectedOpt.durationDays)} · ${isFr ? preselectedOpt.fr : preselectedOpt.en}`
                      : `${formatDateEn(openSlot, preselectedOpt.durationDays)} · ${preselectedOpt.en}`}
                  </DialogDescription>
                ) : null}
              </DialogHeader>
            </div>

            {/* Corps scrollable — overflow auto en fallback, mais avec
              max-h-[97vh] et popup XL, le scroll est rare en pratique. */}
            <div className="max-h-[calc(97vh-160px)] overflow-y-auto px-6 py-6 sm:px-9 sm:py-7 lg:px-12 lg:py-8">
              <DialogHeader className="sr-only">
                <DialogTitle>{isFr ? "Réservation" : "Booking"}</DialogTitle>
              </DialogHeader>

              {submittingState === "success" ? (
                <div className="py-2">
                  {/* Bandeau « Pas encore confirmée » — important : le user ne doit
                  pas croire que c'est validé. */}
                  <div className="bg-halo-warm border-terracotta/30 mb-5 rounded-2xl border-2 p-4">
                    <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
                      {isFr ? "Demande enregistrée" : "Request saved"}
                    </p>
                    <p className="text-fg mt-2 text-base leading-snug font-semibold">
                      {isFr
                        ? "Votre réservation n'est pas encore confirmée."
                        : "Your booking is not confirmed yet."}
                    </p>
                    <p className="text-fg-soft mt-2 text-sm leading-relaxed">
                      {isFr
                        ? "Elle ne sera définitive qu'après l'échange téléphonique de cadrage et le versement du premier acompte (50 %)."
                        : "It will only be final after the framing call and the 50 % deposit payment."}
                    </p>
                  </div>

                  {/* 3 étapes pour confirmer */}
                  <ol className="space-y-3">
                    {[
                      {
                        num: "1",
                        title: isFr
                          ? "Call de cadrage sous 48 h ouvrées"
                          : "Framing call within 48 business hours",
                        detail: isFr
                          ? "Notre équipe vous appelle au numéro indiqué pour valider le format et les modalités pratiques."
                          : "Our team calls you to confirm the format and practicalities.",
                      },
                      {
                        num: "2",
                        title: isFr
                          ? "Versement du premier acompte (50 %)"
                          : "First deposit (50 %)",
                        detail: isFr
                          ? "Virement bancaire ou carte. Facture immédiate. C'est ce paiement qui valide votre créneau dans le calendrier."
                          : "Bank transfer or card. Invoice issued immediately. This payment locks your slot.",
                      },
                      {
                        num: "3",
                        title: isFr
                          ? "Réservation confirmée et créneau bloqué"
                          : "Booking confirmed and slot locked",
                        detail: isFr
                          ? "Vous recevez la confirmation finale par email avec tous les détails logistiques."
                          : "You receive a final email confirmation with logistics details.",
                      },
                    ].map((s) => (
                      <li
                        key={s.num}
                        className="bg-paper border-border flex gap-3 rounded-xl border p-3"
                      >
                        <span className="bg-terracotta text-mocha-fg flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold">
                          {s.num}
                        </span>
                        <div className="min-w-0">
                          <p className="text-fg text-sm leading-snug font-semibold">{s.title}</p>
                          <p className="text-fg-soft mt-0.5 text-[13px] leading-relaxed">
                            {s.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <Button onClick={closeModal} className="mt-6" shape="pill">
                    {isFr ? "J'ai compris, fermer" : "Got it, close"}
                  </Button>
                </div>
              ) : openSlot ? (
                <>
                  {/* Banner draft restauration — visible si form en cours détecté */}
                  {hasDraft && !draftDismissed ? (
                    <div className="bg-halo-warm border-terracotta/30 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-4 py-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <Sparkles
                          aria-hidden="true"
                          className="text-terracotta-deep mt-0.5 h-4 w-4 shrink-0"
                        />
                        <div>
                          <p className="text-fg text-sm leading-tight font-semibold">
                            {isFr
                              ? "Reprendre votre réservation en cours ?"
                              : "Resume your booking in progress?"}
                          </p>
                          <p className="text-fg-soft mt-0.5 text-[12px] leading-tight">
                            {isFr
                              ? "Vos informations ont été sauvegardées automatiquement."
                              : "Your information was saved automatically."}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          onClick={restoreDraft}
                          size="sm"
                          shape="pill"
                          variant="primary"
                        >
                          {isFr ? "Reprendre" : "Resume"}
                        </Button>
                        <Button
                          type="button"
                          onClick={dismissDraft}
                          size="sm"
                          shape="pill"
                          variant="ghost"
                        >
                          {isFr ? "Recommencer" : "Restart"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* Progress bar */}
                  <ProgressBar step={step} isFr={isFr} />

                  {/* Bannière "Brouillon trouvé" — apparaît au step 1 quand
                      un brouillon localStorage existe et n'a pas été
                      explicitement rejeté. Permet de reprendre une saisie
                      en cours. */}
                  {step === 1 && hasDraft && !draftDismissed ? (
                    <div className="bg-halo-warm border-terracotta/30 mb-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4 sm:p-5">
                      <div className="min-w-0 flex-1">
                        <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
                          {isFr ? "Brouillon retrouvé" : "Draft found"}
                        </p>
                        <p className="text-fg mt-1 text-sm leading-snug">
                          {isFr
                            ? "Une saisie précédente a été sauvegardée sur cet appareil. Vous pouvez la reprendre ou repartir de zéro."
                            : "A previous entry was saved on this device. You can resume it or start fresh."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" shape="pill" size="sm" onClick={restoreDraft}>
                          {isFr ? "Reprendre" : "Resume"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          shape="pill"
                          size="sm"
                          onClick={dismissDraft}
                        >
                          {isFr ? "Repartir de zéro" : "Start fresh"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="py-2">
                    {step === 1 ? (
                      <StepCompany
                        isFr={isFr}
                        companyName={companyName}
                        setCompanyName={setCompanyName}
                        companySize={companySize}
                        setCompanySize={setCompanySize}
                        companySector={companySector}
                        setCompanySector={setCompanySector}
                        companyCity={companyCity}
                        setCompanyCity={setCompanyCity}
                        showTierSelector={preselectedOpt.slug === "essentielle"}
                        selectedTier={selectedTier}
                        onPickTier={pickTier}
                      />
                    ) : null}

                    {step === 2 ? (
                      <StepContact
                        isFr={isFr}
                        contactFirstName={contactFirstName}
                        setContactFirstName={setContactFirstName}
                        contactLastName={contactLastName}
                        setContactLastName={setContactLastName}
                        contactRole={contactRole}
                        setContactRole={setContactRole}
                        contactEmail={contactEmail}
                        setContactEmail={setContactEmail}
                        contactPhone={contactPhone}
                        setContactPhone={setContactPhone}
                      />
                    ) : null}

                    {step === 3 ? (
                      <StepAiContext
                        isFr={isFr}
                        aiUsage={aiUsage}
                        setAiUsage={setAiUsage}
                        aiTools={aiTools}
                        setAiTools={setAiTools}
                        hasAutomations={hasAutomations}
                        setHasAutomations={setHasAutomations}
                        auditInterest={auditInterest}
                        setAuditInterest={setAuditInterest}
                        comments={comments}
                        setComments={setComments}
                      />
                    ) : null}

                    {step === 4 ? (
                      <StepRecap
                        isFr={isFr}
                        iso={openSlot}
                        interventionLabel={isFr ? preselectedOpt.fr : preselectedOpt.en}
                        durationDays={preselectedOpt.durationDays}
                        company={{
                          name: companyName,
                          size: companySize,
                          sector: companySector,
                          city: companyCity,
                        }}
                        contact={{
                          firstName: contactFirstName,
                          lastName: contactLastName,
                          email: contactEmail,
                          phone: contactPhone,
                        }}
                        consent={consent}
                        setConsent={setConsent}
                      />
                    ) : null}
                  </div>

                  {/* Footer nav */}
                  <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3 | 4) : closeModal()
                      }
                      shape="pill"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      {step === 1 ? (isFr ? "Annuler" : "Cancel") : isFr ? "Précédent" : "Back"}
                    </Button>

                    {step < 4 ? (
                      <Button
                        type="button"
                        onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                        shape="pill"
                        disabled={
                          (step === 1 && !canStep1) ||
                          (step === 2 && !canStep2) ||
                          (step === 3 && !canStep3)
                        }
                      >
                        {isFr ? "Suivant" : "Next"}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleSubmit}
                        shape="pill"
                        disabled={!canStep4 || submittingState === "submitting"}
                        loading={submittingState === "submitting"}
                      >
                        {isFr ? "Confirmer la réservation" : "Confirm booking"}
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// === Sub-components ===

function ProgressBar({ step, isFr }: { step: 1 | 2 | 3 | 4; isFr: boolean }) {
  const labels = isFr
    ? ["Entreprise", "Vous", "Contexte IA", "Récap"]
    : ["Company", "You", "AI context", "Recap"];
  const icons = [Building2, User, Brain, Check] as const;
  return (
    <div className="border-border-strong mb-6 grid grid-cols-4 gap-2 border-b-2 pb-6 sm:gap-4 sm:pb-7">
      {labels.map((label, i) => {
        const Icon = icons[i]!;
        const isActive = step === i + 1;
        const isDone = step > i + 1;
        return (
          <div
            key={label}
            className={cn(
              "flex flex-col items-center gap-2.5 text-center sm:flex-row sm:items-center sm:gap-3.5 sm:text-left",
              isActive && "text-terracotta-deep",
              isDone && "text-fg",
              !isActive && !isDone && "text-fg-muted",
            )}
          >
            <span
              className={cn(
                // Mobile-first : grand cercle 56px, qui passe à 60px desktop
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all sm:h-[60px] sm:w-[60px]",
                isActive &&
                  "bg-terracotta text-mocha-fg ring-terracotta/30 ring-offset-paper shadow-card scale-105 ring-4 ring-offset-2",
                isDone && "bg-mocha text-mocha-fg shadow-subtle",
                !isActive && !isDone && "bg-sand border-border-strong text-fg-muted border-2",
              )}
            >
              {isDone ? (
                <Check className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" strokeWidth={3} />
              ) : (
                <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
              )}
            </span>
            <span
              className={cn(
                "leading-tight font-bold",
                "text-sm sm:text-base",
                isActive && "text-base sm:text-lg",
              )}
            >
              <span
                className={cn(
                  "block text-[11px] tracking-[0.18em] uppercase sm:hidden",
                  isActive ? "text-terracotta-deep font-bold" : "text-fg-muted font-semibold",
                )}
              >
                {isFr ? `Étape ${i + 1}` : `Step ${i + 1}`}
              </span>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StepCompany(props: {
  isFr: boolean;
  companyName: string;
  setCompanyName: (s: string) => void;
  companySize: string;
  setCompanySize: (s: string) => void;
  companySector: string;
  setCompanySector: (s: string) => void;
  companyCity: string;
  setCompanyCity: (s: string) => void;
  showTierSelector?: boolean;
  selectedTier?: EssentielleTier;
  onPickTier?: (t: EssentielleTier) => void;
}) {
  const { isFr } = props;
  return (
    <div className="space-y-6">
      {/* Sélecteur tier — visible UNIQUEMENT pour l'Essentielle.
          Détermine le prix selon le nombre de participants. */}
      {props.showTierSelector && props.selectedTier && props.onPickTier ? (
        <div className="bg-halo-warm border-terracotta/25 -mx-2 rounded-2xl border-2 p-5 sm:p-6">
          <Label className="text-fg mb-3 block text-base font-bold sm:text-lg">
            {isFr ? "Combien de participants ?" : "How many participants?"}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <p className="text-fg-soft mb-4 text-sm leading-relaxed">
            {isFr
              ? "Le tarif dépend de l'effectif présent à la journée Essentielle. Programme identique pour les 3 tranches."
              : "The price depends on the headcount on the day. Same programme for all 3 tiers."}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {ESSENTIELLE_TIERS.map((t) => {
              const isSel = t.id === props.selectedTier;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => props.onPickTier!(t.id)}
                  className={cn(
                    "relative flex min-h-[120px] flex-col items-start rounded-xl border-2 p-4 text-left transition-all",
                    isSel
                      ? "border-terracotta bg-paper text-terracotta-deep shadow-card scale-[1.02]"
                      : "border-border-strong bg-paper text-fg hover:border-terracotta/60 hover:shadow-subtle",
                  )}
                >
                  {t.isFeatured ? (
                    <span className="bg-terracotta text-mocha-fg absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                      ★ {isFr ? "Recommandé" : "Recommended"}
                    </span>
                  ) : null}
                  <span className="text-fg-muted text-[11px] font-bold tracking-[0.16em] uppercase">
                    {isFr ? t.labelFr : t.labelEn}
                  </span>
                  <span
                    className={cn(
                      "mt-2 text-2xl leading-none font-bold tabular-nums sm:text-3xl",
                      isSel ? "text-terracotta-deep" : "text-fg",
                    )}
                  >
                    {t.priceEur} €
                  </span>
                  <span className="text-fg-soft mt-2 text-[13px] leading-tight font-semibold">
                    {isFr ? t.sizeFr : t.sizeEn}
                  </span>
                  <span className="text-fg-muted mt-1 text-[11px]">
                    {isFr ? "HT" : "excl. VAT"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <Field label={isFr ? "Nom de l'entreprise" : "Company name"} required>
        <Input
          value={props.companyName}
          onChange={(e) => props.setCompanyName(e.target.value)}
          placeholder={isFr ? "Ex. Cabinet Dupont & Associés" : "e.g. Acme Corp"}
        />
      </Field>

      <div>
        <Label className="text-fg mb-3 block text-base font-bold sm:text-lg">
          {isFr ? "Taille de l'entreprise" : "Company size"}
        </Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => props.setCompanySize(opt.value)}
              className={cn(
                "min-h-[76px] rounded-xl border-2 px-3 py-3.5 text-center text-sm leading-tight font-bold transition-all sm:min-h-[84px]",
                props.companySize === opt.value
                  ? "border-terracotta bg-halo-warm text-terracotta-deep shadow-subtle scale-[1.02]"
                  : "border-border-strong bg-paper text-fg hover:border-terracotta/60 hover:bg-halo-warm/40",
              )}
            >
              {isFr ? opt.labelFr : opt.labelEn}
            </button>
          ))}
        </div>
      </div>

      <Field label={isFr ? "Secteur d'activité" : "Industry"}>
        <select
          value={props.companySector}
          onChange={(e) => props.setCompanySector(e.target.value)}
          className="border-border-strong bg-paper text-fg focus-visible:ring-terracotta hover:border-fg/60 focus-visible:border-terracotta focus-visible:ring-terracotta/20 h-12 w-full rounded-lg border px-4 text-base transition focus-visible:ring-4 focus-visible:outline-none"
        >
          {SECTOR_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field label={isFr ? "Ville (lieu de l'intervention)" : "City (intervention venue)"} required>
        <Input
          value={props.companyCity}
          onChange={(e) => props.setCompanyCity(e.target.value)}
          placeholder={isFr ? "Ex. Paris, Bruxelles, New York" : "e.g. Paris, Brussels, New York"}
        />
      </Field>
    </div>
  );
}

function StepContact(props: {
  isFr: boolean;
  contactFirstName: string;
  setContactFirstName: (s: string) => void;
  contactLastName: string;
  setContactLastName: (s: string) => void;
  contactRole: string;
  setContactRole: (s: string) => void;
  contactEmail: string;
  setContactEmail: (s: string) => void;
  contactPhone: string;
  setContactPhone: (s: string) => void;
}) {
  const { isFr } = props;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isFr ? "Prénom" : "First name"} required>
          <Input
            value={props.contactFirstName}
            onChange={(e) => props.setContactFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </Field>
        <Field label={isFr ? "Nom" : "Last name"} required>
          <Input
            value={props.contactLastName}
            onChange={(e) => props.setContactLastName(e.target.value)}
            autoComplete="family-name"
          />
        </Field>
      </div>
      <Field label={isFr ? "Fonction" : "Role"}>
        <Input
          value={props.contactRole}
          onChange={(e) => props.setContactRole(e.target.value)}
          placeholder={isFr ? "Ex. DRH, DG, Responsable IT" : "e.g. HR Director, CEO, IT Manager"}
        />
      </Field>
      <Field label={isFr ? "Email professionnel" : "Work email"} required>
        <Input
          type="email"
          value={props.contactEmail}
          onChange={(e) => props.setContactEmail(e.target.value)}
          autoComplete="email"
          placeholder="contact@entreprise.com"
        />
      </Field>
      <Field label={isFr ? "Téléphone" : "Phone"} required>
        <Input
          type="tel"
          value={props.contactPhone}
          onChange={(e) => props.setContactPhone(e.target.value)}
          autoComplete="tel"
          placeholder="+33 6 12 34 56 78"
        />
      </Field>
    </div>
  );
}

function StepAiContext(props: {
  isFr: boolean;
  aiUsage: "none" | "tested" | "active";
  setAiUsage: (s: "none" | "tested" | "active") => void;
  aiTools: string;
  setAiTools: (s: string) => void;
  hasAutomations: "yes" | "no";
  setHasAutomations: (s: "yes" | "no") => void;
  auditInterest: "yes" | "maybe" | "no";
  setAuditInterest: (s: "yes" | "maybe" | "no") => void;
  comments: string;
  setComments: (s: string) => void;
}) {
  const { isFr } = props;
  const usageLabels = isFr
    ? { none: "Aucun usage IA", tested: "Quelques tests", active: "Usage actif" }
    : { none: "No AI use", tested: "A few tests", active: "Active use" };
  const auditLabels = isFr
    ? { yes: "Oui, ça m'intéresse", maybe: "Peut-être", no: "Non, pas pour l'instant" }
    : { yes: "Yes, interested", maybe: "Maybe", no: "Not for now" };

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-fg mb-3 block text-base font-bold sm:text-lg">
          {isFr
            ? "Vos équipes utilisent-elles déjà l'IA aujourd'hui ?"
            : "Do your teams already use AI today?"}
        </Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["none", "tested", "active"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => props.setAiUsage(v)}
              className={cn(
                "min-h-[76px] rounded-xl border-2 px-4 py-4 text-base font-bold transition-all sm:min-h-[88px] sm:text-lg",
                props.aiUsage === v
                  ? "border-terracotta bg-halo-warm text-terracotta-deep shadow-subtle scale-[1.02]"
                  : "border-border-strong bg-paper text-fg hover:border-terracotta/60 hover:bg-halo-warm/40",
              )}
            >
              {usageLabels[v]}
            </button>
          ))}
        </div>
      </div>

      {props.aiUsage !== "none" ? (
        <Field
          label={
            isFr
              ? "Lesquels (ChatGPT, Claude, Copilot, autre…) ?"
              : "Which ones (ChatGPT, Claude, Copilot, other…)?"
          }
        >
          <Input
            value={props.aiTools}
            onChange={(e) => props.setAiTools(e.target.value)}
            placeholder={isFr ? "Listez les outils utilisés" : "List the tools used"}
          />
        </Field>
      ) : null}

      <div>
        <Label className="text-fg mb-3 block text-base font-bold sm:text-lg">
          {isFr
            ? "Avez-vous déjà mis en place des automatisations ?"
            : "Have you set up any automations yet?"}
        </Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["yes", "no"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => props.setHasAutomations(v)}
              className={cn(
                "min-h-[76px] rounded-xl border-2 px-4 py-4 text-base font-bold transition-all sm:min-h-[88px] sm:text-lg",
                props.hasAutomations === v
                  ? "border-terracotta bg-halo-warm text-terracotta-deep shadow-subtle scale-[1.02]"
                  : "border-border-strong bg-paper text-fg hover:border-terracotta/60 hover:bg-halo-warm/40",
              )}
            >
              {v === "yes" ? (isFr ? "Oui" : "Yes") : isFr ? "Non" : "No"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-fg mb-3 block text-base font-bold sm:text-lg">
          {isFr
            ? "Un audit IA pour optimiser votre entreprise vous intéresse ?"
            : "Are you interested in an AI audit to optimise your company?"}
        </Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["yes", "maybe", "no"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => props.setAuditInterest(v)}
              className={cn(
                "min-h-[76px] rounded-xl border-2 px-4 py-4 text-base font-bold transition-all sm:min-h-[88px] sm:text-lg",
                props.auditInterest === v
                  ? "border-terracotta bg-halo-warm text-terracotta-deep shadow-subtle scale-[1.02]"
                  : "border-border-strong bg-paper text-fg hover:border-terracotta/60 hover:bg-halo-warm/40",
              )}
            >
              {auditLabels[v]}
            </button>
          ))}
        </div>
      </div>

      <Field label={isFr ? "Commentaires (optionnel)" : "Comments (optional)"}>
        <textarea
          value={props.comments}
          onChange={(e) => props.setComments(e.target.value)}
          rows={4}
          className="border-border-strong bg-paper text-fg focus-visible:ring-terracotta hover:border-fg/60 focus-visible:border-terracotta focus-visible:ring-terracotta/20 w-full rounded-lg border px-4 py-3 text-base transition focus-visible:ring-4 focus-visible:outline-none"
          placeholder={
            isFr
              ? "Contraintes particulières, attentes spécifiques…"
              : "Specific constraints, particular expectations…"
          }
        />
      </Field>
    </div>
  );
}

function StepRecap(props: {
  isFr: boolean;
  iso: string;
  interventionLabel: string;
  durationDays: 1 | 2;
  company: { name: string; size: string; sector: string; city: string };
  contact: { firstName: string; lastName: string; email: string; phone: string };
  consent: boolean;
  setConsent: (b: boolean) => void;
}) {
  const { isFr } = props;
  return (
    <div className="space-y-5">
      <div className="bg-halo-warm border-terracotta/25 rounded-xl border-2 p-5">
        <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
          {isFr ? "Votre créneau" : "Your slot"}
        </p>
        <p
          className="text-fg mt-2 text-xl leading-snug font-medium"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isFr
            ? formatDateFr(props.iso, props.durationDays)
            : formatDateEn(props.iso, props.durationDays)}
        </p>
        <p className="text-fg-soft mt-1 text-sm">{props.interventionLabel}</p>
      </div>

      <RecapRow
        label={isFr ? "Entreprise" : "Company"}
        value={`${props.company.name} · ${props.company.sector} · ${props.company.size}${props.company.city ? ` · ${props.company.city}` : ""}`}
      />
      <RecapRow
        label={isFr ? "Contact" : "Contact"}
        value={`${props.contact.firstName} ${props.contact.lastName} · ${props.contact.email} · ${props.contact.phone}`}
      />

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={props.consent}
          onChange={(e) => props.setConsent(e.target.checked)}
          className="text-terracotta focus-visible:ring-terracotta border-border-strong mt-0.5 h-4 w-4 rounded"
        />
        <span className="text-fg-soft text-sm leading-relaxed">
          {isFr
            ? "J'accepte d'être contacté·e pour valider cette réservation et les modalités. Données traitées selon notre politique de confidentialité."
            : "I agree to be contacted to confirm this booking and discuss the practicalities. Data handled per our privacy policy."}
        </span>
      </label>

      {/* Badge sécurité — trust signal final juste avant Confirmer */}
      <div className="border-border bg-paper flex items-start gap-3 rounded-xl border px-4 py-3">
        <ShieldCheck aria-hidden="true" className="text-terracotta-deep mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-fg-soft text-[13px] leading-relaxed">
          <span className="text-fg font-semibold">
            {isFr
              ? "Hébergement Hetzner Frankfurt · RGPD · Cabinet européen"
              : "Hetzner Frankfurt hosting · GDPR · European consultancy"}
          </span>
          {" · "}
          {isFr
            ? "Vos données ne quittent jamais l'UE. Réponse garantie sous 48 h ouvrées."
            : "Your data never leaves the EU. Reply guaranteed within 48 business hours."}
        </p>
      </div>
    </div>
  );
}

// 3 témoignages anonymisés rotatifs (carousel auto 7s, pause au hover).
// Personae B2B variés (DRH, DG, Présidente) pour couvrir tous les profils
// décideurs. Aucun nom d'entreprise (anonymat preservé).
const TESTIMONIALS = [
  {
    initials: "SL",
    nameFr: "Sophie L.",
    nameEn: "Sophie L.",
    roleFr: "DRH · ETI industrielle · Lyon, 250 personnes",
    roleEn: "HR Director · mid-size industrial · Lyon, 250 people",
    quoteFr:
      "Réservation en 2 minutes, call de cadrage très clair le lendemain. Mes 8 collaborateurs étaient opérationnels dès la semaine suivante.",
    quoteEn:
      "Booked in 2 minutes, very clear framing call the next day. My 8 employees were operational the following week.",
    daysAgoFr: "il y a 12 jours",
    daysAgoEn: "12 days ago",
  },
  {
    initials: "MD",
    nameFr: "Marc D.",
    nameEn: "Marc D.",
    roleFr: "DG · PME tech · Bordeaux, 35 personnes",
    roleEn: "CEO · tech SMB · Bordeaux, 35 people",
    quoteFr:
      "On a gagné 9 heures par semaine, par personne, sur la rédaction d'emails et de comptes-rendus. ROI atteint en 3 semaines.",
    quoteEn:
      "We saved 9 hours per week, per person, on emails and minute writing. ROI hit in 3 weeks.",
    daysAgoFr: "il y a 3 semaines",
    daysAgoEn: "3 weeks ago",
  },
  {
    initials: "CV",
    nameFr: "Claire V.",
    nameEn: "Claire V.",
    roleFr: "Présidente · cabinet conseil · Paris, 65 personnes",
    roleEn: "President · consulting firm · Paris, 65 people",
    quoteFr:
      "Programme standardisé, ressources prêtes à utiliser dès le retour au bureau. Aucun document sur-mesure à valider — c'est un vrai gain de temps managérial.",
    quoteEn:
      "Standardised programme, ready-to-use takeaways from day one back at the office. No bespoke documents to validate — real managerial time saved.",
    daysAgoFr: "il y a 5 semaines",
    daysAgoEn: "5 weeks ago",
  },
];

function FloatingTestimonial({ isFr }: { isFr: boolean }) {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);

  React.useEffect(() => {
    if (isPaused) return;
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % TESTIMONIALS.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [isPaused]);

  const t = TESTIMONIALS[activeIdx]!;
  return (
    <div
      className="bg-halo-warm border-terracotta/25 shadow-subtle relative mt-7 overflow-hidden rounded-2xl border-2 p-5 sm:p-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      role="region"
      aria-label={isFr ? "Témoignages clients" : "Customer testimonials"}
    >
      <div
        aria-hidden="true"
        className="bg-terracotta/10 pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl"
      />
      <div className="relative flex flex-wrap items-start gap-4 sm:flex-nowrap sm:gap-5">
        <span className="bg-terracotta text-mocha-fg shadow-subtle flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold">
          {t.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  aria-hidden="true"
                  className="text-terracotta h-3.5 w-3.5"
                  fill="currentColor"
                  strokeWidth={0}
                />
              ))}
            </span>
            <span className="text-fg-muted text-[11px] font-medium">
              {isFr ? t.daysAgoFr : t.daysAgoEn}
            </span>
          </div>
          <blockquote
            key={activeIdx}
            className="text-fg mt-2.5 text-[15px] leading-relaxed italic sm:text-base"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            «&nbsp;{isFr ? t.quoteFr : t.quoteEn}&nbsp;»
          </blockquote>
          <p className="text-fg-soft mt-3 text-[13px] leading-tight">
            <span className="text-fg font-bold">{isFr ? t.nameFr : t.nameEn}</span>
            <span className="text-fg-muted"> · {isFr ? t.roleFr : t.roleEn}</span>
          </p>
        </div>
      </div>

      {/* Indicateurs carousel — 3 dots cliquables */}
      <div className="relative mt-4 flex items-center justify-center gap-2">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIdx(i)}
            aria-label={`${isFr ? "Témoignage" : "Testimonial"} ${i + 1}`}
            aria-current={i === activeIdx ? "true" : undefined}
            className={cn(
              "rounded-full transition-all",
              i === activeIdx
                ? "bg-terracotta h-2 w-6"
                : "bg-fg-muted/30 hover:bg-fg-muted/50 h-2 w-2",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper border-border rounded-xl border p-5">
      <p className="text-fg-muted text-xs font-semibold tracking-[0.14em] uppercase">{label}</p>
      <p className="text-fg mt-1.5 text-base leading-relaxed font-medium">{value || "—"}</p>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="text-fg mb-2.5 block text-base font-bold sm:text-lg">
        {label}
        {required ? <span className="text-terracotta-deep ml-1.5 font-bold">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

// === Date formatters ===

function formatDateFr(iso: string, durationDays: 1 | 2): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  const dayName = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][
    dt.getDay()
  ];
  const formatted = `${dayName} ${d} ${FR_MONTHS[m! - 1]?.toLowerCase()} ${y}`;
  if (durationDays === 1) return formatted;
  const next = addDays(iso, 1);
  const [, m2, d2] = next.split("-").map(Number);
  return `${formatted} → ${d2} ${FR_MONTHS[m2! - 1]?.toLowerCase()} (2 jours)`;
}

function formatDateEn(iso: string, durationDays: 1 | 2): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    dt.getDay()
  ];
  const formatted = `${dayName}, ${EN_MONTHS[m! - 1]} ${d}, ${y}`;
  if (durationDays === 1) return formatted;
  const next = addDays(iso, 1);
  const [, m2, d2] = next.split("-").map(Number);
  return `${formatted} → ${EN_MONTHS[m2! - 1]} ${d2} (2 days)`;
}
