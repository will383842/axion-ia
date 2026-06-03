// P-101 — `loading.tsx` granulaire `/reserver` matché aux dimensions réelles
// du contenu. Le skeleton précédent (loading.tsx global) montrait un placeholder
// hero à ~268 px alors que la vraie page fait : hero 320 px + breadcrumbs +
// calendar 800 px + ctaBlock. Sans réservation correcte, le swap loadingâ†’page
// déclenche un CLS â‰¥ 0,4 (mesuré 0,552 sur Lighthouse smoke). Cette version
// pré-réserve les bonnes hauteurs.
export default function ReserverLoading() {
  return (
    <>
      {/* Hero zone — eyebrow + h1 + paragraphe */}
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <div className="mx-auto w-full max-w-[1366px] px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="bg-border h-4 w-40 animate-pulse rounded-xs" aria-hidden="true" />
          <div
            className="bg-border mt-8 h-16 w-3/4 animate-pulse rounded-xs sm:h-20"
            aria-hidden="true"
          />
          <div className="bg-border mt-6 h-5 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
        </div>
      </section>

      {/* Breadcrumbs zone */}
      <div className="bg-bg py-4">
        <div className="mx-auto w-full max-w-[1366px] px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="bg-border h-4 w-1/3 animate-pulse rounded-xs" aria-hidden="true" />
        </div>
      </div>

      {/* Calendar zone — réserve la hauteur réelle (~800 px desktop).
          2026-06-03 (audit responsive) : le wrapper était `max-w-[1680px]` alors
          que la vraie page calendrier (`reserver/page.tsx:464`) est en
          `max-w-7xl` (≈1280, volontaire « pour tenir sur un écran ») → saut de
          ~400 px skeleton→page au swap. Aligné sur la vraie largeur du
          calendrier. */}
      <div className="bg-bg py-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="bg-paper border-border min-h-[800px] w-full animate-pulse rounded-2xl border"
            aria-hidden="true"
          />
        </div>
      </div>

      <span className="sr-only">Chargement de la page de réservation…</span>
    </>
  );
}
