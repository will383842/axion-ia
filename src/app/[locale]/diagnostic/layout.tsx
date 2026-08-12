// Layout NU de la page d'atterrissage publicitaire `/[locale]/diagnostic`.
//
// Cette page reçoit du trafic payant venu d'une publicité vidéo. Tout élément
// qui n'y sert pas la conversion en sort du monde : l'en-tête terracotta, le
// méga-menu, le pied de page et ses trente liens. Sur une page de ce format, la
// seule sortie possible doit être le bouton.
//
// L'habillage est partagé avec `/simulateur`, l'écran suivant du tunnel
// (cf. `FunnelShellStyle`).
//
// `noindex` : page publicitaire, contenu redondant avec `/roi` qui est la page
// canonique et indexée.

import type { Metadata } from "next";
import { FunnelShellStyle } from "@/components/lp/FunnelShellStyle";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DiagnosticLandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FunnelShellStyle />
      {children}
    </>
  );
}
