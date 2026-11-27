/**
 * Changement d'IBAN d'un apporteur après la signature : les RÈGLES PURES (lot 1 du plan
 * `docs/plans/apporteurs-changement-iban-2026-11-25.md`).
 *
 * Aucun accès à la base, à l'horloge ni à l'environnement : tout instant est PASSÉ en
 * paramètre, ce qui permet de tester chaque borne. Ce module peut être chargé par le worker
 * comme par l'application (pas de `server-only`).
 *
 * ⛔ Rien ici ne reçoit ni ne rend un IBAN entier, sauf `quatreDerniersCaracteres`, qui reçoit
 * l'IBAN à l'entrée (côté serveur, au moment de la demande) et n'en rend que la fin. Les
 * constantes de délai sont ISOLÉES : une valeur de plan, jamais recopiée ailleurs.
 */

/** Les sept états d'une demande (texte contraint par CHECK en base, aucune énumération Postgres). */
export const STATUTS_CHANGEMENT_IBAN = [
  "a_confirmer",
  "confirmee",
  "validee",
  "refusee",
  "opposee",
  "annulee",
  "expiree",
] as const;
export type StatutChangementIban = (typeof STATUTS_CHANGEMENT_IBAN)[number];

const MINUTE_MS = 60_000;
const HEURE_MS = 60 * MINUTE_MS;
const JOUR_MS = 24 * HEURE_MS;

/** La demande non confirmée expire au-delà de 24 heures (et le lien de confirmation avec elle). */
export const DELAI_CONFIRMATION_MS = 24 * HEURE_MS;
/** Délai d'opposition : la validation est refusée avant 72 heures après la confirmation (D-1). */
export const DELAI_OPPOSITION_MS = 72 * HEURE_MS;
/** Une demande confirmée sans décision passe en rouge, et l'alerte interne part, après 10 jours. */
export const DELAI_ALERTE_SANS_DECISION_MS = 10 * JOUR_MS;
/** Pendant 10 jours après une validation, « Virement fait » demande sur quel compte le virement est parti. */
export const DELAI_CHOIX_DU_COMPTE_MS = 10 * JOUR_MS;
/** Fenêtre de la limite « trois demandes au plus » : 30 jours glissants. */
export const FENETRE_LIMITE_DEMANDES_MS = 30 * JOUR_MS;
export const MAX_DEMANDES_PAR_FENETRE = 3;
/** Alerte sur la plus proche échéance de virement : à 5 jours ou moins (J-5, plan §4.2). */
export const ALERTE_ECHEANCE_JOURS = 5;
/** Un numéro de téléphone modifié depuis moins de 30 jours s'affiche en orange (plan §2.5 bis). */
export const FENETRE_NUMERO_MODIFIE_MS = 30 * JOUR_MS;

/**
 * Les limites de débit (plan §2.2, point 9). Chaque entrée : nombre d'essais et durée de la
 * fenêtre en secondes. Toutes sont « fermées en cas de panne » (`surPanne: "refuser"`), ce que
 * le lot 4 pose à l'appel. Les clés sont des gabarits : `<ip>` est l'IP HACHÉE, jamais l'IP.
 */
export const LIMITES_DE_DEBIT = {
  demandeParIp: { cle: "apporteur:iban:demande:ip:<ip>", essais: 5, fenetreSecondes: 3600 },
  demandeParApporteur: {
    cle: "apporteur:iban:demande:apporteur:<id>",
    essais: 3,
    fenetreSecondes: 86_400,
  },
  confirmerParIp: { cle: "apporteur:iban:confirmer:ip:<ip>", essais: 10, fenetreSecondes: 900 },
  bloquerParIp: { cle: "apporteur:iban:bloquer:ip:<ip>", essais: 10, fenetreSecondes: 900 },
  bloquerParDemande: {
    cle: "apporteur:iban:bloquer:demande:<id>",
    essais: 5,
    fenetreSecondes: 86_400,
  },
  annulerParIp: { cle: "apporteur:iban:annuler:ip:<ip>", essais: 10, fenetreSecondes: 900 },
} as const;

/**
 * Les transitions permises. Elles DOUBLENT le déclencheur SQL de la migration
 * (`apporteur_changements_iban_garde_update`) : un test compare les deux.
 *
 * - `a_confirmer` : confirmée par l'apporteur, opposée, annulée, ou expirée (écrite).
 * - `confirmee` : validée ou refusée par le `super_admin`, opposée, annulée par l'apporteur.
 * - tout le reste est FINAL : une demande décidée ne bouge plus.
 */
export const TRANSITIONS_CHANGEMENT_IBAN: Readonly<
  Record<StatutChangementIban, ReadonlyArray<StatutChangementIban>>
> = {
  a_confirmer: ["confirmee", "opposee", "annulee", "expiree"],
  confirmee: ["validee", "refusee", "opposee", "annulee"],
  validee: [],
  refusee: [],
  opposee: [],
  annulee: [],
  expiree: [],
};

export function transitionPermise(de: StatutChangementIban, vers: StatutChangementIban): boolean {
  return TRANSITIONS_CHANGEMENT_IBAN[de].includes(vers);
}

/** Une demande ouverte : celle que l'index unique partiel compte (une seule par apporteur). */
export function estOuverte(statut: StatutChangementIban): boolean {
  return statut === "a_confirmer" || statut === "confirmee";
}

/**
 * Les virements de l'apporteur sont GELÉS tant qu'une demande est ouverte (règle du dirigeant,
 * plan §4.2). Calculé à la lecture : rien n'est écrit, rien à défaire. Une demande `a_confirmer`
 * expirée (non encore écrite `expiree`) ne gèle plus : voir `gelActif`.
 */
