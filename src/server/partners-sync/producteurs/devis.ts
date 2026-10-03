/**
 * producteurs/devis.ts — l'UNIQUE émission de `devis.signe` vers Axion Partners (INT-T04,
 * REQ-INT-006, REQ-INT-007).
 *
 * ── Un seul fait, quel que soit le chemin ─────────────────────────────────────────────────────
 * Trois écrivains posent `statut: "accepte"` sur un devis : le webhook DocuSeal, l'action admin
 * `acceptDevisAction`, et la signature intégrale d'une pièce (`consequenceSignatureComplete`).
 * Tous passent par `emettreDevisSigne`, dans la même transaction que leur écriture. La clé du
 * fait est l'identifiant du DEVIS : deux chemins pour le même devis (un webhook rejoué, une
 * acceptation admin après une signature) rendent le même `event_id`, et la file de sortie écrit
 * en `ON CONFLICT DO NOTHING`. Le cliquet `pnpm partners:cliquet-ecrivains` refuse tout écrivain
 * de l'état qui n'appellerait pas cette fonction.
 *
 * ── La charge est CALCULÉE ICI ────────────────────────────────────────────────────────────────
 * `payloadDevisSigne` résout, par ligne, le palier de commission depuis la grille du dépôt
 * (`commission.ts` IMPORTE `COMMERCIAL_COMMISSIONS`) : Partners reçoit le verdict, jamais la
 * grille. Un palier introuvable part NUL, avec son motif (`a_qualifier`), jamais deviné.
 *
 * ── La vérification de sortie, et pourquoi elle est ici plutôt qu'au contrat ────────────────
 * Le contrat publié dit `montantHtCents: integer`. Il refuse un montant en euros À DÉCIMALES
 * (12,5), pas un montant en euros ENTIERS (5 000 au lieu de 500 000) : un entier est un entier.
 * Le contrat est celui de Partners et ne se modifie pas d'ici. La seconde barrière est donc une
 * cohérence que seules des lignes en centimes satisfont : Σ lignes = `montantTotalHtCents`, le
 * total que `createDevisAction` a calculé EN CENTIMES à la création. Une ligne divisée par cent
 * ne tombe plus sur le total, et la charge est refusée avec le nom du champ.
 *
 * ── Inertie ───────────────────────────────────────────────────────────────────────────────────
 * Canal fermé : `transactionDevisSigne` exécute le travail sur le client reçu, SANS transaction,
 * exactement comme avant ce module ; `emettreDevisSigne` rend `null` sans rien lire. Canal ouvert :
 * une transaction interactive, où l'écriture et l'événement vivent et meurent ensemble.
 */
import type { Prisma, PrismaClient } from "../../../../prisma/generated/client";
import {
  payloadDevisEmis,
  payloadDevisSigne,
  type ClientPourEvenement,
  type DevisPourEvenement,
  type PayloadDevisSigne,
} from "@/server/partners/payloads";

import { canalPartnersOuvert } from "../config";
import { ecrireEvenementPartners } from "../outbox";

/** Le type d'événement, tel que le contrat le nomme. */
export const DEVIS_SIGNE = "devis.signe";
/** Contrat v3 : le devis ÉMIS, à son envoi (INT-T46-A). */
export const DEVIS_EMIS = "devis.emis";

/** Une charge refusée à la sortie : la faute est dans les données du devis, pas dans le réseau. */
export class ChargeDevisSigneRefusee extends Error {
  readonly champ: string;

  constructor(champ: string, message: string) {
    super(`[partners-sync] devis.signe refusé — ${champ} : ${message}`);
    this.name = "ChargeDevisSigneRefusee";
    this.champ = champ;
  }
}

/**
 * La seconde barrière de REQ-INT-006 : des montants EN CENTIMES.
 *
 *   · chaque `lignes[i].montantHtCents` est un entier sûr (un montant à décimales est, au mieux,
 *     un montant en euros) ;
 *   · leur somme est `montantTotalHtCents`, le total en centimes stocké à la création.
 *
 * Rend la charge inchangée, ou lève `ChargeDevisSigneRefusee` en nommant le champ.
 */
export function verifierChargeDevisSigne(charge: PayloadDevisSigne): PayloadDevisSigne {
  if (!Number.isSafeInteger(charge.montantTotalHtCents)) {
    throw new ChargeDevisSigneRefusee(
      "montantTotalHtCents",
      `${String(charge.montantTotalHtCents)} n'est pas un nombre entier de centimes`,
    );
  }
  let somme = 0;
  charge.lignes.forEach((ligne, i) => {
    if (!Number.isSafeInteger(ligne.montantHtCents)) {
      throw new ChargeDevisSigneRefusee(
        `lignes[${i}].montantHtCents`,
        `${String(ligne.montantHtCents)} n'est pas un nombre entier de centimes`,
      );
    }
    somme += ligne.montantHtCents;
  });
  if (somme !== charge.montantTotalHtCents) {
    throw new ChargeDevisSigneRefusee(
      "lignes[].montantHtCents",
      `la somme des lignes (${somme}) diffère de montantTotalHtCents ` +
        `(${charge.montantTotalHtCents}) : une ligne n'est pas exprimée en centimes`,
    );
  }
  return charge;
}

