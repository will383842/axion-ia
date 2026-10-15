// Les TEXTES du dossier en ligne du formateur indépendant (lot L5), en un seul endroit.
// Repris de la maquette `maquette-formateur-dossier.html` (4 étapes, entreprise fermée sans
// impasse, écran de fin). Vouvoiement, phrases courtes, peu de texte.
// ⛔ Lexique : ni « poste », ni « entretien », ni « recrutement », ni « salaire »,
// ni « rémunération », ni « bienvenue », ni « vous devez », ni « obligatoire »
// (garde : `le-dossier-formateur-respecte-le-lexique.spec.ts`).
// « e‑mail » porte un trait d'union INSÉCABLE (U+2011).

import { LIBELLE_ATTESTATION_PLUS_TARD } from "@/lib/vigilance";

export const ADRESSE_CONTACT = "contact@axion-ia.com";

export const ETAPES = ["Vous", "Votre activité", "Vos documents", "Votre contrat"] as const;

export const LIEN_POLITIQUE = "/fr/politique-confidentialite#formateurs-independants";

/** « Retrouver mon espace » (F14) : une seule page, dossier en cours ou espace ouvert. */
export const CHEMIN_RETROUVER = "/formateur/dossier/retrouver";

export const TEXTES = {
  marque: "Axion-IA",
  surtitre: "Votre dossier de formateur",
  astuce:
    "Astuce : ajoutez cette page à vos favoris pour la retrouver en un geste. Ce lien vous est personnel.",
  bonjour: (prenom: string) => (prenom ? `Bonjour ${prenom}` : "Bonjour"),
  etapeNsur4: (n: number) => `Étape ${n} sur 4`,
  duree: "Environ 10 minutes · vous pouvez reprendre plus tard",
  continuer: "Continuer",
  retour: "Retour",
  enregistrement: "Enregistrement…",
  ilManque: "Pour continuer, il manque :",
  trop: "Trop d'essais en peu de temps. Réessayez dans un quart d'heure.",
  connexionPerdue: "La connexion a été perdue. Vérifiez votre réseau, puis réessayez.",

  // Étape 1 · Vous
  prenomNom: "Prénom et nom",
  email: "E‑mail",
  lectureSeule: "Lecture seule",
  uneErreur: "Une erreur ? Écrivez-nous",
  telephone: "Téléphone",
  codePostal: "Code postal",
  codePostalInvalide: "Indiquez un code postal à 5 chiffres.",
  telephoneInvalide: "Ce numéro de téléphone n'est pas valide.",
  prerempli: "Tout est déjà rempli depuis votre candidature.",
  mentionDonnees:
    "Vos informations servent à conclure et suivre nos missions de formation. Des statistiques internes aident à choisir l'intervenant ; la décision reste humaine.",
  mentionLien: "Vos données et vos droits",

  // Étape 2 · Votre activité
  siret: "Numéro SIRET",
  rechercher: "Rechercher",
  recherche: "Recherche…",
  siretInvalide: "Ce numéro SIRET n'est pas valide : vérifiez les 14 chiffres.",
  trouveActive: "Trouvé · active",
  rechercherDabord: "Recherchez d'abord votre numéro SIRET.",
  ecranMuette: "Le registre ne répond pas : continuez, nous vérifierons à la réception.",
  ecranFermee:
    "Le registre indique que cette entreprise est fermée. Si vous en avez une autre, indiquez son numéro SIRET. Sinon, une micro-entreprise suffit.",
  ecranIntrouvable:
    "Ce numéro n'apparaît pas au registre. Vérifiez-le, ou indiquez un autre numéro SIRET. Sinon, une micro-entreprise suffit.",
  ecranHorsFrance:
    "L'intervention depuis l'étranger fait l'objet d'un contrat séparé. Nous gardons votre dossier et revenons vers vous.",
  ecranStatutNonOuvert:
    "Ce statut n'est pas encore ouvert. Nous gardons votre dossier et revenons vers vous.",
  ecranSocieteAxion:
    "Ce numéro est celui d'Axion-IA : indiquez le numéro SIRET de votre propre activité.",
  ecranSansEntreprise: "Une micro-entreprise suffit : elle se crée en ligne, sur le site officiel.",
  autreNumero: "Indiquer un autre numéro",
  creerMicro: "Créer une micro-entreprise (site officiel)",
  creerMicroUrl: "https://formalites.entreprises.gouv.fr",
  dossierGarde: "Votre dossier reste enregistré.",
  sansSiret: "Pas de numéro SIRET à votre nom ?",
  situationPortage: "Je suis en portage salarial ou en coopérative",
  situationEtranger: "J'exerce hors de France",
  situationSansEntreprise: "Je n'ai pas encore d'entreprise",
  nda: "Numéro de déclaration d'activité",
  ndaAide: "11 chiffres, sur le récépissé de votre déclaration.",
  ndaEnCours: "Je n'ai pas encore de numéro",
  ndaEnCoursAide: "Vous ajouterez le récépissé de dépôt à l'étape suivante.",
  ndaInvalide: "Le numéro de déclaration compte 11 chiffres.",
  tva: "Votre TVA",
  tvaFranchise: "Je ne facture pas la TVA (franchise)",
  tvaExonere: "Exonéré de TVA pour la formation",
  tvaAssujetti: "Je facture la TVA à 20 %",
  tvaManquante: "Choisissez votre régime de TVA.",
  iban: "IBAN",
  ibanEnregistre: "IBAN enregistré. Laissez vide pour le garder.",
  ibanFige: "IBAN enregistré. Pour le changer, écrivez-nous : nous le vérifierons d'abord.",
  ibanInvalide:
    "Cet IBAN n'est pas valide, ou n'est pas celui d'un compte de la zone SEPA (Europe), où nous versons vos honoraires : vérifiez-le.",

  // Étape 3 · Vos documents
  aidePiece: {
    attestation_vigilance_urssaf: `Pas nécessaire pour l'instant : ${LIBELLE_ATTESTATION_PLUS_TARD}. Si vous l'avez déjà : moins de 6 mois, sur urssaf.fr, rubrique Mes attestations.`,
    rib: "Le relevé d'identité bancaire du compte indiqué.",
    cv: "Votre parcours et vos formations.",
    recepisse_declaration_activite: "Le récépissé de dépôt de votre déclaration.",
    assurance_rc_pro: "Si vous en avez une.",
    diplome: "Si vous en avez.",
  },
  codeUrssaf: "Code de sécurité (facultatif)",
  codeUrssafAide:
    "En bas de votre attestation. Il nous permet de la vérifier ; sans lui, vous pouvez continuer.",
  codeUrssafInvalide:
    "Ce code n'est pas lisible : recopiez les lettres et chiffres du bas de l'attestation.",
  enregistrerCode: "Enregistrer le code",
  codeEnregistre: "Code enregistré",
  attestationPerimee:
    "Cette attestation date de plus de 6 mois. Téléchargez-en une nouvelle sur urssaf.fr : c'est immédiat.",
  depot: {
    connexionPerdue: "La connexion a été perdue. Vérifiez votre réseau, puis réessayez.",
    facultatif: "facultatif",
    conforme: "Vérifiée",
    ajoutee: "Ajoutée",
    aRetransmettre: (motif: string) => `À renvoyer : ${motif}`,
    apercuDe: (piece: string) => `Aperçu : ${piece}`,
    voirLePdf: "Voir le PDF",
    dateDelivrance: "Date de délivrance",
    envoi: "Envoi…",
    remplacer: "Remplacer",
  },

  // Étape 4 · Votre contrat
  contratBientot: "Votre contrat vous sera proposé ici très bientôt : nous vous écrirons.",
  jeCertifie: "Je certifie que :",
  envoyer: "Envoyer mon dossier",
  envoi: "Envoi…",

  // Fin
  merciPastille: "Merci",
  merciTitre: "Merci, c'est envoyé",
  merciLigne: "Nous vérifions votre dossier et nous vous écrivons par e‑mail.",
  merciEtat: "Dossier reçu, en cours de vérification",
  fermer: "Vous pouvez fermer cette page.",

  // États
  recuPastille: "Dossier reçu",
  recuTitre: "Dossier reçu",
  recuLigne: "Il est en cours de vérification. Nous vous écrivons par e‑mail.",
  invalidePastille: "Lien",
  invalideTitre: "Ce lien n'est pas valable",
  invalideLigne:
    "Il est peut-être incomplet ou trop ancien. Écrivez-nous : nous vous enverrons le bon lien.",
  nousEcrire: "Nous écrire",
  retrouverLien: "Recevoir un nouveau lien par e‑mail",
  erreurTitre: "Un incident est survenu",
  erreurLigne: "Votre saisie est gardée. Réessayez dans un instant, ou écrivez-nous :",
  reessayer: "Réessayer",
} as const;
