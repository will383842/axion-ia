import type { EtatEcheance, NiveauEcheance } from "@/lib/garantie-journee-ia/presentation";

/**
 * Pastille d'échéance de la garantie Journée IA : la couleur ne porte JAMAIS seule l'information,
 * le TEXTE (« Dépassée de 3 j », « Aujourd'hui », « Dans 4 j », « Clos ») la double toujours.
 */
const CLASSES: Record<NiveauEcheance, string> = {
  rouge:
    "border-[color:var(--color-admin-error-fg)] bg-[color:var(--color-admin-error-soft)] text-[color:var(--color-admin-error-fg)] font-semibold",
  orange:
    "border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)] font-semibold",
  jaune:
    "border-[color:var(--color-admin-warning-fg)] bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
  vert: "border-[color:var(--color-admin-success-fg)] bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]",
  gris: "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-2)] text-[color:var(--color-admin-fg-muted)]",
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
      className="inline-flex items-center rounded-full border border-[color:var(--color-admin-error-fg)] bg-[color:var(--color-admin-error-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--color-admin-error-fg)]"
    >
      Hors délai
    </span>
  );
}
