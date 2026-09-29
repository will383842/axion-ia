/**
 * FUSIONNER deux fiches du même client — le filet, pas la règle
 * (chantier visio, PR 4 ; décision A3 de Will : « fusion autorisée, déclenchée
 * par Will, réversible » ; plan §3.17 point 6).
 *
 * L'anti-doublon se joue à la CRÉATION (porte unique, PR 3). La fusion ne
 * répare que ce qui a échappé à la porte : une fiche créée avant, un
 * particulier devenu entreprise.
 *
 * ## Les règles du SIREN
 *
 *   · deux SIREN DIFFÉRENTS : REFUS, toujours — ce sont deux entreprises ;
 *   · le même SIREN : permise, même si les fiches portent des pièces ;
 *   · aucun SIREN : permise ;
 *   · un SIREN d'un seul côté : permise ; si c'est l'absorbante qui l'a, la
 *     case « reporter le SIREN sur la fiche absorbée » (cochée par défaut)
 *     l'y recopie, et `sirenAbsorbeAvant` garde l'ancien (« Défaire » le
 *     rétablit). REPLI PRUDENT tant qu'Axion Partners n'a pas répondu
 *     (`PARTNERS_A_CONFIRME_LE_SUIVI_PAR_SIREN`) : refus si la fiche SANS
 *     SIREN porte une facture — Partners rattache ses apporteurs au SIREN, et
 *     une facture qui changerait de SIREN changerait peut-être de commission.
 *
 * ## Ce qui bouge, ce qui reste
 *
 * Les PERSONNES, les PROJETS et les RENCONTRES de la fiche absorbée passent
 * sur l'absorbante, avec leurs faits et leurs participants ; chacun est
 * listé dans `ClientFusionElement` pour pouvoir être RENDU. Les devis, les
 * factures, les conventions RESTENT sur la fiche absorbée, en lecture seule :
 * ce sont des pièces émises. Un projet relié à un devis (`ProjetDevis`) ne
 * peut donc pas bouger sans son devis : la fusion est refusée et le dit.
 *
 * Les clés « même client » sont différées pour la durée de la transaction
 * (`SET CONSTRAINTS ALL DEFERRED`, prévu par la migration) : projets et
 * personnes changent de fiche l'un après l'autre, tout est contrôlé au COMMIT.
 *
 * ## Axion Partners : la file existante, le constructeur du contrat
 *
 * Correction anti-doublon D3 : aucun événement maison, aucune file de rejeu
 * maison. La fusion s'écrit, DANS sa transaction, par la file de sortie déjà
 * en place (`ecrireEvenementPartners`, `partners-sync/outbox.ts`), avec le
 * constructeur du contrat (`payloadClientFusionne({ survivorId, absorbedId })`,
 * `partners/payloads.ts`) : l'absorbante est le `survivorId`, l'absorbée
 * l'`absorbedId`, la clé de fait est l'identifiant de la fusion.
 *
 *   · `client.fusionne` n'est émissible que si la version PUBLIÉE du contrat
 *     le porte (`TYPES_EVENEMENT`) : en v1 il n'y est pas, rien n'est écrit ;
 *     le jour où la copie v2 est posée (#1223), l'émission part d'elle-même ;
 *   · canal fermé (`PARTNERS_SYNC_ENABLED` absent) : inertie totale ;
 *   · une ligne écrite pose `emiseVersPartnersLe` : « Défaire » la refuse
 *     alors, puisque le contrat n'a AUCUN événement « fusion défaite »
 *     (question ouverte pour Partners, notée dans la PR).
 */

import {
  ecrireEvenementPartners,
  type EcrivainOutboxPartners,
} from "@/server/partners-sync/outbox";
import { TYPES_EVENEMENT } from "@/server/partners/contrat";
import { payloadClientFusionne } from "@/server/partners/payloads";

import type { BaseTransactionnelle, Tx } from "./base";

/**
 * Axion Partners a-t-il confirmé qu'aucun de ses calculs ne s'appuie sur
 * l'identifiant de fiche plutôt que sur le SIREN ? Question technique posée
 * par l'orchestrateur ; `false` = repli prudent.
 */
export const PARTNERS_A_CONFIRME_LE_SUIVI_PAR_SIREN = false;

export const LONGUEUR_MIN_MOTIF_FUSION = 10;

export class ErreurFusion extends Error {}

export const MESSAGE_DEUX_SIREN =
  "Ce sont deux entreprises différentes. Si l'une des deux est fausse, corrige d'abord son SIREN.";

export interface FicheAFusionner {
  readonly id: string;
  readonly siren: string | null;
  readonly aUneFacture: boolean;
}

export type DecisionFusion =
  | { readonly permise: true; readonly reporterSiren: boolean }
  | { readonly permise: false; readonly motif: string };

