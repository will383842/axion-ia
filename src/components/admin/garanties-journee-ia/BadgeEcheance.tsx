import type { EtatEcheance, NiveauEcheance } from "@/lib/garantie-journee-ia/presentation";

/**
 * Pastille d'échéance de la garantie Journée IA : la couleur ne porte JAMAIS seule l'information,
 * le TEXTE (« Dépassée de 3 j », « Aujourd'hui », « Dans 4 j », « Clos ») la double toujours.
 */
const CLASSES: Record<NiveauEcheance, string> = {
  rouge: "bg-red-100 text-red-900 border-red-300",
  orange: "bg-orange-100 text-orange-900 border-orange-300",
  jaune: "bg-yellow-100 text-yellow-900 border-yellow-300",
  vert: "bg-green-100 text-green-900 border-green-300",
  gris: "bg-gray-100 text-gray-700 border-gray-300",
};

const NOM: Record<NiveauEcheance, string> = {
  rouge: "rouge",
  orange: "orange",
  jaune: "jaune",
  vert: "vert",
  gris: "gris",
};

export function BadgeEcheance({ etat }: { etat: EtatEcheance }): React.ReactElement {
  return (
    <span
      data-niveau={NOM[etat.niveau]}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CLASSES[etat.niveau]}`}
    >
      {etat.texte}
    </span>
  );
}

/**
 * Badge ROUGE « Hors délai » : demande reçue après les 30 jours suivant la remise du rapport.
 * Le texte double la couleur ; aucune acceptation tacite, le dirigeant tranche au cas par cas.
 */
export function BadgeHorsDelai(): React.ReactElement {
  return (
    <span
      data-niveau="rouge"
      data-hors-delai="oui"
      className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900"
    >
      Hors délai
    </span>
  );
}
