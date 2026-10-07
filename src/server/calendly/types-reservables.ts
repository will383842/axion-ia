// Les QUATRE rendez-vous que le site sait réserver lui-même — une seule table.
//
// Chantier « parcours sur mesure pour les quatre types » (2026-10-05, ordre de
// Will). Jusqu'ici le parcours maison (`/appel` → créneaux → formulaire →
// confirmation → report → annulation) ne servait que deux types, le diagnostic et
// l'échange projet. Les deux autres — l'échange apporteur et la rencontre au salon
// — renvoyaient vers la page Calendly brute.
//
// ── Pourquoi UNE TABLE, et pas quatre pages ───────────────────────────────
// Tout ce qui diffère d'un type à l'autre tient ici : l'adresse chez Calendly, le
// segment d'URL sur notre site, le type classé en base, les libellés, et les
// formats d'échange possibles. Le reste du parcours (créneaux, formulaire,
// confirmation, report, annulation) est le MÊME code, qui lit cette table. Un
// cinquième type se règle ici, en une entrée.
//
// ── Ce que la table affirme, et ce qu'elle laisse à Calendly ──────────────
// · Les QUESTIONS du formulaire ne sont écrites nulle part : elles sont lues chez
//   Calendly (`questions.ts`). Aucun libellé de question dans ce fichier.
// · Les DURÉES ne sont écrites nulle part : elles viennent de la même réponse
//   d'API que les créneaux (`dureeMinutes`).
// · Les FORMATS d'échange (visio, téléphone, sur place) sont ici des CANDIDATS :
//   quand Calendly dit quels lieux l'événement propose (`locations`), la
//   réservation retient l'intersection (`formatsProposes`) ; quand il ne le dit
//   pas, les candidats font foi. Voir cette fonction pour le détail.
//
// Module NEUTRE (ni `server-only`, ni Next) : le worker et les tests l'importent.

import type { FormatDemande } from "@/server/calendly/reservation";
import {
  URL_CALENDLY_APPEL_PAR_DEFAUT,
  URL_CALENDLY_APPORTEUR_PAR_DEFAUT,
  URL_CALENDLY_DIAGNOSTIC_PAR_DEFAUT,
  URL_CALENDLY_SALON_PAR_DEFAUT,
} from "@/server/calendly/urls-par-defaut";
// Import de TYPE seulement (effacé à la compilation) : aucun cycle à l'exécution.
import type { TypeRendezVous } from "@/server/calendly/type-rendez-vous";

/** Les quatre rendez-vous réservables sur le site. */
export const CHOIX_RENDEZ_VOUS = ["diagnostic", "projet", "apporteur", "salon"] as const;
export type ChoixRendezVous = (typeof CHOIX_RENDEZ_VOUS)[number];

/**
 * Les deux rendez-vous OFFERTS AU PUBLIC sur l'écran du choix de `/appel`.
 * L'échange apporteur et la rencontre au salon sont « En privé » chez Calendly :
 * on ne les liste jamais, on ne les atteint que par leur adresse.
 */
export const CHOIX_PUBLICS = ["diagnostic", "projet"] as const;
export type ChoixPublic = (typeof CHOIX_PUBLICS)[number];

export interface ConfigRendezVous {
  readonly choix: ChoixRendezVous;
  /** Segment d'URL : `/fr/appel/<route>`. */
  readonly route: string;
  /** Le type classé en base (`TypeRendezVous`) pour ce rendez-vous. */
  readonly type: TypeRendezVous;
  /** Listé sur l'écran du choix ? Faux = lien privé. */
  readonly public: boolean;
  /** Le nom du rendez-vous, tel qu'on le dit au visiteur. */
  readonly nom: string;
  /** Le titre de la page du calendrier. */
  readonly titre: string;
  /** Ce que l'on promet côté prix et engagement — jamais plus que ce qui est vrai. */
  readonly promesse: string;
  /** Étape 1 du « Comment ça marche » : le créneau, et le format annoncé AVANT le clic. */
  readonly premiereEtape: string;
  /** Étape 2 : ce que le visiteur reçoit après la réservation — ce que le code envoie vraiment. */
  readonly deuxiemeEtape: string;
  /** Étape 3 : ce que l'on fait pendant le rendez-vous. */
  readonly troisiemeEtape: string;
  /** Les formats d'échange CANDIDATS, dans l'ordre où le formulaire les propose. */
  readonly formats: readonly FormatDemande[];
  /** L'adresse chez Calendly quand aucune variable ne la fixe. */
  readonly urlParDefaut: string;
  /** La variable d'environnement qui la fixe — pour la documentation et les messages. */
  readonly variable: string;
}

