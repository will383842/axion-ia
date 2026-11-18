/**
 * Charte v1 — constantes de style des PDF (couleurs, rayons, typographie, espaces).
 *
 * Module AUTONOME : aucun gabarit ne l'utilise encore. Les codes couleur vivent ICI et non
 * dans `COULEURS_MARQUE` (`src/lib/brand/couleurs-marque.ts`) : ce dernier est comparé au
 * site par un test de parité, et cette palette n'est pas celle du site.
 *
 * Les valeurs sont FIGÉES (verrouillées par `couleurs.spec.ts`).
 */

export const CHARTE_COULEURS = {
  fond: "#FAF9F5",
  texte: "#141413",
  grisChaud: "#E8E6DC",
  carte: "#FFFFFF",
  bordureCarte: "#E8E6DC",
  terracotta: "#B23F16",
  sombre: "#141413",
  sombreTexte: "#FAF9F5",
  sombreSurTitre: "#D97757",
  sombreSecondaire: "#B0AEA5",
  bleuDoux: "#E8F0FA",
  bleu: "#1F5FA8",
  lisere: ["#2F7FC8", "#F0B323", "#C2185B", "#A8C93A"],
} as const;

export const CHARTE_RAYONS = {
  carte: 11,
  tuile: 10,
  ligneTableau: 7.5,
  pastille: 99,
} as const;

/**
 * Manrope est déjà enregistrée par `fonts.ts` (normal, 500, gras). Aucune autre graisse
 * n'existe : 800 ou 900 retomberaient sur une autre police.
 */
export const CHARTE_TYPO = {
  police: "Manrope",
  graisses: { normale: 400, moyenne: 500, grasse: 700 },
  corps: { taille: 10, interligne: 1.4 },
  petit: { taille: 8.8 },
  pied: { taille: 8 },
  surTitre: { taille: 7.8, interlettrage: 0.9 },
  marque: { taille: 12.5 },
  titre1: { taille: 26, interligne: 1.05, interlettrage: -0.75 },
  titre2: { taille: 14, interlettrage: -0.3 },
  titreCarte: { taille: 11 },
  montantTotal: { taille: 26 },
} as const;

export const CHARTE_ESPACES = {
  margeHaut: 37,
  margeCote: 40,
  basReserve: 64,
  ecartCartes: 7,
  carteV: 11,
  carteH: 13,
  hauteurLisere: 5,
} as const;

/**
 * Couples texte / fond réellement posés par les composants. `couleurs.spec.ts` exige un
 * contraste d'au moins 4,5 pour chacun. Un composant qui pose un nouveau couple doit
 * l'ajouter ici. Les filigranes (décor à opacité réduite) n'en font pas partie.
 */
export const CHARTE_COUPLES_TEXTE: ReadonlyArray<{
  readonly nom: string;
  readonly texte: string;
  readonly fond: string;
}> = [
  { nom: "texte sur page", texte: CHARTE_COULEURS.texte, fond: CHARTE_COULEURS.fond },
  { nom: "texte sur carte", texte: CHARTE_COULEURS.texte, fond: CHARTE_COULEURS.carte },
  {
    nom: "texte sur gris chaud (en-tête de tableau)",
    texte: CHARTE_COULEURS.texte,
    fond: CHARTE_COULEURS.grisChaud,
  },
  { nom: "texte sur bleu doux", texte: CHARTE_COULEURS.texte, fond: CHARTE_COULEURS.bleuDoux },
  { nom: "bleu sur bleu doux", texte: CHARTE_COULEURS.bleu, fond: CHARTE_COULEURS.bleuDoux },
  { nom: "terracotta sur page", texte: CHARTE_COULEURS.terracotta, fond: CHARTE_COULEURS.fond },
  { nom: "terracotta sur carte", texte: CHARTE_COULEURS.terracotta, fond: CHARTE_COULEURS.carte },
  {
    nom: "texte sombre-clair sur bloc sombre",
    texte: CHARTE_COULEURS.sombreTexte,
    fond: CHARTE_COULEURS.sombre,
  },
  {
    nom: "sur-titre sur bloc sombre",
    texte: CHARTE_COULEURS.sombreSurTitre,
    fond: CHARTE_COULEURS.sombre,
  },
  {
    nom: "secondaire sur bloc sombre",
    texte: CHARTE_COULEURS.sombreSecondaire,
    fond: CHARTE_COULEURS.sombre,
  },
];
