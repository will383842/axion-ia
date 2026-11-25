// Coquille du dossier en ligne de l'apporteur : le composant COMMUN (FAC-10) avec les
// textes des apporteurs. Composants SERVEUR : aucun JavaScript envoyé au navigateur, sauf le
// lien « Besoin d'aide ? » (`LienAide`), qui lit l'adresse de la page.

import {
  COCHE,
  Coquille as CoquilleCommune,
  EcranEtat,
  EcranInvalide as EcranInvalideCommun,
  icone,
} from "@/components/dossier-en-ligne/Coquille";

import { LienAide } from "./LienAide";
import { ADRESSE_CONTACT, TEXTES } from "./textes";

export { COCHE, EcranEtat, icone };

/** Le conseil « favoris » des pages personnelles (décision de Will, 2026-10-09). */
const ASTUCE =
  "Astuce : ajoutez cette page à vos favoris, ou à l'écran d'accueil de votre téléphone, pour retrouver votre espace en un geste.";

export function Coquille({
  titre,
  sansAide = false,
  children,
}: {
  titre?: string;
  /** La page d'aide elle-même ne renvoie pas vers elle-même. */
  sansAide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <CoquilleCommune
      textes={{ marque: TEXTES.marque, surtitre: TEXTES.surtitre, astuce: ASTUCE }}
      {...(titre !== undefined ? { titre } : {})}
    >
      {children}
      {/* Sur toutes les pages PERSONNELLES (avec un titre), jamais sur un écran neutre. */}
      {titre !== undefined && !sansAide ? <LienAide /> : null}
    </CoquilleCommune>
  );
}

/** La page NEUTRE : lien faux, révoqué, inconnu, dossier refusé ou résilié. */
export function EcranInvalide() {
  return <EcranInvalideCommun textes={TEXTES} adresseContact={ADRESSE_CONTACT} />;
}