/**
 * ⚠️ Chaque variable est lue par un accès STATIQUE (`process.env.X`), jamais par
 * `process.env[nom]` : Next ne remplace que les accès littéraux des variables
 * `NEXT_PUBLIC_*`, et le comportement des deux types existants ne doit pas bouger.
 */
function varDiagnostic(): string | undefined {
  return process.env.NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL;
}
function varProjet(): string | undefined {
  return process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL;
}
function varApporteur(): string | undefined {
  return process.env.CALENDLY_APPORTEUR_URL;
}
function varSalon(): string | undefined {
  return process.env.CALENDLY_SALON_URL;
}

const LECTURE_DE_LA_VARIABLE: Readonly<Record<ChoixRendezVous, () => string | undefined>> = {
  diagnostic: varDiagnostic,
  projet: varProjet,
  apporteur: varApporteur,
  salon: varSalon,
};

// 🔴 Le CHOIX DU FORMAT s'annonce à l'étape 1, et pas ailleurs : c'est le moment où
// l'on s'apprête à cliquer (chantier visio B5, Will 28/09 : Google Meet seulement).
const PREMIERE_ETAPE_VISIO =
  "Choisissez un créneau : le rendez-vous se tient en visioconférence Google Meet.";

// ⚠️ Alignée sur ce que le code envoie vraiment (`rappels-appel.ts`) : la
// confirmation dans la minute, puis les rappels J-1 et H-1.
const CONFIRMATION_CLIENT =
  "Vous recevez notre confirmation dans la minute, l'invitation d'agenda séparément, puis un rappel la veille et une heure avant.";

export const TYPES_RESERVABLES: Readonly<Record<ChoixRendezVous, ConfigRendezVous>> = {
  diagnostic: {
    choix: "diagnostic",
    route: "diagnostic",
    type: "diagnostic",
    public: true,
    nom: "Diagnostic IA",
    titre: "Votre diagnostic IA",
    promesse: "Gratuit et sans engagement",
    premiereEtape: PREMIERE_ETAPE_VISIO,
    deuxiemeEtape: CONFIRMATION_CLIENT,
    troisiemeEtape:
      "Quelques questions sur votre activité, et vous repartez avec des pistes concrètes.",
    formats: ["visio", "telephone"],
    urlParDefaut: URL_CALENDLY_DIAGNOSTIC_PAR_DEFAUT,
    variable: "NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL",
  },
  projet: {
    choix: "projet",
    route: "echange-projet",
    type: "echange_projet",
    public: true,
    nom: "Échange projet",
    titre: "Votre échange projet",
    promesse: "Gratuit et sans engagement",
    premiereEtape: PREMIERE_ETAPE_VISIO,
    deuxiemeEtape: CONFIRMATION_CLIENT,
    troisiemeEtape: "On discute de votre projet ou tout autre besoin de renseignements.",
    formats: ["visio", "telephone"],
    urlParDefaut: URL_CALENDLY_APPEL_PAR_DEFAUT,
    variable: "NEXT_PUBLIC_CALENDLY_APPEL_URL",
  },
  apporteur: {
    choix: "apporteur",
    route: "apporteur",
    type: "apporteur",
    public: false,
    nom: "Échange apporteur d'affaires",
    titre: "Votre échange apporteur d'affaires",
    promesse: "Sans engagement",
    premiereEtape: PREMIERE_ETAPE_VISIO,
    // Un échange apporteur n'est pas un appel CLIENT, mais il reçoit la même
    // séquence avec ses propres gabarits : confirmation, J-1, H-1 (`rappels-appel.ts`,
    // passes `apporteur-echange-*`).
    deuxiemeEtape: CONFIRMATION_CLIENT,
    troisiemeEtape:
      "Nous faisons connaissance et nous répondons à vos questions sur le réseau d'apporteurs d'affaires.",
    // Décision de Will (2026-09-21) : l'échange se fait en visio, Google Meet.
    formats: ["visio"],
    urlParDefaut: URL_CALENDLY_APPORTEUR_PAR_DEFAUT,
    variable: "CALENDLY_APPORTEUR_URL",
  },
  salon: {
    choix: "salon",
    route: "salon-gofab",
    type: "salon",
    public: false,
    nom: "Rencontre au salon GOFAB",
    titre: "Votre rencontre au salon GOFAB",
    promesse: "Sans engagement",
    premiereEtape: "Choisissez un créneau : la rencontre a lieu sur place, au salon.",
    // Le salon reçoit nos propres messages : confirmation, puis rappels J-2 et J-1 —
    // et PAS de H-1 : une heure avant, on est déjà sur place (`rappels-appel.ts`,
    // passes `rdv-salon-*`).
    deuxiemeEtape:
      "Vous recevez notre confirmation dans la minute, avec le lieu, puis un rappel deux jours avant et un la veille.",
    troisiemeEtape:
      "Nous nous retrouvons au salon pour échanger sur votre activité et sur vos besoins.",
    formats: ["sur_place"],
    urlParDefaut: URL_CALENDLY_SALON_PAR_DEFAUT,
    variable: "CALENDLY_SALON_URL",
  },
};

