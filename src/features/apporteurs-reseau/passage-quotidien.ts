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

import { FACTURE_HORS_ESSAI } from "@/server/qualiopi/essai/perimetre";
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
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
import { envoyer } from "./envois";
import { lireReservations, tableAbsente } from "./reservation-presentation";
import { finDeProtectionRendezVous, reservationOccupe } from "./regle-attribution";
import { facturerCommissionsDues } from "./facturation";
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
import { executerResiliationsEchues } from "./resiliation";
import { signalerErreurReseau } from "./signaler";
import {
  ajouterJours,
  ajouterMois,
  baseHorsLignesRecurrentes,
  calculerCommission,
  DEVELOPPEMENT_WEB_COMMISSIONNE_DEPUIS,
  calculerCommissionJourneeIa,
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
  /** Échéances suspendues : un rendez-vous pris pendant la réservation reste à trancher. */
  echeancesSuspendues: number;
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
  reservation?: { reserveeJusquAt: Date; statut: string } | null;
}

/** La présentation qui couvre une commande : la plus ancienne reçue, s'il y en a plusieurs. */
export function presentationQuiCouvre<T extends PresentationProtegee>(
  candidates: readonly T[],
  signeeAt: Date,
): T | null {
  const couvrantes = candidates.filter((p) =>
    commandeCouverte({
      signeeAt,
      recueAt: p.recueAt,
      confirmee: p.confirmeeAt !== null,
      protegeeJusquAt: p.protegeeJusquAt,
      reservation: p.reservation ?? null,
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
): { presentation: T } | { aAttribuer: true; candidats: T[] } | null {
  const couvrantes = candidates
    .filter((p) =>
      commandeCouverte({
        signeeAt,
        recueAt: p.recueAt,
        confirmee: p.confirmeeAt !== null,
        protegeeJusquAt: p.protegeeJusquAt,
        reservation: p.reservation ?? null,
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
  | "confirmation-tacite"
  | "terme"
  | "commissions"
  | "avoirs-clients"
  | "autofacturation"
  | "vigilance"
  | "alerte-pieces-vigilance"
  | "commande-signee"
  | "reservations-echues"
  | "rappels-dossier"
  | "chiffrement-pieces"
  | "avoirs-sans-piece"
  | "hors-grille"
  | "declarations-sans-reponse"
  | "commandes-a-attribuer"
  | "resiliations-echues";

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
    echeancesSuspendues: 0,
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
    }
  }
  return bilan;
}

/** Le passage QUOTIDIEN : toutes les étapes. */
export async function passerReseauApporteurs(
  maintenant: Date = new Date(),
): Promise<BilanPassageReseau> {
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

/**
 * Alerte INTERNE (Williams, console), une seule fois par `jobId`. Jamais l'apporteur. Ne lève pas.
 * Rend vrai si l'alerte part maintenant.
 */
async function alerteInterne(a: {
  jobId: string;
  code: string;
  titre: string;
  message: string;
  cibleType: string;
  cibleId: string;
  niveau?: "important" | "critique";
  maintenant: Date;
}): Promise<boolean> {
  try {
    if (await dejaEnvoye(a.jobId)) return false;
    const r = await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: a.niveau ?? "important",
        code: a.code,
        titre: a.titre,
        message: a.message,
        cibleType: a.cibleType,
        cibleId: a.cibleId,
        rubrique: "apporteurs",
        chemin: "apporteurs/entreprises",
        createdAt: a.maintenant.toLocaleDateString("fr-FR"),
      },
      { jobId: a.jobId, entityType: a.cibleType, entityId: a.cibleId },
    );
    return r.enqueued === true;
  } catch (err) {
    signalerErreurReseau(`alerte interne ${a.code}`, err);
    return false;
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
    select: { prenom: true, nom: true, email: true, parrainId: true, signeParSocieteAt: true },
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
async function lirePresentationsProtegees(): Promise<Array<PresentationProtegee & ProtegeeLue>> {
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
      reservation: { reserveeJusquAt: reservations.get(p.id)!, statut: "reservee" },
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
  };
};

/** Les fins de réservation des lignes NON validées (table absente : aucune). */
async function lireReservationsNonValidees(): Promise<Map<string, Date>> {
  const m = new Map<string, Date>();
  try {
    const ls = await prisma.presentationReservation.findMany({
      where: { valideeAt: null },
      select: { presentationId: true, reserveeJusquAt: true },
    });
    for (const l of ls) m.set(l.presentationId, l.reserveeJusquAt);
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
    // Développement web : jamais de commission rétroactive sur une commande signée avant la date d'effet.
    if (f.activite === "site_web" && signeeAt < DEVELOPPEMENT_WEB_COMMISSIONNE_DEPUIS) continue;
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
    const baseCommissionnable = f.devis?.journeeIa
      ? commande.baseApresAvoirsCents
      : baseHorsLignesRecurrentes(commande.baseApresAvoirsCents, f.devis?.lignes);
    // Journée IA : repérée par `devis.journee_ia` (aucune valeur d'énumération nouvelle).
    const calc =
      f.devis?.journeeIa === true
        ? calculerCommissionJourneeIa({
            activite: (f.activite ?? null) as ActiviteCommission | null,
            lignes: f.devis.lignes,
            netHtCents: commande.baseApresAvoirsCents,
          })
        : calculerCommission({
            activite: (f.activite ?? null) as ActiviteCommission | null,
            factureHtCents: baseCommissionnable,
            palier: null,
          });
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
        await prisma.commissionApporteur.create({
          data: {
            ...base,
            apporteurId: parrainId,
            parrainage: true,
            montantCents: part,
            statut: v.statut,
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
  const devis = await prisma.devis.findMany({
    where: {
      acceptedAt: {
        not: null,
        gte: ajouterJours(maintenant, -FENETRE_COMMANDE_SIGNEE_JOURS),
        lte: maintenant,
      },
      client: { siren: { in: [...index.keys()] } },
    },
    select: { id: true, acceptedAt: true, client: { select: { siren: true, siret: true } } },
  });
  const etablissements = await lireEtablissements(presentations.map((p) => p.id));
  const siretsDevis = await lireSiretsDevis(devis.map((d) => d.id));
  for (const d of devis) {
    // MÊME source que la facture (relecture de a1) : `siretDeLaCommande`.
    const qui = presentationPourEtablissement(
      index.get(d.client.siren ?? "") ?? [],
      etablissements,
      d.acceptedAt!,
      siretDeLaCommande({ devisSiret: siretsDevis.get(d.id), clientSiret: d.client.siret }),
    );
    // À attribuer : l'annonce attend le choix de Williams (aucune donnée ne part à l'aveugle).
    if (!qui || "aAttribuer" in qui) continue;
    const p = qui.presentation;
    // Règle par rendez-vous : une commande signée PENDANT la réservation (sans rendez-vous tenu).
    // La commission est due ; si la réservation court encore, l'entreprise est validée à la date de
    // signature (six mois). Williams en est averti en console, UNE fois par devis. Jamais d'e-mail à
    // l'apporteur : ce n'est pas l'annonce d'une commande d'une entreprise protégée.
    // Validée par CETTE commande à un passage précédent (l'alerte avait pu échouer) : la
    // présentation est désormais `confirmee`, mais l'e-mail « commande signée » ne part jamais
    // pour elle ; l'alerte interne est retentée (idempotente) jusqu'à ce qu'elle parte.
    const valideeLe = p.reservation ? null : await valideeParCommandeLe(p.id);
    const dejaValidee = valideeLe !== null && d.acceptedAt!.getTime() <= valideeLe.getTime();
    if (p.reservation || dejaValidee) {
      const validee =
        dejaValidee ||
        (p.statut === "reservee" && (await validerParCommande(p.id, d.acceptedAt!, maintenant)));
      if (validee && !dejaValidee) {
        bilan.validationsParCommande += 1;
        p.statut = "confirmee";
        p.reservation = null;
      }
      await alerteInterne({
        jobId: `apporteur-commande-en-reservation-${d.id}`,
        code: "apporteur_commande_en_reservation",
        titre: `Commande signée pendant la réservation : ${p.denomination}`,
        message: `${p.denomination} a signé une commande le ${dateEnClair(d.acceptedAt!)}, pendant la réservation de l'apporteur et sans rendez-vous tenu. La commission est due à la facture soldée. ${
          validee
            ? `L'entreprise est validée à la date de signature : la protection de six mois part de ce jour.`
            : `La réservation était déjà close : la commission reste due pour cette commande, sans nouvelle protection.`
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
 * Valide la réservation par une commande signée : écriture CONDITIONNELLE sur la ligne (ni échue, ni
 * déjà validée) puis sur la présentation (encore `reservee`), dans une transaction qui s'annule si
 * l'une des deux perd. Les six mois partent de la date de signature. Rend vrai si CE passage gagne.
 */
async function validerParCommande(
  presentationId: string,
  signeeAt: Date,
  maintenant: Date,
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const r = await tx.presentationReservation.updateMany({
        where: { presentationId, echueAt: null, valideeAt: null },
        data: { valideeAt: maintenant, validationSource: "commande", valideeParId: "systeme" },
      });
      if (r.count !== 1) return false;
      const q = await tx.presentationEntreprise.updateMany({
        where: { id: presentationId, statut: "reservee" },
        data: {
          statut: "confirmee",
          confirmeeAt: signeeAt,
          protegeeJusquAt: finDeProtectionRendezVous(signeeAt),
        },
      });
      if (q.count !== 1) throw new Annule();
      return true;
    });
  } catch (err) {
    if (err instanceof Annule) return false;
    throw err;
  }
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

async function etapeReservationsEchues(maintenant: Date, bilan: BilanPassageReseau): Promise<void> {
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
      continue;
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
      if (echue) bilan.reservationsEchues += 1;
    } catch (err) {
      if (!(err instanceof Annule)) throw err;
    }
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
    const r = await envoyer({
      gabarit: "apporteur-dossier-lien",
      destinataire,
      payload: { contactName: decryptPii(a.prenom) ?? "", dossierUrl: url, rappel },
      entityType: "ApporteurReseau",
      entityId: a.id,
      jobId,
    });
    if (r === "envoye") bilan.rappelsDossier += 1;
  }
}
