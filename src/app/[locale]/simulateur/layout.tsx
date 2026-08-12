// Layout NU de la variante tunnel du simulateur (`/[locale]/simulateur`).
//
// Cette page reçoit du trafic payant. Chaque lien du méga-menu et du pied de
// page y est une fuite : un visiteur venu d'une publicité n'a pas à découvrir
// le blog avant d'avoir vu son résultat. On masque donc l'en-tête et le pied
// de page publics rendus par `[locale]/layout.tsx`.
//
// Même technique que le layout admin et que la route d'embed `/carrieres/widget`
// (CSS `:has()` injecté) : elle évite d'appeler `headers()` dans le layout
// racine, ce qui basculerait TOUTES les pages du site en rendu dynamique et
// dégraderait les scores Lighthouse des pages publiques.
//
// `noindex` : le contenu est celui de `/roi`, déjà indexée. Laisser Google
// indexer les deux créerait une duplication et diluerait la page canonique.

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// `.axion-funnel-shell` : classe racine de la page tunnel. `display: contents`
// sur #main retire son flux sans casser ses enfants.
const hideShellCss = `
  body:has(.axion-funnel-shell) header.bg-terracotta,
  body:has(.axion-funnel-shell) footer.bg-mocha-rich {
    display: none !important;
  }
  body:has(.axion-funnel-shell) #main {
    display: contents;
  }
`.trim();

export default function SimulateurFunnelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* CSS statique (aucune donnée utilisateur) — masque le shell public. */}
      <style dangerouslySetInnerHTML={{ __html: hideShellCss }} />
      {children}
    </>
  );
}
