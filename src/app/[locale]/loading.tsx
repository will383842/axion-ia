// Streaming SSR fallback. prefers-reduced-motion-friendly (no spinner).
export default function LocaleLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20 xl:px-12">
      <div className="bg-border h-4 w-32 animate-pulse rounded-xs" aria-hidden="true" />
      <div className="bg-border mt-4 h-12 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
      <div className="bg-border mt-6 h-4 w-1/2 animate-pulse rounded-xs" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
