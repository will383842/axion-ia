/**
 * Réseau d'apporteurs (démarrage manuel) — TOUS les e-mails partent d'ici.
 *
 * Les noms de gabarit sont écrits EN TOUTES LETTRES : le catalogue des e-mails
 * (`server/email/apercu/catalogue.spec.ts`) retrouve l'émetteur d'un gabarit à son nom
 * littéral dans le fichier qui appelle `enqueueEmail`.
 *
 * `apercu()` vit dans `./apercu-envoi` (qui importe `server-only`) : ce module-ci est chargé par
 * le worker (tsx, hors de Next) et ne doit rien importer qui en dépende (Sentry AXION-IA-25).
 */

import {
  avecLienEspaceRecalcule,
  jobIdSansDeuxPoints,
  resultatDeLEnfilage,
  retirerEnvoiEchoue,
  type ResultatEnvoi,
} from "@/server/email/envoi-monde";
import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";

import { signalerErreurReseau } from "./signaler";
import { prisma } from "@/lib/prisma";
import { urlDossier } from "./jeton";
import { GABARITS_ARGENT, argentEnJeu, retraitDe } from "./retrait";

export type GabaritApporteur =
  | "apporteur-dossier-lien"
  | "apporteur-dossier-a-completer"
  | "apporteur-dossier-refuse"
  | "apporteur-dossier-a-verifier"
  | "apporteur-dossier-recu"
  | "apporteur-commission-suspension"
  | "apporteur-regime-tva"
  | "apporteur-manquement"
  | "apporteur-resiliation-notifiee"
  | "apporteur-resiliation-effective"
  | "apporteur-commission-avoir-client"
  | "apporteur-non-commissionne"
  | "apporteur-contrat-signe"
  | "apporteur-presentation-recue"
  | "apporteur-presentation-recue-rendez-vous"
  | "apporteur-presentation-refusee"
  | "apporteur-presentation-non-retenue"
  | "entreprise-prise-de-contact-apporteur"
  | "apporteur-vigilance"
  | "apporteur-commande-signee"
  | "apporteur-commande-non-attribuee"
  | "apporteur-attribution-confirmee"
  | "apporteur-releve"
  | "apporteur-releve-mensuel"
  | "apporteur-file-attente-premier-rang"
  | "apporteur-virement-fait"
  | "apporteur-lien-espace"
  | "apporteur-avenant-propose"
  | "apporteur-avenant-relance"
  | "apporteur-avenant-enregistre"
  | "apporteur-compte-a-confirmer"
  | "apporteur-compte-demande-bloquee"
  | "apporteur-compte-change"
  | "apporteur-compte-refuse"
  | "apporteur-compte-expire";

function GABARITS_COMPTE_BANCAIRE_LISTE(): GabaritApporteur[] {
  return [
    "apporteur-compte-a-confirmer",
    "apporteur-compte-demande-bloquee",
    "apporteur-compte-change",
    "apporteur-compte-refuse",
    "apporteur-compte-expire",
  ];
}

/**
 * E-mails de SÉCURITÉ du compte bancaire : exclus d'`avecLienEspace` (plan §6.1). Aucun ne porte le
 * lien personnel de l'espace ; le lien neuf part dans un e-mail séparé (`apporteur-lien-espace`).
 */
const GABARITS_SANS_LIEN_ESPACE: ReadonlySet<string> = new Set(GABARITS_COMPTE_BANCAIRE_LISTE());

export const GABARITS_APPORTEUR: readonly GabaritApporteur[] = [
  "apporteur-dossier-lien",
  "apporteur-dossier-a-completer",
  "apporteur-dossier-refuse",
  // « apporteur-dossier-a-verifier » n'y est PAS (relecture de a1, 08/10) : c'est l'alerte
  // INTERNE envoyée à Williams, pas un e-mail à l'apporteur — elle ne se coupe jamais.
  "apporteur-dossier-recu",
  "apporteur-commission-suspension",
  "apporteur-regime-tva",
  "apporteur-manquement",
  "apporteur-resiliation-notifiee",
  "apporteur-resiliation-effective",
  "apporteur-commission-avoir-client",
  "apporteur-non-commissionne",
  "apporteur-contrat-signe",
  "apporteur-presentation-recue",
  "apporteur-presentation-recue-rendez-vous",
  "apporteur-presentation-refusee",
  "apporteur-presentation-non-retenue",
  "entreprise-prise-de-contact-apporteur",
  "apporteur-vigilance",
  "apporteur-commande-signee",
  "apporteur-commande-non-attribuee",
  "apporteur-attribution-confirmee",
  "apporteur-releve",
  "apporteur-releve-mensuel",
  "apporteur-file-attente-premier-rang",
  "apporteur-virement-fait",
  // Avenant 2.8 (lot S4, #2512) : gabarits livrés au worker AVANT leur émetteur (lot S3).
  "apporteur-avenant-propose",
  "apporteur-avenant-relance",
  "apporteur-avenant-enregistre",
  "apporteur-lien-espace",
  // Changement de compte bancaire (lot 4 du plan changement d'IBAN) : jamais de repli (`gabaritRepli`), voir §6.1.
  ...GABARITS_COMPTE_BANCAIRE_LISTE(),
];

