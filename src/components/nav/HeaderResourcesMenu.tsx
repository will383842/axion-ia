"use client";
// use-client: render-prop `children({close})` non sérialisable à travers la frontière RSC (cf. bloc ci-dessous).
// Méga-menu « Ressources » du header desktop (audit maillage 2026-07-03).
//
// Active le shell générique `HeaderMegaMenu` (jusqu'ici code mort) pour exposer
// dans la navigation desktop les sections stratégiques auparavant accessibles
// UNIQUEMENT via le footer ou le drawer mobile (secteurs, guides, glossaire,
// comparaisons, cas concrets, stack IA, implantations, observatoire, ROI…).
// Fort levier de maillage global : ces hubs reçoivent enfin un lien sitewide
// depuis une surface à forte autorité.
//
// Client Component obligatoire : le shell attend un render-prop `children({close})`
// (une fonction ne se sérialise pas à travers la frontière RSC server→client).
// Le contenu se limite à des <Link> next-intl → empreinte JS minimale.
//
// ⚠️ Web Vitals / layout : le header desktop est tuné pour tenir sur une seule
// ligne (cf. Header.tsx). Ce trigger n'est monté qu'à `2xl` (≥1536px) où l'espace
// est confirmé ample, pour ne PAS risquer le budget d'espace de la bande
// 1280–1400px. À abaisser à `xl` après validation visuelle + gates lhci/size-limit.

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { HeaderMegaMenu } from "./HeaderMegaMenu";

interface ColumnLink {
  href: string;
  labelFr: string;
  labelEn: string;
}

interface Column {
  titleFr: string;
  titleEn: string;
  links: ReadonlyArray<ColumnLink>;
}

const COLUMNS: ReadonlyArray<Column> = [
  {
    titleFr: "Se repérer",
    titleEn: "Get oriented",
    links: [
      { href: "/secteurs", labelFr: "L'IA par secteur", labelEn: "AI by sector" },
      { href: "/cas-concrets", labelFr: "Cas concrets", labelEn: "Case studies" },
      { href: "/comparaisons", labelFr: "Comparaisons", labelEn: "Comparisons" },
      { href: "/roi", labelFr: "Calculateur de ROI", labelEn: "ROI calculator" },
    ],
  },
  {
    titleFr: "Apprendre",
    titleEn: "Learn",
    links: [
      { href: "/blog", labelFr: "Blog", labelEn: "Blog" },
      { href: "/guides", labelFr: "Guides", labelEn: "Guides" },
      { href: "/glossaire", labelFr: "Glossaire IA", labelEn: "AI glossary" },
      { href: "/faq", labelFr: "FAQ", labelEn: "FAQ" },
    ],
  },
  {
    titleFr: "Explorer",
    titleEn: "Explore",
    links: [
      { href: "/stack-ia", labelFr: "Stack IA", labelEn: "AI stack" },
      { href: "/implantations", labelFr: "Nos implantations", labelEn: "Our locations" },
      { href: "/observatoire-ia", labelFr: "Observatoire IA", labelEn: "AI observatory" },
      { href: "/guide-ia", labelFr: "Guide de l'IA", labelEn: "AI guide" },
    ],
  },
];

export function HeaderResourcesMenu({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <HeaderMegaMenu
      triggerLabel={isFr ? "Ressources" : "Resources"}
      triggerHref="/guide-ia"
      triggerTrackingId="header_megamenu_resources"
      panelLabel={isFr ? "Ressources" : "Resources"}
      // Dernier declencheur du header : ancre a DROITE, sinon les 720 px du panneau
      // sortent de la fenetre (audit 2026-07-26, 223 px de debordement mesures).
      panelAlign="right"
    >
      {({ close }) => (
        <div className="grid grid-cols-3 gap-6 p-6">
          {COLUMNS.map((col) => (
            <div key={col.titleFr}>
              <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
                {isFr ? col.titleFr : col.titleEn}
              </p>
              <ul className="space-y-1.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href as never}
                      onClick={close}
                      className="text-fg hover:text-terracotta focus-visible:ring-terracotta block rounded-md px-2 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {isFr ? l.labelFr : l.labelEn}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </HeaderMegaMenu>
  );
}
