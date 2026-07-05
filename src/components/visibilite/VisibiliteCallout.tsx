// Encart « visibilité offerte » — bandeau compact réutilisable, à insérer sur les
// pages services (audit, 1-to-1, implémentation, sites web…) pour renvoyer vers
// /visibilite-entreprise. Server Component, ZÉRO JS. Maillage interne + rappel du
// bonus visibilité à chaque service. Fond mocha pour ressortir sur la page.

import type { ReactNode } from "react";
import { ArrowRight, Globe, Link2, Mic, Share2, Video } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export function VisibiliteCallout({ isFr }: { isFr: boolean }): ReactNode {
  const items: ReadonlyArray<{ icon: typeof Mic; label: string }> = [
    { icon: Mic, label: "Podcast" },
    { icon: Video, label: isFr ? "Interviews" : "Interviews" },
    { icon: Globe, label: isFr ? "Page dédiée" : "Dedicated page" },
    { icon: Link2, label: isFr ? "Backlink dofollow" : "Dofollow backlink" },
    { icon: Share2, label: "LinkedIn" },
  ];

  return (
    <section className="bg-mocha-rich text-mocha-fg py-20 sm:py-24 lg:py-28">
      <Container>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-mocha-fg/70 text-[13px] font-medium tracking-[0.16em] uppercase">
              {isFr ? "En bonus, avec votre prestation" : "As a bonus, with your service"}
            </p>
            <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-tight">
              {isFr ? "On met votre entreprise " : "We put your company "}
              <span
                className="text-terracotta-soft italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "en lumière" : "in the spotlight"}
              </span>
            </h2>
            <p data-speakable className="text-mocha-fg/85 mt-4 leading-relaxed">
              {isFr
                ? "Podcast, interviews de vos équipes, page dédiée sur axion-ia.com, backlink dofollow et relais LinkedIn — offerts avec votre prestation, pour un vrai gain de visibilité et d'autorité SEO."
                : "Podcast, team interviews, dedicated page on axion-ia.com, dofollow backlink and LinkedIn share — included with your service, for real visibility and SEO authority."}
            </p>
            <ul role="list" className="mt-6 flex flex-wrap gap-2">
              {items.map((it) => (
                <li
                  key={it.label}
                  className="bg-mocha-fg/10 text-mocha-fg inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium"
                >
                  <it.icon aria-hidden="true" className="text-terracotta-soft h-3.5 w-3.5" />
                  {it.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0">
            <Cta
              href="/visibilite-entreprise"
              variant="terracotta"
              size="lg"
              track="visibilite-callout"
            >
              {isFr ? "Découvrir la visibilité offerte" : "Discover the free visibility"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