const SELECTION_DEVIS = {
  id: true,
  numero: true,
  activite: true,
  clientId: true,
  montantTotalHtCents: true,
  statut: true,
  sentAt: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
  lignes: true,
} as const;

const SELECTION_CLIENT = {
  id: true,
  numero: true,
  type: true,
  raisonSociale: true,
  siren: true,
  nafCode: true,
  secteur: true,
  taille: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Émet `devis.signe` pour `devisId`, dans la transaction `tx`. C'est l'UNIQUE fonction
 * d'émission de ce fait (REQ-INT-007).
 *
 * Rend l'`event_id`, ou `null` si le canal est fermé, ou si le devis relu dans `tx` n'est pas
 * `accepte` — un écrivain gardé (`updateMany` sous condition) qui aurait perdu la course : c'est
 * alors l'écrivain gagnant qui émet, et la clé du fait rend l'événement unique de toute façon.
 * Lève sur une charge illisible ou hors centimes : la transaction de l'écrivain est annulée
 * avec elle (outbox.ts : un événement perdu est une commission jamais calculée).
 */
export async function emettreDevisSigne(
  tx: Prisma.TransactionClient,
  devisId: string,
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  const devis: DevisPourEvenement | null = await tx.devis.findUnique({
    where: { id: devisId },
    select: SELECTION_DEVIS,
  });
  if (devis === null) {
    throw new Error(
      `[partners-sync] devis.signe : devis ${devisId} introuvable dans la transaction.`,
    );
  }
  if (devis.statut !== "accepte") return null;

  const client: ClientPourEvenement | null = await tx.client.findUnique({
    where: { id: devis.clientId },
    select: SELECTION_CLIENT,
  });
  if (client === null) {
    throw new Error(`[partners-sync] devis.signe : client du devis ${devisId} introuvable.`);
  }

  const charge = verifierChargeDevisSigne(payloadDevisSigne({ devis, client }));
  // `payloadDevisSigne` a déjà exigé `acceptedAt` : il est l'instant du fait.
  const signeLe = new Date(charge.signeLe);

  return ecrireEvenementPartners(tx, {
    type: DEVIS_SIGNE,
    // La convention de clé de TOUS les faits (`scripts/partners/fixtures.ts`) : `<type>:<id>`.
    cleDeFait: `${DEVIS_SIGNE}:${devis.id}`,
    occurredAt: signeLe,
    sujet: { devis_id: devis.id },
    payload: { ...charge },
  });
}

/**
 * Émet `devis.emis` pour `devisId`, dans la transaction `tx` de l'ENVOI. C'est l'UNIQUE fonction
 * d'émission de ce fait (REQ-INT-007, INT-T46-A).
 *
 * Rend l'`event_id`, ou `null` si le canal est fermé, ou si le devis relu n'a pas de date d'envoi.
 * La clé du fait (`devis.emis:<id>`) le rend UNIQUE par devis : un renvoi ne réécrit rien, la
 * première émission fait foi. Lève sur un devis ou un client introuvable : la transaction de l'envoi
 * est annulée avec elle.
 */
export async function emettreDevisEmis(
  tx: Prisma.TransactionClient,
  devisId: string,
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  const devis: DevisPourEvenement | null = await tx.devis.findUnique({
    where: { id: devisId },
    select: SELECTION_DEVIS,
  });
  if (devis === null) {
    throw new Error(
      `[partners-sync] devis.emis : devis ${devisId} introuvable dans la transaction.`,
    );
  }
  if (devis.sentAt === null) return null;

  const client: ClientPourEvenement | null = await tx.client.findUnique({
    where: { id: devis.clientId },
    select: SELECTION_CLIENT,
  });
  if (client === null) {
    throw new Error(`[partners-sync] devis.emis : client du devis ${devisId} introuvable.`);
  }

  const charge = payloadDevisEmis({ devis, client });
  return ecrireEvenementPartners(tx, {
    type: DEVIS_EMIS,
    cleDeFait: `${DEVIS_EMIS}:${devis.id}`,
    occurredAt: new Date(charge.emisLe),
    sujet: { devis_id: devis.id },
    payload: { ...charge },
  });
}

/**
 * Pour un écrivain GARDÉ (`updateMany` sous condition) : les devis que la garde désigne, relus
 * dans `tx` AVANT l'écriture — après, la garde ne les désigne plus. Canal fermé : aucun, et rien
 * n'est lu.
 */
export async function devisConcernesPourEmission(
  tx: Prisma.TransactionClient,
  garde: Prisma.DevisWhereInput,
): Promise<string[]> {
  if (!canalPartnersOuvert()) return [];
  const lus = await tx.devis.findMany({ where: garde, select: { id: true } });
  return lus.map((d) => d.id);
}

/**
 * La transaction d'un écrivain de `accepte`. Canal ouvert : `client.$transaction` interactive,
 * l'écriture et l'émission dedans. Canal fermé : le travail sur `client` lui-même, sans
 * transaction — le comportement d'avant INT-T04, à l'identique (REQ-INT-008).
 */
export async function transactionDevisSigne<R>(
  client: PrismaClient,
  travail: (tx: Prisma.TransactionClient) => Promise<R>,
): Promise<R> {
  if (!canalPartnersOuvert()) return travail(client);
  return client.$transaction((tx) => travail(tx));
}
