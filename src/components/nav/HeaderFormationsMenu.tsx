"use client";
// use-client: le shell `HeaderMegaMenu` attend un render-prop `children({close})`
// (non sérialisable à travers la frontière RSC). Ce composant reste néanmoins
// « data-in » : toutes les données (durées, compteurs, prix d'entrée) sont
// calculées côté serveur dans `Header.tsx` et passées en props → le catalogue
// (catalog-v2, ~1600 lignes) N'ENTRE PAS dans le bundle client (budget First
// Load JS ≤ 75 KB/route). Le contenu du panel = uniquement des <Link> next-intl.
//
// Méga-menu de l'onglet « Formations IA » (2026-07-05). Au survol : bloc phare
// « Toutes nos formations entreprises » (→ landing catalogue) + les 4 raccourcis
// par durée (4 h / 1 j / 2 j / 3 j et +). Le clic sur le trigger lui-même reste
// dirigé vers le hub `/formations` (inchangé, cohérent avec le SSOT services.ts).

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { HeaderMegaMenu } from "./HeaderMegaMenu";

export interface FormationsDurationItem {
  /** Pathname next-intl (ex `/formations/duree/4-heures`). */
  href: string;
  /** Libellé court (ex « Formats 4 heures »). */
  label: string;
  /** Heures pédagogiques (ex « 4 heures », « 1 journée (6-8 h) »). */
  hours: string;
  /** Nombre de formations dans ce palier. */
  count: number;
}

interface HeaderFormationsMenuProps {
  isFr: boolean;
  /** Pathname de la landing catalogue phare. */
  allHref: string;
  /** Prix d'entrée du catalogue déjà formaté (ex « 1 200 € »). */
  entryPrice: string;
  /** Nombre total de formations au catalogue. */
  totalCount: number;
  durations: ReadonlyArray<FormationsDurationItem>;
}

export function HeaderFormationsMenu({
  isFr,
  allHref,
  entryPrice,
  totalCount,
  durations,
}: HeaderFormationsMenuProps): ReactNode {
  return (
    <HeaderMegaMenu
      triggerLabel={isFr ? "Formations IA" : "AI training"}
      triggerHref="/formations"
      triggerTrackingId="header_megamenu_formations"
      panelLabel={isFr ? "Formations IA en entreprise" : "Corporate AI training"}
      panelAlign="left"
      panelWidth="w-[min(600px,92vw)]"
    >
      {({ close }) => (
        <div className="p-4">
          {/* Bloc phare — « Toutes nos formations entreprises » (plus visible) */}
          <Link
            href={allHref as never}
            onClick={close}
            className="group bg-sand hover:bg-terracotta-soft border-border hover:border-terracotta flex items-center justify-between gap-4 rounded-xl border p-4 transition"
          >
            <span className="min-w-0">
              <span className="text-fg block text-[15px] font-semibold tracking-tight">
                {isFr ? "Toutes nos formations entreprises" : "All our corporate trainings"}
              </span>
              <span className="text-fg-soft mt-0.5 block text-[13px]">
                {isFr
                  ? `Le catalogue complet · ${totalCount} formations · dès ${entryPrice}`
                  : `Full catalogue · ${totalCount} trainings · from ${entryPrice}`}
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="text-terracotta h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </Link>

          {/* Raccourcis par durée */}
          <p className="text-fg-muted mt-4 mb-2 px-1 text-[11px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? "Par durée" : "By duration"}
          </p>
          <ul className="xs:grid-cols-2 grid grid-cols-1 gap-1.5">
            {durations.map((d) => (
              <li key={d.href}>
                <Link
                  href={d.href as never}
                  onClick={close}
                  className="hover:bg-sand focus-visible:ring-terracotta block rounded-lg px-3 py-2 transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="text-fg block text-sm font-semibold tracking-tight">
                    {d.label}
                  </span>
                  <span className="text-fg-muted block text-[12px]">
                    {d.hours}
                    {d.count > 0 ? ` · ${d.count} formation${d.count > 1 ? "s" : ""}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Raccourcis par métier */}
          <p className="text-fg-muted mt-4 mb-2 px-1 text-[11px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? "Par métier" : "By role"}
          </p>
          <ul className="xs:grid-cols-2 grid grid-cols-1 gap-1.5">
            {(
              [
                ["/formations/ia-rh-recrutement-talents-7h", isFr ? "RH & recrutement" : "HR & recruitment"],
                ["/formations/ia-vente-prospection-developpement-commercial-7h", isFr ? "Vente & prospection" : "Sales & prospecting"],
                ["/formations/ia-marketing-contenus-seo-image-de-marque-7h", isFr ? "Marketing & SEO" : "Marketing & SEO"],
                ["/formations/ia-finance-reporting-analyses-pilotage-7h", isFr ? "Finance & pilotage" : "Finance & reporting"],
                ["/formations/ia-assistanat-mails-comptes-rendus-documents-7h", isFr ? "Assistanat & bureau" : "Office support"],
              ] as ReadonlyArray<readonly [string, string]>
            ).map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href as never}
                  onClick={close}
                  className="hover:bg-sand focus-visible:ring-terracotta text-fg block rounded-lg px-3 py-2 text-sm font-semibold tracking-tight transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Séminaire — rubrique dédiée */}
          <Link
            href={"/formations/seminaire-ia-toute-l-entreprise-1j" as never}
            onClick={close}
            className="hover:bg-sand focus-visible:ring-terracotta mt-1.5 block rounded-lg px-3 py-2 transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="text-fg block text-sm font-semibold tracking-tight">
              {isFr ? "Séminaire — toute l'entreprise" : "Seminar — whole company"}
            </span>
            <span className="text-fg-muted block text-[12px]">
              {isFr ? "1 journée · présentiel · jusqu'à 50 personnes" : "1 day · on-site · up to 50 people"}
            </span>
          </Link>

          {/* Pied — liens utilitaires */}
          <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
            <Link
              href={"/formations" as never}
              onClick={close}
              className="text-fg-soft hover:text-terracotta px-1 text-[13px] font-medium transition"
            >
              {isFr ? "Comment ça se passe" : "How it works"}
            </Link>
            <Link
              href={"/formations/tarifs" as never}
              onClick={close}
              className="text-fg-soft hover:text-terracotta px-1 text-[13px] font-medium transition"
            >
              {isFr ? "Voir les tarifs" : "See pricing"}
            </Link>
          </div>
        </div>
      )}
    </HeaderMegaMenu>
  );
}
