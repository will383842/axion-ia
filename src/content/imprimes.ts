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

import { formatAmount } from "@/content/pricing";

/**
 * Valeur du coup de projecteur TELLE QU'ELLE EST ENCRÉE sur le tirage en cours
 * du flyer A5 — lue dans le PDF servi (`pypdf`), pas supposée : le recto porte
 * « 650 € 0 € » juste avant « Un coup de projecteur, offert ».
 *
 * SÉPARÉE de `VALEUR_REFERENCE_COUP_DE_PROJECTEUR_EUR` (la SSOT) exprès. Un
 * imprimé ne se redéploie pas : le jour où la référence bouge, ce flyer
 * continue d'annoncer l'ancien montant jusqu'au retirage. Deux constantes
 * rendent cet écart VISIBLE — `flyer-valeur-projecteur.spec.ts` rougit et nomme
 * le retirage à faire. Les fusionner ferait mentir la console sur l'objet
 * qu'elle décrit ; exempter la ligne (ce qu'on faisait) rendait l'écart
 * invisible dans les deux sens, et c'est ainsi qu'on a fini par retirer un
 * montant parfaitement légitime.
 */
export const VALEUR_PROJECTEUR_SUR_LE_FLYER = 650;

/** Montants formatés par le helper de la SSOT, jamais écrits à la main. */
const GRATUIT = formatAmount(0, "fr", { compact: true });
const VALEUR_BARREE = formatAmount(VALEUR_PROJECTEUR_SUR_LE_FLYER, "fr", { compact: true });

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
    id: "depliant-formations",
    icon: "ScrollText",
    nom: "Dépliant formations · 4 pages",
    format: "A3 ouvert / A4 fermé · 420 × 297 mm à plat, 210 × 297 mm plié · une pliure au centre",
    resume:
      "Les 21 formations et le séminaire sur une seule page, avec les prix publics et la prise en charge OPCO. Le format à laisser après un rendez-vous quand le catalogue 48 p. est trop lourd.",
    fichiersPublics: [
      {
        chemin: "imprimes/depliant-formations-axion-ia.pdf",
        nom: "Les 4 pages A4",
        role: "À lire à l'écran et à envoyer par mail. Page 1 la couverture, page 2 le temps gagné et le parcours, page 3 les 22 formations, page 4 les tarifs et le contact.",
      },
      {
        chemin: "imprimes/depliant-formations-axion-ia-A3.pdf",
        nom: "Les 2 planches A3, imposées",
        role: "Recto « page 4 | page 1 », verso « page 2 | page 3 » : imprimé en recto-verso sur A3 et plié au centre, il tombe dans le bon ordre. Pour le tirage bureautique.",
      },
      {
        chemin: "imprimes/depliant-formations-axion-ia-IMPRIMEUR.pdf",
        nom: "Le fichier imprimeur — Vistaprint / Exaprint",
        role: "4 pages à 216 × 303 mm : le format fini 210 × 297 plus 3 mm de fond perdu sur chaque bord, avec les repères de coupe. C'est CE fichier qu'on téléverse chez l'imprimeur, pas les deux autres. Pages séparées et non imposées — Vistaprint comme Exaprint imposent eux-mêmes.",
      },
    ],
    fichiersHorsLigne: [],
    avantTirage: [
      "⛔ NE PAS IMPRIMER AVANT LA DÉLIVRANCE DE QUALIOPI. Le dépliant l'affiche quatre fois, dont la bande de couverture — c'est irréversible sur papier. Distribution prévue une fois la certification obtenue (décision Will, 2026-08-25).",
      "Les prix et les 22 intitulés sont DÉRIVÉS de catalog-v2.ts × pricing.ts : ils ne peuvent pas diverger du site, mais ils gèlent au moment du tirage. Refabriquer juste avant d'imprimer : pnpm tsx scripts/build-depliant-formations.ts",
      "Vérifier que les 3 QR pointent où il faut. ⚠️ Ils visent des URL canoniques, PAS des /qr/<slug> : leur destination NE se change PAS après impression, contrairement à ceux du catalogue.",
      "⚠️ LE FICHIER IMPRIMEUR EST EN RVB, pas en CMJN. Vistaprint l'accepte et convertit lui-même. Exaprint l'accepte aussi mais recommande le CMJN : la conversion se fera chez eux, avec un risque d'écart sur le terracotta et les aplats sombres. Pour un tirage où la couleur doit être garantie, faire convertir en CMJN (profil Fogra39) avant de téléverser.",
      "La photo de couverture est recadrée dans le rendu web du catalogue (~230 dpi à 210 mm). Correcte en bureautique, en dessous des 300 dpi d'un offset.",
    ],
    voirAussi: { href: "/imprimes/catalogue-a4", label: "Le catalogue 48 pages" },
  },
  {
    id: "flyer-a5",
    icon: "Newspaper",
    nom: "Flyer A5 · recto-verso",
    format: "A5 · 148 × 210 mm fini · 154 × 216 mm avec 3 mm de fond perdu",
    resume: `La présentation courte d’Axion-IA : les cinq activités, la prise en charge OPCO jusqu’au reste à charge nul, et le coup de projecteur — podcast, interviews, page dédiée — affiché ${VALEUR_BARREE} barré puis ${GRATUIT}. À laisser après un rendez-vous ou à diffuser en salon.`,
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
