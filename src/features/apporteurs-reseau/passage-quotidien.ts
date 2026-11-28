/**
 * Réseau d'apporteurs (démarrage manuel) — le PASSAGE QUOTIDIEN.
 *
 * Planifié sur la file `apporteur-crons` (job `reseau-quotidien`). Sept étapes, chacune
 * isolée (une étape en échec n'empêche pas les suivantes) et rejouable (toute écriture est
 * conditionnelle, tout e-mail a une clé « une fois ») :
 *
 *   (a) confirmation réputée acquise, 30 jours après la prise de contact (art. 3.2) ;
 *   (b) au terme de la protection, prolongation UNIQUE de 3 mois si un fait de la Société
 *       le justifie (art. 3.4 al. 3), sinon `terminee` ;
 *   (c) une commission par COMMANDE soldée d'une entreprise protégée à la date de commande,
 *       plus la part du parrain dans les 6 mois de la signature du filleul ;
 *   (c bis) autofacturation : une autofacture par apporteur pour ses commissions dues pas encore
 *       facturées (`facturation.ts`) — aussi lancée TOUTES LES HEURES avec (c), par le job
 *       `reseau-facturation` (`passerFacturationApporteurs`) ;
 *   (d) vigilance : libère les commissions en attente dès que les pièces sont là, demande
 *       les pièces, relance tous les 15 jours (trois au plus), alerte Williams d'un dépôt à
 *       vérifier, et demande le renouvellement 15 jours avant l'échéance ;
 *   (e) « commande signée » à l'apporteur, une fois par devis accepté (sans montant) ;
 *   (f) rappel du dossier non complété : J+3 puis J+7 après l'envoi du lien, jamais au-delà ;
 *   (g) règle par rendez-vous (lot 4) : une présentation qui porte une ligne de RÉSERVATION n'est
 *       JAMAIS confirmée par le silence (étape (a)) ; son échéance, à la fin des 60 jours, est
 *       l'étape « reservations-echues ». Sans ligne de réservation, rien ne change : l'interrupteur
 *       `APPORTEURS_VALIDATION_RDV` n'est pas lu ici, il ne sert qu'à CRÉER une réservation.
 *
 * Les DÉCISIONS sont dans `regles.ts` (pures, testées) ; ce module lit et écrit.
 */

// ⚠️ Tourne dans le WORKER (tsx, hors Next) : aucun `server-only` ici ni dans ce que ce
// module importe (verrouillé par `le-worker-n-importe-pas-server-only.spec.ts`).

import { ajouterJoursOuvres } from "@/lib/jours-ouvres";
import { FACTURE_HORS_ESSAI } from "@/server/qualiopi/essai/perimetre";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

import { decryptPii } from "@/lib/pii-crypto";
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { enqueueEmail } from "@/server/queue/queues";

import {
  demanderVigilance,
  dejaEnvoye,
  libererSiPiecesValides,
  piecesVigilanceValides,
  relancerVigilance,
  statutApresVigilance,
} from "./commissions";
import {
  alerterDeclarationsSansReponse,
  annoncerAttribution,
  dateEnClair,
} from "./attribution-annonce";
import { alerteInterne } from "./alerte-interne";
import { alerterConflitRattrapage, rattrapageEnConflit } from "./conflit-rattrapage";
import { envoyer } from "./envois";
import { noterDocumentsRemis } from "./annexes-versions";
import { annexesDeLEnvoiDuLien } from "./documents-joints";
import { enregistrerReservation, lireReservations, tableAbsente } from "./reservation-presentation";
import {
  basculeVersRendezVous,
  finDeProtectionRendezVous,
  reservationOccupe,
} from "./regle-attribution";
import { validationParRendezVousActive } from "./interrupteur-rendez-vous";
import { facturerCommissionsDues } from "./facturation";
import { basculerRegimesDuJour } from "./regime-tva";
import { figerPiecesManquantes } from "./tva-pieces";
import { alerterPiecesVigilanceDeposees } from "./alerte-vigilance";
import {
  AVANT_2_6,
  attributaireDeLaCommande,
  lireAAttribuerEnAttente,
  lireDecisionsAAttribuer,
  lireEtablissements,
  relanceAttributionDue,
  lireSiretsDevis,
  ouvrirAAttribuer,
  siretDeLaCommande,
  type Etablissement,
} from "./etablissement-presentation";
import { reprendreApresAvoirsClients } from "./avoir-client";
import { regenererAvoirsSansPiece } from "./manquement";
import { alerterHorsGrille } from "./hors-grille";
import { chiffrerPiecesEnClair } from "./pieces-chiffrement";
import {
  commandeRenduePourLaLigne,
  commandesSoldees,
  ligneNeutralisee,
  PREFIXE_PALIER_COMPLEMENT,
  soldeDesLignesLiees,
} from "./commandes";
import { PREFIXE_PALIER_REPRISE } from "./resiliation";
import { idsPriseDeContactRebondie } from "./rebonds";
import { urlDossier } from "./jeton";
import { executerResiliationsEchues, renvoyerEmailsEffetManques } from "./resiliation";
import { alerteSurveillance } from "./surveillance-passages";
import { signalerErreurReseau } from "./signaler";
import {
  ajouterJours,
  ajouterMois,
  htLignesRecurrentesRestantesCents,
  plafondBaseCommissionnableCents,
  calculerCommissionSelonGrilleAvecRegle,
  regleApresPlafond,
  grilleDeLaCommande,
  MESSAGE_GRILLE_INCONNUE,
  DEVELOPPEMENT_WEB_COMMISSIONNE_DEPUIS,
  calculerCommissionJourneeIa,
  versionContratSignee,
  type CalculCommission,
  type RegleAppliquee,
  commandeCouverte,
  CONFIRMATION_TACITE_JOURS,
  dateConfirmationTaciteAvecContact,
  dateConfirmationTaciteSansContact,
  finDeProtection,
  motifDeProlongation,
  PARRAINAGE_MOIS,
  PRISE_DE_CONTACT_JOURS,
  partParrainage,
  PROLONGATION_FAITS_RECENTS_JOURS,
  PROLONGATION_MOIS,
  type ActiviteCommission,
} from "./regles";

/** Renouvellement de l'attestation de vigilance : tant de jours avant son échéance. */
export const RENOUVELLEMENT_VIGILANCE_JOURS = 15;
/** Alerte interne : une réservation sans rendez-vous ni proposition, à ce nombre de jours (ou moins) du terme. */
export const ALERTE_SANS_RDV_JOURS_AVANT_TERME = 10;
/** E5 : une proposition de rendez-vous qui attend depuis plus de ce nombre de jours ouvrés alerte Williams. */
export const ALERTE_PROPOSITION_JOURS_OUVRES = 5;
/** L3b : une réservation échue depuis moins de ce nombre de jours voit son alerte rattrapée si elle a échoué. */
const RATTRAPAGE_ALERTE_ECHUE_JOURS = 7;
/** L5 : une annonce de validation n'est relancée que si la validation date de moins de ce nombre de jours ouvrés. */
const RELANCE_ANNONCE_JOURS_OUVRES = 5;
/** L7 : au plus ce nombre de maillons suivis dans la chaîne des devis remplacés. */
const MAILLONS_DEVIS_MAX = 10;

/** « Commande signée » : on ne regarde que les devis acceptés dans cette fenêtre. */
export const FENETRE_COMMANDE_SIGNEE_JOURS = 30;

/** Rappel du dossier : jours après l'envoi du lien (J+3, J+7) et fenêtre au-delà de laquelle on se tait. */
export const RAPPEL_DOSSIER_JOURS = [3, 7] as const;
export const RAPPEL_DOSSIER_FIN_JOURS = 14;

/**
 * Quel rappel est dû, d'après l'âge du lien ? 1 = de J+3 à J+7, 2 = de J+7 à J+14,
 * `null` avant J+3 et après J+14 (un lien resté sans suite depuis longtemps n'est pas relancé).
 */
export function rappelDossierDu(lienEnvoyeAt: Date, maintenant: Date): 1 | 2 | null {
  const jours = (maintenant.getTime() - lienEnvoyeAt.getTime()) / 86_400_000;
  if (jours >= RAPPEL_DOSSIER_FIN_JOURS || jours < RAPPEL_DOSSIER_JOURS[0]) return null;
  return jours >= RAPPEL_DOSSIER_JOURS[1] ? 2 : 1;
}

/** Préfixe de la clé d'envoi d'un rappel : ces envois ne sont JAMAIS l'origine d'un délai. */
export const PREFIXE_JOB_RAPPEL_DOSSIER = "apporteur-dossier-rappel-";

export interface EnvoiLienDossier {
  id: string;
  sentAt: Date | null;
  jobId: string | null;
  bounceType: string | null;
}

/**
 * Le rappel du dossier à envoyer maintenant, ou `null`. Décision PURE.
 * L'origine du délai est le dernier lien ENVOYÉ (premier envoi ou renvoi à la main), jamais
 * un rappel : sans cela chaque rappel remettrait l'horloge à zéro et bouclerait (J+3, J+6, …).
 */
export function rappelDossierAEnvoyer(
  envois: readonly EnvoiLienDossier[],
  maintenant: Date,
): { origineId: string; rappel: 1 | 2; jobId: (apporteurId: string) => string } | null {
  const origines = envois
    .filter((e) => e.sentAt !== null && !(e.jobId ?? "").startsWith(PREFIXE_JOB_RAPPEL_DOSSIER))
    .sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime());
  const origine = origines[0];
  if (!origine?.sentAt || origine.bounceType === "hard") return null;
  const rappel = rappelDossierDu(origine.sentAt, maintenant);
  if (rappel === null) return null;
  return {
    origineId: origine.id,
    rappel,
    jobId: (apporteurId) =>
      `${PREFIXE_JOB_RAPPEL_DOSSIER}${apporteurId}-${origine.id}-j${RAPPEL_DOSSIER_JOURS[rappel - 1]}`,
  };
}

export interface BilanPassageReseau {
  confirmeesTacites: number;
  prolongees: number;
  terminees: number;
  commissionsCreees: number;
  partsParrainage: number;
  liberees: number;
  autofacturesEmises: number;
  commissionsFacturees: number;
  autofacturesEcartees: number;
  vigilancesDemandees: number;
  relancesVigilance: number;
  alertesPiecesVigilance: number;
  commandesSigneesAnnoncees: number;
  rappelsDossier: number;
  /** Règle par rendez-vous : réservations arrivées à échéance sans rendez-vous (lot 4). */
  reservationsEchues: number;
  /** Alertes internes « réservation sans rendez-vous, terme proche » parties à ce passage. */
  reservationsBientotEchues: number;
  /** E5 : alertes internes « proposition en attente depuis plus de 5 jours ouvrés » parties. */
  propositionsEnAttente: number;
  /** Échéances suspendues : un rendez-vous pris pendant la réservation reste à trancher. */
  echeancesSuspendues: number;
  /** Présentations en attente passées de l'ancienne règle à la règle du rendez-vous. */
  basculees: number;
  /** Présentations en attente NON basculées (terme dépassé ou prise de contact en erreur), signalées : total « à ce jour » (une même présentation est recomptée à chaque passage tant qu'elle reste en attente). */
  basculeesEcartees: number;
  /** Entreprises validées par une commande signée pendant la réservation. */
  validationsParCommande: number;
  erreurs: number;
}

// ── Décisions pures (testées) ────────────────────────────────────────────

export interface PresentationProtegee {
  id: string;
  apporteurId: string;
  siren: string;
  denomination: string;
  recueAt: Date;
  confirmeeAt: Date | null;
  protegeeJusquAt: Date | null;
  /** Statut réel de la présentation (facultatif : les fixtures d'avant le lot 4 n'en portent pas). */
  statut?: string;
  /**
   * Règle par rendez-vous : la réservation NON VALIDÉE de la présentation. Elle couvre une commande
   * signée jusqu'à son terme, que la présentation soit encore `reservee`, échue ou résiliée (art.
   * 12.3 : la résiliation ramène ce terme à sa date). `null`/absent : présentation d'avant la règle,
   * ou déjà validée (elle est alors jugée sur sa seule protection).
   */
  reservation?: { reserveeJusquAt: Date; statut: string; echueAt?: Date | null } | null;
}

