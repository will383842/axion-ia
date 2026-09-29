/**
 * producteurs/facturation.ts — l'UNIQUE émission des faits de facturation vers Axion Partners
 * (INT-T05, REQ-INT-004, REQ-INT-005, REQ-INT-007, REQ-INT-032, REQ-ARG-005, REQ-ARG-030,
 * REQ-DM-039).
 *
 * ── Six faits, quatre fonctions ───────────────────────────────────────────────────────────────
 *   · `emettreFaitFacture`       — `facture.emise` ou `avoir.emis`. C'est la LIGNE relue qui
 *     décide : une `FactureFormation` qui porte `avoirDeId` est un avoir, toute autre est une
 *     facture. Un écrivain ne choisit pas le type, il désigne la pièce qu'il vient d'émettre.
 *   · `emettreFaitPaiement`      — `paiement.recu` ou `paiement.rembourse`. Même règle : un
 *     `Payment` de type `refund` ou au statut `refunded` est une annulation d'encaissement (les
 *     DEUX formes de REQ-INT-032), un `Payment` `succeeded` est un encaissement, tout autre
 *     statut (en attente, échoué, abandonné) n'est pas un fait.
 *   · `emettreFactureAnnulee`    — `facture.annulee`, avec son motif.
 *   · `emettreFinancementMisAJour` — `financement.mis_a_jour`, payeurs et échéance financeur.
 *
 * Toutes écrivent dans la transaction de l'écrivain (`ecrireEvenementPartners`), avec la clé de
 * fait des fixtures (`scripts/partners/fixtures.ts`) : `<type>:<id>`, et pour le financement
 * `financement.mis_a_jour:<factureId>:<updatedAt du dossier>`. Deux chemins vers le même fait
 * rendent le même `event_id` ; la file écrit en `ON CONFLICT DO NOTHING`. Le cliquet
 * `pnpm partners:cliquet-ecrivains` refuse tout écrivain de ces états qui n'y passerait pas.
 *
 * ── Le BÉNÉFICIAIRE, jamais le destinataire (REQ-ARG-005) ─────────────────────────────────────
 * Le client porté par chaque charge est celui que `resoudreClientBeneficiaire` résout
 * (`facture ?? session ?? inscription ?? dossier`), et le SIREN est le SIEN, relu sur sa fiche.
 * Le destinataire (l'OPCO d'une facture subrogée, France Travail…) n'intervient nulle part :
 * quand un tiers payeur règle, c'est l'entreprise formée qui porte l'attribution. Les
 * encaissements de plusieurs payeurs sur les factures d'une même prestation se proratisent donc
 * facture par facture, sans cas particulier. `verifierAttribution` est la barrière de sortie :
 * une charge dont le client ou le SIREN n'est pas celui du bénéficiaire est refusée, champ nommé.
 *
 * ── Une attribution impossible est ALERTÉE, jamais tue (REQ-ARG-030) ─────────────────────────
 * Un bénéficiaire introuvable part `clientId: null, origineClient: "non_resolue"` — le contrat
 * l'admet, et c'est chez Partners une ligne non résolue — ET lève une alerte `MONITORING_ALERT`
 * ici. Un encaissement sans facture ne peut pas partir (le contrat exige `factureId`) : il est
 * alerté, et l'écriture de l'encaissement n'est pas bloquée pour autant. L'alerte part en tâche
 * détachée, hors de la transaction : une alerte en trop sur une écriture annulée se relit, un
 * encaissement non attribué que personne ne voit ne se rattrape pas.
 *
 * ── Inertie ───────────────────────────────────────────────────────────────────────────────────
 * Canal fermé : chaque fonction rend `null` sans rien lire, et `transactionFaitFacturation`
 * exécute le travail sur le client reçu, sans transaction — le comportement d'avant, à
 * l'identique (REQ-INT-008).
 */
