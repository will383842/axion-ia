// P-102 — `loading.tsx` granulaire `/contact` matché aux dimensions réelles
// (hero 320 px + form 600 px). Le form ContactForm hydrate après JS,
// la skeleton réserve la surface pour éviter CLS au swap.
export default function ContactLoading() {
  return (
    <>
      <section className="bg-halo-warm relative overflow-hidden py-20 sm:py-24 lg:py-28">
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="bg-border h-4 w-32 animate-pulse rounded-xs" aria-hidden="true" />
          <div
            className="bg-border mt-8 h-16 w-2/3 animate-pulse rounded-xs sm:h-20"
            aria-hidden="true"
          />
          <div className="bg-border mt-6 h-5 w-1/2 animate-pulse rounded-xs" aria-hidden="true" />
        </div>
      </section>
      <div className="bg-bg py-16">
        <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 lg:px-8">
          <div
            className="bg-paper border-border min-h-[600px] w-full animate-pulse rounded-2xl border"
            aria-hidden="true"
          />
        </div>
      </div>
      <span className="sr-only">Chargement du formulaire de contact…</span>
    </>
  );
}
