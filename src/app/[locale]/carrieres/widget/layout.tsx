// Layout NU de la route d'embed `/[locale]/carrieres/widget`.
//
// La page est destinée à vivre dans un <iframe> sur un site tiers : on masque le
// Header/Footer publics rendus par `[locale]/layout.tsx` et on rend le fond
// transparent pour se fondre dans la page hôte. Même technique que le layout
// admin (CSS `:has()` injecté) — évite d'appeler `headers()` dans le root layout
// (ce qui forcerait TOUTES les pages en dynamic, cf. commentaire layout admin).
//
// noindex : la route d'embed ne doit jamais être indexée par Google (contenu
// dupliqué du hub /carrieres, sans chrome).

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// `.axion-offers-embed-shell` : classe racine de la page widget. Sélecteurs
// `:has()` → masque header/footer publics + fond transparent + #main pleine
// hauteur. `display: contents` sur #main retire son flux sans casser les enfants.
const hideShellCss = `
  body:has(.axion-offers-embed-shell) {
    background: transparent !important;
  }
  body:has(.axion-offers-embed-shell) header.bg-terracotta,
  body:has(.axion-offers-embed-shell) footer.bg-mocha-rich {
    display: none !important;
  }
  body:has(.axion-offers-embed-shell) #main {
    display: contents;
  }
`.trim();

export default function WidgetEmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* CSS statique (aucune donnée utilisateur) — masque le shell public + fond transparent */}
      <style dangerouslySetInnerHTML={{ __html: hideShellCss }} />
      {children}
    </>
  );
}
