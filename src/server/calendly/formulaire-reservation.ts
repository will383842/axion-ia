/**
 * Validation du formulaire de réservation, côté serveur et sans JavaScript.
 *
 * ## Ce que ce module garantit, et pourquoi ça compte sur un téléphone
 *
 * **1. Rien de ce qui a été saisi n'est perdu.** Chaque refus renvoie les
 * `valeurs` avec les `erreurs`, pour que le formulaire se re-rende rempli. Sans
 * cela, un visiteur au pouce qui se trompe d'un caractère sur son e-mail
 * retaperait tout — et n'irait pas au bout. C'est la première cause d'abandon
 * d'un formulaire mobile, et c'est aussi la plus facile à éviter.
 *
 * **2. Chaque refus dit lequel des champs, et pourquoi.** Un message unique en
 * haut de page oblige à chercher ; sur un écran de téléphone, la zone fautive
 * est souvent déjà hors de vue.
 *
 * **3. Rien n'est tronqué en silence.** La liste d'invités déborde à dix chez
 * Calendly. Le client (`reservation.ts`) coupe à dix pour ne jamais émettre une
 * requête que l'API refuserait — mais si le formulaire laissait passer quinze
 * adresses, les cinq dernières disparaîtraient sans que personne ne l'apprenne.
 * Ici, quinze adresses sont REFUSÉES avec leur compte. La coupe du client
 * devient alors une ceinture qu'on n'atteint jamais.
 *
 * ## Ce que ce module NE garantit pas, délibérément
 *
 * Que le créneau soit encore libre. Il vérifie la forme, l'avenir et l'horizon ;
 * la disponibilité réelle appartient à Calendly, et à personne d'autre. Les
 * créneaux affichés viennent d'un cache de quinze minutes : les valider contre
 * ce cache donnerait une confiance fausse, puisqu'un créneau peut se prendre
 * pendant que le visiteur remplit. L'autorité, c'est le refus de l'API au
 * moment du POST — que `reserverCreneau` sait déjà nommer (`creneau_pris`).
 */

import type { DemandeReservation, FormatDemande } from "./reservation";
import { MAX_INVITES } from "./reservation";
import type { QuestionEventType } from "./questions";

/** Les champs fixes du formulaire. Les questions ajoutent `q0`, `q1`, … */
export const CHAMPS = {
  debut: "debut",
  nom: "nom",
  email: "email",
  format: "format",
  telephone: "telephone",
  fuseau: "fuseau",
  invites: "invites",
  consent: "consent",
} as const;

export type Champ = string;

/** Message d'erreur par champ. La clé est le `name` de l'input. */
export type Erreurs = Readonly<Record<Champ, string>>;

/** Ce que le visiteur a tapé, pour re-remplir le formulaire après un refus. */
export type Valeurs = Readonly<Record<Champ, string>>;

export type ResultatValidation =
  | { readonly ok: true; readonly demande: DemandeReservation; readonly valeurs: Valeurs }
  | { readonly ok: false; readonly erreurs: Erreurs; readonly valeurs: Valeurs };

/**
 * Horizon de réservation, en jours.
 *
 * Aligné sur ce que le sélecteur affiche (`maxDays` de `fetchAvailableSlots`,
 * 31 par défaut), avec un jour de marge pour ne pas refuser un créneau que la
 * page vient de montrer à cheval sur minuit.
 */
export const HORIZON_JOURS = 32;

/**
 * Délai minimal avant un rendez-vous, en minutes.
 *
 * Calendly a son propre préavis, et c'est lui qui fait autorité. Celui-ci ne
 * sert qu'à écarter un `debut` manifestement passé ou imminent avant de
 * consommer un appel réseau.
 */
export const PREAVIS_MINUTES = 15;

/**
 * Fuseaux proposés, dans l'ordre où ils servent.
 *
 * ## Pourquoi une liste, et pas une détection
 *
 * Cette page n'envoie aucun JavaScript — c'est ce qui la rend rapide et
 * fonctionnelle sur un réseau qui vacille. Le prix : le serveur ne peut pas
 * connaître le fuseau du visiteur. Calendly, lui, le détecte dans le navigateur.
 *
 * Trois réponses possibles ; la liste est la moins mauvaise :
 * — figer Europe/Paris ferait recevoir à un visiteur de Montréal une
 *   confirmation à une heure qui n'est pas la sienne, sans qu'il puisse
 *   corriger ;
 * — la liste IANA complète fait plus de quatre cents entrées, illisible au
 *   pouce et lourde dans le HTML ;
 * — une liste courte, ordonnée par usage réel, tient dans un menu natif que le
 *   téléphone rend lui-même, et couvre l'audience francophone.
 *
 * ⚠️ Le champ reste validé au-delà de cette liste (voir `fuseauValide`) : un
 * visiteur qui poste un fuseau IANA légitime absent d'ici est accepté. La liste
 * est une commodité d'affichage, pas une frontière.
 */
