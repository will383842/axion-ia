/**
 * Pastilles du groupe « Formateurs freelance » : quelle entrée porte quel compteur.
 * Module PUR (aucun composant) : la barre latérale l'appelle, les tests l'éprouvent.
 * Égalité EXACTE sur l'adresse, comme les autres pastilles. « Reste à faire » : descend à zéro.
 */

export interface FormateursNavCountsProp {
  /** Dossiers à l'étape « À vérifier » (même calcul que l'onglet de la page). */
  dossiers: number;
  /** Missions dont c'est à l'équipe d'agir. */
  missions: number;
  /** Relevés d'honoraires « À valider ». */
  honoraires: number;
}

export function badgeFormateurs(
  href: string,
  base: string,
  c: FormateursNavCountsProp | undefined,
): { count: number; tone: "danger" | "warn"; label: string } | null {
  if (!c) return null;
  if (href === `${base}/qualiopi/formateurs/a-faire` && c.dossiers + c.missions > 0)
    return { count: c.dossiers + c.missions, tone: "danger", label: "à faire maintenant" };
  if (href === `${base}/qualiopi/formateurs/dossiers` && c.dossiers > 0)
    return { count: c.dossiers, tone: "danger", label: "dossiers à vérifier" };
  if (href === `${base}/qualiopi/formateurs/missions` && c.missions > 0)
    return { count: c.missions, tone: "warn", label: "missions à traiter" };
  if (href === `${base}/qualiopi/remuneration?vue=formateurs-freelance` && c.honoraires > 0)
    return { count: c.honoraires, tone: "warn", label: "relevés à valider" };
  return null;
}
