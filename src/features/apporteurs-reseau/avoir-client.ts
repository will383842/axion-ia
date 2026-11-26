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

import { randomUUID } from "node:crypto";

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import {
  annulerCommission,
  commissionPourPrixConserve,
  partDuParrain,
  reduireCommission,
} from "./ajustement";
import { dateFr } from "./autofacture-donnees";
import {
  etatDeLaCommande,
  netDeLaCommande,
  PREFIXE_MOTIF_COMMANDE_NON_SOLDEE,
  PREFIXE_PALIER_COMPLEMENT,
  type FactureDeCommande,
} from "./commandes";
import { ajouterMois, FORFAIT_CONFERENCE_CENTS, PALIER_CONFERENCE, TAUX_BPS } from "./regles";
import { litigeDisponible } from "./litige";
import { envoyer } from "./envois";
import { retenir, type Piece } from "./manquement";
import { enregistrerReprise, PREFIXE_PALIER_REPRISE } from "./resiliation";
import { signalerErreurReseau } from "./signaler";

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

type FactureLue = FactureDeCommande & { createdAt: Date | null };

const CHAMPS = {
  id: true,
  devisId: true,
  statut: true,
  avoirDeId: true,
  montantHtCents: true,
  emiseAt: true,
  createdAt: true,
} as const;

/** Les factures d'une commande et leurs avoirs, tous statuts (le tri est fait par la source unique). */
async function facturesDeLaCommande(factureId: string): Promise<{
  membres: FactureLue[];
  avoirs: FactureLue[];
  totalDevisCents?: number;
} | null> {
  const f = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: { id: true, devisId: true, devis: { select: { montantTotalHtCents: true } } },
  });
  if (!f) return null;
  const membres = (await prisma.factureFormation.findMany({
    where: f.devisId ? { devisId: f.devisId, avoirDeId: null } : { id: f.id },
    select: CHAMPS,
  })) as FactureLue[];
  const avoirs = (await prisma.factureFormation.findMany({
    where: { avoirDeId: { in: membres.map((m) => m.id) } },
    select: CHAMPS,
  })) as FactureLue[];
  const total = f.devis?.montantTotalHtCents;
  return { membres, avoirs, ...(typeof total === "number" ? { totalDevisCents: total } : {}) };
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
  litigeDepuis: Date | null;
  litigeMotif: string | null;
};

const motifRetour = (net: number) =>
  `Décision du 25/11 : le client a de nouveau payé la commande (net ${(net / 100).toFixed(2).replace(".", ",")} € HT) : la commission revient à sa cible.`;

