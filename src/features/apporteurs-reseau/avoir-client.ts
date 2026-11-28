// Réseau d'apporteurs — la facture du CLIENT est annulée (ou réduite) par un AVOIR : la commission
// suit l'argent réellement gardé, pour tous les produits (décision du pilote, 25/11 ; art. 4.5).
//
// « Un avoir ou un remboursement partiel diminue le prix facturé : la commission est recalculée sur
// le prix net […] et la différence fait l'objet d'une reprise […] dès que la Société constate
// l'annulation. » Passage HORAIRE (avant l'autofacturation), idempotent :
//
//   · prix net de la COMMANDE = `commandes.ts#netDeLaCommande` (SOURCE UNIQUE, RM-01 : brouillons
//     et pièces annulées écartés) ; une commande sans avoir actif n'est pas touchée ;
//   · commission du filleul pas encore facturée → RÉDUITE au prix net, ou ANNULÉE s'il ne reste
//     rien (`ajustement.ts`, qui porte SEUL la part du parrain dans ce cas) ;
//   · facturée, pas encore versée, prix net nul → RETENUE et neutralisée par un AVOIR d'autofacture
//     (`manquement.ts#retenir`, numéro pris sous verrou), envoyé à l'apporteur (gabarit
//     `apporteur-commission-avoir-client`) ; prix net seulement réduit → rien tout de suite : la
//     ligne facturée ne se modifie plus, la reprise suit d'elle-même son versement ;
//   · déjà versée → REPRISE de la différence encore non reprise (`enregistrerReprise`, sous verrou
//     par commission), datée de l'AVOIR (délai de 24 mois de l'art. 4.5).
//
// Rien n'est supprimé ; chaque geste est tracé au journal par les modules réutilisés.
//
// ⚠️ Atteint par le WORKER (job horaire `reseau-facturation`, tsx hors Next) : aucun `server-only`.

import { ACTIVITE_PRIME_CHALLENGE } from "./prime-challenge";
import { randomUUID } from "node:crypto";

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { jobIdSansDeuxPoints } from "@/server/email/envoi-monde";
import { enqueueEmail } from "@/server/queue/queues";

import {
  annulerCommission,
  commissionPourPrixConserve,
  partDuParrain,
  reduireCommission,
  type SurEcritureParrain,
} from "./ajustement";
import { alerteInterne } from "./alerte-interne";
import { dateFr } from "./autofacture-donnees";
import {
  commandeRenduePourLaLigne,
  etatDeLaCommande,
  netDeLaCommande,
  PREFIXE_MOTIF_COMMANDE_NON_SOLDEE,
  PREFIXE_PALIER_COMPLEMENT,
  soldeDesLignesLiees,
  type FactureDeCommande,
  type SoldeDesLignesLiees,
} from "./commandes";
import { dejaEnvoye, grilleDeLaLigne, statutApresVigilance } from "./commissions";
import {
  euros,
  ajouterMois,
  htLignesRecurrentesRestantesCents,
  plafondBaseCommissionnableCents,
  FORFAIT_CONFERENCE_CENTS,
  PALIER_CONFERENCE,
  MESSAGE_GRILLE_INCONNUE,
  PALIER_JOURNEE_IA,
  TAUX_BPS,
  type GrilleCommission,
} from "./regles";
import { litigeDisponible } from "./litige";
import { envoyer } from "./envois";
import { retenir, type Piece } from "./manquement";
import { enregistrerReprise, PREFIXE_PALIER_REPRISE } from "./resiliation";
import { signalerErreurReseau } from "./signaler";
import { horsGesteCommercial } from "./geste-commercial";

/**
 * DÉCISION DU 25/11 (règle unique) : la commission suit l'argent réellement GARDÉ par Axion IA,
 * pour TOUS les produits. Un avoir total l'annule (pas encore versée) ou la fait reprendre
 * (déjà versée) ; un avoir partiel la réduit en proportion. La déduction des 1 490 € d'une
 * Journée IA sur un devis signé n'est pas un avoir.
 */

const MODIFIABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

const CHAMPS_LIGNE = {
  id: true,
  apporteurId: true,
  factureId: true,
  parrainage: true,
  statut: true,
  activite: true,
  palier: true,
  prixPublicHtCents: true,
  factureHtCents: true,
  montantCents: true,
  autofactureNumero: true,
  autofactureEmiseAt: true,
  verseeAt: true,
  creeAt: true,
  presentationId: true,
  litigeDepuis: true,
  litigeMotif: true,
  regleAppliquee: true,
  versionContrat: true,
} as const;

/** Les avoirs de moins de 24 mois (art. 4.5 : la reprise court de la date de CHAQUE annulation). */
export function avoirsDansLeDelai<T extends { emiseAt: Date | null; createdAt?: Date | null }>(
  avoirs: readonly T[],
  maintenant: Date,
): T[] {
  const borne = ajouterMois(maintenant, -24).getTime();
  return avoirs.filter((a) => {
    const t = (a.emiseAt ?? a.createdAt ?? null)?.getTime();
    return typeof t === "number" && t >= borne;
  });
}
const estModifiable = (s: string) => (MODIFIABLES as readonly string[]).includes(s);

export interface BilanAvoirsClients {
  reduites: number;
  annulees: number;
  retenues: number;
  reprises: number;
  /** Lignes pas encore facturées remontées vers la cible (le net payé est revenu). */
  remontees: number;
  /** Compléments créés sur une ligne facturée (reprise ou réduction compensée). */
  complements: number;
  /** Lignes suspendues : facture refaite ou complément émis, pas encore payé. */
  suspendues: number;
  /** Suspensions automatiques levées (la commande est de nouveau dans un état final). */
  suspensionsLevees: number;
}

interface Calcul {
  activite: string;
  palier: string | null;
  prixPublicHtCents: number | null;
  montantCents: number;
  /** Grille du contrat signé de la ligne ; `null` : version inconnue → aucune cible (la ligne ne bouge pas ; le passage pose l'alerte critique `apporteur_grille_inconnue_avoir`). */
  grille: GrilleCommission | null;
}

