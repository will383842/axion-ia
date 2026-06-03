// Streaming SSR fallback global pour `/[locale]` — matche la structure d'une
// page éditoriale standard Axion-IA (PageHero Section + 1 section secondaire).
//
// P-WV-CLS-01 (audit Web Vitals 2026-05-15 AGENT 1) — CLS root cause.
// Avant : skeleton minimal (~160 px). Sur les 404 (route inexistante, ex.
// `/fr/tarifs`) ce skeleton SSR-streamait sous-dimensionné puis hydratait le
// vrai `LocaleNotFound` (~800 px) → footer poussé de ~700 px → CLS = 0.479
// mesuré Lighthouse mobile. Doctrine interne (`AGENTS.md`) exige CLS = 0.
//
// Fix : skeleton dimensionné comme une `Section titleAs="h1"` réelle (hero
// halo-warm + eyebrow 16 px + h1 64 px + description 24 px + 2 CTAs + grille
// 4 cartes), puis 1 section secondaire 240 px. Hauteur totale ≈ 900-1000 px
// mobile — matche la moyenne des pages éditoriales (404 LocaleNotFound,
// landing minimaliste, marketing copy, etc.). Sur les routes plus longues
// (audit, contact, reserver, ville pSEO), un `loading.tsx` granulaire P-101
// à P-104 prend le pas et reste mieux dimensionné.
//
// prefers-reduced-motion-friendly (no spinner, only animate-pulse qui est
// respecté nativement par Tailwind via `prefers-reduced-motion: reduce`).
export default function LocaleLoading() {
  return (
    <>
      {/* Hero zone — Section titleAs="h1" / tone halo-warm.
          Padding doit matcher Section.tsx ligne 86 :
          `pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32`. */}
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
        <div className="mx-auto w-full max-w-[1366px] px-4 sm:px-6 lg:px-10 xl:px-16">
          {/* eyebrow */}
          <div className="bg-border h-4 w-32 animate-pulse rounded-xs" aria-hidden="true" />
          {/* h1 — 2 lignes possibles mobile, 1 ligne desktop. Matche
              `text-display-1` typographie v3.2 : ~56 px mobile, ~88 px lg. */}
          <div
            className="bg-border mt-8 h-16 w-3/4 animate-pulse rounded-xs sm:h-20 lg:h-24"
            aria-hidden="true"
          />
          {/* description — 1 ligne souvent, 2 lignes parfois */}
          <div className="bg-border mt-6 h-5 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
          <div
            className="bg-border mt-3 h-5 w-1/2 animate-pulse rounded-xs sm:hidden"
            aria-hidden="true"
          />

          {/* CTAs row — réserve la hauteur des 2 boutons pill `Cta size="lg"`
              (~48 px) côte-à-côte avec gap-4. */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <div className="bg-border h-12 w-44 animate-pulse rounded-full" aria-hidden="true" />
            <div className="bg-border h-12 w-36 animate-pulse rounded-full" aria-hidden="true" />
          </div>

          {/* Grille de cartes secondaires — réserve la zone qu'on retrouve
              massivement (suggestions 404, 4 features grid, intervention
              cards, etc.). 2 colonnes mobile, 4 desktop, ~80 px par carte. */}
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-paper border-border h-20 animate-pulse rounded-xl border"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Section secondaire — réserve l'emplacement d'un FeatureGrid /
          ProcessSteps / Stats qu'on retrouve sur 80 % des pages éditoriales. */}
      <div className="bg-paper py-16 sm:py-20 lg:py-24">
        <div className="mx-auto w-full max-w-[1366px] px-4 sm:px-6 lg:px-10 xl:px-16">
          <div
            className="bg-bg border-border h-60 w-full animate-pulse rounded-2xl border sm:h-64"
            aria-hidden="true"
          />
        </div>
      </div>

      <span className="sr-only">Chargement…</span>
    </>
  );
}
