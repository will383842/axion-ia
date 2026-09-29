/**
 * producteurs/client.ts — l'UNIQUE émission de `client.cree` et `client.mis_a_jour` vers Axion
 * Partners (INT-T03, REQ-INT-007, REQ-INT-015, REQ-DM-021).
 *
 * ── Les faits ─────────────────────────────────────────────────────────────────────────────────
 *   · `client.cree` : TOUTE création d'une fiche. Il n'y a qu'une porte (`creerOuRetrouverClient`,
 *     `porte-client.ts`) ; elle appelle `emettreFaitClient(tx, id, CREATION_CLIENT)` dans sa
 *     transaction.
 *   · `client.mis_a_jour` : TOUTE écriture qui change la charge. L'écrivain relit la charge AVANT
 *     d'écrire (`chargeClientAvant`), écrit, puis appelle `emettreFaitClient(tx, id, { avant })` :
 *     l'émission compare les deux charges, horodatage exclu, et n'émet que si elles diffèrent.
 *     Elle ne se fie donc jamais à ce que l'appelant DIT avoir écrit — elle constate. Un SIRET
 *     modifié qui change le SIREN dérivé est un fait ; une note, un statut commercial, un contact
 *     n'en sont pas.
 * Le cliquet `pnpm partners:cliquet-ecrivains` confronte chaque écriture de `client` du dépôt à
 * cette fonction : toute création, et toute mise à jour qui pose l'un des
 * `CHAMPS_CLIENT_TRANSMIS` (la même liste, un test tient les deux égales).
 *
 * ── Clés (la convention de `scripts/partners/fixtures.ts`) ───────────────────────────────────
 * `client.cree:<id>` — un second appel pour la même fiche rend le même `event_id` ;
 * `client.mis_a_jour:<id>:<updatedAt ISO>` — une mise à jour est un fait par instant d'écriture.
 * L'instant est celui relu dans `tx`, APRÈS l'écriture : l'émission se place donc après la
 * dernière écriture de la fiche dans la transaction.
 *
 * ── Le SIREN transmis : fiable ou absent, jamais faux (REQ-INT-015, REQ-DM-021) ──────────────
 * Partners attribue un encaissement par le SIREN bénéficiaire. `sirenTransmis` rend :
 *   · le SIREN de la fiche, normalisé à 9 chiffres, s'il passe le contrôle de clé ;
 *   · sinon, s'il est VIDE, celui DÉRIVÉ d'un SIRET valide (les 9 premiers chiffres, contrôlés) ;
 *   · sinon `null`. Un SIREN (ou un SIRET, quand c'est de lui qu'il faudrait dériver) présent mais
 *     invalide part `null` ET lève une alerte `MONITORING_ALERT` : jamais transmis tel quel.
 * Côté factures, `lireFacture` (`facturation.ts`, lot A) applique la même barrière au client
 * bénéficiaire : un SIREN illisible y part `non_resolue`, alerté. Les deux sorties ne portent
 * donc jamais un SIREN que le contrôle de clé refuse.
 *
 * ── Inertie ───────────────────────────────────────────────────────────────────────────────────
 * Canal fermé : `chargeClientAvant` et `emettreFaitClient` rendent `null` sans rien lire. Les deux
 * écrivains branchés écrivaient déjà dans une `$transaction` : rien d'autre ne change pour eux.
 */
import type { Client, Prisma } from "../../../../prisma/generated/client";
import { checkSirenFormat, checkSiretFormat, normalizeSiret, sirenDuSiret } from "@/lib/siret";
import {
  payloadClientCree,
  payloadClientMisAJour,
  type ClientPourEvenement,
  type PayloadClient,
} from "@/server/partners/payloads";

import { canalPartnersOuvert } from "../config";
import { ecrireEvenementPartners } from "../outbox";

/** Les types d'événement, tels que le contrat les nomme. */
export const CLIENT_CREE = "client.cree";
export const CLIENT_MIS_A_JOUR = "client.mis_a_jour";

/**
 * Les colonnes dont la charge dépend : celles de `ClientPourEvenement` (hors identifiant et
 * horodatages), plus `siret`, dont le SIREN transmis est dérivé quand il manque.
 */
