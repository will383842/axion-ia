// Layout NU de `/[locale]/simulateur` — deuxième écran du tunnel publicitaire.
//
// Habillage partagé avec `/diagnostic` (cf. `FunnelShellStyle`) : le visiteur
// passe de l'une à l'autre d'un seul appui, il doit avoir l'impression de rester
// au même endroit.
//
// `noindex` : le contenu est celui de `/roi`, déjà indexée. Laisser Google
// indexer les deux créerait une duplication et diluerait la page canonique.

import type { Metadata } from "next";
import { FunnelShellStyle } from "@/components/lp/FunnelShellStyle";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SimulateurFunnelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FunnelShellStyle />
      {children}
    </>
  );
}
