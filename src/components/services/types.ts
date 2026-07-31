/**
 * Sprint A — VilleContext partagé pour composants services.
 *
 * Ce type est passé en prop optionnelle à chaque composant de
 * `src/components/services/*` pour permettre une réutilisation transparente
 * entre la page hub `/fr/{service}` (sans ville) et les ~430 pages ville
 * `/fr/implantations/{region}/{ville}/{verticale}` (avec ville).
 *
 * Quand `villeContext` est `undefined`, le composant rend sa version
 * canonique (page service hub). Quand fourni, le composant interpole le
 * nom de ville dans les H1/H2 ville-ables, les CTAs et le JSON-LD.
 */

export interface VilleContext {
  /** Nom affichable FR de la ville (ex « Paris », « Lyon »). */
  readonly name: string;
  /** Nom affichable FR de la région (ex « Île-de-France »). */
  readonly region: string;
  /** Slug URL de la région (ex « ile-de-france »). */
  readonly regionSlug: string;
  /** Slug URL de la ville (ex « paris », « marseille-13e »). */
  readonly villeSlug: string;
  /** Code INSEE 5 chiffres (ex « 75056 » Paris). Optionnel pour JSON-LD. */
  readonly inseeCode?: string;
  /** Population approximative (ex 2 161 000). Optionnel. */
  readonly population?: number;
}

/**
 * 5 verticales services. Doivent matcher le slug URL `[verticale]`
 * et les clés du dispatcher `[verticale]/page.tsx`.
 */
export type VerticaleSlug =
  "audits" | "interventions" | "implementations" | "un-a-un" | "sites-web-ia";