import type { Prisma, PrismaClient } from "../../../../prisma/generated/client";
import {
  payloadAvoirEmis,
  payloadFactureAnnulee,
  payloadFactureEmise,
  payloadFinancementMisAJour,
  payloadPaiementRecu,
  payloadPaiementRembourse,
  resoudreClientBeneficiaire,
  type ClientPourEvenement,
  type FactureAvecClient,
  type MotifRemboursement,
  type PaiementPourEvenement,
  type ResolutionBeneficiaire,
} from "@/server/partners/payloads";

import { canalPartnersOuvert } from "../config";
import { ecrireEvenementPartners } from "../outbox";

/** Les types d'événement, tels que le contrat les nomme. */
export const FACTURE_EMISE = "facture.emise";
export const AVOIR_EMIS = "avoir.emis";
export const PAIEMENT_RECU = "paiement.recu";
export const PAIEMENT_REMBOURSE = "paiement.rembourse";
export const FACTURE_ANNULEE = "facture.annulee";
export const FINANCEMENT_MIS_A_JOUR = "financement.mis_a_jour";

/** Une charge refusée à la sortie : la faute est dans l'attribution, pas dans le réseau. */
export class ChargeFacturationRefusee extends Error {
  readonly champ: string;

  constructor(type: string, champ: string, message: string) {
    super(`[partners-sync] ${type} refusé — ${champ} : ${message}`);
    this.name = "ChargeFacturationRefusee";
    this.champ = champ;
  }
}

/** Ce qui est alerté : jamais un nom, jamais un montant — des identifiants et un motif. */
export type AlerteFacturation = {
  readonly type: string;
  readonly motif: "client_non_resolu" | "facture_introuvable";
  /** `facture:<id>` ou `payment:<id>`. */
  readonly sujet: string;
  readonly eventId: string | null;
};

export type OptionsEmission = {
  /** Injecté par les tests ; par défaut, une notification `MONITORING_ALERT` détachée. */
  readonly alerter?: (alerte: AlerteFacturation) => void;
};

function alerterParDefaut(alerte: AlerteFacturation): void {
  void (async () => {
    try {
      const { notify } = await import("@/server/notifications");
      await notify({
        category: "MONITORING_ALERT",
        severity: "error",
        payload: {
          kind: "partners_attribution_non_resolue",
          details: {
            legacyBody:
              `Un fait « ${alerte.type} » n'a pas pu être attribué à un client bénéficiaire ` +
              `(${alerte.motif}).\n\nSujet : ${alerte.sujet}\n` +
              `Événement : ${alerte.eventId ?? "non émis (le contrat exige la facture)"}\n\n` +
              "Rattacher la pièce à son client : la commission en dépend.",
          },
        },
        dedupKey: `partners-non-resolu:${alerte.type}:${alerte.sujet}`,
        dedupTtlSec: 24 * 3600,
      });
    } catch (e) {
      console.warn(
        `[partners-sync] alerte d'attribution impossible : ${e instanceof Error ? e.name : typeof e}`,
      );
    }
  })();
}

/**
 * La barrière de sortie de REQ-ARG-005 : le client et le SIREN d'une charge sont ceux du
 * BÉNÉFICIAIRE. Rend la charge inchangée, ou lève `ChargeFacturationRefusee` en nommant le champ.
 */
export function verifierAttribution<C extends { clientId: string | null; siren: string | null }>(
  type: string,
  charge: C,
  attendu: { readonly clientId: string | null; readonly siren: string | null },
): C {
  if (charge.clientId !== attendu.clientId) {
    throw new ChargeFacturationRefusee(
      type,
      "clientId",
      `${String(charge.clientId)} n'est pas le client bénéficiaire (${String(attendu.clientId)}) ` +
        ": le destinataire ou le payeur ne porte jamais l'attribution",
    );
  }
  if (charge.siren !== attendu.siren) {
    throw new ChargeFacturationRefusee(
      type,
      "siren",
      `${String(charge.siren)} n'est pas le SIREN du client bénéficiaire (${String(attendu.siren)})`,
    );
  }
  return charge;
}

