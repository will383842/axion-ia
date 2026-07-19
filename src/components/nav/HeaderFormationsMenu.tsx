"use client";
// use-client: le shell `HeaderMegaMenu` attend un render-prop `children({close})`
// (non sérialisable à travers la frontière RSC). Ce composant reste néanmoins
// « data-in » : toutes les données (offres générales, compteurs, prix) sont
// calculées côté serveur dans `Header.tsx` et passées en props → le catalogue
// (catalog-v2) N'ENTRE PAS dans le bundle client (budget First Load JS ≤ 75 KB).
//
// Méga-menu de l'onglet « Formations IA » — refonte 2026-07-19 (Will) : l'axe
// durée disparaît. Panel = bloc phare « Toutes nos formations » + les 3 offres
// générales + 2 entrées catégorie (par métier / par secteur d'activité) +
// séminaire. Le clic sur le trigger reste dirigé vers le hub `/formations`.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { HeaderMegaMenu } from "./HeaderMegaMenu";

export interface FormationsMenuItem {
  /** Pathname next-intl (ex `/formations/ia-pour-bien-commencer`). */
  href: string;
  /** Libellé (ex « IA pour bien commencer »). */
  label: string;
  /** Sous-titre (durée · prix — calculé côté serveur, jamais en dur ici). */
  sub: string;
}

export interface FormationsCategorieItem {
  /** Pathname du listing (`/formations/metiers` | `/formations/secteurs`). */
  href: string;
  label: string;
  /** Sous-titre (ex « 9 formations · RH, marketing, commercial… »). */
  sub: string;
}

interface HeaderFormationsMenuProps {
  isFr: boolean;
  /** Pathname de la landing catalogue phare. */
  allHref: string;
  /** Nombre total de formations au catalogue (hors séminaire). */
  totalCount: number;
  /** Les 3 offres générales (avec « bien commencer » vers la fiche 4 h). */
  generales: ReadonlyArray<FormationsMenuItem>;
  /** Les 2 entrées catégorie (par métier / par secteur d'activité). */
  categories: ReadonlyArray<FormationsCategorieItem>;
}

export function HeaderFormationsMenu({
  isFr,
  allHref,
  totalCount,
  generales,
  categories,
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
          {/* Bloc phare — « Toutes nos formations entreprises » */}
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
                  ? `Le catalogue complet · ${totalCount} formations · prix par groupe`
                  : `Full catalogue · ${totalCount} trainings · priced per group`}
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="text-terracotta h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </Link>

          {/* Offres générales */}
          <p className="text-fg-muted mt-4 mb-2 px-1 text-[11px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? "Offres générales" : "General offers"}
          </p>
          <ul className="grid grid-cols-1 gap-1.5">
            {generales.map((g) => (
              <li key={g.href}>
                <Link
                  href={g.href as never}
                  onClick={close}
                  className="hover:bg-sand focus-visible:ring-terracotta block rounded-lg px-3 py-2 transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="text-fg block text-sm font-semibold tracking-tight">
                    {g.label}
                  </span>
                  <span className="text-fg-muted block text-[12px]">{g.sub}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Par métier / par secteur d'activité */}
          <p className="text-fg-muted mt-4 mb-2 px-1 text-[11px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? "Selon votre profil" : "By profile"}
          </p>
          <ul className="xs:grid-cols-2 grid grid-cols-1 gap-1.5">
            {categories.map((c) => (
              <li key={c.href}>
                <Link
                  href={c.href as never}
                  onClick={close}
                  className="group bg-paper hover:bg-terracotta-soft border-border hover:border-terracotta block rounded-xl border px-3 py-2.5 transition"
                >
                  <span className="text-fg flex items-center justify-between text-sm font-semibold tracking-tight">
                    {c.label}
                    <ArrowRight
                      aria-hidden="true"
                      className="text-terracotta h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  <span className="text-fg-muted mt-0.5 block text-[12px]">{c.sub}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Séminaire — rubrique dédiée (conservé à part, décision Will 2026-07-19) */}
          <Link
            href={"/formations/seminaire-ia-toute-l-entreprise-1j" as never}
            onClick={close}
            className="hover:bg-sand focus-visible:ring-terracotta mt-1.5 block rounded-lg px-3 py-2 transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="text-fg block text-sm font-semibold tracking-tight">
              {isFr ? "Séminaire — toute l'entreprise" : "Seminar — whole company"}
            </span>
            <span className="text-fg-muted block text-[12px]">
              {isFr
                ? "1 journée · présentiel · jusqu'à 50 personnes"
                : "1 day · on-site · up to 50 people"}
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
            {/* « Voir les tarifs » → récap multi-modules /tarifs (cible de
                l'onglet Tarifs du header). /formations/tarifs est relié depuis
                le hub /formations (sous les cartes offres). */}
            <Link
              href={"/tarifs" as never}
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
