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
 * `fichiersInternes` (2026-09-28) est la troisième famille : des documents de
 * TRAVAIL de l'équipe (la trame de l'échange avec un candidat apporteur), qui
 * doivent être dans l'image — la console les sert — mais jamais publics. Ils
 * vivent sous `private/imprimes/`, que Next ne sert par aucun chemin, et ne
 * sortent que par `/api/admin/imprimes/<id>/<fichier>`, route gardée par la
 * même frontière que la console (`peutConsulter`) et bornée à cette liste.
 * Le Dockerfile copie `private/` dans l'image finale : sans cette ligne, la
 * route rendrait 404 en production (`imprimes-internes.spec.ts` la vérifie).
 *
 * AUCUNE DATE N'EST EXPOSÉE. Dans une image Docker, les dates de fichier sont
 * celles de la COPIE, pas de la fabrication : elles diraient toutes la même
 * chose et donneraient une fausse fraîcheur. Règle déjà posée pour les PDF KDP.
 */

import { formatAmount } from "@/content/pricing";
import { DOCUMENT_APPORTEUR_CHEMIN } from "@/lib/commercial-application/kit-apporteur";
import { GUIDE_IA_CHEMIN, GUIDE_IA_PAGES } from "@/content/guide-ia";

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

/**
 * Un document INTERNE : présent dans l'image, servi aux seuls comptes console.
 *
 * ⚠️ `fichier` est un NOM, pas un chemin : il est résolu sous
 * `private/imprimes/` par la route de téléchargement, qui le compare mot pour
 * mot à cette liste. `FICHIER_INTERNE_VALIDE` en borne la forme — ni `/`, ni
 * `..`, ni espace — et un test refuse toute entrée qui n'y répond pas.
 */
export interface FichierInterne {
  fichier: string;
  nom: string;
  role: string;
}

/** Dossier, relatif à la racine de l'application, des fichiers internes. */
export const DOSSIER_FICHIERS_INTERNES = "private/imprimes";

