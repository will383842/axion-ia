// Constantes de l'extension — RECOPIÉES du contrat v1 (`contrat.json`, généré
// depuis `src/lib/schemas/enregistreur.ts`). Le test
// `les-delais-locaux-suivent-la-constante` compare chaque valeur au contrat :
// un changement d'un seul côté rougit.

/** Version du contrat parlée par cette extension. */
export const VERSION_CONTRAT = 1;

/** En-tête qui porte la version du contrat. */
export const ENTETE_CONTRAT = "x-enregistreur-contrat";

/** Version de l'extension (reprise du manifeste, envoyée au site). */
export const VERSION_EXTENSION = "1.3.0";

/**
 * La SEULE adresse que l'extension appelle. Aucun préfixe de console, aucune
 * autre machine : `l-extension-ne-parle-qu-aux-routes-de-l-enregistreur`.
 */
export const BASE_API = "https://axion-ia.com/api/enregistreur/";

export const TAILLE_MAX_MORCEAU_OCTETS = 262144;

export const ENTETES_MORCEAU = {
  piste: "x-piste",
  tranche: "x-tranche",
  seq: "x-seq",
  debutCaptureMs: "x-debut-capture-ms",
  empreinte: "x-empreinte",
};

export const DELAIS_LOCAUX = {
  accordMaxMs: 180000,
  rappelAccordMs: 120000,
  destructionSansRencontreMs: 86400000,
  badgePisteClientMuetteMs: 60000,
  badgeSilenceMs: 180000,
  notificationSilenceMs: 300000,
  arretSilenceMs: 1800000,
  arretSalleQuitteeMs: 120000,
  dureeMaxMs: 10500000,
  coupureNouvellePersonneMs: 120000,
  battementSessionMs: 60000,
  battementAppareilMs: 300000,
  renvoiInitialMs: 2000,
  renvoiMaxMs: 300000,
};

export const CONSTANTES_AUDIO = {
  dureeTrancheS: 180,
  dureeMorceauS: 10,
  debitAudioBps: 32000,
  tailleMaxTrancheOctets: 25165824,
  typeMime: "audio/webm;codecs=opus",
};

/** Version du texte d'annonce lu par Will (preuve d'accord). */
export const VERSION_TEXTE_ANNONCE = "annonce-v1";

/** Seuil de niveau (0..1) sous lequel une piste est considérée muette. */
export const SEUIL_SILENCE = 0.01;

/** À partir de 3 participants, un compte Meet gratuit coupe à 60 min. */
export const PARTICIPANTS_LIMITE_MEET = 3;

/**
 * Le service worker ne compte les participants de la salle que toutes les
 * 15 s (lecture de la page Meet). Une arrivée peut donc être vue jusqu'à 15 s
 * après avoir eu lieu : la fenêtre « hors accord » s'ouvre une période plus
 * tôt (RGPD-01). Constante LOCALE, hors contrat : le site ne la lit pas.
 */
export const PERIODE_MESURE_SALLE_MS = 15000;