/** La présentation qui couvre une commande : la plus ancienne reçue, s'il y en a plusieurs. */
export function presentationQuiCouvre<T extends PresentationProtegee>(
  candidates: readonly T[],
  signeeAt: Date,
  /** L7 : date d'émission du devis, pour la SEULE validation d'une réservation (jamais la commission). */
  devisEmisAt?: Date | null,
): T | null {
  const couvrantes = candidates.filter((p) =>
    commandeCouverte({
      signeeAt,
      recueAt: p.recueAt,
      confirmee: p.confirmeeAt !== null,
      protegeeJusquAt: p.protegeeJusquAt,
      reservation: p.reservation ?? null,
      devisEmisAt: devisEmisAt ?? null,
    }),
  );
  couvrantes.sort((a, b) => a.recueAt.getTime() - b.recueAt.getTime());
  return couvrantes[0] ?? null;
}

/**
 * Contrat 2.6 : la présentation à qui revient la commande de l'établissement `siret` (source
 * unique : `siretDeLaCommande`). Les couvrantes à la date de la commande, puis la règle par
 * établissement (`attributaireDeLaCommande`). « À attribuer » : jamais de perte silencieuse. Pur.
 */
export function presentationPourEtablissement<T extends PresentationProtegee>(
  candidates: readonly T[],
  etablissements: ReadonlyMap<string, Etablissement>,
  signeeAt: Date,
  siret: string | null,
  /** L7 : date d'émission du devis, pour la SEULE validation d'une réservation (jamais la commission). */
  devisEmisAt?: Date | null,
): { presentation: T } | { aAttribuer: true; candidats: T[] } | null {
  const couvrantes = candidates
    .filter((p) =>
      commandeCouverte({
        signeeAt,
        recueAt: p.recueAt,
        confirmee: p.confirmeeAt !== null,
        protegeeJusquAt: p.protegeeJusquAt,
        reservation: p.reservation ?? null,
        devisEmisAt: devisEmisAt ?? null,
      }),
    )
    .map((p) => ({ p, recueAt: p.recueAt, etablissement: etablissements.get(p.id) ?? AVANT_2_6 }));
  const r = attributaireDeLaCommande(couvrantes, siret);
  if (!r) return null;
  if ("aAttribuer" in r) return { aAttribuer: true, candidats: r.candidats.map((c) => c.p) };
  return { presentation: r.presentation.p };
}

/** La commande tombe-t-elle dans les 6 mois du parrainage (contrat art. 4.6) ? */
export function dansFenetreParrainage(filleulSigneAt: Date, commandeSigneeAt: Date): boolean {
  const t = commandeSigneeAt.getTime();
  return (
    t >= filleulSigneAt.getTime() && t <= ajouterMois(filleulSigneAt, PARRAINAGE_MOIS).getTime()
  );
}

/** Date de commande d'une facture : l'acceptation du devis, sinon l'émission. */
export function dateDeCommande(f: {
  devis: { acceptedAt: Date | null } | null;
  emiseAt: Date | null;
}): Date | null {
  return f.devis?.acceptedAt ?? f.emiseAt ?? null;
}

// ── Le passage ───────────────────────────────────────────────────────────

/** Étapes du passage, dans l'ordre. `facturation` = celles du job HORAIRE. */
type NomEtape =
  | "bascule-regle-rendez-vous"
  | "confirmation-tacite"
  | "terme"
  | "commissions"
  | "avoirs-clients"
  | "autofacturation"
  | "vigilance"
  | "alerte-pieces-vigilance"
  | "commande-signee"
  | "reservations-sans-rendez-vous"
  | "reservations-echues"
  | "rappels-dossier"
  | "chiffrement-pieces"
  | "avoirs-sans-piece"
  | "hors-grille"
  | "declarations-sans-reponse"
  | "commandes-a-attribuer"
  | "resiliations-echues"
  | "emails-effet-resiliation"
  | "a-verifier-en-retard";

const ETAPES_FACTURATION: readonly NomEtape[] = [
  "commissions",
  "avoirs-clients",
  "autofacturation",
  "avoirs-sans-piece",
];

function bilanVide(): BilanPassageReseau {
  return {
    confirmeesTacites: 0,
    prolongees: 0,
    terminees: 0,
    commissionsCreees: 0,
    partsParrainage: 0,
    liberees: 0,
    autofacturesEmises: 0,
    commissionsFacturees: 0,
    autofacturesEcartees: 0,
    vigilancesDemandees: 0,
    relancesVigilance: 0,
    alertesPiecesVigilance: 0,
    commandesSigneesAnnoncees: 0,
    rappelsDossier: 0,
    reservationsEchues: 0,
    reservationsBientotEchues: 0,
    propositionsEnAttente: 0,
    echeancesSuspendues: 0,
    basculees: 0,
    basculeesEcartees: 0,
    validationsParCommande: 0,
    erreurs: 0,
  };
}

async function passer(
  maintenant: Date,
  seulement: readonly NomEtape[] | null,
): Promise<BilanPassageReseau> {
  const bilan = bilanVide();
  const etapes: Array<[NomEtape, () => Promise<void>]> = [
    // Lot L1b (en PREMIER : les étapes suivantes ne traitent plus l'apporteur comme « signe » le jour de l'effet) : la résiliation notifiée prend effet à sa date (préavis de 30 jours en 11.1).
    ["resiliations-echues", async () => void (await executerResiliationsEchues(maintenant))],
    // #2464 pt 9 : l'e-mail de prise d'effet qui n'est pas parti est renvoyé (idempotent, clé de journal).
    ["emails-effet-resiliation", async () => void (await renvoyerEmailsEffetManques(maintenant))],
    // #2464 pt 10 : contrat signé par l'apporteur, pas contresigné depuis plus de 2 jours ouvrés.
    ["a-verifier-en-retard", async () => void (await alerterAVerifierEnRetard(maintenant))],
    // AVANT la confirmation par le silence : une présentation qui bascule aujourd'hui ne doit pas
    // être confirmée par le silence dans le même passage.
    ["bascule-regle-rendez-vous", () => etapeBasculeRegleRendezVous(maintenant, bilan)],
    ["confirmation-tacite", () => etapeConfirmationTacite(maintenant, bilan)],
    ["terme", () => etapeTerme(maintenant, bilan)],
    ["commissions", () => etapeCommissions(maintenant, bilan)],
    // Les commissions devenues dues (ci-dessus) sont facturées dans la foulée, puis celles que la
    // vigilance libère (ci-dessous) le sont au passage horaire suivant.
    // Art. 4.5 (essai réel du 09/10) : une facture client annulée ou réduite par un avoir réduit,
    // annule, retient ou reprend la commission, AVANT que l'autofacturation ne la facture.
    ["avoirs-clients", async () => void (await reprendreApresAvoirsClients(maintenant))],
    ["autofacturation", () => etapeAutofacturation(maintenant, bilan)],
    ["vigilance", () => etapeVigilance(maintenant, bilan)],
    [
      "alerte-pieces-vigilance",
      async () =>
        void (bilan.alertesPiecesVigilance += await alerterPiecesVigilanceDeposees(maintenant)),
    ],
    ["commande-signee", () => etapeCommandeSignee(maintenant, bilan)],
    // Règle par rendez-vous : APRÈS « commande-signee » (une commande signée pendant la réservation
    // la valide avant que l'échéance ne puisse la clore).
    ["reservations-sans-rendez-vous", () => etapeReservationsSansRendezVous(maintenant, bilan)],
    ["reservations-echues", () => etapeReservationsEchues(maintenant, bilan)],
    ["rappels-dossier", () => etapeRappelsDossier(maintenant, bilan)],
    // Rattrapage (07/10) : les pièces déposées avant le chiffrement au repos sont chiffrées.
    ["chiffrement-pieces", async () => void (await chiffrerPiecesEnClair())],
    // Art. 4.5 bis : un avoir de neutralisation resté sans PDF est régénéré et envoyé.
    ["avoirs-sans-piece", async () => void (await regenererAvoirsSansPiece(maintenant))],
    // Annexe 1, A1.7 : une commission « à qualifier » se règle sous soixante jours ; Williams
    // est alerté dix jours avant, puis le jour du dépassement.
    ["hors-grille", async () => void (await alerterHorsGrille(maintenant))],
    // Rappel INTERNE (non contractuel) : une déclaration sans réponse depuis 15 jours.
    [
      "declarations-sans-reponse",
      async () => void (await alerterDeclarationsSansReponse(maintenant)),
    ],
    // Contrat 2.6 (art. 3.1, relecture de a1) : une commande à attribuer est relancée à J+10,
    // puis à J+15 (délai dépassé).
    ["commandes-a-attribuer", async () => void (await relancerAAttribuer(maintenant))],
  ];
  for (const [nom, etape] of etapes) {
    if (seulement && !seulement.includes(nom)) continue;
    try {
      await etape();
    } catch (err) {
      bilan.erreurs += 1;
      console.error(`[reseau-apporteurs] étape « ${nom} » en échec :`, err);
      signalerErreurReseau(`passage quotidien : ${nom}`, err);
      // #2464 pt 5 : le job finit « vert » quoi qu'il arrive ; l'étape en erreur prévient donc
      // Williams, une fois par jour et par étape (jamais l'apporteur). Fail-soft.
      await alerteSurveillance({
        code: "apporteur_etape_en_erreur",
        cle: `etape-${nom}`,
        titre: `Réseau d'apporteurs : l'étape « ${nom} » du passage est en erreur`,
        message: `L'étape « ${nom} » a levé une erreur ; les autres étapes ont continué. Détail dans Sentry (service apporteur-crons). Elle sera rejouée au prochain passage.`,
        cibleId: nom,
        maintenant,
        niveau: "important",
      });
    }
  }
  return bilan;
}

/**
 * Le premier rattrapage qui suit le démarrage du worker est ATTENDU (pièces émises par l'ancien
 * worker pendant la fenêtre de mise en ligne) : il n'alerte pas ; les suivants, si.
 */
let premierPassageApresMiseEnLigne = true;

/** Le passage QUOTIDIEN : toutes les étapes. */
export async function passerReseauApporteurs(
  maintenant: Date = new Date(),
): Promise<BilanPassageReseau> {
  // Un changement de régime arrivé à échéance met la fiche à jour AVANT toute facturation du passage.
  // (La facturation lit `regimeApplicableAu` : elle ne dépend pas de cette bascule.)
  try {
    await basculerRegimesDuJour(maintenant);
  } catch (err) {
    signalerErreurReseau("passage quotidien : bascule du régime de TVA", err);
  }
  const bilan = await passer(maintenant, null);
  // Les commissions libérées par la vigilance ce matin sont facturées tout de suite, pas dans l'heure.
  if (bilan.liberees > 0) {
    try {
      await etapeAutofacturation(maintenant, bilan);
    } catch (err) {
      bilan.erreurs += 1;
      signalerErreurReseau("passage quotidien : autofacturation après libération", err);
    }
  }
  return bilan;
}

/**
 * Le passage HORAIRE (job `reseau-facturation`) : UNIQUEMENT « commissions » et « autofacturation ».
 * Une commission devient due dès que le client a payé à 100 % : l'apporteur est facturé dans l'heure.
 */
export async function passerFacturationApporteurs(
  maintenant: Date = new Date(),
): Promise<BilanPassageReseau> {
  return passer(maintenant, ETAPES_FACTURATION);
}

async function etapeAutofacturation(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
  // Le régime de chaque pièce déjà émise est FIGÉ avant toute nouvelle émission : rattrapage des
  // pièces émises sans l'être (ancien worker pendant la fenêtre de mise en ligne). Jamais bloquant.
  try {
    const rattrapees = await figerPiecesManquantes();
    if (rattrapees > 0 && !premierPassageApresMiseEnLigne) {
      signalerErreurReseau(
        "pièces d'autofacture émises sans régime figé",
        new Error(`${rattrapees} pièce(s) figée(s) au rattrapage`),
      );
    }
    premierPassageApresMiseEnLigne = false;
  } catch (err) {
    signalerErreurReseau("passage : régime de TVA des pièces déjà émises", err);
  }
  const r = await facturerCommissionsDues(maintenant);
  bilan.autofacturesEmises += r.autofactures;
  bilan.commissionsFacturees += r.commissions;
  bilan.autofacturesEcartees += r.ecartees;
  bilan.erreurs += r.erreurs;
}

