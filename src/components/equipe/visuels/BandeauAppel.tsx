import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Container } from "@/components/layout/Container";

/**
 * Appel final : bandeau `bg-terracotta-deep` (texte ivoire 7,45:1). Ne passe PAS par `CtaBlock`
 * (ton terracotta sous AAA, ton mocha à halo bleu). Les boutons arrivent en `children`.
 */
export function BandeauAppel({
  titre,
  texte,
  reassurance,
  children,
}: {
  titre: string;
  texte: string;
  reassurance?: ReadonlyArray<string>;
  children: ReactNode;
}) {
  return (
    <section
      id="appel"
      aria-labelledby="appel-titre"
      data-fond="terracotta"
      className="bg-terracotta-deep text-mocha-fg relative overflow-hidden py-16 sm:py-20"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 200 200"
        className="stroke-mocha-fg/10 pointer-events-none absolute -top-16 -right-16 h-72 w-72 fill-none"
      >
        <circle cx="200" cy="0" r="60" strokeWidth="1.5" />
        <circle cx="200" cy="0" r="100" strokeWidth="1.5" />
        <circle cx="200" cy="0" r="140" strokeWidth="1.5" />
        <circle cx="200" cy="0" r="180" strokeWidth="1.5" />
      </svg>
      <Container className="relative">
        <h2
          id="appel-titre"
          className="max-w-3xl font-serif text-[clamp(2rem,4vw,3rem)] leading-tight tracking-tight"
        >
          {titre}
        </h2>
        <p className="text-mocha-fg mt-4 max-w-2xl text-lg leading-relaxed">{texte}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">{children}</div>
        {reassurance && reassurance.length > 0 ? (
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-base">
            {reassurance.map((r) => (
              <li key={r} className="inline-flex items-center gap-2">
                <Check aria-hidden="true" focusable="false" className="h-4 w-4" />
                {r}
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </section>
  );
}
