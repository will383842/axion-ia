/**
 * Palette définitive des pièces (e-mails, PDF) — miroir de `couleurs-marque.json`
 * (dépôt axion-brand, version 2026-11-07). Découple les pièces de `globals.css`.
 * Parité vérifiée par `couleurs-pieces.spec.ts`.
 */
export const COULEURS_PIECES = {
  ivoire: "#FAF9F5",
  "gris-chaud": "#E8E6DC",
  noir: "#141413",
  blanc: "#FFFFFF",
  terracotta: "#B23F16",
  /** Orange : accent sur fond noir UNIQUEMENT. */
  orange: "#D97757",
  "gris-moyen": "#B0AEA5",
  "texte-secondaire": "#5E5D59",
  reussite: "#5E7050",
  erreur: "#B8341C",
} as const;

/** Valeurs dérivées « À CONFIRMER » par Williams : isolées, à ne pas figer. */
export const COULEURS_PIECES_A_CONFIRMER = {
  "terracotta-survol": "#8F3412",
  attention: "#8F3412",
} as const;