// (a) ─────────────────────────────────────────────────────────────────────

async function etapeConfirmationTacite(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
  const seuil = ajouterJours(maintenant, -CONFIRMATION_TACITE_JOURS);
  const seuilDeclaration = ajouterJours(
    maintenant,
    -(PRISE_DE_CONTACT_JOURS + CONFIRMATION_TACITE_JOURS),
  );
  // Contact envoyé il y a 30 jours OU déclaration reçue il y a 60 jours : un contact en retard
  // ne repousse pas l'échéance (art. 3.2 et 2.8 ; `dateConfirmationTaciteAvecContact`).
  const lignes = await prisma.presentationEntreprise.findMany({
    where: {
      statut: "reservee",
      contactEnvoyeAt: { not: null },
      OR: [{ contactEnvoyeAt: { lte: seuil } }, { recueAt: { lte: seuilDeclaration } }],
    },
    select: { id: true, contactEnvoyeAt: true, recueAt: true },
  });
  // ⚠️ Pas de « return » si la liste est vide : les déclarations JAMAIS contactées (plus bas)
  // doivent être examinées quand même.
  // Contrat art. 3.2 : le délai ne court pas tant que la prise de contact revient en erreur.
  const rebonds =
    lignes.length > 0
      ? await idsPriseDeContactRebondie(lignes.map((l) => l.id))
      : new Set<string>();
  // Règle par rendez-vous : une présentation qui porte une ligne de réservation n'est JAMAIS
  // confirmée par le silence, interrupteur éteint compris (la ligne fait foi, pas la variable).
  const reservees = await lireReservations(lignes.map((l) => l.id));
  for (const p of lignes) {
    if (rebonds.has(p.id)) continue;
    if (reservees.has(p.id)) continue;
    const confirmeeAt = dateConfirmationTaciteAvecContact(p.contactEnvoyeAt!, p.recueAt);
    if (confirmeeAt.getTime() > maintenant.getTime()) continue;
    // Garde RELUE juste avant l'écriture : une réservation née depuis la lecture l'emporte.
    if ((await lireReservations([p.id])).has(p.id)) continue;
    const r = await prisma.presentationEntreprise.updateMany({
      where: { id: p.id, statut: "reservee" },
      data: {
        statut: "confirmee",
        confirmationTacite: true,
        confirmeeAt,
        // Contrat 2.2 (art. 3.4) : six mois depuis la déclaration, pas depuis la confirmation.
        protegeeJusquAt: finDeProtection(p.recueAt),
      },
    });
    bilan.confirmeesTacites += r.count;
    if (r.count === 1) await annoncerAttribution(p.id, "confirmee");
  }

  // Art. 3.2 : la Société prend contact dans les 30 jours de la déclaration ; À DÉFAUT, le délai
  // de confirmation court à compter de l'expiration de ce délai. Une déclaration JAMAIS contactée
  // est donc réputée confirmée 30 + 30 jours après sa réception (relecture de a1, 08/10 : elle
  // restait « à l'étude » sans fin). Aucun message n'étant parti, aucun rebond à attendre.
  const sansContact = await prisma.presentationEntreprise.findMany({
    where: {
      statut: "reservee",
      contactEnvoyeAt: null,
      recueAt: {
        lte: ajouterJours(maintenant, -(PRISE_DE_CONTACT_JOURS + CONFIRMATION_TACITE_JOURS)),
      },
    },
    select: { id: true, recueAt: true },
  });
  const reservees2 = await lireReservations(sansContact.map((l) => l.id));
  for (const p of sansContact) {
    if (reservees2.has(p.id)) continue;
    if ((await lireReservations([p.id])).has(p.id)) continue;
    const r = await prisma.presentationEntreprise.updateMany({
      where: { id: p.id, statut: "reservee", contactEnvoyeAt: null },
      data: {
        statut: "confirmee",
        confirmationTacite: true,
        confirmeeAt: dateConfirmationTaciteSansContact(p.recueAt),
        protegeeJusquAt: finDeProtection(p.recueAt),
      },
    });
    bilan.confirmeesTacites += r.count;
    if (r.count === 1) await annoncerAttribution(p.id, "confirmee");
  }
}

// (g bis) ─────────────────────────────────────────────────────────────

/**
 * Décision de Will (26/11/2026) : les présentations EN ATTENTE faites sous l'ancienne règle (silence)
 * passent à la règle du 1er rendez-vous tenu ou du devis signé. Une ligne de réservation est ajoutée
 * (terme = `termeApresBascule` : au moins 30 jours après la bascule) ; rien n'est modifié ni supprimé sur la présentation, et
 * une attribution déjà définitive (`confirmee`) n'est jamais lue. Interrupteur éteint : rien.
 */
async function etapeBasculeRegleRendezVous(
  maintenant: Date,
  bilan: BilanPassageReseau,
): Promise<void> {
  if (!validationParRendezVousActive()) return;
  const basculees: Array<{ id: string; denomination: string; terme: Date }> = [];
  try {
    await basculerParPages(maintenant, bilan, basculees);
  } finally {
    await signalerBascules(basculees, maintenant);
  }
}

/**
 * Une seule alerte interne par passage qui a basculé quelque chose : le rapprochement des rendez-vous
 * ne se déclenche qu'à l'apparition d'un rendez-vous, donc un rendez-vous DÉJÀ pris ou tenu avant la
 * bascule n'est jamais proposé tout seul : à vérifier à la main. Signale aussi les termes courts.
 */
async function signalerBascules(
  basculees: ReadonlyArray<{ id: string; denomination: string; terme: Date }>,
  maintenant: Date,
): Promise<void> {
  if (basculees.length === 0) return;
  // Jour à l'heure de Paris ; la clé dépend AUSSI du contenu (hachage des ids basculés) : un second
  // passage le même jour, qui bascule d'autres présentations, n'est pas avalé par la dédup.
  const jour = maintenant.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const empreinte = createHash("sha256")
    .update(
      basculees
        .map((b) => b.id)
        .sort()
        .join(","),
    )
    .digest("hex")
    .slice(0, 12);
  const liste = basculees
    .slice(0, 50)
    .map((b) => {
      const reste = Math.max(0, Math.ceil((b.terme.getTime() - maintenant.getTime()) / 86_400_000));
      return `${b.denomination} (jusqu'au ${dateEnClair(b.terme)}${reste <= 15 ? `, ${reste} j restants` : ""})`;
    })
    .join(" ; ");
  const reste =
    basculees.length > 50
      ? ` ; … et ${basculees.length - 50} autres (voir le journal apporteur.presentation_basculee_rendez_vous)`
      : "";
  await alerteInterne({
    jobId: `apporteur-bascule-lot-${jour}-${empreinte}`,
    code: "apporteur_bascule_rendez_vous",
    titre: `${basculees.length} présentation(s) passée(s) à la règle du rendez-vous`,
    message: `Ces présentations en attente ne sont plus confirmées par le silence : ${liste}${reste}. Vérifiez les rendez-vous déjà pris ou tenus avec ces entreprises depuis la saisie : ils ne sont pas proposés automatiquement. À valider dans la console (Apporteurs › Entreprises présentées).`,
    cibleType: "PresentationEntreprise",
    cibleId: "bascule",
    maintenant,
  });
}

