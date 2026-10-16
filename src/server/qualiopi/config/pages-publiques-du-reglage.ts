/**
 * Pages publiques (ISR) qui affichent un réglage Qualiopi — à revalider quand il change.
 *
 * 🔴 Constaté en production (L15, NC12) : `/fr/accessibilite` affichait « Référent
 * handicap : » sans le nom ni le contact saisis en console. La page est en ISR
 * (`revalidate = 3600`) et prérendue au build avec le stub `stub.invalid`, donc avec
 * le repli générique ; l'enregistrement du réglage (`setQualiopiConfigAction`) ne
 * revalidait RIEN, de sorte que la saisie n'apparaissait qu'au prochain passage de
 * l'horloge d'une heure, et jamais sur une page restée en cache plus longtemps
 * (Cloudflare, régénération échouée). Une saisie visible sur l'écran d'admin et
 * invisible sur le site est le pire cas pour une preuve d'indicateur 26.
 *
 * Module pur (aucune dépendance Next/Prisma) : la table se teste seule.
 */

export interface PagePubliqueARevalider {
  /** Motif de route, tel que `revalidatePath` l'attend pour un segment dynamique. */
  readonly chemin: string;
  readonly type: "page";
}

/** Préfixe de clé de réglage → pages qui le rendent. */
const PAGES_PAR_PREFIXE: ReadonlyArray<{
  readonly prefixe: string;
  readonly pages: ReadonlyArray<PagePubliqueARevalider>;
}> = [
  {
    // Nom + e-mail du référent handicap (indicateur 26) : page d'accessibilité et fiches formation.
    prefixe: "referent_handicap_",
    pages: [
      { chemin: "/[locale]/accessibilite", type: "page" },
      { chemin: "/[locale]/formations/[slug]", type: "page" },
    ],
  },
];

/** Pages publiques à revalider après l'écriture de ce réglage (vide si aucune ne le rend). */
export function pagesPubliquesDuReglage(cle: string): ReadonlyArray<PagePubliqueARevalider> {
  return PAGES_PAR_PREFIXE.filter((e) => cle.startsWith(e.prefixe)).flatMap((e) => e.pages);
}
