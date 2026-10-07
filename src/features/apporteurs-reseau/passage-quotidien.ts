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
 *   (f) rappel du dossier non complété : J+3 puis J+7 après l'envoi du lien, jamais au-delà.
 *
 * Les DÉCISIONS sont dans `regles.ts` (pures, testées) ; ce module lit et écrit.
 */

// ⚠️ Tourne dans le WORKER (tsx, hors Next) : aucun `server-only` ici ni dans ce que ce
// module importe (verrouillé par `le-worker-n-importe-pas-server-only.spec.ts`).

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";

import {
  demanderVigilance,
  dejaEnvoye,
  libererSiPiecesValides,
  piecesVigilanceValides,
  relancerVigilance,
  statutApresVigilance,
} from "./commissions";
import { envoyer } from "./envois";
import { facturerCommissionsDues } from "./facturation";
import { alerterPiecesVigilanceDeposees } from "./alerte-vigilance";
import { regenererAvoirsSansPiece } from "./manquement";
import { chiffrerPiecesEnClair } from "./pieces-chiffrement";
import { marquerRealiseesDepuisSessions } from "./realisation";
import { commandesSoldees } from "./commandes";
import { idsPriseDeContactRebondie } from "./rebonds";
import { urlDossier } from "./jeton";
import { signalerErreurReseau } from "./signaler";
import {
  ajouterJours,
  ajouterMois,
  calculerCommission,
  commandeCouverte,
  CONFIRMATION_TACITE_JOURS,
  dateConfirmationTacite,
  finDeProtection,
  motifDeProlongation,
  PARRAINAGE_MOIS,
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
    }),
  );
  couvrantes.sort((a, b) => a.recueAt.getTime() - b.recueAt.getTime());
  return couvrantes[0] ?? null;
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
  | "autofacturation"
  | "vigilance"
  | "alerte-pieces-vigilance"
  | "commande-signee"
  | "rappels-dossier"
  | "chiffrement-pieces"
  | "avoirs-sans-piece"
  | "realisation";

const ETAPES_FACTURATION: readonly NomEtape[] = [
  "commissions",
  "realisation",
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
    erreurs: 0,
  };
}

async function passer(
  maintenant: Date,
  seulement: readonly NomEtape[] | null,
): Promise<BilanPassageReseau> {
  const bilan = bilanVide();
  const etapes: Array<[NomEtape, () => Promise<void>]> = [
    ["confirmation-tacite", () => etapeConfirmationTacite(maintenant, bilan)],
    ["terme", () => etapeTerme(maintenant, bilan)],
    ["commissions", () => etapeCommissions(maintenant, bilan)],
    // Les commissions devenues dues (ci-dessus) sont facturées dans la foulée, puis celles que la
    // vigilance libère (ci-dessous) le sont au passage horaire suivant.
    // Contrat 2.3 (art. 4.2) : une session de formation terminée rend la prestation « réalisée »,
    // juste avant l'autofacturation qui ne prend que les prestations réalisées.
    ["realisation", async () => void (await marquerRealiseesDepuisSessions(maintenant))],
    ["autofacturation", () => etapeAutofacturation(maintenant, bilan)],
    ["vigilance", () => etapeVigilance(maintenant, bilan)],
    [
      "alerte-pieces-vigilance",
      async () =>
        void (bilan.alertesPiecesVigilance += await alerterPiecesVigilanceDeposees(maintenant)),
    ],
    ["commande-signee", () => etapeCommandeSignee(maintenant, bilan)],
    ["rappels-dossier", () => etapeRappelsDossier(maintenant, bilan)],
    // Rattrapage (07/10) : les pièces déposées avant le chiffrement au repos sont chiffrées.
    ["chiffrement-pieces", async () => void (await chiffrerPiecesEnClair())],
    // Art. 4.5 bis : un avoir de neutralisation resté sans PDF est régénéré et envoyé.
    ["avoirs-sans-piece", async () => void (await regenererAvoirsSansPiece(maintenant))],
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
  const lignes = await prisma.presentationEntreprise.findMany({
    where: { statut: "reservee", contactEnvoyeAt: { not: null, lte: seuil } },
    select: { id: true, contactEnvoyeAt: true, recueAt: true },
  });
  if (lignes.length === 0) return;
  // Contrat art. 3.2 : le délai ne court pas tant que la prise de contact revient en erreur.
  const rebonds = await idsPriseDeContactRebondie(lignes.map((l) => l.id));
  for (const p of lignes) {
    if (rebonds.has(p.id)) continue;
    const confirmeeAt = dateConfirmationTacite(p.contactEnvoyeAt!);
    if (confirmeeAt.getTime() > maintenant.getTime()) continue;
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

/** Présentations qui ont été protégées : confirmées, ou terminées après une protection. */
async function lirePresentationsProtegees() {
  return prisma.presentationEntreprise.findMany({
    where: {
      statut: { in: ["confirmee", "terminee"] },
      confirmeeAt: { not: null },
      protegeeJusquAt: { not: null },
    },
    select: {
      id: true,
      apporteurId: true,
      siren: true,
      denomination: true,
      recueAt: true,
      confirmeeAt: true,
      protegeeJusquAt: true,
      apporteur: {
        select: { prenom: true, nom: true, email: true, parrainId: true, signeParSocieteAt: true },
      },
    },
  });
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
  const payees = await prisma.factureFormation.findMany({
    where: { statut: "payee", avoirDeId: null, client: { siren: { in: [...index.keys()] } } },
    select: { id: true, devisId: true },
  });
  if (payees.length === 0) return;
  // La commande entière : toutes les factures du même devis (acompte + solde), et les avoirs.
  const devisIds = [...new Set(payees.map((f) => f.devisId).filter((d): d is string => !!d))];
  const lignes = await prisma.factureFormation.findMany({
    where: {
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
      devis: { select: { acceptedAt: true, montantTotalHtCents: true } },
      client: { select: { siren: true } },
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
  const existantes = await prisma.commissionApporteur.findMany({
    where: { factureId: { in: commandes.flatMap((c) => c.factureIds) } },
    select: { factureId: true, apporteurId: true, parrainage: true },
  });
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
    const p = presentationQuiCouvre(index.get(siren) ?? [], signeeAt);
    if (!p) continue;
    const calc = calculerCommission({
      activite: (f.activite ?? null) as ActiviteCommission | null,
      factureHtCents: commande.totalHtCents,
      palier: null,
    });
    if (calc.statut === "aucune") continue;
    const base = {
      presentationId: p.id,
      factureId: commande.factureCleId,
      activite: f.activite ?? "inconnue",
      factureHtCents: commande.totalHtCents,
    };

    // La commission de l'apporteur.
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
      } catch (err) {
        if (!estDoublon(err)) throw err;
      }
    }

    // La part du parrain (un seul niveau), dans les 6 mois de la signature du filleul.
    const { parrainId, signeParSocieteAt } = p.apporteur;
    if (!parrainId || !signeParSocieteAt || !dansFenetreParrainage(signeParSocieteAt, signeeAt))
      continue;
    if (deja.has(f.id, parrainId, true, commande)) continue;
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
    select: { id: true, acceptedAt: true, client: { select: { siren: true } } },
  });
  for (const d of devis) {
    const p = presentationQuiCouvre(index.get(d.client.siren ?? "") ?? [], d.acceptedAt!);
    if (!p) continue;
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