async function basculerParPages(
  maintenant: Date,
  bilan: BilanPassageReseau,
  basculees: Array<{ id: string; denomination: string; terme: Date }>,
): Promise<void> {
  let curseur: { at: Date; id: string } | null = null;
  for (let page = 0; page < PAGES_ECHEANCES_MAX; page++) {
    const lignes: Array<{
      id: string;
      denomination: string;
      recueAt: Date;
      contactEnvoyeAt: Date | null;
      apporteur: { statut: string; signatureApporteur: unknown };
    }> = await prisma.presentationEntreprise.findMany({
      where: {
        statut: "reservee",
        ...(curseur
          ? {
              OR: [
                { recueAt: { gt: curseur.at } },
                { recueAt: curseur.at, id: { gt: curseur.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        denomination: true,
        recueAt: true,
        contactEnvoyeAt: true,
        apporteur: { select: { statut: true, signatureApporteur: true } },
      },
      orderBy: [{ recueAt: "asc" }, { id: "asc" }],
      take: PAGE_ECHEANCES,
    });
    if (lignes.length === 0) return;
    let reservees: Awaited<ReturnType<typeof lireReservations>>;
    try {
      reservees = await lireReservations(lignes.map((l) => l.id));
    } catch (err) {
      if (tableAbsente(err)) return;
      throw err;
    }
    const sansLigne = lignes.filter((l) => !reservees.has(l.id));
    const rebonds =
      sansLigne.length > 0
        ? await idsPriseDeContactRebondie(sansLigne.map((l) => l.id))
        : new Set<string>();
    for (const p of sansLigne) {
      const d = basculeVersRendezVous({
        statut: "reservee",
        recueAt: p.recueAt,
        apporteur: {
          statut: p.apporteur.statut,
          signature: p.apporteur.signatureApporteur,
        },
        // Même date que l'étape (a) : atteinte, la présentation est déjà acquise.
        silenceAtteint:
          (p.contactEnvoyeAt
            ? dateConfirmationTaciteAvecContact(p.contactEnvoyeAt, p.recueAt)
            : dateConfirmationTaciteSansContact(p.recueAt)
          ).getTime() <= maintenant.getTime(),
        aUneLigne: false,
        rebond: rebonds.has(p.id),
        actif: validationParRendezVousActive(),
        maintenant,
      });
      if (d.bascule) {
        try {
          const ok = await prisma.$transaction(async (tx) => {
            // Garde RELUE dans la transaction : une confirmation ou une ligne née depuis la lecture l'emporte.
            const cur = await tx.presentationEntreprise.findUnique({
              where: { id: p.id },
              select: { statut: true },
            });
            if (cur?.statut !== "reservee") return false;
            if (await tx.presentationReservation.findUnique({ where: { presentationId: p.id } }))
              return false;
            await enregistrerReservation(p.id, d.reserveeJusquAt, tx);
            await tx.activityLog.create({
              data: {
                action: "apporteur.presentation_basculee_rendez_vous",
                targetType: "presentation_entreprise",
                targetId: p.id,
                changes: { reserveeJusquAt: d.reserveeJusquAt.toISOString() } as object,
              },
            });
            return true;
          });
          if (ok) {
            bilan.basculees += 1;
            basculees.push({ id: p.id, denomination: p.denomination, terme: d.reserveeJusquAt });
          }
        } catch (err) {
          // Table absente (migration pas encore passée) : on s'arrête, sans erreur.
          if (tableAbsente(err)) return;
          // Clé primaire déjà prise : une autre ligne est née entre-temps, rien à faire.
          if ((err as { code?: unknown })?.code === "P2002") continue;
          // Toute autre erreur : comptée au bilan, la boucle continue (une ligne en échec ne bloque pas les suivantes).
          bilan.erreurs += 1;
          signalerErreurReseau("bascule vers la règle du rendez-vous", err);
        }
      } else if (d.motif === "rebond" || d.motif === "terme_depasse") {
        // Terme dépassé sans rebond : le silence confirme au plus tard le lendemain, rien à signaler.
        bilan.basculeesEcartees += 1;
        if (d.motif === "rebond")
          await alerteInterne({
            jobId: `apporteur-bascule-ecartee-rebond-${p.id}`,
            code: "apporteur_bascule_ecartee",
            titre: `Présentation non basculée vers la règle du rendez-vous : ${p.denomination}`,
            message: `La prise de contact de ${p.denomination} est revenue en erreur : l'ancienne règle est suspendue et la présentation n'a pas été basculée vers la règle du rendez-vous. À trancher dans la console (Apporteurs › Entreprises présentées).`,
            cibleType: "PresentationEntreprise",
            cibleId: p.id,
            maintenant,
          });
      }
    }
    if (lignes.length < PAGE_ECHEANCES) return;
    const der = lignes[lignes.length - 1]!;
    curseur = { at: der.recueAt, id: der.id };
  }
}

// (b) ─────────────────────────────────────────────────────────────────────

const STATUTS_DEVIS_EN_COURS = ["envoye"] as const;
const STATUTS_FINANCEMENT_OUVERT = ["a_monter", "envoye", "accord_recu"] as const;

/**
 * Les faits de la Société qui justifient une prolongation, lus dans SES données :
 * devis en cours, dernier rendez-vous ou échange, dossier de financement ouvert.
 */
export async function faitsDeLaSociete(
  siren: string,
  terme: Date,
  emailPersonne: string | null,
): Promise<{ devisEnCours: boolean; dernierEchangeAt: Date | null; financementEnCours: boolean }> {
  const clients = await prisma.client.findMany({ where: { siren }, select: { id: true } });
  const clientId = { in: clients.map((c) => c.id) };
  const depuis = ajouterJours(terme, -PROLONGATION_FAITS_RECENTS_JOURS);
  const [devis, rencontres, calendly, financements] = await Promise.all([
    clients.length
      ? prisma.devis.count({
          where: {
            clientId,
            statut: { in: [...STATUTS_DEVIS_EN_COURS] },
            acceptedAt: null,
            declinedAt: null,
            dateValidite: { gte: terme },
          },
        })
      : Promise.resolve(0),
    clients.length
      ? prisma.rencontre.findMany({
          where: {
            clientId,
            OR: [{ statut: null }, { statut: { in: ["tenu", "planifie"] } }],
            AND: [
              {
                OR: [
                  { debutReel: { gte: depuis, lte: terme } },
                  { debutReel: null, debutPrevu: { gte: depuis, lte: terme } },
                ],
              },
            ],
          },
          select: { debutReel: true, debutPrevu: true },
          take: 20,
        })
      : Promise.resolve([] as Array<{ debutReel: Date | null; debutPrevu: Date | null }>),
    emailPersonne
      ? prisma.calendlyEvent.findMany({
          where: {
            inviteeEmail: emailPersonne,
            status: { in: ["scheduled", "completed"] },
            startTime: { gte: depuis, lte: terme },
          },
          select: { startTime: true },
          take: 20,
        })
      : Promise.resolve([] as Array<{ startTime: Date | null }>),
    clients.length
      ? prisma.dossierFinancement.count({
          where: { clientId, statut: { in: [...STATUTS_FINANCEMENT_OUVERT] } },
        })
      : Promise.resolve(0),
  ]);
  const dates = [
    ...rencontres.map((r) => r.debutReel ?? r.debutPrevu),
    ...calendly.map((c) => c.startTime),
  ].filter((d): d is Date => d instanceof Date);
  const dernier = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  return {
    devisEnCours: devis > 0,
    dernierEchangeAt: dernier,
    financementEnCours: financements > 0,
  };
}

async function etapeTerme(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
  const echues = await prisma.presentationEntreprise.findMany({
    where: { statut: "confirmee", protegeeJusquAt: { lte: maintenant } },
    select: {
      id: true,
      siren: true,
      protegeeJusquAt: true,
      prolongeeAt: true,
      personneEmail: true,
    },
  });
  for (const p of echues) {
    const terme = p.protegeeJusquAt!;
    const deja = p.prolongeeAt !== null;
    const faits = deja
      ? { devisEnCours: false, dernierEchangeAt: null, financementEnCours: false }
      : await faitsDeLaSociete(p.siren, terme, decryptPii(p.personneEmail) ?? null);
    const motif = motifDeProlongation({ deja, ...faits, terme });
    if (motif) {
      const r = await prisma.presentationEntreprise.updateMany({
        where: { id: p.id, statut: "confirmee", prolongeeAt: null },
        data: {
          protegeeJusquAt: ajouterMois(terme, PROLONGATION_MOIS),
          prolongeeAt: maintenant,
          motifProlongation: motif,
        },
      });
      bilan.prolongees += r.count;
      if (r.count === 1) await annoncerAttribution(p.id, "prolongee");
    } else {
      const r = await prisma.presentationEntreprise.updateMany({
        where: { id: p.id, statut: "confirmee", protegeeJusquAt: terme },
        data: { statut: "terminee" },
      });
      bilan.terminees += r.count;
    }
  }
}

// (c) ─────────────────────────────────────────────────────────────────────

/** Relances internes des commandes à attribuer : J+10, puis J+15 (une fois chacune). */
async function relancerAAttribuer(maintenant: Date): Promise<void> {
  for (const c of await lireAAttribuerEnAttente()) {
    const due = relanceAttributionDue(c.creeAt, maintenant);
    if (!due) continue;
    const jobId = `apporteur-commande-a-attribuer-${c.factureId}-j${due}`;
    if (await dejaEnvoye(jobId)) continue;
    await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: due === 15 ? "critique" : "important",
        code: "apporteur_commande_a_attribuer_relance",
        titre:
          due === 15
            ? "Commande à attribuer : délai de 15 jours DÉPASSÉ"
            : "Commande à attribuer : plus que 5 jours",
        message: `Une commande payée de l'entreprise SIREN ${c.siren} attend votre choix d'attribution depuis ${due} jours (contrat 2.6, art. 3.1 : 15 jours de l'encaissement). Console › Apporteurs › Commissions › Commandes à attribuer.`,
        cibleType: "FactureFormation",
        cibleId: c.factureId,
        createdAt: maintenant.toLocaleDateString("fr-FR"),
      },
      { jobId, entityType: "FactureFormation", entityId: c.factureId },
    );
  }
}

/**
 * Contrat 2.6 (relecture de a1) : une commande soldée dont l'établissement ne correspond à aucune
 * attribution exacte (SIRET absent, autre établissement, siège qui paie pour l'agence) passe « À
 * ATTRIBUER » : Williams est alerté UNE fois et choisit dans la console (art. 3.1 : sous 15 jours
 * de l'encaissement ; la commission reste due et le délai de paiement court de l'attribution).
 */
async function alerterAAttribuer(factureId: string, siren: string, maintenant: Date) {
  const jobId = `apporteur-commande-a-attribuer-${factureId}`;
  try {
    if (await dejaEnvoye(jobId)) return;
    await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_commande_a_attribuer",
        titre: "Commande payée à attribuer à un apporteur (sous 15 jours)",
        message: `Une commande payée de l'entreprise SIREN ${siren} ne correspond exactement à aucun établissement attribué (SIRET absent, autre établissement, ou siège qui paie pour une agence). Choisissez l'apporteur, ou « aucun », dans la console (Apporteurs › Commissions › Commandes à attribuer) dans les 15 jours de l'encaissement (contrat 2.6, art. 3.1).`,
        cibleType: "FactureFormation",
        cibleId: factureId,
        createdAt: maintenant.toLocaleDateString("fr-FR"),
      },
      { jobId, entityType: "FactureFormation", entityId: factureId },
    );
  } catch (err) {
    signalerErreurReseau("alerte commande à attribuer", err);
  }
}

async function alerterDeuxApporteurs(factureId: string, siren: string, maintenant: Date) {
  await alerteInterne({
    jobId: `apporteur-commande-deux-apporteurs-${factureId}`,
    code: "apporteur_commande_deux_apporteurs",
    titre: "Commande déjà commissionnée à un autre apporteur : aucune seconde commission",
    message: `Une commande payée de l'entreprise SIREN ${siren} est couverte par deux apporteurs, et l'un d'eux est déjà commissionné pour cette commande. Aucune seconde commission n'a été créée. À trancher dans la console (Apporteurs › Entreprises présentées).`,
    cibleType: "FactureFormation",
    cibleId: factureId,
    niveau: "critique",
    maintenant,
  });
}

const SELECT_PRESENTATION_PROTEGEE = {
  id: true,
  apporteurId: true,
  siren: true,
  denomination: true,
  recueAt: true,
  statut: true,
  confirmeeAt: true,
  protegeeJusquAt: true,
  apporteur: {
    select: {
      prenom: true,
      nom: true,
      email: true,
      parrainId: true,
      signeParSocieteAt: true,
      // La version signée décide de la grille (décision du 27/11).
      signatureApporteur: true,
    },
  },
} as const;

/**
 * Présentations qui ont été protégées : confirmées, ou terminées après une protection.
 *
 * Règle par rendez-vous : s'y ajoutent les présentations `reservee` ou `terminee` qui portent une
 * ligne de RÉSERVATION non validée (réservation en cours, échue ou ramenée par une résiliation).
 * `dementie`, `deja_connue` et `hors_champ` n'y entrent jamais, ligne ou non : un manquement ou une
 * entreprise déjà connue ne rapporte rien. Une présentation validée (ligne `valideeAt`) est
 * `confirmee` : elle passe par la première requête, jugée sur sa seule protection.
 */
export async function lirePresentationsProtegees(): Promise<
  Array<PresentationProtegee & ProtegeeLue>
> {
  const protegees = await prisma.presentationEntreprise.findMany({
    where: {
      statut: { in: ["confirmee", "terminee"] },
      confirmeeAt: { not: null },
      protegeeJusquAt: { not: null },
    },
    select: SELECT_PRESENTATION_PROTEGEE,
  });
  const reservations = await lireReservationsNonValidees();
  const reservees =
    reservations.size === 0
      ? []
      : await prisma.presentationEntreprise.findMany({
          where: {
            id: { in: [...reservations.keys()] },
            statut: { in: ["reservee", "terminee"] },
            confirmeeAt: null,
          },
          select: SELECT_PRESENTATION_PROTEGEE,
        });
  return [
    ...protegees.map((p) => ({ ...p, reservation: null })),
    ...reservees.map((p) => ({
      ...p,
      // `statut: "reservee"` pour `commandeCouverte`, que la présentation soit encore réservée,
      // échue ou résiliée : c'est la FIN de la réservation (ramenée par la résiliation) qui borne.
      reservation: {
        reserveeJusquAt: reservations.get(p.id)!.reserveeJusquAt,
        echueAt: reservations.get(p.id)!.echueAt,
        statut: "reservee",
      },
    })),
  ];
}

type ProtegeeLue = {
  apporteur: {
    prenom: string;
    nom: string;
    email: string;
    parrainId: string | null;
    signeParSocieteAt: Date | null;
    /** Lue seulement pour poser `versionContrat` à la création (relevé mensuel, lot R). */
    signatureApporteur?: unknown;
  };
};

/** Les fins de réservation des lignes NON validées (table absente : aucune). */
async function lireReservationsNonValidees(): Promise<
  Map<string, { reserveeJusquAt: Date; echueAt: Date | null }>
> {
  const m = new Map<string, { reserveeJusquAt: Date; echueAt: Date | null }>();
  try {
    const ls = await prisma.presentationReservation.findMany({
      where: { valideeAt: null },
      select: { presentationId: true, reserveeJusquAt: true, echueAt: true },
    });
    for (const l of ls)
      m.set(l.presentationId, { reserveeJusquAt: l.reserveeJusquAt, echueAt: l.echueAt ?? null });
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
  return m;
}

function parSiren<T extends { siren: string }>(l: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of l) m.set(x.siren, [...(m.get(x.siren) ?? []), x]);
  return m;
}

function estDoublon(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

async function etapeCommissions(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
  const presentations = await lirePresentationsProtegees();
  if (presentations.length === 0) return;
  const index = parSiren(presentations);
  const etablissements = await lireEtablissements(presentations.map((p) => p.id));
  const payees = await prisma.factureFormation.findMany({
    where: {
      // QNC L02 — une facture d'ESSAI ne fonde aucune commission d'apporteur.
      ...FACTURE_HORS_ESSAI,
      statut: "payee",
      avoirDeId: null,
      // Règle du 25/11 : rien sur les abonnements ni la maintenance (factures de plan récurrent).
      planRecurrentId: null,
      client: { siren: { in: [...index.keys()] } },
    },
    select: { id: true, devisId: true },
  });
  if (payees.length === 0) return;
  // La commande entière : toutes les factures du même devis (acompte + solde), et les avoirs.
  const devisIds = [...new Set(payees.map((f) => f.devisId).filter((d): d is string => !!d))];
  const lignes = await prisma.factureFormation.findMany({
    where: {
      ...FACTURE_HORS_ESSAI,
      avoirDeId: null,
      OR: [
        { id: { in: payees.map((f) => f.id) } },
        ...(devisIds.length ? [{ devisId: { in: devisIds } }] : []),
      ],
    },
    select: {
      id: true,
      devisId: true,
      statut: true,
      avoirDeId: true,
      activite: true,
      montantHtCents: true,
      emiseAt: true,
      lignes: true,
      devis: {
        select: { acceptedAt: true, montantTotalHtCents: true, journeeIa: true, lignes: true },
      },
      client: { select: { siren: true, siret: true } },
    },
  });
  const avoirsLignes = await prisma.factureFormation.findMany({
    where: { avoirDeId: { in: lignes.map((f) => f.id) } },
    select: {
      id: true,
      devisId: true,
      statut: true,
      avoirDeId: true,
      montantHtCents: true,
      emiseAt: true,
      lignes: true,
    },
  });
  const parId = new Map(lignes.map((f) => [f.id, f]));
  const totauxDevis = new Map<string, number>();
  for (const l of lignes) {
    if (l.devisId && l.devis) totauxDevis.set(l.devisId, l.devis.montantTotalHtCents);
  }
  const commandes = commandesSoldees([...lignes, ...avoirsLignes], totauxDevis);
  if (commandes.length === 0) return;
  // Contrat 2.6 : le SIRET de l'établissement qui commande (devis, sinon fiche client) et les
  // décisions de Williams sur les commandes « à attribuer ».
  const siretsDevis = await lireSiretsDevis([
    ...new Set(lignes.map((l) => l.devisId).filter((d): d is string => !!d)),
  ]);
  const decisions = await lireDecisionsAAttribuer(commandes.map((c) => c.factureCleId));
  const existantesToutes = await prisma.commissionApporteur.findMany({
    // Une commission ANNULÉE (avoir total) ne bloque ni la recréation sur la facture refaite, ni la
    // garde « deux apporteurs » : seul compte l'argent encore en jeu.
    where: { factureId: { in: commandes.flatMap((c) => c.factureIds) } },
    select: {
      id: true,
      factureId: true,
      apporteurId: true,
      parrainage: true,
      statut: true,
      montantCents: true,
      creeAt: true,
    },
  });
  const toutesCle = new Set(
    existantesToutes.map((e) => `${e.factureId}|${e.apporteurId}|${e.parrainage ? 1 : 0}`),
  );
  // Une ligne ne cesse de bloquer (facture refaite sous le même devis) que si la COMMANDE qu'elle
  // couvrait a été entièrement rendue au client par avoir — quelle que soit la facture du devis à
  // laquelle l'avoir est rattaché (`commandeRenduePourLaLigne`) — ET si la ligne est RÉELLEMENT
  // neutralisée (annulée, retenue, ou versée avec reprises égales à son montant). Sinon l'argent est
  // encore en jeu : une seconde commission le paierait deux fois (600 € + 600 € pour 2 000 €).
  const commandeDe = new Map<string, (typeof commandes)[number]>();
  for (const c of commandes) for (const id of c.factureIds) commandeDe.set(id, c);
  const rendue = (e: { factureId: string; creeAt: Date }): boolean => {
    const c = commandeDe.get(e.factureId);
    if (!c) return false;
    const membres = c.factureIds.map((id) => parId.get(id)).filter((x) => !!x);
    return commandeRenduePourLaLigne(membres, avoirsLignes, e.creeAt);
  };
  const versees = existantesToutes.filter((e) => e.statut === "versee");
  // Tour 2/2 (défaut 1) : une ligne versée n'est neutralisée que si ses reprises couvrent son
  // montant ET ses compléments vivants (`soldeDesLignesLiees`, source unique avec `avoir-client.ts`) :
  // une ligne reprise puis complétée bloque, jamais une ligne neuve à côté de son complément.
  const reprisesParLigne = new Map<string, number>();
  if (versees.length > 0) {
    const liees = await prisma.commissionApporteur.findMany({
      where: {
        palier: {
          in: versees.flatMap((e) => [
            `${PREFIXE_PALIER_REPRISE}${e.id}`,
            `${PREFIXE_PALIER_COMPLEMENT}${e.id}`,
          ]),
        },
      },
      select: { id: true, palier: true, montantCents: true, statut: true },
    });
    const complements = liees.filter((x) => (x.palier ?? "").startsWith(PREFIXE_PALIER_COMPLEMENT));
    const reprisesDesComplements = complements.length
      ? (
          await prisma.commissionApporteur.findMany({
            where: { palier: { in: complements.map((c) => `${PREFIXE_PALIER_REPRISE}${c.id}`) } },
            select: { id: true, palier: true, montantCents: true, statut: true },
          })
        ).filter((r) => complements.some((c) => r.palier === `${PREFIXE_PALIER_REPRISE}${c.id}`))
      : [];
    for (const e of versees) {
      const solde = soldeDesLignesLiees(
        e.id,
        [...liees, ...reprisesDesComplements],
        PREFIXE_PALIER_REPRISE,
      );
      reprisesParLigne.set(e.id, solde.reprisCents - solde.complementsCents);
    }
  }
  const neutralisee = (e: (typeof existantesToutes)[number]) =>
    ligneNeutralisee(e, reprisesParLigne.get(e.id) ?? 0);
  const existantes = existantesToutes.filter((e) => !(rendue(e) && neutralisee(e)));
  const cle = (f: string, a: string, p: boolean) => `${f}|${a}|${p ? 1 : 0}`;
  const dejaCle = new Set(existantes.map((e) => cle(e.factureId, e.apporteurId, e.parrainage)));
  // Une commission déjà créée sur n'importe quelle facture de la commande vaut pour la commande.
  const deja = {
    has: (_f: string, a: string, p: boolean, c: { factureIds: string[] }) =>
      c.factureIds.some((id) => dejaCle.has(cle(id, a, p))),
  };

  for (const commande of commandes) {
    const f = parId.get(commande.factureCleId);
    if (!f) continue;
    const signeeAt = dateDeCommande(f);
    const siren = f.client?.siren;
    if (!signeeAt || !siren) continue;
    const siret = siretDeLaCommande({
      devisSiret: f.devisId ? siretsDevis.get(f.devisId) : null,
      clientSiret: f.client?.siret,
    });
    const qui = presentationPourEtablissement(
      index.get(siren) ?? [],
      etablissements,
      signeeAt,
      siret,
    );
    if (!qui) continue;
    let p: (typeof presentations)[number];
    if ("aAttribuer" in qui) {
      // Jamais de perte silencieuse : la commande attend le choix de Williams.
      const d = decisions.get(commande.factureCleId);
      if (!d) {
        await ouvrirAAttribuer({
          factureId: commande.factureCleId,
          siren,
          siret,
          candidats: qui.candidats.map((c) => c.id),
        });
        await alerterAAttribuer(commande.factureCleId, siren, maintenant);
        continue;
      }
      const choisie = d.presentationId
        ? qui.candidats.find((c) => c.id === d.presentationId)
        : null;
      if (!d.decidee || d.aucune || !choisie) continue;
      p = choisie;
    } else {
      p = qui.presentation;
    }
    // Règle du 25/11 : maintenance, abonnement, hébergement, licence sur la même facture que la
    // mise en service = 0 € ; seule la mise en service donne 15 %.
    const avoirsActifs = avoirsLignes.filter(
      (a) =>
        a.statut !== "brouillon" &&
        a.statut !== "annulee" &&
        a.avoirDeId !== null &&
        commande.factureIds.includes(a.avoirDeId),
    );
    const recurrentCents = f.devis?.journeeIa
      ? 0
      : htLignesRecurrentesRestantesCents(
          f.devis ? f.devis.lignes : f.lignes,
          avoirsActifs.map((a) => a.lignes),
          lignes
            .filter(
              (m) =>
                commande.factureIds.includes(m.id) &&
                m.avoirDeId === null &&
                m.statut !== "brouillon" &&
                m.statut !== "annulee",
            )
            .map((m) => m.lignes),
        );
    // Plafond strict (26/11) : jamais plus que « total HT du devis − récurrent brut du devis »,
    // APRÈS le calcul ci-dessus (prorata des avoirs partiels, avoir annulé…), qui reste en place.
    const plafondBase = plafondBaseCommissionnableCents(
      f.devis ? f.devis.montantTotalHtCents : f.montantHtCents,
      f.devis ? f.devis.lignes : f.lignes,
      f.devis?.journeeIa === true,
    );
    const baseCommissionnable = Math.min(
      Math.max(0, commande.baseApresAvoirsCents - recurrentCents),
      plafondBase,
    );
    // Grille de la version signée par l'apporteur (décision du 27/11) ; date d'effet de l'avenant
    // 2.8 : lot S1 (table de l'avenant), `null` tant qu'il n'existe pas.
    const grille = grilleDeLaCommande({
      signature: p.apporteur.signatureApporteur,
      declareeAt: p.recueAt,
      commandeSigneeAt: signeeAt,
      avenant28EffetAt: null,
    });
    // Développement web (grille v3) : jamais de commission rétroactive avant la date d'effet.
    if (
      grille === "v3" &&
      f.activite === "site_web" &&
      signeeAt < DEVELOPPEMENT_WEB_COMMISSIONNE_DEPUIS
    )
      continue;
    if (grille === null)
      // ESCALADE, jamais un 0 € silencieux : la ligne naît « à qualifier » (ci-dessous) et Williams
      // est prévenu une fois.
      await alerteInterne({
        jobId: `apporteur-grille-inconnue-${commande.factureCleId}-${p.apporteurId}`,
        code: "apporteur_grille_inconnue",
        titre: "Commission à calculer à la main : version du contrat signé inconnue",
        message: `Une commande payée de l'entreprise SIREN ${siren} revient à un apporteur dont la version de contrat signée n'a pas de grille connue. La commission est « à qualifier » : ${MESSAGE_GRILLE_INCONNUE} (Apporteurs › Commissions).`,
        cibleType: "FactureFormation",
        cibleId: commande.factureCleId,
        niveau: "critique",
        maintenant,
      });
    // Journée IA : repérée par `devis.journee_ia` (aucune valeur d'énumération nouvelle).
    // La règle appliquée est posée à la création (relevé mensuel, lot R) : le calcul est celui
    // d'avant, seul un code est ajouté. Jamais rétroactif.
    const baseAvantPlafond = Math.max(0, commande.baseApresAvoirsCents - recurrentCents);
    let regle: RegleAppliquee | null = null;
    let calc: CalculCommission;
    if (grille === null) {
      calc = { statut: "a_qualifier" };
    } else if (f.devis?.journeeIa === true) {
      calc = calculerCommissionJourneeIa({
        activite: (f.activite ?? null) as ActiviteCommission | null,
        lignes: f.devis.lignes,
        netHtCents: commande.baseApresAvoirsCents,
      });
      regle = "journee_ia";
    } else {
      const r = calculerCommissionSelonGrilleAvecRegle({
        activite: (f.activite ?? null) as ActiviteCommission | null,
        factureHtCents: baseCommissionnable,
        palier: null,
        signeeAt,
        grille,
      });
      calc = r.calcul;
      regle = regleApresPlafond(r.regle, baseAvantPlafond, plafondBase);
    }
    const versionContrat = versionContratSignee(p.apporteur.signatureApporteur);
    if (calc.statut === "aucune") continue;
    // JAMAIS deux apporteurs commissionnés pour une même entreprise : si une autre personne a déjà
    // une commission (hors part de parrain) sur cette commande, rien n'est créé et Williams tranche.
    if (
      existantes.some(
        (e) =>
          e.apporteurId !== p.apporteurId &&
          !e.parrainage &&
          commande.factureIds.includes(e.factureId),
      )
    ) {
      await alerterDeuxApporteurs(commande.factureCleId, siren, maintenant);
      continue;
    }
    const base = {
      presentationId: p.id,
      factureId: commande.factureCleId,
      activite: f.activite ?? "inconnue",
      factureHtCents: baseCommissionnable,
    };

    // La commission de l'apporteur.
    let filleulCreeCeTour = false;
    const bloquantes = existantes.filter(
      (e) =>
        e.apporteurId === p.apporteurId &&
        !e.parrainage &&
        commande.factureIds.includes(e.factureId),
    );
    if (bloquantes.length > 0 && bloquantes.every(neutralisee)) {
      // Jamais de blocage SILENCIEUX : la commande est de nouveau soldée, la seule commission de
      // l'apporteur est neutralisée, mais la commande n'est pas entièrement rendue. Williams
      // tranche (une alerte, une fois) ; rien n'est créé à l'aveugle.
      await alerteInterne({
        jobId: `apporteur-commande-bloquee-${commande.factureCleId}-${p.apporteurId}`,
        code: "apporteur_commande_bloquee",
        titre: "Commande de nouveau payée, commission neutralisée : à trancher",
        message: `Une commande payée de l'entreprise SIREN ${siren} porte une commission annulée, retenue ou reprise, alors que la commande n'a pas été entièrement rendue au client. Aucune nouvelle commission n'a été créée. À trancher dans la console (Apporteurs › Commissions).`,
        cibleType: "FactureFormation",
        cibleId: commande.factureCleId,
        maintenant,
      });
    }
    if (!deja.has(f.id, p.apporteurId, false, commande)) {
      try {
        if (calc.statut === "calculee") {
          const v = await statutApresVigilance(p.apporteurId, calc.montantCents, maintenant);
          await prisma.commissionApporteur.create({
            data: {
              ...base,
              apporteurId: p.apporteurId,
              palier: calc.palier,
              prixPublicHtCents: calc.prixPublicCents,
              montantCents: calc.montantCents,
              statut: v.statut,
              regleAppliquee: regle,
              versionContrat,
            },
            select: { id: true },
          });
          if (v.demander && (await demanderVigilance(p.apporteurId, "premiere")) !== "deja") {
            bilan.vigilancesDemandees += 1;
          }
        } else {
          await prisma.commissionApporteur.create({
            data: { ...base, apporteurId: p.apporteurId, statut: "a_qualifier" },
            select: { id: true },
          });
        }
        bilan.commissionsCreees += 1;
        filleulCreeCeTour = true;
      } catch (err) {
        if (!estDoublon(err)) throw err;
      }
    }

    // La part du parrain (un seul niveau), dans les 6 mois de la signature du filleul.
    const { parrainId, signeParSocieteAt } = p.apporteur;
    if (!parrainId || !signeParSocieteAt || !dansFenetreParrainage(signeParSocieteAt, signeeAt))
      continue;
    if (deja.has(f.id, parrainId, true, commande)) continue;
    // Une part de parrain annulée (avoir total) ne renaît qu'à côté d'une commission du filleul
    // VIVANTE sur la commande : créée dans CE passage, ou déjà là et non neutralisée (un passage
    // précédent a pu créer le filleul puis échouer sur le parrain). Jamais seule à côté d'un
    // filleul repris ou retenu (même résultat avant/après).
    const filleulVivant =
      filleulCreeCeTour || (bloquantes.length > 0 && !bloquantes.every(neutralisee));
    if (!filleulVivant && commande.factureIds.some((id) => toutesCle.has(`${id}|${parrainId}|1`)))
      continue;
    try {
      if (calc.statut === "calculee") {
        const part = partParrainage({
          commissionFilleulCents: calc.montantCents,
          filleulSigneAt: signeParSocieteAt,
          commandeSigneeAt: signeeAt,
        });
        const v = await statutApresVigilance(parrainId, part, maintenant);
        // Version signée par le PARRAIN (un apporteur signé), pas celle du filleul.
        const parrain = await prisma.apporteurReseau.findUnique({
          where: { id: parrainId },
          select: { signatureApporteur: true },
        });
        await prisma.commissionApporteur.create({
          data: {
            ...base,
            apporteurId: parrainId,
            parrainage: true,
            montantCents: part,
            statut: v.statut,
            regleAppliquee: "parrainage_10",
            versionContrat: versionContratSignee(parrain?.signatureApporteur),
          },
          select: { id: true },
        });
        if (v.demander && (await demanderVigilance(parrainId, "premiere")) !== "deja") {
          bilan.vigilancesDemandees += 1;
        }
      } else {
        await prisma.commissionApporteur.create({
          data: { ...base, apporteurId: parrainId, parrainage: true, statut: "a_qualifier" },
          select: { id: true },
        });
      }
      bilan.partsParrainage += 1;
    } catch (err) {
      if (!estDoublon(err)) throw err;
    }
  }
}

// (d) ─────────────────────────────────────────────────────────────────────

async function etapeVigilance(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
  // Commissions en attente : libérées si les pièces sont là, sinon demande (une fois).
  const enAttente = await prisma.commissionApporteur.groupBy({
    by: ["apporteurId"],
    where: { statut: "en_attente_vigilance" },
    _count: { _all: true },
  });
  for (const g of enAttente) {
    if (await piecesVigilanceValides(g.apporteurId, maintenant)) {
      bilan.liberees += await libererSiPiecesValides(g.apporteurId, maintenant);
    } else if ((await demanderVigilance(g.apporteurId, "premiere")) !== "deja") {
      bilan.vigilancesDemandees += 1;
    } else if (await relancerVigilance(g.apporteurId, maintenant)) {
      bilan.relancesVigilance += 1;
    }
  }
  // Renouvellement : 15 jours avant l'échéance de l'attestation conforme, une fois par échéance.
  const aRenouveler = await prisma.pieceApporteur.findMany({
    where: {
      type: "vigilance",
      statut: "conforme",
      remplaceeAt: null,
      expireAt: { gt: maintenant, lte: ajouterJours(maintenant, RENOUVELLEMENT_VIGILANCE_JOURS) },
      apporteur: { statut: "signe" },
    },
    select: { apporteurId: true, expireAt: true },
  });
  for (const p of aRenouveler) {
    if ((await demanderVigilance(p.apporteurId, "renouvellement", p.expireAt!)) !== "deja") {
      bilan.vigilancesDemandees += 1;
    }
  }
}

// (e) ─────────────────────────────────────────────────────────────────────

async function etapeCommandeSignee(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
  const presentations = await lirePresentationsProtegees();
  if (presentations.length === 0) return;
  const index = parSiren(presentations);
  // Borne basse des devis (L8) : 30 jours, ou plus loin si une réservation non validée remonte
  // plus haut (un devis signé pendant la réservation peut être saisi tard). Une présentation SANS
  // réservation garde la limite de 30 jours (filtrée plus bas, par présentation).
  const limite30 = ajouterJours(maintenant, -FENETRE_COMMANDE_SIGNEE_JOURS);
  const recuesReservations = presentations
    .filter((p) => p.reservation)
    .map((p) => p.recueAt.getTime());
  const borneBasse = new Date(Math.min(limite30.getTime(), ...recuesReservations));
  const devis = await prisma.devis.findMany({
    where: {
      acceptedAt: { not: null, gte: borneBasse, lte: maintenant },
      client: { siren: { in: [...index.keys()] } },
    },
    select: {
      id: true,
      acceptedAt: true,
      sentAt: true,
      createdAt: true,
      replacesDevisId: true,
      client: { select: { siren: true, siret: true } },
    },
  });
  const etablissements = await lireEtablissements(presentations.map((p) => p.id));
  const siretsDevis = await lireSiretsDevis(devis.map((d) => d.id));
  for (const d of devis) {
    // MÊME source que la facture (relecture de a1) : `siretDeLaCommande`.
    const hors30Jours = d.acceptedAt!.getTime() < limite30.getTime();
    // Sans réservation à valider, la fenêtre reste de 30 jours : on ne cherche pas la présentation
    // d'un devis plus ancien que cela parmi les seules présentations protégées.
    const candidates = (index.get(d.client.siren ?? "") ?? []).filter(
      (c) => !hors30Jours || c.reservation,
    );
    const qui = presentationPourEtablissement(
      candidates,
      etablissements,
      d.acceptedAt!,
      siretDeLaCommande({ devisSiret: siretsDevis.get(d.id), clientSiret: d.client.siret }),
      // L7 : la date d'émission ne sert qu'à la validation d'une réservation (jamais la commission).
      await dateEmissionDevis(d),
    );
    // À attribuer : l'annonce attend le choix de Williams (aucune donnée ne part à l'aveugle).
    if (!qui || "aAttribuer" in qui) continue;
    const p = qui.presentation;
    // Règle par rendez-vous : une commande signée PENDANT la réservation (sans rendez-vous tenu).
    // La commission est due ; si la réservation court encore (ou vient de s'achever, signature avant
    // le terme), l'entreprise est validée à la date de signature (six mois). Williams en est averti
    // en console, UNE fois par devis. L'apporteur reçoit l'ANNONCE DE VALIDATION (idempotente, une
    // seule par présentation) ; jamais l'e-mail « commande signée » pour cette commande.
    // Validée par CETTE commande à un passage précédent (l'alerte avait pu échouer) : la
    // présentation est désormais `confirmee`, mais l'e-mail « commande signée » ne part jamais
    // pour elle ; l'alerte interne est retentée (idempotente) jusqu'à ce qu'elle parte.
    const valideeLe = p.reservation ? null : await valideeParCommandeLe(p.id);
    const dejaValidee = valideeLe !== null && d.acceptedAt!.getTime() <= valideeLe.getTime();
    if (p.reservation || dejaValidee) {
      // Réservation en cours, OU échue sans validation (jamais confirmée) avec une signature
      // entre la saisie et le terme (la couverture de `presentationPourEtablissement` l'a déjà vérifié).
      const rattrapable =
        p.statut === "terminee" && p.confirmeeAt === null && !!p.reservation?.echueAt;
      const validee =
        dejaValidee ||
        ((p.statut === "reservee" || rattrapable) &&
          (await validerParCommande(p.id, d.acceptedAt!, maintenant)));
      if (validee && !dejaValidee) {
        bilan.validationsParCommande += 1;
        p.statut = "confirmee";
        p.reservation = null;
        // Le contrat 2.8 (art. 3.2) veut que l'apporteur soit prévenu : UNE annonce, idempotente.
        await annoncerValidation(p.id, p.apporteurId);
      } else if (dejaValidee && valideeLe) {
        // Annonce échouée à un passage précédent : retentée, mais seulement si la validation est
        // récente (pas d'annonce en retard pour les anciennes).
        if (
          ajouterJoursOuvres(valideeLe, RELANCE_ANNONCE_JOURS_OUVRES).getTime() >
          maintenant.getTime()
        )
          await annoncerValidation(p.id, p.apporteurId);
      }
      await alerteInterne({
        jobId: `apporteur-commande-en-reservation-${d.id}`,
        code: "apporteur_commande_en_reservation",
        titre: `Commande signée pendant la réservation : ${p.denomination}`,
        message: `${p.denomination} a signé une commande le ${dateEnClair(d.acceptedAt!)}, pendant la réservation de l'apporteur et sans rendez-vous tenu. La commission est due à la facture soldée. ${
          validee
            ? `L'entreprise est validée à la date de signature : la protection de six mois part de ce jour.`
            : `La validation n'a pas pu être enregistrée (déjà traitée, contrat de l'apporteur terminé, ou autre déclaration sur la même entreprise) : la commission reste due pour cette commande ; vérifiez la fiche en console.`
        }`,
        cibleType: "PresentationEntreprise",
        cibleId: p.id,
        maintenant,
      });
      continue;
    }
    // Cette commande a été traitée en console pendant la réservation : pas d'e-mail à l'apporteur.
    if (await dejaEnvoye(`apporteur-commande-en-reservation-${d.id}`)) continue;
    const jobId = `apporteur-commande-signee-${d.id}-${p.apporteurId}`;
    if (await dejaEnvoye(jobId)) continue;
    const r = await envoyer({
      gabarit: "apporteur-commande-signee",
      destinataire: decryptPii(p.apporteur.email) ?? "",
      payload: {
        contactName: [decryptPii(p.apporteur.prenom), decryptPii(p.apporteur.nom)]
          .filter(Boolean)
          .join(" "),
        entreprise: p.denomination,
      },
      entityType: "PresentationEntreprise",
      entityId: p.id,
      jobId,
    });
    if (r === "envoye" || r === "en-validation") bilan.commandesSigneesAnnoncees += 1;
  }
}

// (g) ─────────────────────────────────────────────────────────────────────

/** Sentinelle : annule la transaction sans être une erreur. */
class Annule extends Error {}

/**
 * Valide la réservation par une commande signée : écriture CONDITIONNELLE sur la ligne (pas déjà
 * validée) puis sur la présentation (`reservee`, ou `terminee` jamais confirmée pour le rattrapage),
 * dans une transaction qui s'annule si l'une des deux perd. Les six mois partent de la date de
 * signature. Rend vrai si CE passage gagne.
 *
 * Réservation ÉCHUE (rattrapage) : la ligne garde son `echueAt` ; la signature doit être au plus
 * tard au terme. Refus si l'apporteur est résilié, ou si une AUTRE déclaration occupe l'entreprise
 * (alerte critique : Williams tranche).
 */
async function validerParCommande(
  presentationId: string,
  signeeAt: Date,
  maintenant: Date,
): Promise<boolean> {
  let conflit = false;
  try {
    const validee = await prisma.$transaction(async (tx) => {
      const ligne = await tx.presentationReservation.findUnique({
        where: { presentationId },
        select: { reserveeJusquAt: true, echueAt: true, valideeAt: true },
      });
      if (!ligne || ligne.valideeAt) return false;
      // Une ligne échue ne se valide que si la signature tombe au plus tard au terme.
      if (ligne.echueAt && !(signeeAt.getTime() <= ligne.reserveeJusquAt.getTime())) return false;
      const p = await tx.presentationEntreprise.findUnique({
        where: { id: presentationId },
        select: { id: true, siren: true, apporteurId: true, statut: true, confirmeeAt: true },
      });
      if (!p || p.confirmeeAt) return false;
      const rattrapage = p.statut === "terminee";
      if (rattrapage && !ligne.echueAt) return false; // terminée par résiliation : rien à rattraper
      if (p.statut !== "reservee" && !rattrapage) return false;
      const apporteur = await tx.apporteurReseau.findUnique({
        where: { id: p.apporteurId },
        select: { statut: true },
      });
      if (apporteur?.statut === "resilie") return false;
      if (rattrapage && (await rattrapageEnConflit(tx, p, maintenant))) {
        conflit = true;
        return false;
      }
      const r = await tx.presentationReservation.updateMany({
        where: { presentationId, valideeAt: null },
        data: { valideeAt: maintenant, validationSource: "commande", valideeParId: "systeme" },
      });
      if (r.count !== 1) return false;
      const q = await tx.presentationEntreprise.updateMany({
        where: { id: presentationId, statut: { in: ["reservee", "terminee"] }, confirmeeAt: null },
        data: {
          statut: "confirmee",
          confirmeeAt: signeeAt,
          protegeeJusquAt: finDeProtectionRendezVous(signeeAt),
        },
      });
      if (q.count !== 1) throw new Annule();
      return true;
    });
    if (conflit) await alerterConflitRattrapage(presentationId, maintenant);
    return validee;
  } catch (err) {
    if (err instanceof Annule) return false;
    throw err;
  }
}

/**
 * Annonce la validation à l'apporteur (contrat 2.8, art. 3.2) : UNE fois (`jobId` de
 * `annoncerAttribution`). Un apporteur RETIRÉ du réseau ne reçoit rien (seuls les e-mails liés à
 * l'argent lui parviennent). Ne lève pas.
 */
async function annoncerValidation(presentationId: string, apporteurId: string): Promise<void> {
  try {
    const retrait = await prisma.apporteurReseauRetrait.findUnique({
      where: { apporteurId },
      select: { apporteurId: true },
    });
    if (retrait) return;
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
  await annoncerAttribution(presentationId, "confirmee");
}

/**
 * L7 : date d'émission d'un devis = `sentAt ?? createdAt`, la PLUS ANCIENNE de la chaîne des devis
 * qu'il remplace (`replacesDevisId`, 10 maillons au plus). `null` si rien n'est lisible.
 */
async function dateEmissionDevis(d: {
  sentAt?: Date | null;
  createdAt?: Date | null;
  replacesDevisId?: string | null;
}): Promise<Date | null> {
  let plusAncienne: Date | null = null;
  let courant: typeof d | null = d;
  const vus = new Set<string>();
  for (let i = 0; courant && i < MAILLONS_DEVIS_MAX; i++) {
    const emis = courant.sentAt ?? courant.createdAt ?? null;
    if (emis && (!plusAncienne || emis.getTime() < plusAncienne.getTime())) plusAncienne = emis;
    const suivant: string | null | undefined = courant.replacesDevisId;
    if (!suivant || vus.has(suivant)) break;
    vus.add(suivant);
    courant = await prisma.devis.findUnique({
      where: { id: suivant },
      select: { sentAt: true, createdAt: true, replacesDevisId: true },
    });
  }
  return plusAncienne;
}

/** Date de validation d'une réservation par une COMMANDE signée (sinon `null`, table absente comprise). */
async function valideeParCommandeLe(presentationId: string): Promise<Date | null> {
  try {
    const r = await prisma.presentationReservation.findUnique({
      where: { presentationId },
      select: { valideeAt: true, validationSource: true },
    });
    return r?.validationSource === "commande" ? (r.valideeAt ?? null) : null;
  } catch (err) {
    if (!tableAbsente(err)) throw err;
    return null;
  }
}

/** Les propositions de rendez-vous non écartées d'une présentation (table absente : aucune). */
async function lirePropositionsOuvertes(presentationId: string): Promise<Date[]> {
  try {
    const ls = await prisma.propositionRendezVousPresentation.findMany({
      where: { presentationId, ecarteeAt: null },
      select: { prisAt: true },
    });
    return ls.map((l) => l.prisAt);
  } catch (err) {
    if (!tableAbsente(err)) throw err;
    return [];
  }
}

/**
 * Échéance des réservations (règle par rendez-vous) : à la fin des 60 jours, sans validation, la
 * présentation devient `terminee`. Deux écritures conditionnelles dans UNE transaction : la ligne
 * (`echueAt` et `valideeAt` vides) puis la présentation (encore `reservee`). Une validation
 * simultanée et l'échéance ne gagnent jamais toutes les deux ; rejouée, l'échéance est sans effet.
 *
 * Un rendez-vous PRIS pendant la réservation et pas encore tenu garde l'entreprise
 * (`reservationOccupe`), et une proposition de rendez-vous recevable, non écartée, suspend
 * l'échéance et alerte Williams en interne, une fois. Aucun e-mail à l'apporteur, jamais.
 * Aucune prolongation : `faitsDeLaSociete` n'est jamais lu pour une réservation.
 */
/** Taille d'une page de réservations échues ; le passage les lit TOUTES, page après page. */
const PAGE_ECHEANCES = 500;
/** Garde-fou : au plus 40 pages (20 000 réservations) par passage. */
const PAGES_ECHEANCES_MAX = 40;

type ReservationEchue = {
  presentationId: string;
  reserveeJusquAt: Date;
  rendezVousPrisAt: Date | null;
  rendezVousAt: Date | null;
};

/**
 * Alerte INTERNE (jamais l'apporteur) à l'approche du terme : une réservation sans rendez-vous ni
 * proposition, à `ALERTE_SANS_RDV_JOURS_AVANT_TERME` jours (ou moins) de son terme. « Saisir un
 * rendez-vous ou créer la rencontre avant le terme, sinon la réservation prend fin. » Une alerte
 * par réservation ET par terme (le `jobId` porte `reserveeJusquAt`). Un envoi qui échoue est
 * retenté au passage suivant (rien n'est mémorisé tant qu'il n'est pas parti).
 *
 * E5, dans la même étape : une proposition de rendez-vous en attente depuis plus de
 * `ALERTE_PROPOSITION_JOURS_OUVRES` jours ouvrés alerte Williams, une fois par proposition.
 */
async function etapeReservationsSansRendezVous(
  maintenant: Date,
  bilan: BilanPassageReseau,
): Promise<void> {
  const horizon = ajouterJours(maintenant, ALERTE_SANS_RDV_JOURS_AVANT_TERME);
  let curseur: { at: Date; id: string } | null = null;
  try {
    for (let page = 0; page < PAGES_ECHEANCES_MAX; page++) {
      const lignes: Array<{ presentationId: string; reserveeJusquAt: Date }> =
        await prisma.presentationReservation.findMany({
          where: {
            regle: "rendez_vous",
            echueAt: null,
            valideeAt: null,
            reserveeJusquAt: { gte: maintenant, lte: horizon },
            ...(curseur
              ? {
                  OR: [
                    { reserveeJusquAt: { gt: curseur.at } },
                    { reserveeJusquAt: curseur.at, presentationId: { gt: curseur.id } },
                  ],
                }
              : {}),
          },
          select: { presentationId: true, reserveeJusquAt: true },
          orderBy: [{ reserveeJusquAt: "asc" }, { presentationId: "asc" }],
          take: PAGE_ECHEANCES,
        });
      if (lignes.length === 0) break;
      const presentations = await prisma.presentationEntreprise.findMany({
        where: { id: { in: lignes.map((l) => l.presentationId) }, statut: "reservee" },
        select: { id: true, denomination: true },
      });
      const parId = new Map(presentations.map((p) => [p.id, p]));
      for (const l of lignes) {
        const p = parId.get(l.presentationId);
        if (!p) continue;
        if ((await lirePropositionsOuvertes(p.id)).length > 0) continue;
        const parti = await alerteInterne({
          jobId: `apporteur-reservation-sans-rdv-${p.id}-${l.reserveeJusquAt.toISOString()}`,
          code: "apporteur_reservation_sans_rdv",
          titre: `Réservation sans rendez-vous, terme proche : ${p.denomination}`,
          message: `La réservation de ${p.denomination} prend fin le ${dateEnClair(l.reserveeJusquAt)} et aucun rendez-vous n'est enregistré ni proposé. Saisir un rendez-vous ou créer la rencontre avant le terme, sinon la réservation prend fin. À traiter dans la console (Apporteurs › Entreprises présentées).`,
          cibleType: "PresentationEntreprise",
          cibleId: p.id,
          maintenant,
        });
        if (parti) bilan.reservationsBientotEchues += 1;
      }
      if (lignes.length < PAGE_ECHEANCES) break;
      const der = lignes[lignes.length - 1]!;
      curseur = { at: der.reserveeJusquAt, id: der.presentationId };
    }
  } catch (err) {
    if (!tableAbsente(err)) throw err;
    return;
  }
  await alerterPropositionsEnAttente(maintenant, bilan);
}

