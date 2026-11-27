/**
 * Photos de repli des gabarits d'articles (S2, révision v3) : table statique
 * `gabarit → { src, alt }` de la banque du site (`public/images/axion-ia-*`, chaque
 * fichier existe en `.webp` ET en `.avif`). Utilisée UNIQUEMENT quand l'article n'a pas
 * de `featuredImage`. Jamais un dessin, un SVG ni une infographie : aucun nom de fichier
 * ne contient « infographie » ni un chiffre-vedette (verrouillé par test). La photo de
 * repli n'entre ni dans `og:image` ni dans le JSON-LD (les métadonnées ne changent pas).
 *
 * ⚠️ POINT OUVERT (relecture Opus) : la banque `public/images/axion-ia-*` ne contient que des
 * visuels de marque (affiches, citations, schémas) et très peu de vraies photos. Ces choix sont
 * les moins texteux, pas de vraies photos : `alt` vide (décor) plutôt qu'une description fausse.
 * À remplacer par de vraies photos validées par Will.
 */
import type { GabaritArticle } from "@/server/content-gen/blog/gabarits";

export interface PhotoRepli {
  readonly src: string;
  readonly alt: string;
}

export const PHOTOS_REPLI: Readonly<Record<GabaritArticle, PhotoRepli>> = {
  analyse: {
    src: "/images/axion-ia-atelier-ia-equipe-commerciale-crm-automatisation-leads.webp",
    alt: "",
  },
  guide: {
    src: "/images/axion-ia-compte-rendu-reunion-ecrit-automatiquement-equipe-bureau-banniere.webp",
    alt: "",
  },
  comparatif: {
    src: "/images/axion-ia-audit-ia-cartographie-outils-existants-systeme-information-banniere.webp",
    alt: "",
  },
  selection: {
    src: "/images/axion-ia-audit-ia-diagnostic-workflow-taches-repetitives-detection.webp",
    alt: "",
  },
  cas: {
    src: "/images/axion-ia-cas-concret-soirees-admin-devis-factures-automatiques-pme-carre.webp",
    alt: "",
  },
  definition: {
    src: "/images/axion-ia-connexion-outils-crm-erp-ia-automatisation-donnees.webp",
    alt: "",
  },
  faq: {
    src: "/images/axion-ia-audit-ia-entretien-dirigeant-recueil-besoins-analyse.webp",
    alt: "",
  },
  chiffres: {
    src: "/images/axion-ia-audit-ia-diagnostic-numerique-pme-bilan-competences.webp",
    alt: "",
  },
};