export interface EnvoiApporteur {
  gabarit: GabaritApporteur;
  destinataire: string;
  payload: Record<string, unknown>;
  /** Traçabilité (EmailLog) : l'apporteur ou la présentation concernés. */
  entityType: "ApporteurReseau" | "PresentationEntreprise";
  entityId: string;
  /** Clé d'idempotence : un même envoi n'est jamais doublé. */
  jobId?: string;
  attachments?: Array<{
    filename: string;
    r2Key: string;
    contentType?: string;
    facultative?: boolean;
  }>;
}

// Fonctions communes du module d'envoi « monde » (FAC-1) : ré-exportées, jamais recopiées.
export { avecTexteLibre, retirerEnvoiEchoue } from "@/server/email/envoi-monde";
export type { ResultatEnvoi };

/**
 * Gabarits que reçoit l'APPORTEUR lui-même (et non une entreprise) : ce sont eux qui
 * s'arrêtent quand il est retiré, sauf ceux liés à l'argent (`GABARITS_ARGENT`).
 */
const GABARITS_VERS_L_APPORTEUR: ReadonlySet<string> = new Set([
  "apporteur-dossier-lien",
  "apporteur-dossier-a-completer",
  "apporteur-dossier-refuse",
  // « apporteur-dossier-a-verifier » n'y est PAS (relecture de a1, 08/10) : c'est l'alerte
  // INTERNE envoyée à Williams, pas un e-mail à l'apporteur — elle ne se coupe jamais.
  "apporteur-dossier-recu",
  "apporteur-commission-suspension",
  "apporteur-regime-tva",
  "apporteur-manquement",
  "apporteur-resiliation-notifiee",
  "apporteur-resiliation-effective",
  "apporteur-commission-avoir-client",
  "apporteur-non-commissionne",
  "apporteur-contrat-signe",
  "apporteur-presentation-recue",
  "apporteur-presentation-recue-rendez-vous",
  "apporteur-presentation-refusee",
  "apporteur-presentation-non-retenue",
  "apporteur-vigilance",
  "apporteur-commande-signee",
  "apporteur-commande-non-attribuee",
  "apporteur-attribution-confirmee",
  "apporteur-releve",
  "apporteur-releve-mensuel",
  "apporteur-file-attente-premier-rang",
  "apporteur-virement-fait",
  // Avenant 2.8 (lot S4, #2512) : gabarits livrés au worker AVANT leur émetteur (lot S3).
  "apporteur-avenant-propose",
  "apporteur-avenant-relance",
  "apporteur-avenant-enregistre",
  // « apporteur-lien-espace » n'y est PAS (2026-10-09) : envoyé à SA demande depuis
  // « Retrouver mon espace », qui décide lui-même qui le reçoit (fiche retirée comprise,
  // pour qu'elle puisse encore déposer ses attestations).
]);

/** L'apporteur concerné par un envoi : l'entité elle-même, ou celui de la présentation. */
async function apporteurDeLEnvoi(e: EnvoiApporteur): Promise<string | null> {
  if (e.entityType === "ApporteurReseau") return e.entityId;
  const pr = await prisma.presentationEntreprise.findUnique({
    where: { id: e.entityId },
    select: { apporteurId: true },
  });
  return pr?.apporteurId ?? null;
}

/**
 * « Ouvrir mon espace » (décision de Will, 2026-10-09) : chaque e-mail adressé à l'apporteur
 * porte son lien personnel, que le gabarit de base affiche en bas de la carte. Le dernier
 * e-mail reçu suffit donc à retrouver son espace. Jamais pour un dossier refusé ou résilié
 * (le lien mène à une page neutre ; vérifié sur la FICHE, pas seulement sur le gabarit) ni
 * pour un apporteur RETIRÉ du réseau (relecture sécurité, a1 :
 * le retrait change la version du lien pour le couper — on ne le recalcule pas) ;
 * fail-soft : sans lien, l'e-mail part tel quel. Le lien est TOUJOURS recalculé ici : un
 * `lienEspace` reçu dans le payload est retiré ou écrasé, jamais repris (relecture de #1408).
 */