/** E5 : propositions de rendez-vous ni retenues ni écartées, en attente depuis plus de 5 jours ouvrés. */
async function alerterPropositionsEnAttente(
  maintenant: Date,
  bilan: BilanPassageReseau,
): Promise<void> {
  let propositions;
  try {
    propositions = await prisma.propositionRendezVousPresentation.findMany({
      // Au moins cinq jours civils : filtre large, le calcul en jours ouvrés est fait ensuite.
      where: {
        ecarteeAt: null,
        retenueAt: null,
        creeAt: { lte: ajouterJours(maintenant, -ALERTE_PROPOSITION_JOURS_OUVRES) },
      },
      select: { id: true, presentationId: true, creeAt: true },
      orderBy: [{ creeAt: "asc" }],
      take: PAGE_ECHEANCES,
    });
  } catch (err) {
    if (tableAbsente(err)) return;
    throw err;
  }
  const dues = propositions.filter(
    (pr) =>
      ajouterJoursOuvres(pr.creeAt, ALERTE_PROPOSITION_JOURS_OUVRES).getTime() <=
      maintenant.getTime(),
  );
  if (dues.length === 0) return;
  const presentations = await prisma.presentationEntreprise.findMany({
    // En cours, ou échue sans validation (rattrapage possible), jamais confirmée.
    where: {
      id: { in: [...new Set(dues.map((d) => d.presentationId))] },
      statut: { in: ["reservee", "terminee"] },
      confirmeeAt: null,
    },
    select: { id: true, denomination: true },
  });
  const parId = new Map(presentations.map((p) => [p.id, p]));
  for (const pr of dues) {
    const p = parId.get(pr.presentationId);
    if (!p) continue;
    const parti = await alerteInterne({
      jobId: `apporteur-proposition-en-attente-${pr.id}`,
      code: "apporteur_proposition_en_attente",
      titre: `Proposition de rendez-vous sans réponse : ${p.denomination}`,
      message: `Une proposition de rendez-vous pour ${p.denomination} attend depuis plus de ${ALERTE_PROPOSITION_JOURS_OUVRES} jours ouvrés (proposée le ${dateEnClair(pr.creeAt)}). Retenez-la ou écartez-la dans la console (Apporteurs › Entreprises présentées) : tant qu'elle reste ouverte, l'entreprise reste réservée.`,
      cibleType: "PresentationEntreprise",
      cibleId: p.id,
      maintenant,
    });
    if (parti) bilan.propositionsEnAttente += 1;
  }
}

