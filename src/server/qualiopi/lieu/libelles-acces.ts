/**
 * Qualiopi — Les mots du bloc « accès » se DÉRIVENT de la modalité.
 *
 * Fonctions PURES (aucun I/O). Partagées par le formulaire de création de
 * session et par la correction depuis la fiche : une seule définition, sinon
 * une session créée et une session corrigée ne décrivent pas le même objet.
 *
 * ## Le défaut que ce module ferme
 *
 * Recette du 2026-09-04, session AXI-SESS-2026-001, modalité « Distanciel ».
 * Les champs adresse / code postal / ville / salle disparaissent bien — la
 * conditionnelle est propre. Mais TROIS libellés restaient ceux du présentiel :
 *
 *   · « CONTACT SUR PLACE (NOM) » et « CONTACT SUR PLACE (TÉLÉPHONE) »
 *   · « CONSIGNES D'ACCÈS POUR LE FORMATEUR »
 *   · l'aide : « Envoyé au formateur 7 jours avant et la veille, avec
 *     l'adresse, la salle et le contact » — il n'y a ni adresse ni salle.
 *
 * C'est le MÊME défaut que celui corrigé dans l'alerte
 * `session_contact_sur_place_absent` (#980) : le message et le titre de
 * l'alerte ont été rendus par modalité, le FORMULAIRE qui alimente ces champs
 * ne l'a pas été. La correction s'était arrêtée à l'écran de SORTIE sans
 * remonter à l'écran de SAISIE. Le vocabulaire vient donc de là, mot pour mot :
 * « personne à joindre » en visio, « contact sur place » sur site.
 *
 * ## Pourquoi une fonction, et pas trois ternaires dans le JSX
 *
 * Parce que le défaut d'origine était précisément qu'une seule chaîne sur trois
 * avait été dérivée. Trois ternaires côte à côte se corrigent une par une, et
 * on en oublie une ; un objet unique se corrige d'un bloc, et une garde peut
 * exiger que TOUTES ses chaînes bougent avec la modalité.
 */

import type { LieuTypeValue } from "@/server/qualiopi/lieu/format-lieu";

/** Valeurs de l'enum Prisma `Modalite` (miroir, sans import du client). */
export type ModaliteValue = "presentiel" | "distanciel" | "hybride";

/** Les cinq chaînes du bloc « accès ». Toutes dérivées, aucune en dur. */
export interface LibellesAcces {
  readonly contactNom: string;
  readonly contactTelephone: string;
  readonly consignes: string;
  readonly consignesPlaceholder: string;
  /** Sous les consignes : dit ce qui part au formateur, et QUAND. */
  readonly aide: string;
}

/**
 * Comment on rejoint la prestation, du point de vue du FORMATEUR.
 *
 * `lieuType` seul ne suffit pas : l'hybride se tient dans une salle ET en
 * visio, et l'enum `LieuType` ne porte aucune valeur qui dise « les deux ».
 * C'est la modalité qui tranche — comme dans `LieuFieldset`.
 */
export type ManiereDEntrer = "porte" | "lien" | "les_deux";

export function maniereDEntrer(
  lieuType: LieuTypeValue | "" | null | undefined,
  modalite: ModaliteValue | null | undefined,
): ManiereDEntrer {
  if (modalite === "hybride") return "les_deux";
  if (modalite === "distanciel") return "lien";
  if (lieuType === "distanciel") return "lien";
  return "porte";
}

const AIDE_QUAND = "Envoyé au formateur 7 jours avant et la veille";
const AIDE_JAMAIS = "Jamais imprimé sur les documents du client.";

/**
 * Les cinq chaînes du bloc « accès », pour une modalité donnée.
 *
 * ⚠️ Contrat gardé par `libelles-acces.spec.ts` : les cinq chaînes doivent
 * TOUTES différer d'une manière d'entrer à l'autre. Une seule qui resterait
 * commune serait la réapparition exacte du défaut de 2026-09-04.
 */
