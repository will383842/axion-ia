// Grille de cas d'usage illustrés (accompagnements 1-to-1).
//
// Server Component pur (aucun JS client) : photo + texte + crédit photographe.
// Même langage visuel que la section « cas d'usage » des fiches formation
// (FormationDetailPage) pour l'harmonie inter-pages. Les données viennent du
// SSOT `un-a-un-cas-usage.ts`.

import type { ReactNode } from "react";
import Image from "next/image";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import type { UnAUnCasUsage } from "@/content/interventions/un-a-un-cas-usage";

interface Props {
  items: ReadonlyArray<UnAUnCasUsage>;
  isFr: boolean;
}

export function InterventionCasUsageGrid({ items, isFr }: Props): ReactNode {
  return (
    <ul className="xs:grid-cols-2 mx-auto grid max-w-5xl gap-4 lg:grid-cols-4">
      {items.map((c) => {
        const texte = isFr ? c.texteFr : c.texteEn;
        return (
          <li
            key={c.imageSrc}
            className="border-border bg-bg shadow-card flex flex-col overflow-hidden rounded-2xl border"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={c.imageSrc}
                alt={texte}
                fill
                sizes="(min-width: 1024px) 23vw, (min-width: 479px) 50vw, 100vw"
                loading="lazy"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <p className="text-fg flex-1 text-sm leading-relaxed font-medium">{texte}</p>
              <UnsplashCredit
                photographerName={c.imageCredit.name}
                photographerUrl={c.imageCredit.url}
                className="text-[10px]"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