async function etapeReservationsEchues(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
  try {
    await echeancesDesReservations(maintenant, bilan);
  } finally {
    // Même si une page a échoué : les alertes d'échéance manquées sont rattrapées.
    try {
      await rattraperAlertesEchues(maintenant);
    } catch (err) {
      if (!tableAbsente(err)) signalerErreurReseau("alertes d'échéance des réservations", err);
    }
  }
}

async function echeancesDesReservations(
  maintenant: Date,
  bilan: BilanPassageReseau,
): Promise<void> {
  // Ordre STABLE (les plus anciennes échéances d'abord) et lecture par CURSEUR : une réservation
  // suspendue (rendez-vous à trancher) reste dans le filtre, mais ne masque jamais les suivantes.
  let curseur: { at: Date; id: string } | null = null;
  for (let page = 0; page < PAGES_ECHEANCES_MAX; page++) {
    let lignes: ReservationEchue[];
    try {
      lignes = await prisma.presentationReservation.findMany({
        where: {
          echueAt: null,
          valideeAt: null,
          reserveeJusquAt: { lt: maintenant },
          ...(curseur
            ? {
                OR: [
                  { reserveeJusquAt: { gt: curseur.at } },
                  { reserveeJusquAt: curseur.at, presentationId: { gt: curseur.id } },
                ],
              }
            : {}),
        },
        select: {
          presentationId: true,
          reserveeJusquAt: true,
          rendezVousPrisAt: true,
          rendezVousAt: true,
        },
        orderBy: [{ reserveeJusquAt: "asc" }, { presentationId: "asc" }],
        take: PAGE_ECHEANCES,
      });
    } catch (err) {
      if (tableAbsente(err)) return;
      throw err;
    }
    if (lignes.length === 0) return;
    await traiterReservationsEchues(lignes, maintenant, bilan);
    if (lignes.length < PAGE_ECHEANCES) return;
    const der = lignes[lignes.length - 1]!;
    curseur = { at: der.reserveeJusquAt, id: der.presentationId };
  }
}

