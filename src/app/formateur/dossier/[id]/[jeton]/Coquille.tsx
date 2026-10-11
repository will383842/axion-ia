// Coquille du dossier en ligne du formateur : le composant COMMUN (FAC-10) avec les textes
// des formateurs. Composants SERVEUR : aucun JavaScript envoyé au navigateur.

import {
  COCHE,
  Coquille as CoquilleCommune,
  EcranEtat,
  EcranInvalide as EcranInvalideCommun,
  icone,
} from "@/components/dossier-en-ligne/Coquille";

import { ADRESSE_CONTACT, TEXTES } from "./textes";

export { COCHE, EcranEtat, icone };

export function Coquille({ titre, children }: { titre?: string; children: React.ReactNode }) {
  return (
    <CoquilleCommune
      textes={{ marque: TEXTES.marque, surtitre: TEXTES.surtitre, astuce: TEXTES.astuce }}
      {...(titre !== undefined ? { titre } : {})}
    >
      {children}
    </CoquilleCommune>
  );
}

/** La page NEUTRE : lien faux, échu, révoqué, inconnu, ou dossier fermé. */
export function EcranInvalide() {
  return <EcranInvalideCommun textes={TEXTES} adresseContact={ADRESSE_CONTACT} />;
}