/** Les règles du SIREN, sans la base. PURE. */
export function deciderFusion(
  absorbee: FicheAFusionner,
  absorbante: FicheAFusionner,
  e: { readonly reporterSiren: boolean; readonly partnersAConfirme?: boolean },
): DecisionFusion {
  if (absorbee.id === absorbante.id) {
    return { permise: false, motif: "Une fiche ne se fusionne pas avec elle-même." };
  }
  const a = absorbee.siren;
  const b = absorbante.siren;
  if (a !== null && b !== null) {
    return a === b
      ? { permise: true, reporterSiren: false }
      : { permise: false, motif: MESSAGE_DEUX_SIREN };
  }
  if (a === null && b === null) return { permise: true, reporterSiren: false };

  // Un SIREN d'un seul côté.
  const sansSiren = a === null ? absorbee : absorbante;
  if (!(e.partnersAConfirme ?? PARTNERS_A_CONFIRME_LE_SUIVI_PAR_SIREN) && sansSiren.aUneFacture) {
    return {
      permise: false,
      motif:
        "La fiche sans SIREN porte une facture : tant qu'Axion Partners n'a pas confirmé " +
        "qu'il suit les apporteurs par le SIREN, cette fusion attend. Donnez d'abord son " +
        "SIREN à la fiche, s'il est connu.",
    };
  }
  return { permise: true, reporterSiren: a === null && e.reporterSiren };
}

export interface EntreeFusion {
  readonly absorbeeId: string;
  readonly absorbanteId: string;
  readonly motif: string;
  /** Case « reporter le SIREN sur la fiche absorbée » (cochée par défaut). */
  readonly reporterSiren: boolean;
  readonly parAdminId: string;
}

async function ficheAFusionner(tx: Tx, id: string): Promise<FicheAFusionner> {
  const c = await tx.client.findUnique({ where: { id }, select: { id: true, siren: true } });
  if (c === null) throw new ErreurFusion("Fiche introuvable.");
  const factures = await tx.factureFormation.count({ where: { clientId: id } });
  return { id: c.id, siren: c.siren, aUneFacture: factures > 0 };
}

async function estAbsorbee(tx: Tx, id: string): Promise<boolean> {
  return (await tx.clientFusion.count({ where: { absorbeId: id, defaiteLe: null } })) > 0;
}