/** Le montant cible d'une ligne pour un prix net (part du parrain : 10 % du filleul recalculé). */
export function cibleApresAvoir(l: Calcul, netCents: number, filleul?: Calcul): number | null {
  if (netCents <= 0) return 0;
  if (filleul) {
    const f = commissionPourPrixConserve(filleul, netCents, filleul.montantCents);
    return f === null ? null : Math.min(l.montantCents, partDuParrain(f));
  }
  const c = commissionPourPrixConserve(l, netCents, l.montantCents);
  return c === null ? null : Math.min(l.montantCents, c);
}

/**
 * La commission CIBLE d'une ligne de FILLEUL pour l'état final de la commande (décision du 25/11) :
 * fonction du seul net payé plafonné à la base (`etatDeLaCommande`), jamais de l'ordre des passages.
 * Jamais plus que la commission calculée sur la base. `null` : la règle ne s'applique pas.
 *   · conférence : forfait fixe, au plus le montant de la ligne ou un forfait, et le net ;
 *   · ancien coaching (30 %) : ne remonte jamais au-delà du montant de la ligne.
 */
export function cibleEtatFinal(l: Calcul, netCibleCents: number, baseCents: number): number | null {
  const net = Math.max(0, Math.min(netCibleCents, baseCents));
  if (net <= 0) return 0;
  // Journée IA d'abord : son palier l'emporte sur l'activité de la facture (coaching, conférence).
  if (l.palier === PALIER_JOURNEE_IA) return commissionPourPrixConserve(l, net);
  if (l.activite === "conference" || l.palier === PALIER_CONFERENCE)
    return Math.min(Math.max(l.montantCents, FORFAIT_CONFERENCE_CENTS), net);
  if (l.activite === "un_a_un")
    return Math.min(l.montantCents, Math.round((net * TAUX_BPS.un_a_un) / 10_000));
  return commissionPourPrixConserve(l, net);
}

/** La date de l'annulation : celle de l'avoir actif le plus récent (émission, sinon création). */
export function dateDeLAnnulation(
  avoirs: ReadonlyArray<{ emiseAt: Date | null; createdAt?: Date | null }>,
): Date | null {
  const t = avoirs
    .map((a) => (a.emiseAt ?? a.createdAt ?? null)?.getTime())
    .filter((x): x is number => typeof x === "number");
  return t.length ? new Date(Math.max(...t)) : null;
}

async function tracer(id: string, changes: Record<string, unknown>): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action:
          (changes.apresCents as number) <= 0
            ? "commission_apporteur.annulee"
            : "commission_apporteur.reduite",
        targetType: "commission_apporteur",
        targetId: id,
        changes: changes as object,
      },
    });
  } catch {
    // La trace ne fait jamais échouer le passage.
  }
}

async function prevenirRetenue(apporteurId: string, numeroAvoir: string, avoir?: Piece) {
  try {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { prenom: true, email: true },
    });
    const destinataire = a ? (decryptPii(a.email) ?? "") : "";
    if (!destinataire) return;
    await envoyer({
      gabarit: "apporteur-commission-avoir-client",
      destinataire,
      payload: { contactName: decryptPii(a!.prenom) ?? "" },
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      // Une clé PAR AVOIR (relecture de a1) : deux retenues sur la même autofacture, deux e-mails.
      jobId: `apporteur-commission-avoir-client-${numeroAvoir}`,
      ...(avoir
        ? {
            attachments: [
              { filename: avoir.filename, r2Key: avoir.r2Key, contentType: "application/pdf" },
            ],
          }
        : {}),
    });
  } catch {
    // Prévenir ne fait jamais échouer le passage.
  }
}

/** Ce que l'apporteur apprend d'un ajustement fait APRÈS l'avoir du client (art. 4.5), sans pièce jointe. */
interface AjustementAnnonce {
  /** L'apporteur à prévenir (le PARRAIN pour une part de parrainage). */
  apporteurId: string;
  ligneId: string;
  type: "reduite" | "annulee" | "reprise";
  avantCents: number;
  apresCents?: number;
  reprisCents?: number;
  /** Date de l'avoir (heure de Paris à l'affichage). */
  annulationLe: Date;
  /** `reprise` : l'identifiant de la ligne de reprise écrite (clé d'idempotence). */
  repriseId?: string;
}

/**
 * Annonce à l'apporteur une réduction, une annulation (avant facturation) ou une reprise (déjà
 * versée) qui vient d'être ÉCRITE. Appelée seulement après une écriture réussie, qu'elle ne défait
 * jamais ; ne lève jamais. Une clé par état atteint : jamais de date du jour (l'étape tourne aussi
 * à l'heure), donc un second passage sur le même état n'envoie rien. Le motif interne (qui porte
 * des montants) n'est jamais transmis ; le payload ne porte que des chaînes.
 */
async function prevenirAjustement(e: AjustementAnnonce): Promise<void> {
  try {
    const jobBrut =
      e.type === "reduite"
        ? `apporteur-commission-reduite-${e.ligneId}-${e.apresCents ?? 0}`
        : e.type === "annulee"
          ? `apporteur-commission-annulee-${e.ligneId}`
          : e.repriseId
            ? `apporteur-commission-reprise-${e.repriseId}`
            : null;
    if (!jobBrut) {
      signalerErreurReseau(
        "avoir client : annonce de reprise",
        new Error(`Reprise sans identifiant (ligne ${e.ligneId}) : e-mail non envoyé.`),
      );
      return;
    }
    const jobId = jobIdSansDeuxPoints(jobBrut) ?? jobBrut;
    if (await dejaEnvoye(jobId)) return;
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: e.apporteurId },
      select: { prenom: true, email: true },
    });
    const destinataire = a ? (decryptPii(a.email) ?? "") : "";
    if (!a || !destinataire) return;
    await envoyer({
      gabarit: "apporteur-commission-avoir-client",
      destinataire,
      payload: {
        contactName: decryptPii(a.prenom) ?? "",
        variante: e.type,
        avant: euros(e.avantCents),
        ...(e.apresCents !== undefined ? { apres: euros(e.apresCents) } : {}),
        ...(e.reprisCents !== undefined ? { repris: euros(e.reprisCents) } : {}),
        annulationLe: dateFr(e.annulationLe),
      },
      entityType: "ApporteurReseau",
      entityId: e.apporteurId,
      jobId,
    });
  } catch (err) {
    signalerErreurReseau("avoir client : annonce", err);
  }
}

type FactureLue = FactureDeCommande & { createdAt: Date | null; lignes?: unknown };