export const FUSEAUX_PROPOSES: ReadonlyArray<{ readonly id: string; readonly libelle: string }> = [
  { id: "Europe/Paris", libelle: "France métropolitaine (Paris)" },
  { id: "Europe/Brussels", libelle: "Belgique (Bruxelles)" },
  { id: "Europe/Zurich", libelle: "Suisse (Zurich)" },
  { id: "Europe/Luxembourg", libelle: "Luxembourg" },
  { id: "Europe/London", libelle: "Royaume-Uni (Londres)" },
  { id: "America/Montreal", libelle: "Québec (Montréal)" },
  { id: "Africa/Casablanca", libelle: "Maroc (Casablanca)" },
  { id: "Africa/Tunis", libelle: "Tunisie (Tunis)" },
  { id: "Africa/Algiers", libelle: "Algérie (Alger)" },
  { id: "Africa/Dakar", libelle: "Sénégal (Dakar)" },
  { id: "Africa/Abidjan", libelle: "Côte d'Ivoire (Abidjan)" },
  { id: "Indian/Reunion", libelle: "La Réunion" },
  { id: "America/Guadeloupe", libelle: "Guadeloupe · Martinique" },
  { id: "Pacific/Noumea", libelle: "Nouvelle-Calédonie (Nouméa)" },
  { id: "UTC", libelle: "UTC (temps universel)" },
];

/** Le fuseau retenu quand le visiteur n'en choisit pas. */
export const FUSEAU_DEFAUT = "Europe/Paris";

/**
 * Un fuseau IANA que le moteur sait interpréter.
 *
 * 🔑 On n'apparie PAS sur la liste ci-dessus : elle est courte par choix
 * d'ergonomie, et refuser `Asia/Tokyo` parce qu'il n'y figure pas serait
 * arbitraire. On demande au moteur, qui est l'autorité réelle — et c'est aussi
 * lui que Calendly consultera.
 */
