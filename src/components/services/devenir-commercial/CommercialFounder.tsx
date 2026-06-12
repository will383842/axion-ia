// Server Component — « Mot du fondateur ». Calqué sur SignatureCard (audit),
// avec la photo réelle du fondateur (next/image → optimisée WebP/AVIF, lazy car
// sous la ligne de flottaison). Contenu FIXE.

import type { ReactNode } from "react";
import Image from "next/image";
import { Container } from "@/components/layout/Container";

export interface CommercialFounderProps {
  readonly isFr: boolean;
}

export function CommercialFounder({ isFr }: CommercialFounderProps): ReactNode {
  return (
    <section className="bg-bg py-12 sm:py-14">
      <Container>
        <article className="border-terracotta/15 bg-halo-warm flex flex-col gap-6 rounded-3xl border-2 p-7 sm:flex-row sm:items-start sm:gap-8 sm:p-9">
          <Image
            src="/illustrations/devenir-commercial-fondateur.webp"
            alt={
              isFr ? "Williams, fondateur et CEO d'Axion-IA" : "Williams, Axion-IA founder and CEO"
            }
            width={224}
            height={224}
            sizes="(min-width: 640px) 112px, 80px"
            className="border-terracotta/20 h-20 w-20 shrink-0 rounded-full border object-cover sm:h-28 sm:w-28"
          />
          <div>
            <p className="text-fg-muted text-[12px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Mot du fondateur" : "A word from the founder"}
            </p>
            <blockquote
              className="text-fg mt-3 text-lg leading-relaxed sm:text-xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr
                ? "« Nous cherchons des commerciaux qui ont faim. Le marché de l'IA est énorme, nos produits sont concrets et faciles à défendre, et notre équipe s'occupe de vous outiller : supports de vente, formation à l'offre et accompagnement au quotidien. Vous gardez votre liberté, votre portefeuille, et vous touchez de vraies commissions sur ce que vous vendez. Si vous avez la fibre, on construit quelque chose de grand ensemble. »"
                : "\"We're looking for hungry sales reps. The AI market is huge, our products are concrete and easy to defend, and our team makes sure you're well equipped: sales materials, training on the offer and day-to-day support. You keep your freedom, your portfolio, and you earn real commissions on what you sell. If you've got the instinct, we'll build something big together.\""}
            </blockquote>
            <p className="text-fg mt-4 font-semibold">
              Williams
              <span className="text-fg-muted font-normal">
                {isFr
                  ? " · Fondateur & CEO, Axion-IA (axion-ia.com)"
                  : " · Founder & CEO, Axion-IA (axion-ia.com)"}
              </span>
            </p>
          </div>
        </article>
      </Container>
    </section>
  );
}
