/**
 * Couleurs de la charte GELÉES au 2026-11 (fiche V8-P0).
 *
 * ⛔ NE JAMAIS « mettre à jour » ce fichier. Les gabarits PDF des pièces SIGNABLES (devis,
 * conventions, contrats…) lisent leurs couleurs par `brand-tokens.ts`, et l'exemplaire signé
 * est RE-RENDU depuis l'instantané : changer une valeur ici recolorerait rétroactivement les
 * exemplaires de pièces déjà signées. Les 21 valeurs sont donc écrites EN DUR, sans import,
 * et l'objet est gelé.
 *
 * La charte vivante est `couleurs-marque.ts` (miroir de `globals.css`) : elle peut évoluer.
 * Une pièce signable ne change de couleurs que par une NOUVELLE version de gabarit archivée.
 *
 * Garde : `couleurs-marque-gelees-2026-11.spec.ts` (valeurs littérales + empreinte sha256) et
 * `pieces-signees-restent-reproductibles.spec.tsx` (octets des exemplaires signés).
 */
export const COULEURS_MARQUE_GELEES_2026_11 = Object.freeze({
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
} as const);