/** Le descriptif d'un choix. */
export function configDuChoix(choix: ChoixRendezVous): ConfigRendezVous {
  return TYPES_RESERVABLES[choix];
}

/** Vrai si la valeur est l'un des quatre choix. */
export function estUnChoix(valeur: unknown): valeur is ChoixRendezVous {
  return typeof valeur === "string" && (CHOIX_RENDEZ_VOUS as readonly string[]).includes(valeur);
}

/** Le choix qui porte ce segment d'URL (`salon-gofab` → `salon`), `null` sinon. */
export function choixDeLaRoute(segment: unknown): ChoixRendezVous | null {
  if (typeof segment !== "string") return null;
  const s = segment.trim().toLowerCase();
  return CHOIX_RENDEZ_VOUS.find((c) => TYPES_RESERVABLES[c].route === s) ?? null;
}

/** Le choix qui correspond à un type classé en base, `null` pour `autre`. */
export function choixDuTypeRendezVous(type: unknown): ChoixRendezVous | null {
  return CHOIX_RENDEZ_VOUS.find((c) => TYPES_RESERVABLES[c].type === type) ?? null;
}

/** Ce choix est-il listé sur l'écran public ? */
export function estUnChoixPublic(choix: ChoixRendezVous): choix is ChoixPublic {
  return TYPES_RESERVABLES[choix].public;
}

/** L'adresse chez Calendly : la variable si elle est posée, sinon le défaut. */
export function urlConfigureeDuChoix(choix: ChoixRendezVous): string {
  const v = LECTURE_DE_LA_VARIABLE[choix]()?.trim();
  return v ? v : TYPES_RESERVABLES[choix].urlParDefaut;
}

// ── Les formats ────────────────────────────────────────────────────────────

/**
 * Les formats RÉELLEMENT proposés au visiteur pour ce rendez-vous.
 *
 * 1. Calendly ne dit rien (`offerts` nul) → les candidats de la table.
 * 2. Calendly dit ses lieux → l'intersection avec les candidats, dans l'ordre de
 *    la table : un format que l'événement ne propose pas n'est jamais offert.
 * 3. Intersection VIDE → ce que l'événement propose vraiment. Le formulaire reste
 *    utilisable, et la relecture du lieu (`lieuConforme`) garde le dernier mot.
 *
 * 🔑 UNE SEULE FONCTION, appelée par la page du formulaire ET par l'action qui
 * l'envoie : si les deux jugeaient différemment, le visiteur choisirait un format
 * que le serveur refuserait après coup.
 */
export function formatsProposes(
  choix: ChoixRendezVous,
  offerts: readonly FormatDemande[] | null | undefined,
): readonly FormatDemande[] {
  const candidats = TYPES_RESERVABLES[choix].formats;
  if (!offerts || offerts.length === 0) return candidats;
  const commun = candidats.filter((f) => offerts.includes(f));
  return commun.length > 0 ? commun : offerts;
}