const CHAMPS = {
  id: true,
  devisId: true,
  statut: true,
  avoirDeId: true,
  montantHtCents: true,
  emiseAt: true,
  createdAt: true,
  lignes: true,
} as const;

/** Les factures d'une commande et leurs avoirs, tous statuts (le tri est fait par la source unique). */
async function facturesDeLaCommande(factureId: string): Promise<{
  membres: FactureLue[];
  avoirs: FactureLue[];
  totalDevisCents?: number;
  /** HT des lignes de maintenance / abonnement du devis : jamais dans la base (règle du 25/11). */
  recurrentCents: number;
  /** Plafond strict : total HT du devis − récurrent brut (Infinity si total inconnu). */
  plafondCents: number;
} | null> {
  const f = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: {
      id: true,
      devisId: true,
      lignes: true,
      montantHtCents: true,
      devis: { select: { montantTotalHtCents: true, journeeIa: true, lignes: true } },
    },
  });
  if (!f) return null;
  const membres = (await prisma.factureFormation.findMany({
    where: f.devisId ? { devisId: f.devisId, avoirDeId: null } : { id: f.id },
    select: CHAMPS,
  })) as FactureLue[];
  const avoirs = (await prisma.factureFormation.findMany({
    where: { avoirDeId: { in: membres.map((m) => m.id) }, ...(await horsGesteCommercial()) },
    select: CHAMPS,
  })) as FactureLue[];
  const total = f.devis?.montantTotalHtCents;
  const recurrentCents = f.devis?.journeeIa
    ? 0
    : htLignesRecurrentesRestantesCents(
        f.devis ? f.devis.lignes : f.lignes,
        avoirs
          .filter((a) => a.statut !== "brouillon" && a.statut !== "annulee")
          .map((a) => a.lignes),
        membres
          .filter((m) => m.statut !== "brouillon" && m.statut !== "annulee")
          .map((m) => m.lignes),
      );
  const plafondCents = plafondBaseCommissionnableCents(
    f.devis ? f.devis.montantTotalHtCents : f.montantHtCents,
    f.devis ? f.devis.lignes : f.lignes,
    f.devis?.journeeIa === true,
  );
  return {
    membres,
    avoirs,
    recurrentCents,
    plafondCents,
    ...(typeof total === "number" ? { totalDevisCents: total } : {}),
  };
}

type LigneLue = {
  id: string;
  apporteurId: string;
  factureId: string;
  presentationId: string | null;
  parrainage: boolean;
  statut: string;
  activite: string;
  palier: string | null;
  montantCents: number | null;
  autofactureNumero: string | null;
  autofactureEmiseAt?: Date | null;
  litigeDepuis: Date | null;
  litigeMotif: string | null;
  creeAt?: Date | null;
  /** Relevé mensuel : repris sur le complément (jamais recalculés). */
  regleAppliquee?: string | null;
  versionContrat?: string | null;
};

const motifRetour = (net: number) =>
  `Décision du 25/11 : le client a de nouveau payé la commande (net ${(net / 100).toFixed(2).replace(".", ",")} € HT) : la commission revient à sa cible.`;

const CHAMPS_LIEE = { id: true, palier: true, montantCents: true, statut: true } as const;

/**
 * Le solde d'une ligne d'origine : ses reprises, ses compléments vivants (chacun net de ses PROPRES
 * reprises) — `commandes.ts#soldeDesLignesLiees`, source unique avec le passage quotidien.
 */
async function reprisesEtComplements(
  db: Pick<typeof prisma, "commissionApporteur">,
  apporteurId: string,
  id: string,
): Promise<SoldeDesLignesLiees> {
  const ls =
    (await db.commissionApporteur.findMany({
      where: {
        apporteurId,
        palier: { in: [`${PREFIXE_PALIER_REPRISE}${id}`, `${PREFIXE_PALIER_COMPLEMENT}${id}`] },
      },
      select: CHAMPS_LIEE,
    })) ?? [];
  // Lignes déjà restreintes à cette origine : ce qui n'est pas un complément est une de ses reprises.
  const liees = ls.map((x) => ({
    ...x,
    palier: (x.palier ?? "").startsWith(PREFIXE_PALIER_COMPLEMENT)
      ? `${PREFIXE_PALIER_COMPLEMENT}${id}`
      : `${PREFIXE_PALIER_REPRISE}${id}`,
  }));
  const complements = liees.filter(
    (x) => x.palier.startsWith(PREFIXE_PALIER_COMPLEMENT) && typeof x.id === "string" && x.id,
  );
  const reprisesDesComplements = complements.length
    ? (
        (await db.commissionApporteur.findMany({
          where: {
            apporteurId,
            palier: { in: complements.map((c) => `${PREFIXE_PALIER_REPRISE}${c.id}`) },
          },
          select: CHAMPS_LIEE,
        })) ?? []
      ).filter((r) => complements.some((c) => r.palier === `${PREFIXE_PALIER_REPRISE}${c.id}`))
    : [];
  return soldeDesLignesLiees(id, [...liees, ...reprisesDesComplements], PREFIXE_PALIER_REPRISE);
}

/**
 * Tour 2/2 (défauts 1 et 2) : UN SEUL mécanisme rend l'argent revenu. Une ligne NEUTRALISÉE
 * (reprises ≥ montant + compléments) sur une commande entièrement RENDUE pour elle est remplacée
 * par la ligne neuve du passage quotidien (`passage-quotidien.ts#etapeCommissions`, même règle
 * `commandeRenduePourLaLigne`) : elle ne reçoit jamais de complément. Et aucune ligne ne reçoit de
 * complément quand une autre ligne vivante de même rang (filleul ou parrain) existe sur la commande,
 * du même apporteur ou d'un autre : jamais deux paiements, jamais deux apporteurs.
 */
