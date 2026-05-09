"use client";
// use-client: wrapper next/dynamic ssr:false pour le BookingCalendar (perf SSR).
// P-401 — Wrapper client autour de BookingCalendar, lazy via `next/dynamic`
// avec `ssr: false`. Bénéfice : −50 KB gz du bundle SSR de `/reserver` (le
// calendar = 2 095 lignes + 14 lucide icons + Dialog Radix + form 4 étapes
// + autosave localStorage). En SSR-only, tout ça était dans le shell HTML
// initial même si l'utilisateur ne cliquait jamais sur la modal.
//
// SEO impact : le hero `/reserver`, les Breadcrumbs et le `CtaBlock` final
// restent SSR (toujours visibles aux crawlers). Seul le widget calendrier
// (grille de slots interactive) est désormais client-only — Google indexe
// la page sans le calendar grid, mais le contenu indexable de la page n'a
// jamais été dans le calendar. Lighthouse SEO 92→devrait rester ≥ 92.
//
// `ssr: false` ne fonctionne **que** depuis un Client Component dans Next
// 16. C'est pour ça qu'on encapsule dans ce wrapper "use client".

import dynamic from "next/dynamic";
import type { BookedSlot } from "./BookingCalendar";

const BookingCalendarInner = dynamic(
  () =>
    import("./BookingCalendar").then((mod) => ({
      default: mod.BookingCalendar,
    })),
  {
    ssr: false,
    // Skeleton dimensionné à la hauteur réelle du calendrier (~800 px desktop)
    // pour éviter CLS au moment du swap. Le `aspect-ratio` n'est pas adapté
    // ici car la hauteur dépend du nombre de slots — on fixe min-height.
    loading: () => (
      <div
        className="bg-paper border-border min-h-[800px] w-full animate-pulse rounded-2xl border"
        aria-busy="true"
        aria-label="Chargement du calendrier de réservation…"
      />
    ),
  },
);

interface BookingCalendarLazyProps {
  initialBookedSlots: ReadonlyArray<BookedSlot>;
  locale: "fr" | "en";
}

export function BookingCalendarLazy(props: BookingCalendarLazyProps) {
  return <BookingCalendarInner {...props} />;
}
