/**
 * Qualiopi — SSOT marque pour PDF & email (miroir de `@theme`).
 *
 * `@react-pdf/renderer` et React Email NE LISENT PAS les CSS variables. Pour
 * éviter de re-hardcoder les couleurs/polices (et les voir diverger de la
 * charte), ce module est l'UNIQUE source pour les templates PDF/email Qualiopi.
 *
 * ⚠️ Les valeurs ci-dessous sont le **miroir exact** de `src/app/globals.css`
 * (`@theme`). Le test de parité `brand-tokens.parity.spec.ts` échoue si une
 * valeur diverge → la charte reste modifiable en un seul endroit (changer le
 * token globals.css + ce miroir, le test garde-fou détecte tout oubli).
 *
 * Charte : Editorial Premium Light (ivoire chaud, mocha, terracotta, bleu
 * éditorial, Manrope/Fraunces/Inconsolata). Pas de mode sombre.
 */

/**
 * Couleurs miroir de `@theme` — clé = nom du token CSS (`--color-<clé>`),
 * valeur = hex. Le test de parité compare cette map à globals.css.
 */
export const QUALIOPI_BRAND_COLORS = {
  bg: "#faf8f3",
  paper: "#ffffff",
  sand: "#f0e9da",
  "sand-deep": "#e6dcc4",
  mocha: "#2a2520",
  "mocha-soft": "#3d362f",
  "mocha-fg": "#f7f3ea",
  fg: "#1a1815",
  "fg-soft": "#524b41",
  "fg-muted": "#5a4f44",
  primary: "#1a4dd9",
  "primary-hover": "#0f3aae",
  "primary-fg": "#ffffff",
  "primary-soft": "#e8efff",
  terracotta: "#b23f16",
  "terracotta-soft": "#f5e3d8",
  "terracotta-deep": "#8c3010",
  sage: "#5e6c54",
  "sage-soft": "#e6ebe2",
  border: "#e5ddc8",
  "border-strong": "#c8bda0",
} as const;

export type QualiopiBrandColorToken = keyof typeof QUALIOPI_BRAND_COLORS;

/**
 * Familles de polices embarquées dans les PDF (`Font.register`) + emails.
 * Fraunces = titres (serif), Manrope = corps (sans), Inconsolata = n° doc /
 * montants techniques (mono). Miroir des familles `--font-*` de globals.css.
 */
export const QUALIOPI_BRAND_FONTS = {
  serif: "Fraunces",
  sans: "Manrope",
  mono: "Inconsolata",
} as const;

/** Accès typé à une couleur de marque. */
export function brandColor(token: QualiopiBrandColorToken): string {
  return QUALIOPI_BRAND_COLORS[token];
}

/**
 * Échelle typographique des PDF officiels (en points). Centralisée pour donner
 * une hiérarchie cohérente à TOUS les templates (fini les `fontSize: 10` en dur
 * dispersés). NON soumise au test de parité couleurs (ce ne sont pas des
 * couleurs) : modifiable librement sans toucher globals.css.
 *
 * Échelle modulaire ~1.18 autour d'un corps de 10 pt, calée pour l'A4 dense
 * réglementaire (lisibilité à l'impression + à l'écran).
 */
export const QUALIOPI_PDF_TYPE = {
  /** Légales en pied, filigranes secondaires. */
  xs: 8,
  /** Méta, labels de champ, notes. */
  sm: 9,
  /** Corps de texte par défaut. */
  base: 10,
  /** Sous-titres, libellés de section. */
  md: 11,
  /** Intertitres marquants, montant TTC. */
  lg: 13,
  /** Titre de document (en-tête). */
  xl: 16,
  /** Très grands chiffres (note /10, durée mise en avant). */
  display: 22,

  /** Interlignes. */
  lineTight: 1.3,
  lineNormal: 1.5,
  lineRelaxed: 1.65,

  /** Interlettrage des sur-titres (« eyebrow ») et labels capitales. */
  trackingWide: 1.1,
} as const;

/**
 * Échelle d'espacement (points) — rythme vertical/horizontal homogène.
 * Multiples de 2, alignés sur une grille de 4 pt. NON soumise à la parité.
 */
export const QUALIOPI_PDF_SPACE = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
  xxxl: 24,
  /** Marge de page A4. */
  page: 40,
  /** Rayon de coin par défaut (callouts, encarts). */
  radius: 3,
  /** Rayon large (totaux, blocs mis en avant). */
  radiusLg: 4,
} as const;