export function libellesAcces(
  lieuType: LieuTypeValue | "" | null | undefined,
  modalite: ModaliteValue | null | undefined,
): LibellesAcces {
  switch (maniereDEntrer(lieuType, modalite)) {
    case "lien":
      // En visio il n'y a pas de porte. Ce qui manque n'est pas le même
      // manque : sur site on ne peut pas ENTRER, à distance on n'a personne à
      // JOINDRE si le lien ne s'ouvre pas.
      return {
        contactNom: "Personne à joindre (nom)",
        contactTelephone: "Personne à joindre (téléphone)",
        consignes: "Informations de connexion pour le formateur",
        consignesPlaceholder:
          "Salle d'attente à activer, code de la réunion, à quelle heure se connecter, quoi faire si le lien ne s'ouvre pas…",
        aide: `${AIDE_QUAND}, avec le lien de connexion et la personne à joindre. ${AIDE_JAMAIS}`,
      };
    case "les_deux":
      // Hybride : le formateur a une salle À TENIR et des participants à
      // distance à accueillir. Les deux blocs comptent, et la phrase doit le
      // dire — sinon il prépare l'un et découvre l'autre le jour même.
      return {
        contactNom: "Contact sur place ou à joindre (nom)",
        contactTelephone: "Contact sur place ou à joindre (téléphone)",
        consignes: "Consignes d'accès et de connexion pour le formateur",
        consignesPlaceholder:
          "Badge à l'accueil, étage et salle, ET côté visio : salle d'attente, code de la réunion, qui accueille les participants à distance…",
        aide: `${AIDE_QUAND}, avec l'adresse, la salle, le lien de connexion et le contact. ${AIDE_JAMAIS}`,
      };
    case "porte":
      return {
        contactNom: "Contact sur place (nom)",
        contactTelephone: "Contact sur place (téléphone)",
        consignes: "Consignes d'accès pour le formateur",
        consignesPlaceholder:
          "Badge à retirer à l'accueil, parking visiteurs, étage, code de la porte, heure d'arrivée conseillée…",
        aide: `${AIDE_QUAND}, avec l'adresse, la salle et le contact sur place. ${AIDE_JAMAIS}`,
      };
  }
}

/**
 * La modalité et le type de lieu peuvent se CONTREDIRE, et rien ne le disait.
 *
 * 🔴 Constat du 2026-09-04 : la modalité n'était modifiable NULLE PART après la
 * création, alors que le formulaire de lieu, lui, permettait déjà de passer de
 * « distanciel » à « nos locaux ». On pouvait donc obtenir une session
 * `modalite = distanciel` **et** `lieuType = nos_locaux` — deux affirmations
 * contradictoires sur la même prestation, qu'aucun écran ne signalait. C'est
 * exactement l'état dans lequel AXI-SESS-2026-001 s'est retrouvée.
 *
 * Ce n'est pas un défaut d'esthétique : ces deux champs décident ensemble de ce
 * que la CONVENTION imprime et de ce que la CONVOCATION promet. Une convention
 * qui annonce une salle pour une formation qui se tient en visio est une pièce
 * fausse au sens du contrôle.
 *
 * Renvoie la phrase à afficher, ou `null` si les deux se tiennent.
 */
export function incoherenceModaliteLieu(
  lieuType: LieuTypeValue | "" | null | undefined,
  modalite: ModaliteValue | null | undefined,
): string | null {
  if (modalite === "hybride") {
    // L'hybride est le seul cas où les deux blocs coexistent sans se
    // contredire : n'importe quel `lieuType` est recevable.
    return null;
  }
  if (
    modalite === "distanciel" &&
    lieuType !== "distanciel" &&
    lieuType !== "" &&
    lieuType != null
  ) {
    return (
      "La session est déclarée « à distance » mais son lieu est renseigné comme un lieu physique. " +
      "La convention imprimerait une adresse pour une formation qui se tient en visio. " +
      "Corrigez l'un des deux."
    );
  }
  if (modalite === "presentiel" && lieuType === "distanciel") {
    return (
      "La session est déclarée « en présentiel » mais son lieu est « Distanciel (visioconférence) ». " +
      "La convocation ne donnerait ni adresse ni salle. Corrigez l'un des deux."
    );
  }
  return null;
}