async function traiterReservationsEchues(
  lignes: readonly ReservationEchue[],
  maintenant: Date,
  bilan: BilanPassageReseau,
): Promise<void> {
  const presentations = await prisma.presentationEntreprise.findMany({
    where: { id: { in: lignes.map((l) => l.presentationId) }, statut: "reservee" },
    select: { id: true, denomination: true, recueAt: true },
  });
  const parId = new Map(presentations.map((p) => [p.id, p]));
  for (const l of lignes) {
    const p = parId.get(l.presentationId);
    if (!p) continue;
    // Une erreur sur UNE ligne n'arrête plus la page (critique #2464, point 22) : Sentry, compteur,
    // et la ligne revient au passage suivant (rien n'a été écrit pour elle).
    try {
      await traiterUneReservationEchue(l, p, maintenant, bilan);
    } catch (err) {
      bilan.erreurs += 1;
      signalerErreurReseau("passage quotidien : réservation échue (une ligne)", err);
    }
  }
}

async function traiterUneReservationEchue(
  l: ReservationEchue,
  p: { id: string; denomination: string; recueAt: Date },
  maintenant: Date,
  bilan: BilanPassageReseau,
): Promise<void> {
  // Rendez-vous pris et pas encore tenu (ligne), puis propositions non écartées : chacun garde
  // l'entreprise s'il a été PRIS pendant la réservation.
  const propositions = await lirePropositionsOuvertes(p.id);
  const enAttente = l.rendezVousPrisAt && !l.rendezVousAt ? [l.rendezVousPrisAt] : [];
  const retient = (prisAt: Date) =>
    reservationOccupe(
      {
        recueAt: p.recueAt,
        reserveeJusquAt: l.reserveeJusquAt,
        rendezVousEnAttentePrisAt: prisAt,
      },
      maintenant,
    );
  const parProposition = propositions.some(retient);
  if (parProposition || enAttente.some(retient)) {
    bilan.echeancesSuspendues += 1;
    if (parProposition) {
      await alerteInterne({
        jobId: `apporteur-echeance-suspendue-${p.id}`,
        code: "apporteur_echeance_suspendue",
        titre: `Réservation arrivée à échéance, rendez-vous à trancher : ${p.denomination}`,
        message: `La réservation de ${p.denomination} s'est achevée le ${dateEnClair(l.reserveeJusquAt)}, mais un rendez-vous pris pendant ces 60 jours vous est proposé. Tant que vous ne l'avez ni retenu ni écarté, l'entreprise reste réservée à son apporteur. À traiter dans la console (Apporteurs › Entreprises présentées).`,
        cibleType: "PresentationEntreprise",
        cibleId: p.id,
        maintenant,
      });
    }
    return;
  }
  try {
    const echue = await prisma.$transaction(async (tx) => {
      const r = await tx.presentationReservation.updateMany({
        where: { presentationId: p.id, echueAt: null, valideeAt: null },
        data: { echueAt: maintenant },
      });
      if (r.count !== 1) return false;
      const q = await tx.presentationEntreprise.updateMany({
        where: { id: p.id, statut: "reservee" },
        data: { statut: "terminee" },
      });
      if (q.count !== 1) throw new Annule();
      return true;
    });
    if (echue) {
      bilan.reservationsEchues += 1;
      await alerterReservationEchue(p.id, p.denomination, l.reserveeJusquAt, maintenant);
    }
  } catch (err) {
    if (!(err instanceof Annule)) throw err;
  }
}