export function gelActif(
  demande: { statut: StatutChangementIban; demandeeAt: Date } | null,
  maintenant: Date,
): boolean {
  if (demande === null) return false;
  if (!estOuverte(demande.statut)) return false;
  return !confirmationExpiree(demande, maintenant);
}

/**
 * Une demande `a_confirmer` de PLUS de 24 heures est expirée (strictement : à 24 h pile elle vit
 * encore, comme l'écriture conditionnelle `demandee_at < maintenant - 24 h`). Une demande
 * confirmée n'expire jamais seule : l'administrateur décide.
 */
export function confirmationExpiree(
  demande: { statut: StatutChangementIban; demandeeAt: Date },
  maintenant: Date,
): boolean {
  if (demande.statut !== "a_confirmer") return false;
  return demande.demandeeAt.getTime() < maintenant.getTime() - DELAI_CONFIRMATION_MS;
}

/**
 * Le seuil de l'écriture conditionnelle « expirer avant d'insérer » (plan §3.1) : toute demande `a_confirmer`
 * dont `demandee_at` est STRICTEMENT antérieure à ce seuil passe à `expiree`. Source unique du `WHERE` du lot 4.
 */
export function seuilExpiration(maintenant: Date): Date {
  return new Date(maintenant.getTime() - DELAI_CONFIRMATION_MS);
}

/** Date limite de la confirmation par lien (signée dans le lien : la même borne que l'expiration). */
export function echeanceConfirmation(demandeeAt: Date): Date {
  return new Date(demandeeAt.getTime() + DELAI_CONFIRMATION_MS);
}

/** Premier instant où la validation est permise : 72 heures après la confirmation, à la milliseconde. */
export function validationPermiseA(confirmeeAt: Date): Date {
  return new Date(confirmeeAt.getTime() + DELAI_OPPOSITION_MS);
}

/** À 71 h 59 : faux. À 72 h pile : vrai. */
export function delaiOppositionEcoule(confirmeeAt: Date, maintenant: Date): boolean {
  return maintenant.getTime() >= validationPermiseA(confirmeeAt).getTime();
}

/** Demande confirmée depuis 10 jours ou plus, sans décision : rouge en console, alerte interne. */
export function decisionEnRetard(
  demande: { statut: StatutChangementIban; confirmeeAt: Date | null },
  maintenant: Date,
): boolean {
  if (demande.statut !== "confirmee" || demande.confirmeeAt === null) return false;
  return maintenant.getTime() >= demande.confirmeeAt.getTime() + DELAI_ALERTE_SANS_DECISION_MS;
}

/**
 * Le plafond de demandes : trois au plus sur 30 jours glissants, toutes issues confondues
 * (une demande opposée ou refusée compte : c'est ce qui borne l'abus du gel, plan §4.2).
 * Une demande plus ancienne que 30 jours (strictement) ne compte plus.
 */
export function demandePermiseSurLaFenetre(
  datesDesDemandes: ReadonlyArray<Date>,
  maintenant: Date,
): boolean {
  const debut = maintenant.getTime() - FENETRE_LIMITE_DEMANDES_MS;
  const recentes = datesDesDemandes.filter((d) => d.getTime() > debut).length;
  return recentes < MAX_DEMANDES_PAR_FENETRE;
}

/**
 * Une validation de moins de 10 jours : le formulaire « Virement fait » demande sur quel compte
 * le virement est parti (le virement a pu partir de la banque avant la validation).
 */
export function choixDuCompteDemande(valideeAt: Date | null, maintenant: Date): boolean {
  if (valideeAt === null) return false;
  return maintenant.getTime() < valideeAt.getTime() + DELAI_CHOIX_DU_COMPTE_MS;
}

/** « fr76 3000 … » → « FR763000… » (même règle que `ibanNormalise`, recopiée pour rester pur). */
function normaliser(brut: string): string {
  return brut.replace(/\s+/g, "").toUpperCase();
}

/**
 * Les quatre derniers caractères de l'IBAN normalisé (rien si l'IBAN est trop court pour que
 * quatre caractères n'en soient qu'une fin). C'est la SEULE partie d'IBAN qui s'affiche, se
 * journalise ou s'écrit dans un e-mail.
 */
export function quatreDerniersCaracteres(iban: string): string | null {
  const n = normaliser(iban);
  if (n.length < 15) return null;
  const fin = n.slice(-4);
  // La base exige `^[A-Z0-9]{4}$` : une fin portant « - » ou « . » est refusée ici, pas par une erreur 500.
  return /^[A-Z0-9]{4}$/.test(fin) ? fin : null;
}

/** « se termine par 1234 » : la seule forme d'un compte à l'écran, dans une alerte ou un e-mail. */
export function compteMasque(fin4: string | null | undefined): string {
  if (!fin4 || !/^[A-Z0-9]{4}$/.test(fin4)) return "compte non renseigné";
  return `se termine par ${fin4}`;
}

/**
 * « jeanne.martin@exemple.fr » → « j•••@exemple.fr ». Assez pour reconnaître son adresse,
 * pas assez pour la lire ; jamais d'adresse entière dans une réponse ni un journal.
 */
export function masquerAdresse(email: string): string {
  const [local = "", domaine = ""] = email.trim().split("@");
  if (local === "" || domaine === "") return "•••";
  return `${local.slice(0, 1)}•••@${domaine}`;
}

/**
 * Un numéro modifié depuis moins de 30 jours s'affiche en orange (plan §2.5 bis) : l'administrateur
 * confirme alors par un autre moyen. `modifieLe` nul : jamais modifié depuis la signature.
 */
export function numeroRecemmentModifie(modifieLe: Date | null, maintenant: Date): boolean {
  if (modifieLe === null) return false;
  return maintenant.getTime() - modifieLe.getTime() < FENETRE_NUMERO_MODIFIE_MS;
}
