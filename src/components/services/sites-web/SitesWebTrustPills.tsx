/**
 * SitesWebTrustPills — 4 pills réassurance sous le hero (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/sites-web-augmentes/page.tsx` (l.377-394). 4 pills :
 * Toute stack / RGPD natif / Chatbot RAG / Forfait fixe. Server-only, zéro
 * JS, indépendant de toute ville.
 */

import type { ReactNode } from "react";
import { ArrowRight, Globe, Sparkles, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";

export interface SitesWebTrustPillsProps {
  readonly isFr: boolean;
}

export function SitesWebTrustPills({ isFr }: SitesWebTrustPillsProps): ReactNode {
  const features = isFr
    ? [
        { icon: Globe, label: "Toute stack existante — on s'intègre" },
        { icon: ShieldCheck, label: "RGPD natif · hébergement EU" },
        { icon: Sparkles, label: "Chatbot RAG formé sur vos données" },
        { icon: ArrowRight, label: "Forfait fixe · devis ferme 48 h" },
      ]
    : [
        { icon: Globe, label: "Any existing stack — we integrate" },
        { icon: ShieldCheck, label: "GDPR native · EU hosting" },
        { icon: Sparkles, label: "RAG chatbot trained on your data" },
        { icon: ArrowRight, label: "Fixed fee · firm quote 48 h" },
      ];

  return (
    <section className="bg-paper border-border border-y py-8">
      <Container>
        <ul className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.label} className="flex items-center gap-3">
                <span className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="text-fg text-sm leading-snug font-medium">{f.label}</span>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