export async function avecLienEspace(e: EnvoiApporteur): Promise<Record<string, unknown>> {
  return avecLienEspaceRecalcule(e.payload, async () => {
    if (GABARITS_SANS_LIEN_ESPACE.has(e.gabarit)) return null;
    if (!GABARITS_VERS_L_APPORTEUR.has(e.gabarit) || e.gabarit === "apporteur-dossier-refuse") {
      return null;
    }
    const apporteurId = await apporteurDeLEnvoi(e);
    if (!apporteurId || (await retraitDe(apporteurId))) return null;
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { versionLien: true, statut: true, refuseAt: true, resilieAt: true },
    });
    if (!a || a.statut === "refuse") return null;
    // Résilié (lot L1b, B1 bis) : le lien n'existe que pour les e-mails liés à l'argent, tant que de
    // l'argent est en jeu (mode restreint de la page) ; sinon page neutre, donc pas de lien.
    if (a.statut === "resilie" || a.resilieAt) {
      if (!GABARITS_ARGENT.has(e.gabarit) || !(await argentEnJeu(apporteurId))) return null;
    } else if (a.refuseAt) {
      return null;
    }
    return urlDossier(apporteurId, a.versionLien);
  });
}

export async function envoyer(e: EnvoiApporteur): Promise<ResultatEnvoi> {
  try {
    // 🔴 Retiré du réseau (2026-10-07) : seuls les e-mails liés à l'ARGENT lui parviennent
    // encore (commande signée, relevé, vigilance, virement) ; ils pointent vers le mode
    // restreint de sa page. Tous les autres s'arrêtent ICI, quel que soit l'appelant.
    if (GABARITS_VERS_L_APPORTEUR.has(e.gabarit) && !GABARITS_ARGENT.has(e.gabarit)) {
      const apporteurId = await apporteurDeLEnvoi(e);
      if (apporteurId && (await retraitDe(apporteurId))) return "fiche-retiree";
    }
    const jobId = jobIdSansDeuxPoints(e.jobId);
    if (jobId) await retirerEnvoiEchoue(jobId);
    const payload = await avecLienEspace(e);
    const r = await enqueueEmail(e.gabarit as EmailJobName, e.destinataire, "fr", payload, {
      entityType: e.entityType,
      entityId: e.entityId,
      ...(jobId ? { jobId } : {}),
      ...(e.attachments ? { attachments: e.attachments } : {}),
    });
    return resultatDeLEnfilage(r);
  } catch (err) {
    signalerErreurReseau(`envoi ${e.gabarit}`, err);
    return "indisponible";
  }
}

/**
 * Clé d'idempotence de « Votre commission est virée » : une par lot d'autofactures
 * virées ensemble. Triée, donc stable quel que soit l'ordre des numéros.
 */
export function jobIdVirementFait(numeros: readonly string[]): string {
  return `apporteur-virement-fait-${[...numeros].sort().join("-")}`;
}

/**
 * « Votre commission est virée » — envoyé à l'apporteur quand Williams clique
 * « Virement fait » dans la console. Texte non modifiable ; aucune date d'arrivée promise.
 */
export async function envoyerConfirmationVirement(e: {
  apporteurId: string;
  destinataire: string;
  contactName: string;
  montant: string;
  numeros: readonly string[];
  dateVirement: string;
  /** Lot 7 : les 4 derniers caractères du compte payé (facultatif : un ancien worker l'ignore). */
  compteFin?: string;
}): Promise<ResultatEnvoi> {
  const numeros =
    e.numeros.length === 0
      ? null
      : e.numeros.length > 1
        ? `n° ${e.numeros.join(", n° ")}`
        : `n° ${e.numeros[0]}`;
  return envoyer({
    gabarit: "apporteur-virement-fait",
    destinataire: e.destinataire,
    entityType: "ApporteurReseau",
    entityId: e.apporteurId,
    jobId: jobIdVirementFait(e.numeros),
    payload: {
      contactName: e.contactName,
      montant: e.montant,
      ...(numeros ? { numeros } : {}),
      dateVirement: e.dateVirement,
      ...(e.compteFin ? { compteFin: e.compteFin } : {}),
    },
  });
}
