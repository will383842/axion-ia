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
  terracotta: "#c24a1b",
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
