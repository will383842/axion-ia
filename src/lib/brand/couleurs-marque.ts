/**
 * Les couleurs de la charte — miroir de `@theme` dans `src/app/globals.css`.
 *
 * ## Pourquoi ce module existe, et pourquoi ICI
 *
 * Ces valeurs vivaient dans `src/server/qualiopi/brand/brand-tokens.ts`, parce
 * que leur premier consommateur était la génération de PDF Qualiopi. Le nom du
 * dossier a fini par décrire l'histoire du fichier plutôt que son contenu : une
 * couleur de marque n'appartient pas au domaine Qualiopi, elle appartient à la
 * marque.
 *
 * Le déplacement n'est pas cosmétique. La garde de cloisonnement
 * (`scripts/qualiopi/isolation-check.ts`) refuse — à raison — qu'une surface
 * publique importe le domaine Qualiopi. Le sélecteur de créneaux avait besoin
 * du terracotta ; il ne pouvait l'obtenir qu'en important Qualiopi, ce qui
 * aurait obligé à **élargir** une liste d'exceptions dont le fichier dit
 * lui-même qu'elle « doit RÉTRÉCIR, jamais grandir ».
 *
 * 🔑 Les deux issues étaient : desserrer la garde, ou ranger la couleur au bon
 * endroit. La seconde coûte deux fichiers et referme le sujet.
 *
 * ## ⚠️ Miroir : à tenir à jour avec globals.css
 *
 * `@react-pdf/renderer`, React Email et les paramètres d'URL de Calendly ne
 * lisent pas les variables CSS. Ce module est donc une copie — et
 * `src/server/qualiopi/brand/brand-tokens.parity.spec.ts` échoue si une valeur
 * diverge de `globals.css`. Changer la charte = changer le jeton CSS **et** ce
 * miroir ; le test attrape l'oubli.
 *
 * C'est ce test qui manquait au `c2410c` envoyé à Calendly : une quatrième
 * copie, celle-là sans garde, restée sur l'ancien terracotta après l'audit
 * d'accessibilité du 2026-07-26.
 */

/**
 * Couleurs miroir de `@theme` — clé = nom du token CSS (`--color-<clé>`),
 * valeur = hex.
 */
export const COULEURS_MARQUE = {
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

export type JetonCouleurMarque = keyof typeof COULEURS_MARQUE;
