/**
 * Console éditoriale — les recettes de dérivation semées à l'amorçage.
 *
 * Module PUR : le registre, rien d'autre. L'écriture en base vit dans
 * `prisma/seeds/editorial/`.
 *
 * ── 🔴 Pourquoi ce fichier existe ─────────────────────────────────────────
 *
 * Défaut trouvé par les passes 2 et 5 du protocole, séparément : `ed_recettes`
 * était **vide**. Zéro ligne. Le critère 1 du lot 2 — « un asset enregistré
 * avec une recette crée AUTOMATIQUEMENT ses dérivés en `a_produire` » — ne
 * pouvait donc pas être exercé, et le sélecteur de recette de la médiathèque
 * n'avait rien à proposer.
 *
 * `appliquerRecetteAction` était écrite et testée. Une fonctionnalité correcte
 * dont la donnée de référence manque est aussi inutilisable qu'une
 * fonctionnalité absente — et plus trompeuse, parce que le code laisse croire
 * qu'elle marche.
 *
 * ── ⚠️ Ce que ces recettes ne sont PAS ────────────────────────────────────
 *
 * Elles ne sont pas une politique éditoriale figée. Elles vivent en base et
 * s'y modifient : quantités, familles, comptes cibles. Ce registre n'est que
 * le point de départ, choisi pour correspondre au fonctionnement réel décrit
 * au §2 bis — un épisode se découpe, une vidéo courte se décline.
 *
 * 🔑 Les quantités sont VOLONTAIREMENT modestes. Une recette qui crée trente
 * dérivés d'un coup remplit la médiathèque d'assets `a_produire` que personne
 * ne produira, et le tableau de bord se met à mentir sur ce qui reste à
 * faire. Mieux vaut en créer trois et en redemander.
 */

/** Une ligne de recette : « depuis cette famille, produire N de celle-là ». */
export interface LigneRecette {
  /** `slug` de la famille à produire — voir `ED_FAMILLES`. */
  familleSlug: string;
  quantite: number;
  /** Pourquoi cette ligne, en français. Affiché à l'application. */
  note: string;
}

export interface AmorcageRecette {
  /** Clé naturelle, stable — l'amorçage doit être rejouable. */
  slug: string;
  nom: string;
  /** `slug` de la famille SOURCE : la recette ne s'applique qu'à celle-là. */
  familleSourceSlug: string;
  lignes: readonly LigneRecette[];
}

/**
 * Les trois recettes de départ.
 *
 * Chacune part d'une famille réellement produite aujourd'hui, et ne dérive
 * que vers des familles qui existent déjà dans `ED_FAMILLES` — une recette
 * qui vise une famille absente échouerait à l'amorçage, ce qui vaut mieux que
 * de créer des dérivés orphelins.
 */
export const ED_RECETTES: readonly AmorcageRecette[] = [
  {
    slug: "episode-vers-shorts",
    nom: "Épisode → 3 shorts + 1 extrait",
    familleSourceSlug: "episode-podcast",
    lignes: [
      {
        familleSlug: "short-vertical",
        quantite: 3,
        note: "Trois moments forts, verticaux, sous-titrés. Trois, pas trente : ce qui est créé ici devra être monté.",
      },
      {
        familleSlug: "extrait-video",
        quantite: 1,
        note: "Un extrait horizontal plus long, pour le fil et la page.",
      },
    ],
  },
  {
    slug: "video-courte-vers-declinaisons",
    nom: "Vidéo courte → short + image",
    familleSourceSlug: "video-courte",
    lignes: [
      {
        familleSlug: "short-vertical",
        quantite: 1,
        note: "Recadrage vertical de la même vidéo.",
      },
      {
        familleSlug: "image-unique",
        quantite: 1,
        note: "Une image d'accroche tirée de la vidéo — utile quand le fil coupe la lecture automatique.",
      },
    ],
  },
  {
    slug: "carrousel-vers-image",
    nom: "Carrousel → image d'accroche",
    familleSourceSlug: "carrousel",
    lignes: [
      {
        familleSlug: "image-unique",
        quantite: 1,
        note: "La première page en image seule, pour les surfaces qui ne feuillettent pas.",
      },
    ],
  },
];

/** Le compte attendu après amorçage. Un écart signale un semis partiel. */
export const ED_RECETTES_ATTENDUES = ED_RECETTES.length;

/** Combien de dérivés une recette produit au total. */
export function totalDerives(recette: AmorcageRecette): number {
  return recette.lignes.reduce((s, l) => s + l.quantite, 0);
}
