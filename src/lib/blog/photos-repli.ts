/**
 * Photos de repli des gabarits d'articles (S2, révision v3) : table statique
 * `gabarit → { src, alt }` de la banque du site (`public/images/axion-ia-*`, chaque
 * fichier existe en `.webp` ET en `.avif`). Utilisée UNIQUEMENT quand l'article n'a pas
 * de `featuredImage`. Jamais un dessin, un SVG ni une infographie : aucun nom de fichier
 * ne contient « infographie » ni un chiffre-vedette (verrouillé par test). La photo de
 * repli n'entre ni dans `og:image` ni dans le JSON-LD (les métadonnées ne changent pas).
 *
 * Les huit entrées sont de VRAIES photographies de la banque (fichiers `axion-ia-photo-*`,
 * sans texte incrusté ni logo) : cinq photos distinctes, donc certaines servent à deux gabarits
 * faute d'un stock plus large. Aucun visuel de marque, affiche ou schéma. `alt` vide : la photo
 * est décorative (elle n'illustre pas un fait de l'article ; le titre porte le sens).
 */
import type { GabaritArticle } from "@/server/content-gen/blog/gabarits";

/**
 * Code de page des gabarits v2 : les huit gabarits du blog, plus l'actualité (PR M-A1) et le
 * guide pilier (PR M-GU1), qui vivent sur `/actualites/[slug]` et `/guides/[slug]`. Ce n'est PAS un `GabaritArticle` : `gabaritPourType` et la
 * table du PLAN §3 ne le connaissent pas.
 */
export type GabaritPage = GabaritArticle | "actualite" | "guide-pilier";

export interface PhotoRepli {
  readonly src: string;
  readonly alt: string;
}

export const PHOTOS_REPLI: Readonly<Record<GabaritPage, PhotoRepli>> = {
  analyse: {
    src: "/images/axion-ia-photo-formation-ia-salle-conference-participants-eclairage.webp",
    alt: "",
  },
  guide: {
    src: "/images/axion-ia-photo-formation-ia-equipe-mixte-exercices-pratiques-resultat.webp",
    alt: "",
  },
  comparatif: {
    src: "/images/axion-ia-photo-formateur-ia-presentation-tableau-equipe-entreprise.webp",
    alt: "",
  },
  selection: {
    src: "/images/axion-ia-photo-atelier-ia-groupe-collaborateurs-ordinateurs-ecrans.webp",
    alt: "",
  },
  cas: {
    src: "/images/axion-ia-photo-celebration-formation-ia-reussie-equipe-satisfaite.webp",
    alt: "",
  },
  definition: {
    src: "/images/axion-ia-photo-atelier-ia-groupe-collaborateurs-ordinateurs-ecrans.webp",
    alt: "",
  },
  faq: {
    src: "/images/axion-ia-photo-formation-ia-equipe-mixte-exercices-pratiques-resultat.webp",
    alt: "",
  },
  chiffres: {
    src: "/images/axion-ia-photo-formation-ia-salle-conference-participants-eclairage.webp",
    alt: "",
  },
  actualite: {
    src: "/images/axion-ia-photo-formateur-ia-presentation-tableau-equipe-entreprise.webp",
    alt: "",
  },
  "guide-pilier": {
    src: "/images/axion-ia-photo-celebration-formation-ia-reussie-equipe-satisfaite.webp",
    alt: "",
  },
};
