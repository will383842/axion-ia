/**
 * LES IMPRIMÉS — source unique de ce qui part sur du papier.
 *
 * POURQUOI CE FICHIER (2026-08-17, demande Will)
 *
 * « Un onglet qui rassemble tous les imprimés, et en sous-onglet catalogue,
 * flyer A5, etc. » Jusqu'ici il n'y avait qu'un onglet isolé, `catalogue-imprime`,
 * qui ne parlait que des PRIX du livre KDP. Le catalogue A4 et le flyer n'avaient
 * nulle part où aller.
 *
 * Le hub et chaque sous-onglet DÉRIVENT de cette liste. Recopier la liste dans
 * le hub ferait diverger les deux en silence — c'est exactement ce qui est
 * arrivé aux catégories de QR, recopiées à la main jusqu'au 2026-08-17 : une
 * catégorie existait dans le SSOT sans entrée ni page, et deux QR n'avaient
 * aucun tiroir. Une liste recopiée finit toujours par diverger de sa source.
 *
 * CE QUI EST PUBLIC ET CE QUI NE L'EST PAS
 *
 * `fichiersPublics` vit sous `public/`, donc dans l'image Docker : la console
 * mesure leur taille sur son propre disque, et c'est l'octet servi au visiteur.
 *
 * `fichiersHorsLigne` n'est PAS publié, et ne doit pas l'être — un CMJN de
 * 25 Mo avec fond perdu et repères de coupe, téléchargeable par n'importe qui,
 * n'a aucun sens. La console dit où il est plutôt que de laisser chercher.
 *
 * AUCUNE DATE N'EST EXPOSÉE. Dans une image Docker, les dates de fichier sont
 * celles de la COPIE, pas de la fabrication : elles diraient toutes la même
 * chose et donneraient une fausse fraîcheur. Règle déjà posée pour les PDF KDP.
 */

export interface FichierImprime {
  /** Chemin sous `public/`, tel qu'il est servi. Sans slash initial. */
  chemin: string;
  nom: string;
  role: string;
}

export interface FichierHorsLigne {
  nom: string;
  ou: string;
  pourquoi: string;
}

export interface Imprime {
  /** Segment d'URL sous `/imprimes/`. */
  id: string;
  nom: string;
  /**
   * Nom d'icone Lucide, resolu par `NAV_ICONS`. DISTINCTE pour chaque imprime :
   * une garde du registre (`admin-nav-icons.test.ts`) refuse deux entrees du
   * meme groupe qui porteraient la meme — elles seraient indiscernables dans
   * la barre laterale. Elle a mordu des la premiere ecriture de ce fichier.
   */
  icon: string;
  format: string;
  /** Une phrase : à quoi sert cet imprimé, et à qui on le donne. */
  resume: string;
  fichiersPublics: ReadonlyArray<FichierImprime>;
  fichiersHorsLigne: ReadonlyArray<FichierHorsLigne>;
  /** Ce qu'il faut vérifier avant de lancer un tirage. */
  avantTirage: ReadonlyArray<string>;
  /** Renvoi vers un autre écran de la console, s'il y en a un d'utile. */
  voirAussi?: { href: string; label: string };
}

/**
 * ⚠️ Le fichier destiné à l'IMPRIMEUR n'apparaît jamais dans `fichiersPublics`.
 * Si un jour quelqu'un l'y met « pour que ce soit plus pratique », il devient
 * téléchargeable par tout le monde — et un PDF avec fond perdu et repères de
 * coupe n'est pas un document de communication.
 */
