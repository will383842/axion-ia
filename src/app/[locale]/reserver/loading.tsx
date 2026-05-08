// P-101 â€” `loading.tsx` granulaire `/reserver` matchÃ© aux dimensions rÃ©elles
// du contenu. Le skeleton prÃ©cÃ©dent (loading.tsx global) montrait un placeholder
// hero Ã  ~268 px alors que la vraie page fait : hero 320 px + breadcrumbs +
// calendar 800 px + ctaBlock. Sans rÃ©servation correcte, le swap loadingâ†’page
// dÃ©clenche un CLS â‰¥ 0,4 (mesurÃ© 0,552 sur Lighthouse smoke). Cette version
// prÃ©-rÃ©serve les bonnes hauteurs.
export default function ReserverLoading() {
  return (
    <>
      {/* Hero zone â€” eyebrow + h1 + paragraphe */}
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 xl:px-12">
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
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="bg-border h-4 w-1/3 animate-pulse rounded-xs" aria-hidden="true" />
        </div>
      </div>

      {/* Calendar zone â€” rÃ©serve la hauteur rÃ©elle (~800 px desktop) */}
      <div className="bg-bg py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
          <div
            className="bg-paper border-border min-h-[800px] w-full animate-pulse rounded-2xl border"
            aria-hidden="true"
          />
        </div>
      </div>

      <span className="sr-only">Chargement de la page de rÃ©servationâ€¦</span>
    </>
  );
}
