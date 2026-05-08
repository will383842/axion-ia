// P-102 — `loading.tsx` granulaire `/audit` matché aux dimensions réelles
// (hero 320 px + 3 cartes audit 280 px chacune + tarifs grid + CtaBlock).
export default function AuditLoading() {
  return (
    <>
      <section className="bg-halo-warm relative overflow-hidden py-20 sm:py-24 lg:py-28">
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="bg-border h-4 w-40 animate-pulse rounded-xs" aria-hidden="true" />
          <div
            className="bg-border mt-8 h-16 w-3/4 animate-pulse rounded-xs sm:h-20"
            aria-hidden="true"
          />
          <div className="bg-border mt-6 h-5 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
        </div>
      </section>
      <div className="bg-paper py-20">
        <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-bg border-border h-72 animate-pulse rounded-2xl border"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <span className="sr-only">Chargement de la page audit…</span>
    </>
  );
}
