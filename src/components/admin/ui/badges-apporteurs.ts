/**
 * Pastilles du menu « Apporteurs d'affaires » : quelle entrée porte quel compteur.
 * Module PUR (aucun composant) : la barre latérale l'appelle, les tests l'éprouvent.
 * Égalité EXACTE sur l'adresse, comme les autres pastilles : « Apporteurs signés » ne doit pas
 * capter ses sous-écrans.
 */

export interface ApporteursNavCountsProp {
  presentations: number;
  pieces: number;
  virements: number;
}

export function badgeApporteurs(
  href: string,
  base: string,
  c: ApporteursNavCountsProp | undefined,
): { count: number; tone: "danger" | "warn"; label: string } | null {
  if (!c) return null;
  if (href === `${base}/apporteurs/entreprises` && c.presentations > 0)
    return { count: c.presentations, tone: "danger", label: "présentations à traiter" };
  if (href === `${base}/apporteurs` && c.pieces > 0)
    return { count: c.pieces, tone: "warn", label: "pièces de vigilance déposées" };
  if (href === `${base}/apporteurs/commissions` && c.virements > 0)
    return { count: c.virements, tone: "warn", label: "virements à faire" };
  return null;
}
