// Coquille du dossier en ligne de l'apporteur : le composant COMMUN (FAC-10) avec les
// textes des apporteurs. Composants SERVEUR : aucun JavaScript envoyé au navigateur.

import {
  COCHE,
  Coquille as CoquilleCommune,
  EcranEtat,
  EcranInvalide as EcranInvalideCommun,
  icone,
} from "@/components/dossier-en-ligne/Coquille";

import { ADRESSE_CONTACT, TEXTES } from "./textes";

export { COCHE, EcranEtat, icone };

/** Le conseil « favoris » des pages personnelles (décision de Will, 2026-10-09). */
const ASTUCE =
  "Astuce : ajoutez cette page à vos favoris, ou à l'écran d'accueil de votre téléphone, pour retrouver votre espace en un geste.";

export function Coquille({ titre, children }: { titre?: string; children: React.ReactNode }) {
  return (
    <CoquilleCommune
      textes={{ marque: TEXTES.marque, surtitre: TEXTES.surtitre, astuce: ASTUCE }}
      {...(titre !== undefined ? { titre } : {})}
    >
      {children}
    </CoquilleCommune>
  );
}

/** La page NEUTRE : lien faux, révoqué, inconnu, dossier refusé ou résilié. */
export function EcranInvalide() {
  return <EcranInvalideCommun textes={TEXTES} adresseContact={ADRESSE_CONTACT} />;
}