/** L3b : « la réservation a pris fin » — alerte INTERNE, une fois par présentation (jobId stable). */
async function alerterReservationEchue(
  presentationId: string,
  denomination: string,
  reserveeJusquAt: Date,
  maintenant: Date,
): Promise<boolean> {
  return alerteInterne({
    jobId: `apporteur-reservation-echue-${presentationId}`,
    code: "apporteur_reservation_echue",
    titre: `Réservation terminée : ${denomination}`,
    message: `La réservation de ${denomination} a pris fin le ${dateEnClair(reserveeJusquAt)} sans validation : la réservation a pris fin ; un rendez-vous pris avant le terme peut encore être validé (console › Apporteurs › Entreprises présentées).`,
    cibleType: "PresentationEntreprise",
    cibleId: presentationId,
    maintenant,
  });
}

/** L3b : rattrape les alertes d'échéance qui n'ont pas pu partir (lignes échues depuis moins de 7 jours). Idempotent. */
async function rattraperAlertesEchues(maintenant: Date): Promise<void> {
  const lignes = await prisma.presentationReservation.findMany({
    where: {
      regle: "rendez_vous",
      valideeAt: null,
      echueAt: { gte: ajouterJours(maintenant, -RATTRAPAGE_ALERTE_ECHUE_JOURS), lte: maintenant },
    },
    select: { presentationId: true, reserveeJusquAt: true },
    orderBy: [{ echueAt: "asc" }],
    take: PAGE_ECHEANCES,
  });
  if (lignes.length === 0) return;
  const presentations = await prisma.presentationEntreprise.findMany({
    where: {
      id: { in: lignes.map((l) => l.presentationId) },
      statut: "terminee",
      confirmeeAt: null,
    },
    select: { id: true, denomination: true },
  });
  const parId = new Map(presentations.map((p) => [p.id, p]));
  for (const l of lignes) {
    const p = parId.get(l.presentationId);
    if (p) await alerterReservationEchue(p.id, p.denomination, l.reserveeJusquAt, maintenant);
  }
}

// (f) ─────────────────────────────────────────────────────────────────────

/**
 * Dossier non complété : un rappel à J+3, un à J+7 après l'ENVOI du lien (journal d'e-mails : le lien
 * envoyé à la main OU l'e-mail « Retenu » qui le porte),
 * puis plus rien. Un lien renvoyé repart de zéro (la clé « une fois » porte l'id de l'envoi).
 * Ni refusé, ni résilié, ni déjà signé ; une adresse morte n'est pas relancée.
 */
async function etapeRappelsDossier(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
  const candidats = await prisma.apporteurReseau.findMany({
    where: { statut: "dossier_en_cours", signeParApporteurAt: null },
    select: { id: true, prenom: true, email: true, versionLien: true, submissionId: true },
  });
  let annexesDuPassage: ReturnType<typeof annexesDeLEnvoiDuLien> | undefined;
  for (const a of candidats) {
    const envoisLien = await prisma.emailLog.findMany({
      where: {
        template: "apporteur-dossier-lien",
        entityType: "ApporteurReseau",
        entityId: a.id,
        sentAt: { not: null },
        // Les rappels portent le même gabarit : on les écarte (un jobId nul reste un envoi d'origine).
        OR: [{ jobId: null }, { NOT: { jobId: { startsWith: PREFIXE_JOB_RAPPEL_DOSSIER } } }],
      },
      orderBy: { sentAt: "desc" },
      take: 5,
      select: { id: true, sentAt: true, jobId: true, bounceType: true },
    });
    // Chemin principal : l'e-mail « Retenu » porte lui-même le lien du dossier. Il est journalisé
    // sur la candidature (`Submission`), rattachée à l'apporteur par `submissionId`.
    const envoisRetenu = a.submissionId
      ? await prisma.emailLog.findMany({
          where: {
            template: "apporteur-issue-retenu",
            entityType: "Submission",
            entityId: a.submissionId,
            sentAt: { not: null },
          },
          orderBy: { sentAt: "desc" },
          take: 5,
          select: { id: true, sentAt: true, jobId: true, bounceType: true },
        })
      : [];
    const envois = [...envoisLien, ...envoisRetenu];
    const decision = rappelDossierAEnvoyer(envois, maintenant);
    if (!decision) continue;
    const { rappel } = decision;
    const jobId = decision.jobId(a.id);
    if (await dejaEnvoye(jobId)) continue;
    const url = urlDossier(a.id, a.versionLien);
    const destinataire = decryptPii(a.email);
    if (!url || !destinataire) continue;
    // Les relances portent aussi la fiche, le livret et le guide (facultatifs, jamais d'erreur).
    // Lus une seule fois par passage, et seulement s'il y a au moins une relance à envoyer.
    annexesDuPassage ??= annexesDeLEnvoiDuLien();
    const annexes = await annexesDuPassage;
    const r = await envoyer({
      gabarit: "apporteur-dossier-lien",
      destinataire,
      payload: {
        contactName: decryptPii(a.prenom) ?? "",
        dossierUrl: url,
        rappel,
        ...annexes.payload,
      },
      entityType: "ApporteurReseau",
      entityId: a.id,
      jobId,
      ...(annexes.attachments.length > 0 ? { attachments: annexes.attachments } : {}),
    });
    if (r === "envoye") {
      bilan.rappelsDossier += 1;
      await noterDocumentsRemis(a.id, annexes.attachments, "lien_dossier", jobId);
    }
  }
}

// ── #2464 pt 10 : contrat signé, jamais contresigné ──────────────────────

/** Délai (jours ouvrés) après la signature de l'apporteur avant la relance INTERNE. */
export const A_VERIFIER_JOURS_OUVRES = 2;

/**
 * Un apporteur « à vérifier » depuis plus de 2 jours ouvrés : alerte INTERNE (pas d'e-mail à
 * l'apporteur), une fois par jour et par apporteur tant que ce n'est pas traité. Se tait sinon.
 */
async function alerterAVerifierEnRetard(maintenant: Date): Promise<number> {
  const lignes = await prisma.apporteurReseau.findMany({
    where: { statut: "a_verifier", signeParApporteurAt: { not: null, lte: maintenant } },
    select: { id: true, signeParApporteurAt: true },
    take: 200,
  });
  let n = 0;
  for (const l of lignes) {
    const signe = l.signeParApporteurAt!;
    if (maintenant.getTime() <= ajouterJoursOuvres(signe, A_VERIFIER_JOURS_OUVRES).getTime())
      continue;
    const partie = await alerteSurveillance({
      code: "apporteur_a_verifier_en_retard",
      cle: `a-verifier-${l.id}`,
      titre: "Apporteur à vérifier depuis plus de 2 jours ouvrés",
      message: `Un apporteur a signé le ${dateEnClair(signe)} et attend toujours la vérification des pièces et la contresignature (console › Apporteurs › fiche ${l.id}). Rien n'est envoyé à l'apporteur.`,
      cibleId: l.id,
      maintenant,
      niveau: "important",
    });
    if (partie) n += 1;
  }
  return n;
}