async function remplaceeParUneAutreLigne(
  l: LigneLue,
  montant: number,
  solde: SoldeDesLignesLiees,
  membres: readonly FactureDeCommande[],
  avoirs: readonly FactureDeCommande[],
): Promise<boolean> {
  const neutralisee = solde.reprisCents - solde.complementsCents >= montant;
  if (neutralisee && commandeRenduePourLaLigne(membres, avoirs, l.creeAt ?? null)) return true;
  const ids = membres.map((m) => m.id);
  const autres = (
    (await prisma.commissionApporteur.findMany({
      where: {
        factureId: { in: ids },
        // Une prime de challenge n'est jamais reprise par un avoir client.
        activite: { not: ACTIVITE_PRIME_CHALLENGE },
        parrainage: l.parrainage,
        statut: { in: [...MODIFIABLES, "versee"] },
        montantCents: { gt: 0 },
      },
      select: {
        id: true,
        apporteurId: true,
        factureId: true,
        parrainage: true,
        statut: true,
        montantCents: true,
        palier: true,
      },
    })) ?? []
  ).filter(
    (x) =>
      x.id !== l.id &&
      x.parrainage === l.parrainage &&
      ids.includes(x.factureId) &&
      !(x.palier ?? "").startsWith(PREFIXE_PALIER_COMPLEMENT),
  );
  for (const x of autres) {
    if (x.statut !== "versee") return true;
    const sx = await reprisesEtComplements(prisma, x.apporteurId, x.id);
    if (sx.reprisCents - sx.complementsCents < (x.montantCents ?? 0)) return true;
  }
  return false;
}

/**
 * REMONTÉE d'une ligne pas encore facturée vers sa cible : écriture CONDITIONNELLE sur le montant
 * lu (deux passages simultanés : un seul gagne), tracée. Rend vrai si CE passage l'a remontée.
 */
async function remonter(
  l: { id: string },
  avant: number,
  cible: number,
  netCents: number,
  motif: string,
): Promise<boolean> {
  const u = await prisma.commissionApporteur.updateMany({
    where: {
      id: l.id,
      montantCents: avant,
      autofactureNumero: null,
      statut: { in: [...MODIFIABLES] },
    },
    data: { montantCents: cible, factureHtCents: netCents },
  });
  if (u.count !== 1) return false;
  await tracerRemontee(l.id, { avantCents: avant, apresCents: cible, motif });
  return true;
}

/** Les parts du parrain pas encore facturées suivent la remontée du filleul (art. 4.6). */
async function remonterParrain(
  groupe: readonly LigneLue[],
  cible: number,
  motif: string,
): Promise<number> {
  let n = 0;
  for (const p of groupe) {
    if (!p.parrainage || p.autofactureNumero || !estModifiable(p.statut)) continue;
    const avant = p.montantCents ?? 0;
    if (cible <= avant) continue;
    const u = await prisma.commissionApporteur.updateMany({
      where: {
        id: p.id,
        montantCents: avant,
        autofactureNumero: null,
        statut: { in: [...MODIFIABLES] },
      },
      data: { montantCents: cible },
    });
    if (u.count === 1) {
      n += 1;
      await tracerRemontee(p.id, { avantCents: avant, apresCents: cible, motif });
    }
  }
  return n;
}

async function tracerRemontee(id: string, changes: Record<string, unknown>): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: "commission_apporteur.remontee",
        targetType: "commission_apporteur",
        targetId: id,
        changes: changes as object,
      },
    });
  } catch {
    // La trace ne fait jamais échouer le passage.
  }
}

/**
 * Tour 2/2 (défaut 4) : plus jamais de refus SILENCIEUX. Une reprise que `enregistrerReprise`
 * refuse (plafond, délai de 24 mois…) déclenche UNE alerte interne (Williams, jamais l'apporteur),
 * une seule fois par ligne et par montant. Ne lève pas.
 */
async function alerterRepriseRefusee(
  ligneId: string,
  cents: number,
  raison: string,
  maintenant: Date,
): Promise<void> {
  const jobId = `apporteur-reprise-refusee-${ligneId}-${cents}`;
  try {
    if (await dejaEnvoye(jobId)) return;
    await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_reprise_refusee",
        titre: "Reprise de commission refusée après un avoir client : à trancher",
        message: `La reprise de ${(cents / 100).toFixed(2).replace(".", ",")} € sur une commission d'apporteur (après un avoir du client) a été refusée : ${raison} Rien n'a été repris. À trancher dans la console (Apporteurs › Commissions).`,
        cibleType: "CommissionApporteur",
        cibleId: ligneId,
        rubrique: "apporteurs",
        chemin: "apporteurs/commissions",
        createdAt: maintenant.toLocaleDateString("fr-FR"),
      },
      { jobId, entityType: "CommissionApporteur", entityId: ligneId },
    );
  } catch (err) {
    signalerErreurReseau("alerte reprise refusée", err);
  }
}

/** Reprise sur UNE ligne versée (origine ou complément), plafonnée à sa propre ligne ; alerte si refus. */
async function reprendreSurLaLigne(
  id: string,
  apporteurId: string,
  cents: number,
  motif: string,
  annulationLe: Date,
  maintenant: Date,
): Promise<{ ok: boolean; repriseId?: string }> {
  if (cents <= 0) return { ok: false };
  // `enregistrerReprise` relit sous verrou : un passage concurrent ne reprend pas deux fois.
  const r = await enregistrerReprise({
    commissionId: id,
    apporteurId,
    demandeeCents: cents,
    motif,
    annulationLe,
    maintenant,
  });
  if (!r.ok) {
    await alerterRepriseRefusee(id, cents, r.message, maintenant);
    return { ok: false };
  }
  return { ok: true, ...(r.repriseId ? { repriseId: r.repriseId } : {}) };
}

/**
 * COMPLÉMENT d'une ligne facturée : l'apporteur retrouve ce que la reprise (ou la réduction faite
 * avant facturation) lui avait retiré, à hauteur de `plafond` (la cible). Sous le MÊME verrou que
 * la reprise (`reprise:<id>`) et après RELECTURE : deux passages simultanés ne complètent qu'une
 * fois, un rejeu est sans effet. Rend le montant complété (0 si rien).
 *
 * Tour 2/2 (défaut 7) : le complément passe par la vigilance comme toute commission neuve, et
 * HÉRITE de la contestation saisie à la main sur sa ligne d'origine (jamais d'une suspension
 * automatique, que le passage lève seul).
 */