export function fuseauValide(v: string): boolean {
  if (v.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: v }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Le même contrôle d'e-mail que `unified-contact-schema`, pour ne pas diverger. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Le même contrôle de téléphone que `/contact`, indicatif pays obligatoire.
 *
 * 🔑 Recopié à dessein depuis `unified-contact-schema.ts` plutôt qu'importé :
 * les deux formulaires ont des raisons différentes d'exiger un indicatif. Ici
 * c'est le numéro que NOUS composerons, et un numéro sans indicatif est
 * incomposable depuis l'étranger. Là-bas c'est un moyen de rappel. Un jour où
 * l'un des deux s'assouplira, l'autre ne doit pas suivre par accident.
 */
const TELEPHONE = /^(\+|00)[0-9]{1,3}[\s0-9()\-.]{4,28}$/;

/** Sépare une liste d'adresses saisie librement : virgules, points-virgules, retours. */
export function separerLesInvites(brut: string): readonly string[] {
  return brut
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function lire(fd: FormData, nom: string): string {
  const v = fd.get(nom);
  return typeof v === "string" ? v.trim() : "";
}

export interface OptionsValidation {
  readonly questions: readonly QuestionEventType[];
  readonly eventTypeUri: string;
  /** Injectable pour les tests ; l'horloge réelle par défaut. */
  readonly maintenant?: Date;
  readonly utmSource?: string | null;
  readonly utmMedium?: string | null;
  readonly utmCampaign?: string | null;
}

/**
 * Valide la saisie et construit la demande.
 *
 * Ne lève jamais : un formulaire malformé est un cas nominal, pas une
 * exception. Toutes les erreurs sont collectées d'un coup — refuser un champ à
 * la fois ferait recommencer le visiteur autant de fois qu'il y a de fautes.
 */
export function validerFormulaire(fd: FormData, o: OptionsValidation): ResultatValidation {
  const maintenant = o.maintenant ?? new Date();
  const erreurs: Record<string, string> = {};
  const valeurs: Record<string, string> = {};

  // -- Créneau (champ caché : une erreur ici n'est pas une faute du visiteur)
  const debutBrut = lire(fd, CHAMPS.debut);
  valeurs[CHAMPS.debut] = debutBrut;
  const debut = new Date(debutBrut);
  const debutLisible = debutBrut !== "" && !Number.isNaN(debut.getTime());

  // 🔴 LE VERDICT VIENT DE `creneauExploitable`, ET DE LUI SEUL.
  //
  // La première version rejouait la comparaison ici, avec les mêmes constantes.
  // Elle a divergé immédiatement, et sur une seconde : ce code écrivait `<`
  // là où l'autre écrivait `>`, si bien qu'un créneau tombant EXACTEMENT sur le
  // préavis — ou exactement sur l'horizon — était accepté ici et refusé par la
  // page. Effet : un créneau visible au calendrier, sur lequel le formulaire ne
  // s'ouvre jamais. Trouvé par la garde
  // `la-page-et-le-validateur-jugent-pareil.spec.ts`, invisible en relecture.
  //
  // Les branches ci-dessous ne décident donc plus rien : elles choisissent le
  // MESSAGE, ce qui est le seul travail que ce module ait à faire en propre.
  if (!creneauExploitable(debutBrut, maintenant)) {
    erreurs[CHAMPS.debut] = !debutLisible
      ? "Le créneau choisi n'a pas été transmis. Choisissez-en un à nouveau."
      : debut.getTime() <= maintenant.getTime() + PREAVIS_MINUTES * 60_000
        ? // Le cas réel : le visiteur a laissé l'onglet ouvert une nuit.
          "Ce créneau est passé. Choisissez-en un autre."
        : "Ce créneau est trop lointain. Choisissez-en un autre.";
  }

  // -- Identité
  const nom = lire(fd, CHAMPS.nom);
  valeurs[CHAMPS.nom] = nom;
  if (nom.length < 2) erreurs[CHAMPS.nom] = "Indiquez votre nom (2 caractères minimum).";
  else if (nom.length > 80) erreurs[CHAMPS.nom] = "Nom trop long (80 caractères maximum).";

  const email = lire(fd, CHAMPS.email);
  valeurs[CHAMPS.email] = email;
  if (email === "")
    erreurs[CHAMPS.email] = "Indiquez votre e-mail : c'est là que part la confirmation.";
  else if (email.length > 254) erreurs[CHAMPS.email] = "E-mail trop long.";
  else if (!EMAIL.test(email))
    erreurs[CHAMPS.email] = "Cet e-mail semble incomplet (exemple : prenom@entreprise.fr).";

  // -- Format, et le numéro qu'il rend obligatoire
  const formatBrut = lire(fd, CHAMPS.format);
  valeurs[CHAMPS.format] = formatBrut;
  const format: FormatDemande | null =
    formatBrut === "telephone" || formatBrut === "visio" ? formatBrut : null;
  if (!format) erreurs[CHAMPS.format] = "Choisissez comment vous préférez échanger.";

  const telephone = lire(fd, CHAMPS.telephone);
  valeurs[CHAMPS.telephone] = telephone;
  if (format === "telephone") {
    // 🔴 Sans numéro, un appel sortant n'a rien à composer. Calendly accepterait
    // la réservation quand même : le rendez-vous existerait, et personne ne
    // saurait qui appeler avant le jour même.
    if (telephone === "")
      erreurs[CHAMPS.telephone] = "Indiquez le numéro à composer, avec l'indicatif pays.";
    else if (!TELEPHONE.test(telephone))
      erreurs[CHAMPS.telephone] = "Indicatif pays obligatoire (exemple : +33 6 12 34 56 78).";
  }

  // -- Fuseau
  const fuseauBrut = lire(fd, CHAMPS.fuseau);
  const fuseau = fuseauBrut === "" ? FUSEAU_DEFAUT : fuseauBrut;
  valeurs[CHAMPS.fuseau] = fuseau;
  if (!fuseauValide(fuseau)) erreurs[CHAMPS.fuseau] = "Ce fuseau horaire n'est pas reconnu.";

  // -- Invités
  const invitesBrut = fd.get(CHAMPS.invites);
  // 🔑 On garde le texte BRUT, retours à la ligne compris, et non la liste
  // reconstituée : le visiteur doit retrouver sa zone de saisie telle qu'il l'a
  // remplie. Recomposer « a@x, b@x » à partir des adresses lui ferait relire une
  // mise en forme qui n'est pas la sienne.
  const invitesTexte = typeof invitesBrut === "string" ? invitesBrut : "";
  valeurs[CHAMPS.invites] = invitesTexte;
  const invites = separerLesInvites(invitesTexte);
  const invalides = invites.filter((a) => !EMAIL.test(a) || a.length > 254);
  if (invalides.length > 0) {
    erreurs[CHAMPS.invites] =
      invalides.length === 1
        ? `Cette adresse semble incomplète : ${invalides[0]}`
        : `Ces adresses semblent incomplètes : ${invalides.slice(0, 3).join(", ")}${invalides.length > 3 ? "…" : ""}`;
  } else if (invites.length > MAX_INVITES) {
    // 🔑 On REFUSE au lieu de couper. Couper ferait disparaître les dernières
    // adresses sans le dire, et le visiteur croirait les avoir invitées.
    erreurs[CHAMPS.invites] =
      `Calendly accepte ${MAX_INVITES} invités au maximum, vous en avez indiqué ${invites.length}. Retirez-en ${invites.length - MAX_INVITES}.`;
  }

  // -- Questions de l'event-type
  const reponses: Array<{ question: string; reponse: string; position: number }> = [];
  for (const q of o.questions) {
    const valeur = lire(fd, q.champ);
    valeurs[q.champ] = valeur;
    if (valeur === "") {
      if (q.requise) erreurs[q.champ] = "Cette réponse est nécessaire.";
      // Une question facultative sans réponse ne part PAS : envoyer une chaîne
      // vide écrirait « (vide) » dans le récapitulatif reçu par Will.
      continue;
    }
    if (valeur.length > 10_000) {
      erreurs[q.champ] = "Réponse trop longue.";
      continue;
    }
    // 🔑 Un menu déroulant se valide contre ses choix : le HTML d'un `<select>`
    // se réécrit en deux secondes, et une valeur hors liste passerait chez
    // Calendly sans jamais correspondre à rien.
    if (q.type === "single_select" && !q.choix.includes(valeur) && !q.autreAutorise) {
      erreurs[q.champ] = "Choisissez une des réponses proposées.";
      continue;
    }
    reponses.push({ question: q.libelle, reponse: valeur, position: q.position });
  }

  // -- Consentement
  const consent = lire(fd, CHAMPS.consent);
  valeurs[CHAMPS.consent] = consent;
  if (consent !== "on" && consent !== "true") {
    erreurs[CHAMPS.consent] = "Votre accord est nécessaire pour enregistrer ce rendez-vous.";
  }

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs, valeurs };

  // À ce point tout est validé — les assertions ci-dessous sont des faits
  // établis par les branches précédentes, pas des espoirs.
  return {
    ok: true,
    valeurs,
    demande: {
      eventTypeUri: o.eventTypeUri,
      debut,
      nom,
      email,
      fuseau,
      format: format as FormatDemande,
      ...(format === "telephone" ? { telephone } : {}),
      ...(reponses.length > 0 ? { reponses } : {}),
      ...(invites.length > 0 ? { invites } : {}),
      utmSource: o.utmSource ?? null,
      utmMedium: o.utmMedium ?? null,
      utmCampaign: o.utmCampaign ?? null,
    },
  };
}

/**
 * Ce créneau vaut-il qu'on affiche un formulaire pour lui ?
 *
 * ## Pourquoi une fonction, et pas trois lignes dans la page
 *
 * Deux raisons, la seconde inattendue :
 *
 * 1. La page ET l'action doivent porter le MÊME jugement. Si la page acceptait
 *    un créneau que l'action refuse, le visiteur remplirait un formulaire
 *    condamné d'avance — et découvrirait le refus après avoir tout saisi.
 * 2. Le compilateur React interdit d'appeler `Date.now()` pendant un rendu, à
 *    juste titre : une valeur impure rend le rendu non reproductible. Recevoir
 *    l'instant en paramètre lève l'objection ET rend la règle éprouvable sans
 *    manipuler l'horloge.
 */
export function creneauExploitable(debutIso: string, maintenant: Date): boolean {
  if (debutIso === "") return false;
  const d = new Date(debutIso);
  if (Number.isNaN(d.getTime())) return false;
  const t = maintenant.getTime();
  return d.getTime() > t + PREAVIS_MINUTES * 60_000 && d.getTime() < t + HORIZON_JOURS * 86_400_000;
}

/**
 * Le formulaire de réservation directe est-il actif ?
 *
 * ## Pourquoi un drapeau, et pourquoi UNE SEULE lecture
 *
 * Tant qu'il est éteint, cliquer un créneau ouvre la page Calendly, exactement
 * comme avant. Allumé, le clic reste chez nous. Le basculement se fait par une
 * variable d'environnement Coolify, sans redéploiement de code — donc
 * réversible en une minute si quelque chose se passe mal en production.
 *
 * 🔑 Le sélecteur de créneaux et la page de réservation lisent TOUS DEUX cette
 * fonction. Deux lectures indépendantes du même drapeau finiraient par
 * diverger, et la divergence serait muette dans le pire sens : des liens qui
 * pointent vers un formulaire éteint, c'est-à-dire un cul-de-sac au milieu du
 * seul entonnoir du site.
 */
export function reservationDirecteActive(): boolean {
  return process.env.RESERVATION_DIRECTE_ACTIVE === "true";
}

/**
 * L'adresse de notre formulaire pour un créneau donné.
 *
 * ⚠️ Le créneau est la SEULE chose qui voyage dans l'URL, et c'est volontaire :
 * un instant n'est pas une donnée personnelle. Rien de ce que le visiteur
 * saisira ensuite n'y passera — voir `reprise-formulaire.ts`.
 */
export function urlDuFormulaire(locale: string, debutIso: string): string {
  return `/${locale}/appel/reserver?debut=${encodeURIComponent(debutIso)}`;
}
