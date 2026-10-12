// Coquille du dossier en ligne du formateur : le composant COMMUN (FAC-10) avec les textes
// des formateurs. Composants SERVEUR : aucun JavaScript envoyé au navigateur.

import {
  COCHE,
  Coquille as CoquilleCommune,
  EcranEtat,
  EcranInvalide as EcranInvalideCommun,
  icone,
} from "@/components/dossier-en-ligne/Coquille";

import { ADRESSE_CONTACT, CHEMIN_RETROUVER, TEXTES } from "./textes";

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

/**
 * La page NEUTRE : lien faux, échu, révoqué, inconnu, ou dossier fermé. Lot B (M25) :
 * avec le dossier en ligne ouvert, elle mène aussi à « Retrouver mon espace ».
 */
export function EcranInvalide({ avecRetrouver = false }: { avecRetrouver?: boolean } = {}) {
  return (
    <>
      <EcranInvalideCommun textes={TEXTES} adresseContact={ADRESSE_CONTACT} />
      {avecRetrouver ? (
        <p className="mt-4 text-center text-[16px]">
          <a
            href={CHEMIN_RETROUVER}
            className="text-terracotta-deep font-semibold underline underline-offset-4"
          >
            {TEXTES.retrouverLien}
          </a>
        </p>
      ) : null}
    </>
  );
}