/** Fusionne la fiche `absorbeeId` dans `absorbanteId`. Voir l'en-tête. */
export async function fusionnerFiches(
  db: BaseTransactionnelle,
  e: EntreeFusion,
  options: { readonly typesDuContrat?: readonly string[] } = {},
): Promise<{ fusionId: string; contacts: number; projets: number; rencontres: number }> {
  const motif = e.motif.trim();
  if (motif.length < LONGUEUR_MIN_MOTIF_FUSION) {
    throw new ErreurFusion(
      `Écrivez pourquoi ces deux fiches sont le même client (${LONGUEUR_MIN_MOTIF_FUSION} caractères au moins).`,
    );
  }
  return db.$transaction(async (tx) => {
    const absorbee = await ficheAFusionner(tx, e.absorbeeId);
    const absorbante = await ficheAFusionner(tx, e.absorbanteId);
    if (await estAbsorbee(tx, e.absorbeeId)) {
      throw new ErreurFusion("Cette fiche est déjà fusionnée dans une autre.");
    }
    if (await estAbsorbee(tx, e.absorbanteId)) {
      throw new ErreurFusion(
        "La fiche qui reste a elle-même été fusionnée : choisissez celle qui l'a absorbée.",
      );
    }
    const decision = deciderFusion(absorbee, absorbante, { reporterSiren: e.reporterSiren });
    if (!decision.permise) throw new ErreurFusion(decision.motif);

    const projets = await tx.projet.findMany({
      where: { clientId: e.absorbeeId },
      select: { id: true },
    });
    const projetIds = projets.map((p) => p.id);
    if (projetIds.length > 0) {
      const lies = await tx.projetDevis.count({ where: { projetId: { in: projetIds } } });
      if (lies > 0) {
        throw new ErreurFusion(
          "Un projet de la fiche absorbée est relié à un devis : un devis émis reste sur sa fiche, " +
            "son projet ne peut pas la quitter. Retirez d'abord ce lien, ou gardez les deux fiches.",
        );
      }
    }
    const contacts = await tx.clientContact.findMany({
      where: { clientId: e.absorbeeId },
      select: { id: true },
    });
    const rencontres = await tx.rencontre.findMany({
      where: { clientId: e.absorbeeId },
      select: { id: true, projetId: true },
    });

    await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");

    const fusion = await tx.clientFusion.create({
      data: {
        absorbeId: e.absorbeeId,
        absorbantId: e.absorbanteId,
        parAdminId: e.parAdminId,
        motif: motif.slice(0, 300),
        sirenReporte: decision.reporterSiren,
        sirenAbsorbeAvant: absorbee.siren,
      },
      select: { id: true, le: true },
    });

    const elements = [
      ...contacts.map((c) => ({ fusionId: fusion.id, type: "contact" as const, elementId: c.id })),
      ...projetIds.map((id) => ({ fusionId: fusion.id, type: "projet" as const, elementId: id })),
      ...rencontres.map((r) => ({
        fusionId: fusion.id,
        type: "rencontre" as const,
        elementId: r.id,
      })),
    ];
    if (elements.length > 0) await tx.clientFusionElement.createMany({ data: elements });

    // Personnes, projets, rencontres — puis tout ce qui porte la fiche.
    const vers = { clientId: e.absorbanteId };
    await tx.clientContact.updateMany({ where: { clientId: e.absorbeeId }, data: vers });
    await tx.projet.updateMany({ where: { clientId: e.absorbeeId }, data: vers });
    await tx.projetContact.updateMany({ where: { clientId: e.absorbeeId }, data: vers });
    await tx.rencontre.updateMany({ where: { clientId: e.absorbeeId }, data: vers });
    await tx.rencontreParticipant.updateMany({ where: { clientId: e.absorbeeId }, data: vers });
    await tx.questionnaireCadrage.updateMany({ where: { clientId: e.absorbeeId }, data: vers });
    await tx.emailSuivi.updateMany({ where: { clientId: e.absorbeeId }, data: vers });
    const faits = await tx.fait.findMany({
      where: { clientId: e.absorbeeId },
      select: { id: true, portee: true, projetId: true },
    });
    await tx.fait.updateMany({ where: { clientId: e.absorbeeId }, data: vers });
    if (faits.length > 0) {
      await tx.faitEvenement.createMany({
        data: faits.map((f) => ({
          faitId: f.id,
          action: "deplace" as const,
          ancienClientId: e.absorbeeId,
          nouveauClientId: e.absorbanteId,
          ancienPortee: f.portee,
          nouveauPortee: f.portee,
          ancienProjetId: f.projetId,
          nouveauProjetId: f.projetId,
          parAdminId: e.parAdminId,
        })),
      });
    }
    // Les propositions pendantes suivent aussi (A4 : elles restent des propositions).
    await tx.rencontre.updateMany({
      where: { clientProposeId: e.absorbeeId },
      data: { clientProposeId: e.absorbanteId },
    });

    if (projetIds.length > 0) {
      await tx.projetEvenement.createMany({
        data: projetIds.map((projetId) => ({
          projetId,
          action: "deplace" as const,
          motif: "Fusion de fiches",
          parAdminId: e.parAdminId,
        })),
      });
    }
    if (rencontres.length > 0) {
      await tx.rencontreRattachementEvenement.createMany({
        data: rencontres.map((r) => ({
          rencontreId: r.id,
          action: "fusionne" as const,
          ancienClientId: e.absorbeeId,
          nouveauClientId: e.absorbanteId,
          ancienProjetId: r.projetId,
          nouveauProjetId: r.projetId,
          parAdminId: e.parAdminId,
        })),
      });
    }

    if (decision.reporterSiren && absorbante.siren !== null) {
      await tx.client.update({ where: { id: e.absorbeeId }, data: { siren: absorbante.siren } });
    }

    // Axion Partners : même transaction, file existante (D3). Voir l'en-tête.
    const eventId = await emettreFusionVersPartners(
      tx,
      {
        fusionId: fusion.id,
        absorbanteId: e.absorbanteId,
        absorbeeId: e.absorbeeId,
        le: fusion.le,
      },
      options.typesDuContrat,
    );
    if (eventId !== null) {
      await tx.clientFusion.update({
        where: { id: fusion.id },
        data: { emiseVersPartnersLe: new Date() },
      });
    }

    return {
      fusionId: fusion.id,
      contacts: contacts.length,
      projets: projetIds.length,
      rencontres: rencontres.length,
    };
  });
}

// ── Axion Partners : la file existante (correction anti-doublon D3) ─────────

export const TYPE_EVENEMENT_FUSION = "client.fusionne";

/** Vrai si la version publiée du contrat porte `client.fusionne`. */
export function fusionEmissibleVersPartners(
  typesDuContrat: readonly string[] = TYPES_EVENEMENT,
): boolean {
  return typesDuContrat.includes(TYPE_EVENEMENT_FUSION);
}

/**
 * Écrit `client.fusionne` dans la file de sortie Partners, dans la transaction
 * de la fusion. Rend l'`event_id`, ou `null` si rien n'est écrit (type absent
 * du contrat publié, ou canal fermé). SEUL producteur de cet événement
 * (cliquet `tests/unit/ci/toute-fusion-de-fiches-passe-par-la-file-partners.spec.ts`).
 */
export async function emettreFusionVersPartners(
  tx: EcrivainOutboxPartners,
  f: {
    readonly fusionId: string;
    readonly absorbanteId: string;
    readonly absorbeeId: string;
    readonly le: Date;
  },
  typesDuContrat: readonly string[] = TYPES_EVENEMENT,
): Promise<string | null> {
  if (!fusionEmissibleVersPartners(typesDuContrat)) return null;
  return ecrireEvenementPartners(tx, {
    type: TYPE_EVENEMENT_FUSION,
    cleDeFait: `${TYPE_EVENEMENT_FUSION}:${f.fusionId}`,
    occurredAt: f.le,
    sujet: { client_id: f.absorbanteId },
    payload: payloadClientFusionne({ survivorId: f.absorbanteId, absorbedId: f.absorbeeId }),
  });
}