const SELECTION_FACTURE = {
  id: true,
  numero: true,
  activite: true,
  clientId: true,
  sessionId: true,
  enrollmentId: true,
  coachingContractId: true,
  dossierFinancementId: true,
  destinataire: true,
  destinataireSiret: true,
  montantHtCents: true,
  montantTvaCents: true,
  montantTtcCents: true,
  regimeTva: true,
  subrogation: true,
  avoirDeId: true,
  statut: true,
  emiseAt: true,
  echeanceAt: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  session: { select: { clientId: true } },
  enrollment: { select: { clientId: true } },
  dossierFinancement: { select: { clientId: true, echeanceFinanceurAt: true, updatedAt: true } },
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

const SELECTION_PAIEMENT = {
  id: true,
  factureFormationId: true,
  provider: true,
  amountCents: true,
  currency: true,
  status: true,
  type: true,
  paidAt: true,
  createdAt: true,
} as const;

const SELECTION_PAYEUR = { payeurType: true, montantAttenduCents: true } as const;

/** Les statuts d'une pièce ÉMISE : ni brouillon, ni annulée. */
const STATUTS_EMIS: readonly string[] = ["emise", "partiellement_payee", "en_retard", "payee"];

type FactureLue = FactureAvecClient & {
  readonly dossierFinancement?: {
    readonly clientId: string | null;
    readonly echeanceFinanceurAt: Date | null;
    readonly updatedAt: Date;
  } | null;
};

type Lecture = {
  readonly facture: FactureLue;
  readonly beneficiaire: ResolutionBeneficiaire;
};

/**
 * La facture relue dans `tx`, son client BÉNÉFICIAIRE chargé à la place du client de la ligne :
 * c'est de lui que viennent le `clientId` et le SIREN de toute charge.
 */
async function lireFacture(
  tx: Prisma.TransactionClient,
  factureId: string,
): Promise<Lecture | null> {
  const ligne = await tx.factureFormation.findUnique({
    where: { id: factureId },
    select: SELECTION_FACTURE,
  });
  if (ligne === null) return null;
  const beneficiaire = resoudreClientBeneficiaire(ligne);
  const client: ClientPourEvenement | null =
    beneficiaire.clientId === null
      ? null
      : await tx.client.findUnique({
          where: { id: beneficiaire.clientId },
          select: SELECTION_CLIENT,
        });
  return { facture: { ...ligne, client }, beneficiaire };
}

function attenduDe(l: Lecture): { clientId: string | null; siren: string | null } {
  return { clientId: l.beneficiaire.clientId, siren: l.facture.client?.siren ?? null };
}

function signalerSiNonResolu(
  l: Lecture,
  type: string,
  eventId: string | null,
  options: OptionsEmission,
): void {
  if (eventId === null || l.beneficiaire.origine !== "non_resolue") return;
  (options.alerter ?? alerterParDefaut)({
    type,
    motif: "client_non_resolu",
    sujet: `facture:${l.facture.id}`,
    eventId,
  });
}

/**
 * Émet `facture.emise` — ou `avoir.emis` si la ligne relue est un avoir — pour `factureId`,
 * dans la transaction `tx`. L'UNIQUE fonction d'émission de ces deux faits (REQ-INT-007).
 *
 * Rend l'`event_id`, ou `null` si le canal est fermé ou si la pièce relue n'est pas émise
 * (brouillon, annulée). Lève si la pièce est introuvable : l'écrivain vient de l'écrire.
 */
export async function emettreFaitFacture(
  tx: Prisma.TransactionClient,
  factureId: string,
  options: OptionsEmission = {},
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  const l = await lireFacture(tx, factureId);
  if (l === null) {
    throw new Error(`[partners-sync] facture ${factureId} introuvable dans la transaction.`);
  }
  const { facture } = l;
  if (!STATUTS_EMIS.includes(facture.statut)) return null;

  let eventId: string | null;
  if (facture.avoirDeId !== null) {
    const charge = verifierAttribution(
      AVOIR_EMIS,
      payloadAvoirEmis({ avoir: facture }),
      attenduDe(l),
    );
    eventId = await ecrireEvenementPartners(tx, {
      type: AVOIR_EMIS,
      cleDeFait: `${AVOIR_EMIS}:${facture.id}`,
      occurredAt: new Date(charge.emisLe),
      sujet: { facture_id: facture.id },
      payload: { ...charge },
    });
    signalerSiNonResolu(l, AVOIR_EMIS, eventId, options);
    return eventId;
  }

  const payeurs = await tx.dossierPayeur.findMany({
    where: { factureFormationId: facture.id },
    select: SELECTION_PAYEUR,
    orderBy: { montantAttenduCents: "desc" },
  });
  const charge = verifierAttribution(
    FACTURE_EMISE,
    payloadFactureEmise({
      facture,
      payeurs,
      echeanceFinanceurAt: facture.dossierFinancement?.echeanceFinanceurAt ?? null,
    }),
    attenduDe(l),
  );
  eventId = await ecrireEvenementPartners(tx, {
    type: FACTURE_EMISE,
    cleDeFait: `${FACTURE_EMISE}:${facture.id}`,
    occurredAt: new Date(charge.emiseLe),
    sujet: { facture_id: facture.id },
    payload: { ...charge },
  });
  signalerSiNonResolu(l, FACTURE_EMISE, eventId, options);
  return eventId;
}

/**
 * Émet `facture.annulee` pour `factureId` — relue au statut `annulee`, sinon rien.
 * L'UNIQUE fonction d'émission de ce fait (REQ-INT-032).
 */
export async function emettreFactureAnnulee(
  tx: Prisma.TransactionClient,
  factureId: string,
  motif: string,
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  const l = await lireFacture(tx, factureId);
  if (l === null) {
    throw new Error(`[partners-sync] facture ${factureId} introuvable dans la transaction.`);
  }
  if (l.facture.statut !== "annulee") return null;
  const charge = payloadFactureAnnulee({ facture: l.facture, motif });
  return ecrireEvenementPartners(tx, {
    type: FACTURE_ANNULEE,
    cleDeFait: `${FACTURE_ANNULEE}:${l.facture.id}`,
    occurredAt: l.facture.updatedAt,
    sujet: { facture_id: l.facture.id },
    payload: { ...charge },
  });
}

/**
 * Émet `financement.mis_a_jour` pour la facture `factureId` : ses payeurs et l'échéance du
 * financeur de son dossier. La clé porte l'instant du dossier — chaque mise à jour est un fait.
 * Rend `null` si la facture n'a pas de dossier de financement. (REQ-INT-032)
 */
export async function emettreFinancementMisAJour(
  tx: Prisma.TransactionClient,
  factureId: string,
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  const l = await lireFacture(tx, factureId);
  if (l === null) {
    throw new Error(`[partners-sync] facture ${factureId} introuvable dans la transaction.`);
  }
  const dossier = l.facture.dossierFinancement ?? null;
  if (dossier === null) return null;
  const payeurs = await tx.dossierPayeur.findMany({
    where: { factureFormationId: factureId },
    select: SELECTION_PAYEUR,
    orderBy: { montantAttenduCents: "desc" },
  });
  const charge = payloadFinancementMisAJour({
    factureId,
    payeurs,
    echeanceFinanceurAt: dossier.echeanceFinanceurAt,
  });
  return ecrireEvenementPartners(tx, {
    type: FINANCEMENT_MIS_A_JOUR,
    cleDeFait: `${FINANCEMENT_MIS_A_JOUR}:${factureId}:${dossier.updatedAt.toISOString()}`,
    occurredAt: dossier.updatedAt,
    sujet: { facture_id: factureId },
    payload: { ...charge },
  });
}

export type OptionsPaiement = OptionsEmission & {
  /** Exigé pour une annulation d'encaissement : les six motifs de REQ-INT-032. */
  readonly motif?: MotifRemboursement;
};

/**
 * Émet `paiement.recu` — ou `paiement.rembourse` pour une annulation d'encaissement — pour
 * `paymentId`, dans la transaction `tx`. L'UNIQUE fonction d'émission de ces deux faits.
 *
 * Le cumul encaissé est relu dans `tx` : les encaissements `succeeded` de la facture, hors
 * remboursements, CELUI-CI COMPRIS — c'est lui qui fait absorber le reliquat au dernier
 * (`derivationHt`, REQ-INT-005 amendée : le HT de chaque paiement est calculé ici).
 */
export async function emettreFaitPaiement(
  tx: Prisma.TransactionClient,
  paymentId: string,
  options: OptionsPaiement = {},
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  const paiement: PaiementPourEvenement | null = await tx.payment.findUnique({
    where: { id: paymentId },
    select: SELECTION_PAIEMENT,
  });
  if (paiement === null) {
    throw new Error(`[partners-sync] paiement ${paymentId} introuvable dans la transaction.`);
  }
  const estAnnulation = paiement.type === "refund" || paiement.status === "refunded";
  if (!estAnnulation && paiement.status !== "succeeded") return null;
  const type = estAnnulation ? PAIEMENT_REMBOURSE : PAIEMENT_RECU;

  const l =
    paiement.factureFormationId === null
      ? null
      : await lireFacture(tx, paiement.factureFormationId);
  if (l === null) {
    // Le contrat exige `factureId` : rien ne peut partir. Le fait n'est pas tu pour autant.
    (options.alerter ?? alerterParDefaut)({
      type,
      motif: "facture_introuvable",
      sujet: `payment:${paiement.id}`,
      eventId: null,
    });
    return null;
  }

  if (estAnnulation) {
    if (options.motif === undefined) {
      throw new Error(
        `[partners-sync] paiement.rembourse ${paiement.id} : le motif est exigé (REQ-INT-032).`,
      );
    }
    const charge = verifierAttribution(
      PAIEMENT_REMBOURSE,
      payloadPaiementRembourse({
        paiement,
        facture: l.facture,
        totalEncaisseTtcCents: paiement.amountCents,
        motif: options.motif,
      }),
      attenduDe(l),
    );
    const eventId = await ecrireEvenementPartners(tx, {
      type: PAIEMENT_REMBOURSE,
      cleDeFait: `${PAIEMENT_REMBOURSE}:${paiement.id}`,
      occurredAt: new Date(charge.rembourseLe),
      sujet: { payment_id: paiement.id },
      payload: { ...charge },
    });
    signalerSiNonResolu(l, PAIEMENT_REMBOURSE, eventId, options);
    return eventId;
  }

  const cumul = await tx.payment.aggregate({
    where: {
      factureFormationId: l.facture.id,
      status: "succeeded",
      type: { not: "refund" },
    },
    _sum: { amountCents: true },
  });
  // Le cumul COMPREND cet encaissement : un cumul vide est une incohérence, jamais un repli.
  const totalEncaisseTtcCents = cumul._sum.amountCents;
  if (totalEncaisseTtcCents === null) {
    throw new Error(
      `[partners-sync] paiement.recu ${paiement.id} : cumul encaissé vide alors que ` +
        "l'encaissement est relu `succeeded` dans la même transaction.",
    );
  }
  const charge = verifierAttribution(
    PAIEMENT_RECU,
    payloadPaiementRecu({ paiement, facture: l.facture, totalEncaisseTtcCents }),
    attenduDe(l),
  );
  const eventId = await ecrireEvenementPartners(tx, {
    type: PAIEMENT_RECU,
    cleDeFait: `${PAIEMENT_RECU}:${paiement.id}`,
    occurredAt: new Date(charge.paidAt),
    sujet: { payment_id: paiement.id },
    payload: { ...charge },
  });
  signalerSiNonResolu(l, PAIEMENT_RECU, eventId, options);
  return eventId;
}

/**
 * La transaction d'un écrivain de facturation. Canal ouvert : `client.$transaction` interactive,
 * l'écriture et l'émission dedans. Canal fermé : le travail sur `client` lui-même, sans
 * transaction — le comportement d'avant INT-T05, à l'identique (REQ-INT-008).
 */
export async function transactionFaitFacturation<R>(
  client: PrismaClient,
  travail: (tx: Prisma.TransactionClient) => Promise<R>,
): Promise<R> {
  if (!canalPartnersOuvert()) return travail(client);
  return client.$transaction((tx) => travail(tx));
}
