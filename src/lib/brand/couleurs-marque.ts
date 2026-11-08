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
  bg: "#faf9f5",
  paper: "#ffffff",
  sand: "#e8e6dc",
  "sand-deep": "#e8e6dc",
  mocha: "#141413",
  "mocha-soft": "#141413",
  "mocha-fg": "#faf9f5",
  fg: "#141413",
  "fg-soft": "#5e5d59",
  "fg-muted": "#5e5d59",
  primary: "#b23f16",
  "primary-hover": "#8f3412",
  "primary-fg": "#ffffff",
  "primary-soft": "#e8e6dc",
  terracotta: "#b23f16",
  "terracotta-soft": "#e8e6dc",
  "terracotta-deep": "#8f3412",
  sage: "#5e7050",
  "sage-soft": "#e8e6dc",
  border: "#e8e6dc",
  "border-strong": "#b0aea5",
} as const;

export type JetonCouleurMarque = keyof typeof COULEURS_MARQUE;
