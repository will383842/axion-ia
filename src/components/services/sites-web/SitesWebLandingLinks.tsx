// Server Component — grille de liens internes du hub /sites-web-augmentes vers
// les landings détail (chatbot-rag, recherche-semantique, sans-refonte,
// plateforme-native). Évite que ces pages soient orphelines : maillage descendant
// depuis la page hub à forte autorité → crawl + transfert de PageRank + UX.

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { SITES_WEB } from "@/content/sites-web";

export function SitesWebLandingLinks({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "En détail" : "In detail"}
      title={isFr ? "Explorez" : "Explore"}
      titleEm={isFr ? "chaque brique" : "each brick"}
      description={
        isFr
          ? "Chaque besoin a sa page dédiée — du chatbot ancré à la plateforme IA-native."
          : "Each need has its own page — from the grounded chatbot to the AI-native platform."
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SITES_WEB.map((s) => {
          const c = isFr ? s.fr : s.en;
          const label = [c.title, c.titleEm, c.titleTail].filter(Boolean).join(" ").trim();
          return (
            <Link
              key={s.slug}
              href={(isFr ? s.pathFr : s.pathEn) as never}
              className="border-border bg-bg hover:border-terracotta hover:shadow-card focus-visible:ring-terracotta flex h-full flex-col rounded-2xl border p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <p className="text-fg text-[15px] leading-snug font-semibold">{label}</p>
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
    </Section>
  );
}
