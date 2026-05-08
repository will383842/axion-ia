// P-104 — `loading.tsx` granulaire `/implantations/[region]/[ville]` —
// template ville pSEO (2 150+ SSG livrés Sprint 14.9). Hero + 10 sections
// réservées, conforme Ã  la structure AxionIA-centric (interventions,
// méthodologie, tarifs, FAQ AEO, related cities).
export default function VilleLoading() {
  return (
    <>
      {/* Hero zone */}
      <section className="bg-halo-warm relative overflow-hidden pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="bg-border h-4 w-32 animate-pulse rounded-xs" aria-hidden="true" />
          <div
            className="bg-border mt-6 h-14 w-3/4 animate-pulse rounded-xs sm:h-16"
            aria-hidden="true"
          />
          <div className="bg-border mt-5 h-5 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
        </div>
      </section>
      {/* Breadcrumbs */}
      <div className="bg-bg py-3">
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="bg-border h-3 w-1/2 animate-pulse rounded-xs" aria-hidden="true" />
        </div>
      </div>
      {/* 3 sections réservées (interventions / méthodologie / tarifs) */}
      <div className="bg-paper py-16">
        <div className="mx-auto w-full max-w-[1280px] space-y-12 px-4 sm:px-6 lg:px-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-bg border-border h-64 animate-pulse rounded-2xl border"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <span className="sr-only">Chargement de la page ville…</span>
    </>
  );
}