/** Les reprises (valeur absolue) et les compléments encore actifs d'une ligne d'origine. */
async function reprisesEtComplements(
  db: Pick<typeof prisma, "commissionApporteur">,
  apporteurId: string,
  id: string,
): Promise<{ reprisCents: number; complementsCents: number }> {
  const ls = await db.commissionApporteur.findMany({
    where: {
      apporteurId,
      palier: { in: [`${PREFIXE_PALIER_REPRISE}${id}`, `${PREFIXE_PALIER_COMPLEMENT}${id}`] },
    },
    select: { palier: true, montantCents: true, statut: true },
  });
  let reprisCents = 0;
  let complementsCents = 0;
  for (const x of ls ?? []) {
    if ((x.palier ?? "").startsWith(PREFIXE_PALIER_COMPLEMENT)) {
      if (x.statut !== "annulee" && x.statut !== "retenue")
        complementsCents += Math.max(0, x.montantCents ?? 0);
    } else reprisCents += Math.abs(x.montantCents ?? 0);
  }
  return { reprisCents, complementsCents };
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
 * COMPLÉMENT d'une ligne facturée : l'apporteur retrouve ce que la reprise (ou la réduction faite
 * avant facturation) lui avait retiré, à hauteur de `plafond` (la cible). Sous le MÊME verrou que
 * la reprise (`reprise:<id>`) et après RELECTURE : deux passages simultanés ne complètent qu'une
 * fois, un rejeu est sans effet. Rend le montant complété (0 si rien).
 */
async function completer(
  l: LigneLue,
  montant: number,
  plafond: number,
  motif: string,
): Promise<number> {
  const premier = await reprisesEtComplements(prisma, l.apporteurId, l.id);
  if (montant - premier.reprisCents + premier.complementsCents >= plafond) return 0;
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
        statut: "due",
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
    where: { avoirDeId: { not: null } },
    select: { avoirDeId: true, devisId: true },
  });
  const origines = [...new Set(avoirs.map((a) => a.avoirDeId).filter((x): x is string => !!x))];
  if (origines.length === 0) return bilan;
  const devis = [...new Set(avoirs.map((a) => a.devisId).filter((x): x is string => !!x))];
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
      if (actifs.length === 0) {
        // avoir brouillon ou annulé : sans effet (une suspension automatique est levée)
        if (suspensionPossible) bilan.suspensionsLevees += await leverSuspension(groupe);
        continue;
      }
      // Une facture refaite ou un complément est émis mais pas payé : la commande n'est plus
      // soldée par du payé. Rien ne part (ni autofacture ni virement) et aucun montant ne bouge
      // tant que l'état n'est pas final : il sera jugé d'un coup, au paiement ou à l'annulation.
      // Exception : plus RIEN de payé n'est gardé → la ligne est annulée (ou retenue, reprise) tout
      // de suite ; la facture refaite, une fois payée, fonde une commission neuve (même résultat).
      if (etat.enAttente && etat.netPayeCents > 0) {
        if (suspensionPossible) bilan.suspendues += await suspendre(groupe, maintenant);
        continue;
      }
      if (suspensionPossible) bilan.suspensionsLevees += await leverSuspension(groupe);
      const net = etat.netCibleCents;
      // Dette a1 (a) : le délai de 24 mois de l'art. 4.5 s'apprécie AVOIR PAR AVOIR. Pour une ligne
      // déjà facturée (retenue, reprise), seuls comptent les avoirs de moins de 24 mois ; un avoir
      // plus ancien ne profite jamais du délai d'un avoir récent.
      const recents = avoirsDansLeDelai(actifs as FactureLue[], maintenant);
      const annulationLe = dateDeLAnnulation(recents) ?? maintenant;
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
      const parrainParAjustement =
        !!filleul && !filleul.autofactureNumero && estModifiable(filleul.statut);
      const ordre = [...groupe].sort((a, b) => Number(a.parrainage) - Number(b.parrainage));

      for (const l of ordre) {
        const montant = l.montantCents ?? 0;
        if (l.parrainage && parrainParAjustement) continue;

        if (!l.autofactureNumero && estModifiable(l.statut) && l.parrainage) {
          // Part de parrain pas encore facturée alors que le filleul l'est : elle suit le filleul
          // recalculé (art. 4.6), par une écriture conditionnelle tracée.
          const cible = filleul
            ? cibleApresAvoir({ ...l, montantCents: montant }, net, {
                ...filleul,
                montantCents: filleul.montantCents ?? 0,
              })
            : null;
          if (cible === null || cible >= montant) continue;
          const u = await prisma.commissionApporteur.updateMany({
            where: { id: l.id, montantCents: montant, autofactureNumero: null, statut: l.statut },
            data: cible <= 0 ? { statut: "annulee" } : { montantCents: cible },
          });
          if (u.count === 1) {
            if (cible <= 0) bilan.annulees += 1;
            else bilan.reduites += 1;
            await tracer(l.id, { avantCents: montant, apresCents: cible, motif });
          }
          continue;
        }

        if (!l.autofactureNumero && estModifiable(l.statut)) {
          if (net > l.factureHtCents) {
            // L'argent est revenu : la ligne REMONTE vers la cible (et la part du parrain la suit).
            const cible = cibleEtatFinal({ ...l, montantCents: montant }, net, etat.baseCents);
            if (cible !== null && cible > montant) {
              if (await remonter(l, montant, cible, net, motifRetour(net))) {
                bilan.remontees += 1;
                bilan.remontees += await remonterParrain(
                  groupe,
                  partDuParrain(cible),
                  motifRetour(net),
                );
              }
            }
            continue;
          }
          if (net === l.factureHtCents) continue; // déjà au prix net (idempotence)
          const r =
            net <= 0
              ? await annulerCommission(l.id, motif)
              : await reduireCommission(l.id, net, motif);
          if (r.ok) {
            if (net <= 0) bilan.annulees += 1;
            else bilan.reduites += 1;
          }
          continue;
        }

        // Ligne FACTURÉE (due facturée ou versée) : l'argent est revenu après une reprise, ou après
        // une réduction faite avant sa facturation → COMPLÉMENT (ligne « due » qui renvoie à elle),
        // jamais au-delà de la cible ni, pour une ligne jamais réduite, de son propre montant.
        if (l.statut === "versee" || (l.statut === "due" && l.autofactureNumero)) {
          const reference = l.parrainage ? filleul : l;
          if (reference && reference.montantCents !== null) {
            const cibleF = cibleEtatFinal(
              { ...reference, montantCents: reference.montantCents ?? 0 },
              net,
              etat.baseCents,
            );
            if (cibleF !== null) {
              const reduiteAvant = reference.factureHtCents < net;
              const cibleL = l.parrainage ? partDuParrain(cibleF) : cibleF;
              const plafond = reduiteAvant ? cibleL : Math.min(cibleL, montant);
              const c = await completer(l, montant, plafond, motifRetour(net));
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
        // `l.factureHtCents` est déjà le prix net à la création OU après une réduction (qui le
        // réécrit) : il ne se réduit plus des avoirs, il est seulement borné par le net actuel de la
        // commande (jamais de double déduction d'un avoir déjà pris en compte).
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
        const cible = cibleApresAvoir(
          { ...l, montantCents: montant },
          netLigne,
          l.parrainage && filleul
            ? { ...filleul, montantCents: filleul.montantCents ?? 0 }
            : undefined,
        );
        if (cible === null || cible >= montant) continue;

        if (l.statut === "due" && l.autofactureNumero && !l.verseeAt) {
          if (cible > 0) continue; // réduction partielle : la reprise suivra le versement
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
          const { reprisCents: repris, complementsCents } = await reprisesEtComplements(
            prisma,
            l.apporteurId,
            l.id,
          );
          let aReprendre = montant + complementsCents - cible - repris;
          if (aReprendre <= 0) continue;
          // Un complément pas encore facturé se retire d'abord (jamais une reprise de ce qui
          // n'a pas été versé) ; le reste seulement est repris.
          aReprendre -= await retirerComplementsNonFactures(l, aReprendre, motif);
          if (aReprendre <= 0) continue;
          // `enregistrerReprise` relit sous verrou : un passage concurrent ne reprend pas deux fois.
          const r = await enregistrerReprise({
            commissionId: l.id,
            apporteurId: l.apporteurId,
            demandeeCents: aReprendre,
            motif,
            annulationLe: annulationLigne,
            maintenant,
          });
          if (r.ok) bilan.reprises += 1;
        }
      }
    } catch (err) {
      // Une commande en échec n'arrête pas les autres ; le passage suivant la reprend.
      signalerErreurReseau("avoir client : commande", err);
    }
  }
  return bilan;
}