async function completer(
  l: LigneLue,
  montant: number,
  plafond: number,
  motif: string,
  maintenant: Date,
): Promise<number> {
  const premier = await reprisesEtComplements(prisma, l.apporteurId, l.id);
  const estime = plafond - (montant - premier.reprisCents + premier.complementsCents);
  if (estime <= 0) return 0;
  const v = await statutApresVigilance(l.apporteurId, estime, maintenant);
  const contestation =
    l.litigeDepuis && !(l.litigeMotif ?? "").startsWith(PREFIXE_MOTIF_COMMANDE_NON_SOLDEE)
      ? { litigeDepuis: l.litigeDepuis, litigeMotif: l.litigeMotif }
      : {};
  const cents = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reprise:${l.id}`}))`;
    const r = await reprisesEtComplements(tx, l.apporteurId, l.id);
    const aCompleter = plafond - (montant - r.reprisCents + r.complementsCents);
    if (aCompleter <= 0) return 0;
    await tx.commissionApporteur.create({
      data: {
        apporteurId: l.apporteurId,
        presentationId: l.presentationId,
        // Pas de clé étrangère : la ligne porte son propre identifiant (même usage que la reprise).
        factureId: randomUUID(),
        parrainage: l.parrainage,
        activite: l.activite,
        palier: `${PREFIXE_PALIER_COMPLEMENT}${l.id}`,
        factureHtCents: 0,
        montantCents: aCompleter,
        statut: v.statut,
        regleAppliquee: l.regleAppliquee ?? null,
        versionContrat: l.versionContrat ?? null,
        ...contestation,
      },
      select: { id: true },
    });
    return aCompleter;
  });
  if (cents > 0) await tracerRemontee(l.id, { complementCents: cents, motif });
  return cents;
}

/** Retire (annule ou réduit) les compléments pas encore facturés, à hauteur de `cents`. */
async function retirerComplementsNonFactures(
  l: { id: string; apporteurId: string },
  cents: number,
  motif: string,
): Promise<number> {
  const cs = await prisma.commissionApporteur.findMany({
    where: {
      apporteurId: l.apporteurId,
      palier: `${PREFIXE_PALIER_COMPLEMENT}${l.id}`,
      autofactureNumero: null,
      statut: { in: [...MODIFIABLES] },
    },
    select: { id: true, montantCents: true, statut: true },
  });
  let retire = 0;
  for (const c of cs ?? []) {
    const m = c.montantCents ?? 0;
    const part = Math.min(m, cents - retire);
    if (part <= 0) break;
    const u = await prisma.commissionApporteur.updateMany({
      where: { id: c.id, montantCents: m, autofactureNumero: null, statut: c.statut as never },
      data: part === m ? { statut: "annulee" } : { montantCents: m - part },
    });
    if (u.count === 1) {
      retire += part;
      await tracer(c.id, { avantCents: m, apresCents: m - part, motif });
    }
  }
  return retire;
}

/**
 * Suspension AUTOMATIQUE des lignes ni versées ni reprises (même effet qu'une contestation : ni
 * autofacture ni virement). Jamais par-dessus une contestation saisie par Williams. Aucun e-mail.
 */
async function suspendre(groupe: readonly LigneLue[], maintenant: Date): Promise<number> {
  const ids = groupe.filter((l) => estModifiable(l.statut) && !l.litigeDepuis).map((l) => l.id);
  if (ids.length === 0) return 0;
  const u = await prisma.commissionApporteur.updateMany({
    where: { id: { in: ids }, litigeDepuis: null, statut: { in: [...MODIFIABLES] } },
    data: {
      litigeDepuis: maintenant,
      litigeMotif: `${PREFIXE_MOTIF_COMMANDE_NON_SOLDEE} facture refaite ou complément émis, pas encore payé : la commission attend le paiement (ou l'annulation) pour suivre l'argent gardé.`,
    },
  });
  return u.count;
}

/** Lève la seule suspension AUTOMATIQUE (jamais une contestation saisie à la main). */
async function leverSuspension(groupe: readonly LigneLue[]): Promise<number> {
  const ids = groupe
    .filter(
      (l) => l.litigeDepuis && (l.litigeMotif ?? "").startsWith(PREFIXE_MOTIF_COMMANDE_NON_SOLDEE),
    )
    .map((l) => l.id);
  if (ids.length === 0) return 0;
  const u = await prisma.commissionApporteur.updateMany({
    where: { id: { in: ids }, litigeMotif: { startsWith: PREFIXE_MOTIF_COMMANDE_NON_SOLDEE } },
    data: { litigeDepuis: null, litigeMotif: null },
  });
  return u.count;
}

