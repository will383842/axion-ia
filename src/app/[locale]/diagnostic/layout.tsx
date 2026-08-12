// Layout NU de la page d'atterrissage publicitaire `/[locale]/diagnostic`.
//
// Cette page reçoit du trafic payant venu d'une publicité vidéo. Tout élément
// qui n'y sert pas la conversion en sort du monde : l'en-tête terracotta, le
// méga-menu, le pied de page et ses trente liens. Sur une page de ce format, la
// seule sortie possible doit être le bouton.
//
// Même technique que le layout admin et que `/carrieres/widget` (CSS `:has()`
// injecté) : elle évite d'appeler `headers()` dans le layout racine, ce qui
// basculerait TOUTES les pages du site en rendu dynamique.
//
// ⚠️ Le fond sombre est appliqué au `body` — pas seulement au conteneur de la
// page. Sans cela, la zone de rebond élastique du défilement (iOS) et la barre
// d'adresse laisseraient apparaître l'ivoire du site sous le noir, ce qui se
// voit immédiatement sur un téléphone.
//
// `noindex` : page publicitaire, contenu redondant avec `/roi` qui est la page
// canonique et indexée.

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const hideShellCss = `
  body:has(.axion-vsl-shell) {
    background-color: var(--color-ink);
  }
  body:has(.axion-vsl-shell) header.bg-terracotta,
  body:has(.axion-vsl-shell) footer.bg-mocha-rich {
    display: none !important;
  }
  body:has(.axion-vsl-shell) #main {
    display: contents;
  }
`.trim();

export default function DiagnosticLandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* CSS statique (aucune donnée utilisateur) — masque le shell public. */}
      <style dangerouslySetInnerHTML={{ __html: hideShellCss }} />
      {children}
    </>
  );
}
