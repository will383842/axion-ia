/**
 * ImplementationTrustPills — Bandeau réassurance 4 pillules sous le hero.
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.854-870). Vrais engagements
 * opérables (devis 48 h, forfait fixe, livraison 2-6 sem, formation incluse).
 * Server Component pur, zéro JS.
 */

import type { ReactNode } from "react";
import { Check, Clock, Sparkles, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";

export interface ImplementationTrustPillsProps {
  readonly isFr: boolean;
}

export function ImplementationTrustPills({ isFr }: ImplementationTrustPillsProps): ReactNode {
  const trustItems = isFr
    ? [
        { icon: Clock, label: "Devis ferme sous 48 h" },
        { icon: ShieldCheck, label: "Forfait fixe · sans abonnement" },
        { icon: Sparkles, label: "Livraison en 2 à 6 semaines" },
        { icon: Check, label: "Formation incluse · vous êtes propriétaire" },
      ]
    : [
        { icon: Clock, label: "Firm quote within 48 h" },
        { icon: ShieldCheck, label: "Fixed fee · no subscription" },
        { icon: Sparkles, label: "Delivery in 2 to 6 weeks" },
        { icon: Check, label: "Training included · you own everything" },
      ];

  return (
    <section className="bg-paper border-border border-y py-8">
      <Container>
        <ul className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex items-center gap-3">
                <span className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="text-fg text-sm leading-snug font-medium">{item.label}</span>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