export async function reprendreApresAvoirsClients(
  maintenant: Date = new Date(),
): Promise<BilanAvoirsClients> {
  const bilan: BilanAvoirsClients = {
    reduites: 0,
    annulees: 0,
    retenues: 0,
    reprises: 0,
    remontees: 0,
    complements: 0,
    suspendues: 0,
    suspensionsLevees: 0,
  };

  // Les factures d'origine qui portent un avoir (le statut de l'avoir est jugé plus bas).
  const avoirs = await prisma.factureFormation.findMany({
    where: { avoirDeId: { not: null }, ...(await horsGesteCommercial()) },
    select: { avoirDeId: true, devisId: true },
  });
  const origines = [...new Set(avoirs.map((a) => a.avoirDeId).filter((x): x is string => !!x))];
  if (origines.length === 0) return bilan;
  // `genererAvoirFacture` ne recopie pas `devisId` sur l'avoir : le devis se lit sur la facture
  // d'ORIGINE (audit Opus D1). Sans cela, un avoir sur l'acompte ne touchait pas le solde qui
  // porte la commission.
  const dOrigines = await prisma.factureFormation.findMany({
    where: { id: { in: origines } },
    select: { devisId: true },
  });
  const devis = [
    ...new Set(
      [...avoirs.map((a) => a.devisId), ...dOrigines.map((o) => o.devisId)].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const surLeDevis = devis.length
    ? await prisma.factureFormation.findMany({
        where: { devisId: { in: devis }, avoirDeId: null },
        select: { id: true },
      })
    : [];
  const factureIds = [...new Set([...origines, ...surLeDevis.map((f) => f.id)])];

  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      factureId: { in: factureIds },
      // Une prime de challenge n'est jamais reprise par un avoir client.
      activite: { not: ACTIVITE_PRIME_CHALLENGE },
      statut: { in: [...MODIFIABLES, "versee"] },
      montantCents: { gt: 0 },
    },
    select: {
      id: true,
      apporteurId: true,
      factureId: true,
      parrainage: true,
      statut: true,
      activite: true,
      palier: true,
      prixPublicHtCents: true,
      factureHtCents: true,
      montantCents: true,
      autofactureNumero: true,
      autofactureEmiseAt: true,
      verseeAt: true,
      creeAt: true,
      presentationId: true,
      litigeDepuis: true,
      litigeMotif: true,
      regleAppliquee: true,
      versionContrat: true,
    },
  });
  if (lignes.length === 0) return bilan;
  const suspensionPossible = await litigeDisponible();

  const parFacture = new Map<string, typeof lignes>();
  for (const l of lignes) parFacture.set(l.factureId, [...(parFacture.get(l.factureId) ?? []), l]);

  for (const [factureId, groupe] of parFacture) {
    try {
      const lu = await facturesDeLaCommande(factureId);
      if (!lu) continue;
      // ÉTAT FINAL de la commande (décision du 25/11) : seules les factures PAYÉES comptent, net
      // de leurs avoirs, plafonnées à la base de signature. La cible ne dépend que de cet état,
      // jamais du moment où le passage l'a vu : la ligne se réduit quand l'argent part, REMONTE
      // quand il revient (facture refaite ou complément payé), sans jamais dépasser la cible.
      const etat = etatDeLaCommande(lu.membres, lu.avoirs, lu.totalDevisCents);
      const { avoirs: actifs } = netDeLaCommande(
        lu.membres.filter((m) => m.statut === "payee"),
        lu.avoirs,
      );
      // Tour 2/2 (défaut 5) : un avoir brouillon ou ANNULÉ n'a pas d'effet — mais la reprise faite
      // quand il était actif est compensée (complément), et une ligne réduite remonte. Rien ne se
      // réduit ni ne se reprend sans avoir actif (une suspension automatique est levée).
      const sansAvoirActif = actifs.length === 0;
      // Une facture refaite ou un complément est émis mais pas payé : la commande n'est plus
      // soldée par du payé. Rien ne part (ni autofacture ni virement) et aucun montant ne bouge
      // tant que l'état n'est pas final : il sera jugé d'un coup, au paiement ou à l'annulation.
      // Exception : plus RIEN de payé n'est gardé → la ligne est annulée (ou retenue, reprise) tout
      // de suite ; la facture refaite, une fois payée, fonde une commission neuve (même résultat).
      if (!sansAvoirActif && etat.enAttente && etat.netPayeCents > 0) {
        if (suspensionPossible) bilan.suspendues += await suspendre(groupe, maintenant);
        continue;
      }
      if (suspensionPossible) bilan.suspensionsLevees += await leverSuspension(groupe);
      // La commission est calculée hors lignes récurrentes : la cible se lit sur la même base
      // (sinon un avoir ferait REMONTER une commission de 600 € à 607,50 €).
      // Plafond strict (26/11) APRÈS ce calcul : jamais au-delà de « total HT − récurrent brut »,
      // y compris pour la remontée d'une ligne lors d'une reprise.
      const net = Math.min(Math.max(0, etat.netCibleCents - lu.recurrentCents), lu.plafondCents);
      const baseHorsRecurrent = Math.min(
        Math.max(0, etat.baseCents - lu.recurrentCents),
        lu.plafondCents,
      );
      // Dette a1 (a) : le délai de 24 mois de l'art. 4.5 s'apprécie AVOIR PAR AVOIR. Pour une ligne
      // déjà facturée (retenue, reprise), seuls comptent les avoirs de moins de 24 mois ; un avoir
      // plus ancien ne profite jamais du délai d'un avoir récent.
      const recents = avoirsDansLeDelai(actifs as FactureLue[], maintenant);
      const annulationLe = dateDeLAnnulation(recents) ?? maintenant;
      // La part du PARRAIN ajustée avec celle du filleul (non facturé) lui est annoncée aussi.
      const surParrain: SurEcritureParrain = (e) => prevenirAjustement({ ...e, annulationLe });
      const motif = `Art. 4.5 : facture du client annulée ou réduite par un avoir (prix net ${(net / 100).toFixed(2).replace(".", ",")} € HT).`;

      // Le FILLEUL d'abord : s'il n'est pas encore facturé, `ajustement.ts` porte la part du parrain
      // (réduction, annulation ou reprise) — elle n'est alors jamais reprise une seconde fois ici.
      // Dette a1 (b) : le filleul déjà annulé ou retenu n'est plus dans `groupe` ; sa ligne
      // d'origine sert quand même au calcul de la part du parrain (10 % du filleul recalculé).
      const filleul =
        groupe.find((l) => !l.parrainage) ??
        (groupe.some((l) => l.parrainage)
          ? await prisma.commissionApporteur.findFirst({
              where: { factureId, parrainage: false },
              select: CHAMPS_LIGNE,
            })
          : null);
      // Grille du contrat signé de chaque ligne (jamais le plafond 2.8 d'office) ; relue comme à la création.
      const grilleDe = async (x: { presentationId: string | null; factureId: string }) =>
        (await grilleDeLaLigne(x)).grille;
      const grilleFilleul = filleul ? await grilleDe(filleul) : null;
      const parrainParAjustement =
        !!filleul && !filleul.autofactureNumero && estModifiable(filleul.statut);
      // Grille inconnue (ligne ou filleul) alors qu'un avoir actif existe : la ligne ne bouge pas
      // (aucun montant inventé) mais Williams est prévenu, une seule fois par ligne.
      const alerterGrilleInconnue = async (
        x: { id: string },
        grille: GrilleCommission | null,
        cause: "grille" | "filleul-introuvable" = "grille",
      ) => {
        if (grille !== null || sansAvoirActif) return;
        const detail =
          cause === "filleul-introuvable"
            ? "dépend d'un filleul dont la ligne est introuvable (part de parrain sans filleul) : elle n'a pas été recalculée."
            : `n'a pas de grille connue : elle n'a pas été recalculée. ${MESSAGE_GRILLE_INCONNUE}`;
        await alerteInterne({
          jobId: `apporteur-grille-inconnue-avoir-${x.id}`,
          code: "apporteur_grille_inconnue_avoir",
          titre: "Avoir client : commission à ajuster à la main, version du contrat signé inconnue",
          message: `Un avoir client touche une commande dont la commission (ligne ${x.id}) ${detail} Console : Apporteurs › Commissions.`,
          cibleType: "CommissionApporteur",
          cibleId: x.id,
          niveau: "critique",
          maintenant,
        });
      };
      const ordre = [...groupe].sort((a, b) => Number(a.parrainage) - Number(b.parrainage));

      for (const l of ordre) {
        const montant = l.montantCents ?? 0;
        if (l.parrainage && parrainParAjustement) continue;

        if (!l.autofactureNumero && estModifiable(l.statut) && l.parrainage) {
          if (sansAvoirActif) continue;
          // Part de parrain pas encore facturée alors que le filleul l'est : elle suit le filleul
          // recalculé (art. 4.6), par une écriture conditionnelle tracée.
          const cible = filleul
            ? cibleApresAvoir({ ...l, montantCents: montant, grille: await grilleDe(l) }, net, {
                ...filleul,
                montantCents: filleul.montantCents ?? 0,
                grille: grilleFilleul,
              })
            : null;
          if (cible === null) {
            if (net > 0)
              await alerterGrilleInconnue(
                l,
                grilleFilleul,
                filleul ? "grille" : "filleul-introuvable",
              );
            continue;
          }
          if (cible >= montant) continue;
          const u = await prisma.commissionApporteur.updateMany({
            where: { id: l.id, montantCents: montant, autofactureNumero: null, statut: l.statut },
            data: cible <= 0 ? { statut: "annulee" } : { montantCents: cible },
          });
          if (u.count === 1) {
            if (cible <= 0) bilan.annulees += 1;
            else bilan.reduites += 1;
            await tracer(l.id, { avantCents: montant, apresCents: cible, motif });
            await prevenirAjustement({
              apporteurId: l.apporteurId,
              ligneId: l.id,
              type: cible <= 0 ? "annulee" : "reduite",
              avantCents: montant,
              ...(cible > 0 ? { apresCents: cible } : {}),
              annulationLe,
            });
          }
          continue;
        }

        if (!l.autofactureNumero && estModifiable(l.statut)) {
          if (net >= l.factureHtCents) {
            // L'argent est revenu : la ligne REMONTE vers la cible. Tour 2/2 (défaut 6) : la part du
            // parrain suit l'ÉTAT FINAL du filleul, que la remontée ait lieu dans CE passage ou
            // dans un précédent (passage interrompu entre les deux écritures).
            const cible = cibleEtatFinal(
              { ...l, montantCents: montant, grille: await grilleDe(l) },
              net,
              baseHorsRecurrent,
            );
            if (cible === null) {
              await alerterGrilleInconnue(l, await grilleDe(l));
              continue;
            }
            let apres = montant;
            if (net > l.factureHtCents && cible > montant) {
              if (await remonter(l, montant, cible, net, motifRetour(net))) {
                bilan.remontees += 1;
                apres = cible;
              }
            }
            bilan.remontees += await remonterParrain(
              groupe,
              partDuParrain(Math.min(cible, apres)),
              motifRetour(net),
            );
            continue;
          }
          if (sansAvoirActif) continue;
          const r =
            net <= 0
              ? await annulerCommission(l.id, motif, null, surParrain)
              : await reduireCommission(l.id, net, motif, null, surParrain);
          if (r.ok) {
            if (net <= 0) bilan.annulees += 1;
            else bilan.reduites += 1;
            const apresCents = net <= 0 ? undefined : r.montantCents;
            if (net <= 0 || apresCents !== undefined) {
              await prevenirAjustement({
                apporteurId: l.apporteurId,
                ligneId: l.id,
                type: net <= 0 ? "annulee" : "reduite",
                avantCents: montant,
                ...(apresCents !== undefined ? { apresCents } : {}),
                annulationLe,
              });
            }
          } else if (
            net > 0 &&
            (r.message === MESSAGE_GRILLE_INCONNUE || (await grilleDe(l)) === null)
          ) {
            // Ligne pas encore facturée dont la grille est inconnue : rien ne bouge, Williams est prévenu.
            await alerterGrilleInconnue(l, null);
          }
          continue;
        }

        // Ligne FACTURÉE (due facturée ou versée) : l'argent est revenu après une reprise, ou après
        // une réduction faite avant sa facturation → COMPLÉMENT (ligne « due » qui renvoie à elle),
        // jamais au-delà de la cible ni, pour une ligne jamais réduite, de son propre montant.
        const facturee = l.statut === "versee" || (l.statut === "due" && !!l.autofactureNumero);
        if (!facturee) continue;
        const solde = await reprisesEtComplements(prisma, l.apporteurId, l.id);
        let plafondEtatFinal: number | null = null;
        const reference = l.parrainage ? filleul : l;
        if (reference && reference.montantCents !== null) {
          const cibleF = cibleEtatFinal(
            {
              ...reference,
              montantCents: reference.montantCents ?? 0,
              grille: l.parrainage ? grilleFilleul : await grilleDe(l),
            },
            net,
            baseHorsRecurrent,
          );
          if (cibleF !== null) {
            const reduiteAvant = reference.factureHtCents < net;
            const cibleL = l.parrainage ? partDuParrain(cibleF) : cibleF;
            plafondEtatFinal = reduiteAvant ? cibleL : Math.min(cibleL, montant);
            const vivantAvant = montant - solde.reprisCents + solde.complementsCents;
            if (
              plafondEtatFinal > vivantAvant &&
              !(await remplaceeParUneAutreLigne(l, montant, solde, lu.membres, lu.avoirs))
            ) {
              const c = await completer(l, montant, plafondEtatFinal, motifRetour(net), maintenant);
              if (c > 0) {
                bilan.complements += 1;
                continue;
              }
            }
          }
        }

        // Relecture de a1 : la base est le prix de la LIGNE à sa création (`factureHtCents`, déjà net
        // des avoirs d'alors) ; seuls les avoirs émis APRÈS elle, et de moins de 24 mois, la réduisent.
        const apres = recents.filter((a) => (a.emiseAt ?? a.createdAt ?? new Date(0)) > l.creeAt);
        if (apres.length === 0) continue; // aucun avoir dans le délai depuis la ligne : rien à reprendre
        // `l.factureHtCents` porte déjà les avoirs pris en compte à la création ou par une
        // réduction : on ne le réduit que du net actuel de la commande (tous avoirs), la reprise
        // déjà faite étant soustraite plus bas. Le délai de 24 mois est tenu par `apres` ci-dessus.
        // Un avoir de plus de 24 mois émis APRÈS la ligne n'est pas déjà intégré à sa base : il ne
        // profite pas du délai d'un avoir récent (art. 4.5) et est donc remis dans le net.
        const anciensApres = (actifs as FactureLue[])
          .filter(
            (a) => !recents.includes(a) && (a.emiseAt ?? a.createdAt ?? new Date(0)) > l.creeAt,
          )
          .reduce((x, a) => x + a.montantHtCents, 0);
        const netLigne = Math.max(0, Math.min(l.factureHtCents, net - anciensApres));
        const annulationLigne = dateDeLAnnulation(apres) ?? annulationLe;
        const cibleLigne = cibleApresAvoir(
          { ...l, montantCents: montant, grille: await grilleDe(l) },
          netLigne,
          l.parrainage && filleul
            ? { ...filleul, montantCents: filleul.montantCents ?? 0, grille: grilleFilleul }
            : undefined,
        );
        if (cibleLigne === null) {
          await alerterGrilleInconnue(l, l.parrainage ? grilleFilleul : await grilleDe(l));
          continue;
        }
        // Tour 2/2 (défaut 4) : la cible porte sur TOUT ce que la ligne a rapporté (montant −
        // reprises + compléments vivants). Une ligne déjà reprise ou complétée ne descend jamais
        // sous la cible de l'état final (l'argent revenu reste à l'apporteur).
        const cible =
          solde.reprisCents > 0 || solde.complementsCents > 0
            ? Math.max(cibleLigne, plafondEtatFinal ?? cibleLigne)
            : cibleLigne;
        const vivant = montant - solde.reprisCents + solde.complementsCents;
        if (cible >= vivant) continue;
        let aRetirer = vivant - cible;

        // 1. Les compléments pas encore facturés se retirent d'abord (jamais une reprise de ce qui
        //    n'a pas été versé).
        aRetirer -= await retirerComplementsNonFactures(l, aRetirer, motif);
        // 2. Les compléments VERSÉS sont repris sur leur PROPRE ligne (plafond propre : montant du
        //    complément moins ses reprises), le plus récent d'abord.
        for (const c of [...solde.complements].reverse()) {
          if (aRetirer <= 0) break;
          if (c.statut !== "versee") continue;
          const part = Math.min(aRetirer, c.montantCents - c.reprisCents);
          if (part <= 0) continue;
          const rc = await reprendreSurLaLigne(
            c.id,
            l.apporteurId,
            part,
            motif,
            annulationLigne,
            maintenant,
          );
          if (rc.ok) {
            aRetirer -= part;
            bilan.reprises += 1;
            await prevenirAjustement({
              apporteurId: l.apporteurId,
              ligneId: c.id,
              type: "reprise",
              avantCents: c.montantCents,
              reprisCents: part,
              annulationLe: annulationLigne,
              ...(rc.repriseId ? { repriseId: rc.repriseId } : {}),
            });
          }
        }
        // 3. Un complément facturé, pas encore versé, est retenu s'il part en entier ; une réduction
        //    partielle attend son versement (la reprise suivra).
        for (const c of [...solde.complements].reverse()) {
          if (aRetirer <= 0) break;
          if (c.statut !== "due") continue;
          const lc = await prisma.commissionApporteur.findUnique({
            where: { id: c.id },
            select: {
              id: true,
              apporteurId: true,
              statut: true,
              montantCents: true,
              autofactureNumero: true,
              autofactureEmiseAt: true,
              verseeAt: true,
              parrainage: true,
            },
          });
          if (!lc || !lc.autofactureNumero || lc.verseeAt) continue;
          const m = lc.montantCents ?? 0;
          if (aRetirer < m) continue;
          const r = await retenir(
            { ...lc, montantCents: m, autofactureNumero: lc.autofactureNumero },
            motif,
            maintenant,
            `annulation après l'avoir du client au ${dateFr(annulationLigne)} (art. 4.5)`,
          );
          if (r.ok && r.numero) {
            aRetirer -= m;
            bilan.retenues += 1;
            await prevenirRetenue(l.apporteurId, r.numero, r.avoir);
            if (r.avertissement) signalerErreurReseau("avoir client", new Error(r.avertissement));
          }
        }
        if (aRetirer <= 0) continue;

        // 4. La ligne d'origine.
        if (l.statut === "due" && l.autofactureNumero && !l.verseeAt) {
          // Réduction partielle : la reprise suivra le versement ; tout part → retenue.
          if (aRetirer < montant) continue;
          const r = await retenir(
            {
              id: l.id,
              apporteurId: l.apporteurId,
              statut: l.statut,
              montantCents: montant,
              autofactureNumero: l.autofactureNumero,
              autofactureEmiseAt: l.autofactureEmiseAt,
              parrainage: l.parrainage,
            },
            motif,
            maintenant,
            `annulation après l'avoir du client au ${dateFr(annulationLigne)} (art. 4.5)`,
          );
          if (r.ok && r.numero) {
            bilan.retenues += 1;
            await prevenirRetenue(l.apporteurId, r.numero, r.avoir);
            if (r.avertissement) signalerErreurReseau("avoir client", new Error(r.avertissement));
          }
          continue;
        }

        if (l.statut === "versee") {
          const part = Math.min(aRetirer, montant - solde.reprisCents);
          if (part < aRetirer)
            await alerterRepriseRefusee(
              l.id,
              aRetirer,
              `il reste ${((aRetirer - Math.max(0, part)) / 100).toFixed(2).replace(".", ",")} € à reprendre au-delà de ce que la ligne et ses compléments peuvent porter.`,
              maintenant,
            );
          const rl = await reprendreSurLaLigne(
            l.id,
            l.apporteurId,
            part,
            motif,
            annulationLigne,
            maintenant,
          );
          if (rl.ok) {
            bilan.reprises += 1;
            await prevenirAjustement({
              apporteurId: l.apporteurId,
              ligneId: l.id,
              type: "reprise",
              avantCents: montant,
              reprisCents: part,
              annulationLe: annulationLigne,
              ...(rl.repriseId ? { repriseId: rl.repriseId } : {}),
            });
          }
        }
      }
    } catch (err) {
      // Une commande en échec n'arrête pas les autres ; le passage suivant la reprend.
      signalerErreurReseau("avoir client : commande", err);
    }
  }
  return bilan;
}