export const CHAMPS_CLIENT_TRANSMIS = [
  "numero",
  "type",
  "raisonSociale",
  "siren",
  "siret",
  "nafCode",
  "secteur",
  "taille",
] as const satisfies readonly (keyof Client)[];

/** `never` tant que la liste couvre la charge : un champ ajouté au `Pick` sans elle le rompt. */
export type ChampsClientNonGardes = Exclude<
  keyof ClientPourEvenement,
  "id" | "createdAt" | "updatedAt" | (typeof CHAMPS_CLIENT_TRANSMIS)[number]
>;

export type SirenTransmis =
  | { readonly siren: string; readonly origine: "fiche" | "siret" }
  | { readonly siren: null; readonly origine: "absent" }
  | { readonly siren: null; readonly origine: "invalide"; readonly champ: "siren" | "siret" };

/** Le SIREN qu'une charge peut porter (voir l'en-tête). Pur. */
export function sirenTransmis(fiche: {
  readonly siren: string | null;
  readonly siret: string | null;
}): SirenTransmis {
  const saisi = fiche.siren === null ? "" : normalizeSiret(fiche.siren);
  if (saisi !== "") {
    const controle = checkSirenFormat(saisi);
    return controle.ok
      ? { siren: controle.value, origine: "fiche" }
      : { siren: null, origine: "invalide", champ: "siren" };
  }
  const siret = fiche.siret === null ? "" : normalizeSiret(fiche.siret);
  if (siret === "") return { siren: null, origine: "absent" };
  const controleSiret = checkSiretFormat(siret);
  if (!controleSiret.ok) return { siren: null, origine: "invalide", champ: "siret" };
  const derive = checkSirenFormat(sirenDuSiret(controleSiret.value));
  return derive.ok
    ? { siren: derive.value, origine: "siret" }
    : { siren: null, origine: "invalide", champ: "siret" };
}

/** Ce qui est alerté : des identifiants et un motif, jamais la valeur saisie. */
export type AlerteClient = {
  readonly type: string;
  readonly motif: "siren_invalide" | "siret_invalide";
  /** `client:<id>`. */
  readonly sujet: string;
  readonly eventId: string;
};

export type OptionsEmissionClient = {
  /** Injecté par les tests ; par défaut, une notification `MONITORING_ALERT` détachée. */
  readonly alerter?: (alerte: AlerteClient) => void;
};

function alerterParDefaut(alerte: AlerteClient): void {
  void (async () => {
    try {
      const { notify } = await import("@/server/notifications");
      await notify({
        category: "MONITORING_ALERT",
        severity: "error",
        payload: {
          kind: "partners_siren_invalide",
          details: {
            legacyBody:
              `Un fait « ${alerte.type} » est parti SANS SIREN (${alerte.motif}) : la valeur de ` +
              `la fiche ne passe pas le contrôle de clé.\n\nSujet : ${alerte.sujet}\n` +
              `Événement : ${alerte.eventId}\n\n` +
              "Corriger le SIREN ou le SIRET de la fiche : Partners attribue par le SIREN.",
          },
        },
        dedupKey: `partners-siren-invalide:${alerte.sujet}`,
        dedupTtlSec: 24 * 3600,
      });
    } catch (e) {
      console.warn(
        `[partners-sync] alerte de SIREN impossible : ${e instanceof Error ? e.name : typeof e}`,
      );
    }
  })();
}

const SELECTION_CLIENT = {
  id: true,
  numero: true,
  type: true,
  raisonSociale: true,
  siren: true,
  siret: true,
  nafCode: true,
  secteur: true,
  taille: true,
  createdAt: true,
  updatedAt: true,
} as const;

type LigneClient = ClientPourEvenement & Pick<Client, "siret">;

/** La charge d'une fiche, relue, sans son horodatage de mise à jour : ce qui fait le fait. */
export type ChargeClientAvant = Omit<PayloadClient, "misAJourLe">;

