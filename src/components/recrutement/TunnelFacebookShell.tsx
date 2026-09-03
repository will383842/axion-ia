// Coquille des pages du tunnel Facebook (`/facebook`, `/facebook/merci`) :
// SANS le menu du site, SANS son pied de page — une barre avec le nom, la
// page, puis trois liens légaux.
//
// ── Pourquoi on retire le menu ──────────────────────────────────────────────
// Un visiteur venu d'un post a cliqué pour UNE chose. Chaque lien du menu
// (« Formations », « Audit », « Réserver un appel »…) est une sortie payée au
// clic, vers des pages écrites pour des DIRIGEANTS — pas pour lui. La règle
// des pages d'atterrissage : une promesse, une action, aucune porte de côté.
//
// ── Comment on le retire ────────────────────────────────────────────────────
// L'en-tête et le pied de page sont rendus par le layout racine, et un layout
// imbriqué s'AJOUTE à son parent sans jamais le remplacer. On fait donc
// exactement ce que fait la console admin : une règle CSS servie avec la page
// (`body:has(.tunnel-facebook) header…`), qui agit dès le premier rendu — un
// garde côté client ne dé-rendrait pas ce que le serveur a écrit (React 19 :
// « This won't be patched up »). Les sélecteurs sont ceux du layout admin.
//
// Le pied légal reste : mentions, confidentialité, cookies. Une page qui
// recueille des données personnelles ne peut pas s'en passer, et Meta vérifie
// aussi que la page d'arrivée en a.

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { PIED } from "@/content/recrutement/tunnel-facebook";

const STYLE_SANS_CHROME = `
body:has(.tunnel-facebook) header.bg-terracotta,
body:has(.tunnel-facebook) footer.bg-mocha-rich,
body:has(.tunnel-facebook) aside.bg-sage-soft { display: none !important; }
`.trim();

export function TunnelFacebookShell({
  children,
  sousTitre,
}: {
  children: ReactNode;
  /** Ce que dit la barre, à droite du nom (« Réseau d'apporteurs d'affaires »). */
  sousTitre: string;
}) {
  return (
    <div className="tunnel-facebook">
      <style dangerouslySetInnerHTML={{ __html: STYLE_SANS_CHROME }} />

      {/* Barre haute : nom + contexte. Pas de lien vers l'accueil — c'est une
          sortie, et le nom suffit à dire où l'on est. */}
      <div className="border-border bg-paper border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span
            className="text-fg text-xl leading-none font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Axion
            <span aria-hidden="true" className="text-fg/70 mx-0.5">
              -
            </span>
            <span className="text-terracotta italic">IA</span>
          </span>
          <span className="text-fg-muted text-xs font-semibold tracking-[0.12em] uppercase sm:text-sm">
            {sousTitre}
          </span>
        </div>
      </div>

      {children}

      {/* Pied légal minimal. */}
      <footer className="border-border bg-paper border-t py-6">
        <div className="text-fg-muted mx-auto flex max-w-6xl flex-col gap-2 px-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{PIED.ligne}</p>
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link
              href={ROUTES.legalNotice as never}
              className="hover:text-fg underline-offset-2 hover:underline"
            >
              Mentions légales
            </Link>
            <Link
              href={ROUTES.privacy as never}
              className="hover:text-fg underline-offset-2 hover:underline"
            >
              Confidentialité
            </Link>
            <Link
              href={ROUTES.cookies as never}
              className="hover:text-fg underline-offset-2 hover:underline"
            >
              Cookies
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
