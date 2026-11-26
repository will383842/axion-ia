/**
 * Pastilles du menu « Apporteurs d'affaires » : quelle entrée porte quel compteur.
 * Module PUR (aucun composant) : la barre latérale l'appelle, les tests l'éprouvent.
 * Égalité EXACTE sur l'adresse, comme les autres pastilles : « Apporteurs signés » ne doit pas
 * capter ses sous-écrans.
 */

export interface ApporteursNavCountsProp {
  presentations: number;
  /** Rendez-vous proposés à valider ou écarter (absent = 0). */
  propositions?: number;
  pieces: number;
  virements: number;
}

export function badgeApporteurs(
  href: string,
  base: string,
  c: ApporteursNavCountsProp | undefined,
): { count: number; tone: "danger" | "warn"; label: string } | null {
  if (!c) return null;
  const propositions = c.propositions ?? 0;
  if (href === `${base}/apporteurs/entreprises` && c.presentations + propositions > 0)
    return {
      count: c.presentations + propositions,
      tone: "danger",
      label:
        propositions > 0
          ? "présentations et rendez-vous proposés à traiter"
          : "présentations à traiter",
    };
  if (href === `${base}/apporteurs` && c.pieces > 0)
    return { count: c.pieces, tone: "warn", label: "pièces de vigilance déposées" };
  if (href === `${base}/apporteurs/commissions` && c.virements > 0)
    return { count: c.virements, tone: "warn", label: "virements à faire" };
  return null;
}