/** La seule forme de nom acceptée pour un fichier interne. */
export const FICHIER_INTERNE_VALIDE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.pdf$/;

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
  /**
   * Documents internes, téléchargeables depuis la console SEULEMENT. Absent
   * pour tout imprimé destiné au public.
   */
  fichiersInternes?: ReadonlyArray<FichierInterne>;
  /**
   * Présent ⇔ l'imprimé est un document de travail interne. Le texte est
   * affiché en tête de l'écran : ce qu'il ne faut jamais en faire.
   */
  usageInterne?: string;
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
    format:
      "A3 ouvert / A4 fermé · 420 × 297 mm à plat, 210 × 297 mm plié · pli central · " +
      "pages 2-3 conçues comme une seule double page, bandeau traversant le pli",
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
        chemin: "imprimes/depliant-formations-axion-ia-VISTAPRINT.pdf",
        nom: "Fichier Vistaprint — 422 × 299 mm",
        role: "2 planches A3 recto-verso, aux cotes exactes du gabarit « Dépliant pli central » (fini 420 × 297, soit 1 mm de fond perdu par bord). C'est CE fichier qu'on téléverse chez Vistaprint.",
      },
      {
        chemin: "imprimes/depliant-formations-axion-ia-EXAPRINT.pdf",
        nom: "Fichier Exaprint — 426 × 303 mm",
        role: "Le même document avec 3 mm de fond perdu, le standard des offsets français. ⚠️ Ces 3 mm viennent de l'usage, pas d'un gabarit Exaprint lu : à confronter à leur gabarit avant de lancer un tirage.",
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
    id: "devenir-apporteur",
    icon: "Handshake",
    nom: "Devenir apporteur d'affaires · 13 pages",
    format: "A4 paysage · 297 × 210 mm · 13 pages, lecture à l'écran",
    resume:
      "Le document de présentation du réseau d'apporteurs d'affaires : commissions, fonctionnement, prestations à recommander, profils recherchés. Envoyé automatiquement, avec le catalogue, à toute personne qui s'y intéresse — et dont le lien accompagne l'invitation à l'échange de 15 minutes.",
    fichiersPublics: [
      {
        chemin: DOCUMENT_APPORTEUR_CHEMIN,
        nom: "Le PDF, 13 pages",
        role: "Le lien que portent les e-mails du réseau d'apporteurs (accusé du premier contact, rappels, confirmation du dossier, invitation) et la page de remerciement du tunnel Facebook. ⚠️ Ne pas renommer : le chemin part dans des e-mails déjà envoyés.",
      },
    ],
    fichiersHorsLigne: [
      {
        nom: "devenir-apporteur-d-affaires.html",
        ou: "docs/imprimes/ (dans le dépôt)",
        pourquoi:
          "La source du PDF. Toute correction se fait là, puis le PDF se régénère — la commande est écrite en tête du fichier. Corriger le PDF à la main ferait diverger les deux.",
      },
    ],
    avantTirage: [
      "Le vocabulaire est celui de l'apporteur qui RECOMMANDE, jamais du commercial qui vend : ni « prospection », ni « argumentaire », ni « formation à l'offre ». Relire toute correction à l'aune de docs/partners/ANTI-REQUALIFICATION.md.",
      "Les commissions imprimées dans le document (par journée de formation, audit, intégration) viennent de COMMERCIAL_COMMISSIONS dans pricing.ts : si la grille change, le document doit être régénéré.",
    ],
  },
  {
    id: "trame-echange-apporteur",
    icon: "MessagesSquare",
    nom: "Trame de l'échange découverte apporteur (15 min)",
    format: "A4 portrait · 3 pages · usage interne",
    resume:
      "La trame pour conduire et noter l'échange de 15 minutes avec un candidat apporteur d'affaires : déroulé minute par minute, questions sur des faits vécus, présentation du réseau, réponses aux questions fréquentes, mots à dire et à bannir, critères éliminatoires fixés avant l'appel, et une fiche de notes à grille qui débouche sur une décision structurée juste après l'échange.",
    usageInterne:
      "Usage interne — ne pas transmettre au candidat. Ce document n'est pas en ligne : il ne se télécharge que depuis la console, par un compte administrateur.",
    fichiersPublics: [],
    fichiersInternes: [
      {
        fichier: "trame-echange-apporteur.pdf",
        nom: "La trame, 3 pages",
        role: "À imprimer avant chaque échange : pages 1 et 2 pour conduire l'appel, page 3 pour noter le candidat pendant et juste après. Une fiche par candidat.",
      },
    ],
    fichiersHorsLigne: [
      {
        nom: "trame-echange-apporteur.html",
        ou: "docs/imprimes/ (dans le dépôt)",
        pourquoi:
          "La source du PDF. Toute correction se fait là, puis le PDF se régénère dans private/imprimes/ — la commande est écrite en tête du fichier. Corriger le PDF à la main ferait diverger les deux.",
      },
    ],
    avantTirage: [
      "Les commissions et la durée de protection des contacts citées dans la trame doivent rester celles du document « Devenir apporteur d'affaires » et de COMMERCIAL_COMMISSIONS dans pricing.ts : si la grille change, régénérer les deux documents ensemble.",
      "Le vocabulaire face au candidat est celui de l'échange entre indépendants — jamais « entretien », « poste », « recrutement », « objectifs » ni « exclusivité ». Relire toute correction à l'aune de docs/partners/ANTI-REQUALIFICATION.md.",
      "Ne jamais déposer ce PDF sous public/, ni l'envoyer en pièce jointe : il contient la grille de notation et les critères éliminatoires.",
    ],
    voirAussi: { href: "/contacts/commercial", label: "Contacts › Apporteurs" },
  },
  {
    id: "guide-ia",
    icon: "Lightbulb",
    nom: `Guide IA entreprise · ${GUIDE_IA_PAGES} pages`,
    format: `A4 portrait · 210 × 297 mm · ${GUIDE_IA_PAGES} pages, lecture à l'écran`,
    resume:
      "Le guide promis par la page /guide-ia : comprendre l'IA générative, les usages prouvés, les coûts réels, la gouvernance, le retour sur investissement et les écueils. Envoyé par e-mail dès la demande (page du guide ou encart de fin d'article), et proposé en lien dans la confirmation d'un appel de découverte.",
    fichiersPublics: [
      {
        chemin: GUIDE_IA_CHEMIN,
        nom: `Le PDF, ${GUIDE_IA_PAGES} pages`,
        role: "La cible du lien personnel de l'e-mail « Votre guide » (`/api/guide-ia/telecharger`, qui y redirige après le clic), de la page de confirmation de la lettre et de l'e-mail de confirmation d'un appel de découverte. ⚠️ Ne pas renommer : le chemin part dans des e-mails déjà envoyés. Une nouvelle édition remplace le fichier sous le même nom.",
      },
    ],
    fichiersHorsLigne: [
      {
        nom: "La source du guide",
        ou: "_GUIDE-IA-2026/ (poste de fabrication, hors dépôt)",
        pourquoi:
          "Le PDF est un rendu : toute correction se fait dans la source, puis le PDF se régénère et remplace celui-ci. Corriger le PDF à la main ferait diverger les deux.",
      },
    ],
    avantTirage: [
      `La page /guide-ia annonce ${GUIDE_IA_PAGES} pages et six chapitres : une nouvelle édition qui change la pagination fait rougir src/content/__tests__/le-guide-promis-existe.spec.ts, qui recompte le PDF.`,
      "Les pages 5 (l'essentiel en une page) et 9 (l'exercice d'une heure) sont citées dans l'e-mail de confirmation d'un appel : si elles bougent, corriger appel-rappel.tsx.",
    ],
  },
  {
    id: "fiches-reseaux",
    icon: "ClipboardList",
    nom: "Fiches offertes · 3 × 2 pages",
    format: "A4 portrait · 210 × 297 mm · 2 pages chacune, à imprimer",
    resume:
      "Les trois fiches que les publications Instagram et Facebook promettent à qui écrit un mot-clé en message privé : FICHE (le test des 20 minutes), FUITES (les 7 fuites de temps), PLAN (le plan 90 jours). Le lien part dans la réponse automatique de la messagerie.",
    fichiersPublics: [
      {
        chemin: "imprimes/fiche-test-20-minutes-axion-ia.pdf",
        nom: "FICHE — Le test des 20 minutes",
        role: "Promise par la publication Instagram du 25/09 (et du 15/12) et par Facebook. ⚠️ Ne pas renommer : le lien part dans la réponse automatique au mot-clé FICHE.",
      },
      {
        chemin: "imprimes/fiche-7-fuites-de-temps-axion-ia.pdf",
        nom: "FUITES — Les 7 fuites de temps",
        role: "Promise par les publications du 02/11 (Facebook) et du 03/11 (Instagram). ⚠️ Ne pas renommer : le lien part dans la réponse automatique au mot-clé FUITES.",
      },
      {
        chemin: "imprimes/fiche-plan-90-jours-axion-ia.pdf",
        nom: "PLAN — Le plan 90 jours",
        role: "Promise par Facebook en janvier. ⚠️ Ne pas renommer : le lien part dans la réponse automatique au mot-clé PLAN.",
      },
    ],
    fichiersHorsLigne: [
      {
        nom: "La source des fiches",
        ou: "_FICHES-OFFERTES-2026/ (poste de fabrication, hors dépôt)",
        pourquoi:
          "Les PDF sont des rendus : toute correction se fait dans la source (python build.py), puis le PDF remplace celui-ci sous le même nom.",
      },
    ],
    avantTirage: [
      "Les réponses automatiques de la messagerie Instagram/Facebook pointent vers ces trois chemins : un renommage casse la promesse sans que rien ne rougisse.",
    ],
  },
  {
    id: "dossier-intervenant",
    icon: "Mic",
    nom: "Dossier intervenant · 12 pages",
    format: "A4 portrait · 210 × 297 mm · 12 pages, lecture à l'écran et envoi par e-mail",
    resume:
      "Le dossier de conférencier de Williams Jullin pour les organisateurs d'événements : la conférence « L'IA, tout le monde en parle. Personne ne sait par où commencer. Vous, en repartant, vous saurez. », tous les formats d'intervention (conférence, invité, table ronde, café-débat, ciné-débat, ouverture ou clôture, jury, remplacement de dernière minute), les engagements et le contact. Envoyé en pièce jointe quand un organisateur répond « oui ».",
    fichiersPublics: [
      {
        chemin: "imprimes/dossier-intervenant-williams-jullin-axion-ia.pdf",
        nom: "Le PDF, 12 pages",
        role: "À envoyer en pièce jointe à un organisateur qui a répondu, ou à partager par lien (LinkedIn, formulaires d'organisateurs). Jamais dans un premier e-mail de prospection.",
      },
    ],
    fichiersHorsLigne: [
      {
        nom: "dossier-intervenant.html",
        ou: "_INTERVENTIONS-CONFERENCES/pdf/ (hors dépôt)",
        pourquoi:
          "La source HTML du PDF ; se régénère avec render.sh (Chrome headless). Hors dépôt : elle embarque la photo et les polices.",
      },
      {
        nom: "DOSSIER-INTERVENANT-texte-v12.md",
        ou: "_INTERVENTIONS-CONFERENCES/ (hors dépôt)",
        pourquoi: "Le texte de référence, page par page.",
      },
    ],
    avantTirage: [
      "Vérifier qu'aucun numéro de téléphone n'apparaît.",
      "Vérifier la voix : « je » pour Williams conférencier, « nous » pour Axion-IA ; jamais « je conçois / je déploie ».",
      "Vérifier « partout en France, sans distinction » (aucune région prioritaire).",
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

/** Le lien de téléchargement, gardé, d'un fichier interne. */
export function lienFichierInterne(imprimeId: string, fichier: string): string {
  return `/api/admin/imprimes/${encodeURIComponent(imprimeId)}/${encodeURIComponent(fichier)}`;
}

/**
 * La LISTE BLANCHE de la route de téléchargement : rend le fichier interne
 * déclaré sous cet imprimé et ce nom exact, ou `undefined`.
 *
 * Comparaison stricte sur le nom — jamais un préfixe, jamais un chemin
 * normalisé : `../x.pdf` ou `trame-echange-apporteur.pdf/..` ne sont égaux à
 * aucune entrée, et la forme est revérifiée par `FICHIER_INTERNE_VALIDE`.
 */
export function fichierInterneAutorise(
  imprimeId: string,
  fichier: string,
): FichierInterne | undefined {
  if (!FICHIER_INTERNE_VALIDE.test(fichier)) return undefined;
  return imprimeParId(imprimeId)?.fichiersInternes?.find((f) => f.fichier === fichier);
}