export const IMPRIMES: ReadonlyArray<Imprime> = [
  {
    id: "catalogue-a4",
    icon: "BookOpenText",
    nom: "Catalogue A4 · 48 pages",
    format: "A5 plié / A4 · 148 × 210 mm fini · piqûre à cheval, 12 feuillets",
    resume:
      "Le catalogue complet des prestations : 21 formations et un séminaire, accompagnement 1-to-1, audit IA, implémentation. Distribué en main propre et lisible en ligne.",
    fichiersPublics: [
      {
        chemin: "catalogue/index.html",
        nom: "Le feuilletoir",
        role: "Le catalogue qui se tourne page par page, en doubles. C’est le lien à partager : il porte un aperçu Open Graph, donc il s’affiche avec une image dans WhatsApp ou LinkedIn.",
      },
      {
        chemin: "catalogue-formations-ia-axion-ia.pdf",
        nom: "Le PDF, pages à l’unité",
        role: "48 pages, à envoyer par mail ou à imprimer chez soi. S’ouvre en doubles pages dans un lecteur qui respecte la mise en page.",
      },
      {
        chemin: "catalogue/catalogue-axion-ia.pdf",
        nom: "Le PDF en doubles pages",
        role: "25 planches de 420 × 297 mm, sans fond perdu ni repère : la lecture à l’écran.",
      },
      {
        chemin: "catalogue/og-catalogue.jpg",
        nom: "L’image de partage",
        role: "1200 × 630. La vignette que WhatsApp, LinkedIn ou Slack affichent quand on partage le lien du feuilletoir.",
      },
    ],
    fichiersHorsLigne: [
      {
        nom: "catalogue-axion-ia-CMYK.pdf",
        ou: "Catalogue_formations_Axion_IA/catalogue-axion-ia-v2/export/",
        pourquoi:
          "Le fichier de l’imprimeur : 25 Mo, quadri, avec fond perdu. Le publier le rendrait téléchargeable par n’importe qui.",
      },
      {
        nom: "catalogue-planches-verification.pdf",
        ou: "Catalogue_formations_Axion_IA/catalogue-axion-ia-v2/export/",
        pourquoi:
          "La relecture, AVEC les traits de coupe. Il ressemble beaucoup au précédent — c’est la confusion entre les deux qui est le vrai risque. Il ne part jamais à l’imprimeur.",
      },
    ],
    avantTirage: [
      "Confirmer que la certification Qualiopi est bien délivrée : le catalogue l’affiche, et c’est irréversible sur papier.",
      "Relire les prix ci-contre (onglet « Livre KDP » pour la grille détaillée) — ils viennent tous de pricing.ts.",
      "Vérifier que les 22 QR pointent où il faut : leur destination se change sans réimprimer.",
    ],
    voirAussi: { href: "/qr-codes/catalogue", label: "Les 22 QR du catalogue" },
  },
  {
    id: "flyer-a5",
    icon: "Newspaper",
    nom: "Flyer A5 · recto-verso",
    format: "A5 · 148 × 210 mm fini · 154 × 216 mm avec 3 mm de fond perdu",
    resume:
      "La présentation courte d’Axion-IA : les cinq activités, le financement OPCO jusqu’à 0 € de reste à charge, et la visibilité offerte à 0 € au lieu de 650 €. À laisser après un rendez-vous ou à diffuser en salon.",
    fichiersPublics: [
      {
        chemin: "imprimes/flyer-a5-axion-ia.pdf",
        nom: "Le flyer, recto-verso",
        role: "Deux pages. Recto : l’accroche et les deux arguments d’argent. Verso : les cinq activités avec leurs prix planchers, le déroulé en trois temps, le contact.",
      },
    ],
    fichiersHorsLigne: [],
    avantTirage: [
      "Confirmer la certification Qualiopi : le flyer l’affiche à deux endroits.",
      "Vérifier les prix planchers — ils sont repris du catalogue, lui-même branché sur pricing.ts.",
      "Les deux QR réutilisent des slugs déjà vivants (cat-catalogue, formations) : leur destination se change sans réimprimer.",
    ],
  },
  {
    id: "livre-kdp",
    icon: "BookUser",
    nom: "Livre KDP",
    format: "Broché, imprimé et distribué par Amazon KDP",
    resume:
      "Le livre publié en autoédition. Cet écran relit les faits — prix, durée, format — tels qu’ils partiront à l’impression : distribué en main propre, un prix faux ne se corrige pas.",
    fichiersPublics: [],
    fichiersHorsLigne: [
      {
        nom: "Les 4 PDF KDP",
        ou: "Catalogue_formations_Axion_IA/catalogue-kdp/",
        pourquoi:
          "Ils vivent sur le poste de fabrication, hors dépôt. La console tourne dans un conteneur et n’y a aucun accès : afficher une fraîcheur qu’on ne peut pas mesurer serait pire que de ne rien afficher.",
      },
    ],
    avantTirage: [
      "Relire les offres et leurs prix dans le tableau ci-dessous.",
      "Régénérer les données : pnpm tsx scripts/export-catalogue-kdp.ts",
      "Reconstruire et exporter les 4 PDF (cf. catalogue-kdp/README.md).",
    ],
  },
];

export function imprimeParId(id: string): Imprime | undefined {
  return IMPRIMES.find((i) => i.id === id);
}