/** La fiche réduite à ce qui traverse, le SIREN remplacé par le SIREN transmissible. */
function versEvenement(ligne: LigneClient, siren: string | null): ClientPourEvenement {
  return {
    id: ligne.id,
    numero: ligne.numero,
    type: ligne.type,
    raisonSociale: ligne.raisonSociale,
    siren,
    nafCode: ligne.nafCode,
    secteur: ligne.secteur,
    taille: ligne.taille,
    createdAt: ligne.createdAt,
    updatedAt: ligne.updatedAt,
  };
}

/** Champ par champ, dans un ordre fixe : deux charges égales se sérialisent à l'identique. */
function sansHorodatage(charge: PayloadClient): ChargeClientAvant {
  return {
    clientId: charge.clientId,
    numero: charge.numero,
    type: charge.type,
    raisonSociale: charge.raisonSociale,
    siren: charge.siren,
    nafCode: charge.nafCode,
    secteur: charge.secteur,
    taille: charge.taille,
    creeLe: charge.creeLe,
  };
}

async function lireLigne(
  tx: Prisma.TransactionClient,
  clientId: string,
): Promise<LigneClient | null> {
  return tx.client.findUnique({ where: { id: clientId }, select: SELECTION_CLIENT });
}

/**
 * La charge de la fiche AVANT une mise à jour, à relire dans la transaction de l'écrivain, juste
 * avant son écriture. `null` canal fermé (rien n'est lu) ou fiche introuvable.
 */
export async function chargeClientAvant(
  tx: Prisma.TransactionClient,
  clientId: string,
): Promise<ChargeClientAvant | null> {
  if (!canalPartnersOuvert()) return null;
  const ligne = await lireLigne(tx, clientId);
  if (ligne === null) return null;
  return sansHorodatage(
    payloadClientMisAJour({ client: versEvenement(ligne, sirenTransmis(ligne).siren) }),
  );
}

/** L'écriture que l'émission reçoit : une création, ou la charge relue avant une mise à jour. */
export type EcritureClient =
  { readonly creation: true } | { readonly avant: ChargeClientAvant | null };

export const CREATION_CLIENT: EcritureClient = { creation: true };

/**
 * Émet `client.cree` (création) ou `client.mis_a_jour` (charge changée) pour `clientId`, dans la
 * transaction `tx`. L'UNIQUE fonction d'émission de ces deux faits (REQ-INT-007).
 *
 * Rend l'`event_id`, ou `null` si le canal est fermé ou si la charge relue est celle d'avant
 * l'écriture (horodatage exclu). Une charge d'avant absente (`null`) ne prouve rien : le fait
 * part. Lève si la fiche est introuvable : l'écrivain vient de l'écrire.
 */
export async function emettreFaitClient(
  tx: Prisma.TransactionClient,
  clientId: string,
  ecriture: EcritureClient,
  options: OptionsEmissionClient = {},
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  const ligne = await lireLigne(tx, clientId);
  if (ligne === null) {
    throw new Error(`[partners-sync] client ${clientId} introuvable dans la transaction.`);
  }
  const resolu = sirenTransmis(ligne);
  const client = versEvenement(ligne, resolu.siren);

  const creation = "creation" in ecriture;
  const type = creation ? CLIENT_CREE : CLIENT_MIS_A_JOUR;
  const charge = creation ? payloadClientCree({ client }) : payloadClientMisAJour({ client });
  if (
    !creation &&
    ecriture.avant !== null &&
    JSON.stringify(sansHorodatage(charge)) === JSON.stringify(ecriture.avant)
  ) {
    return null;
  }

  const eventId = await ecrireEvenementPartners(tx, {
    type,
    // La convention de clé des fixtures (`scripts/partners/fixtures.ts`).
    cleDeFait: creation
      ? `${CLIENT_CREE}:${ligne.id}`
      : `${CLIENT_MIS_A_JOUR}:${ligne.id}:${ligne.updatedAt.toISOString()}`,
    occurredAt: creation ? ligne.createdAt : ligne.updatedAt,
    sujet: { client_id: ligne.id },
    payload: { ...charge },
  });

  if (eventId !== null && resolu.origine === "invalide") {
    (options.alerter ?? alerterParDefaut)({
      type,
      motif: resolu.champ === "siren" ? "siren_invalide" : "siret_invalide",
      sujet: `client:${ligne.id}`,
      eventId,
    });
  }
  return eventId;
}
