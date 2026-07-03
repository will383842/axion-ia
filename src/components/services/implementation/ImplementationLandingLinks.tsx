// Server Component — grille de liens internes du hub /implementation vers ses 9
// sous-pages détail (agents, chatbot, crm-erp, documents, ia-custom, integrations,
// no-code, processus, structuration) + les 2 hubs d'entrée (par brique techno /
// par fonction métier). Corrige l'audit maillage 2026-07-03 : avant, le hub
// n'exposait AUCUN lien HTML vers ses sous-pages (seul lien = /contact) → 9 pages
// quasi-orphelines découvrables au sitemap uniquement. Maillage descendant depuis
// une page hub à forte autorité → crawl + transfert de PageRank + UX.
// Calqué sur `SitesWebLandingLinks` (même intention anti-orphelin).

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { IMPLEMENTATIONS } from "@/content/implementation";

export function ImplementationLandingLinks({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "En détail" : "In detail"}
      title={isFr ? "Explorez chaque" : "Explore each"}
      titleEm={isFr ? "brique d'implémentation" : "implementation brick"}
      description={
        isFr
          ? "Chaque cas d'usage a sa page dédiée — de l'agent IA connecté à vos outils à l'IA custom d'entreprise."
          : "Each use case has its own page — from the AI agent wired to your tools to custom enterprise AI."
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {IMPLEMENTATIONS.map((item) => {
          const c = isFr ? item.fr : item.en;
          return (
            <Link
              key={item.slug}
              href={(isFr ? item.pathFr : item.pathEn) as never}
              className="border-border bg-bg hover:border-terracotta hover:shadow-card focus-visible:ring-terracotta flex h-full flex-col rounded-2xl border p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <p className="text-fg text-[15px] leading-snug font-semibold">{c.title}</p>
              <p className="text-fg-soft mt-2 line-clamp-2 flex-1 text-sm leading-relaxed">
                {c.answer}
              </p>
              <span className="text-terracotta-deep mt-4 inline-flex items-center gap-1 text-[13px] font-medium">
                {isFr ? "Découvrir" : "Discover"}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>

      {/* Porte d'entrée thématique — de-orphelinise le hub par-techno (audit
          maillage 2026-07-03 : 0 lien entrant HTML avant). Ce hub relie lui-même
          les 9 prestations packagées. Pas de lien vers /implementation/par-fonction :
          cette route n'a pas de hub (seulement des pages [slug]) → 404. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/implementation/par-techno"
          className="border-border text-fg hover:border-terracotta focus-visible:ring-terracotta inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {isFr ? "Voir les 9 prestations par brique techno" : "See all 9 services by tech block"}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Section>
  );
}
