/**
 * RETOUR du CRM vers le dossier client de la console (sens CRM → console de la
 * synchro automatique, décision de Will du 25/10/2026).
 *
 * ── Contrat du message (`POST /api/internal/crm-dossier-webhook`) ───────────
 * Signé comme le webhook des consentements (`verifyInboundRequest`, même secret).
 *   event_id     identifiant unique du message (8 à 80 car.)
 *   event_type   "company_dossier_changed"
 *   origin       "crm" (obligatoire : sans provenance, pas de protection d'écho)
 *   occurred_at  ISO 8601 — l'instant du changement DANS le CRM
 *   subject_ref  "site:client:<uuid>"
 *   fields       { naf_code? }
 *                — liste FERMÉE à UNE clé : le NAF, sur lequel le CRM fait foi
 *                (PLAN-SYNCHRO : console = identité, SIREN, adresse ; CRM = NAF).
 *                L'adresse ne revient JAMAIS du CRM sans décision de Will : une
 *                clé d'adresse est un contrat violé (422). Ni score, étiquette,
 *                étape, ni donnée sur une personne.
 *
 * ── Règles ──────────────────────────────────────────────────────────────────
 *   · LE PLUS RÉCENT GAGNE : une valeur du CRM n'est appliquée que si
 *     `occurred_at` (borné à « maintenant » : une horloge du CRM en avance ne
 *     gagne pas à tous les coups) est postérieur à la dernière écriture de la
 *     fiche (`client.updatedAt`) ; sinon la console, plus récente, garde la sienne.
 *   · UN NAF NOUVEAU RECALCULE L'OPCO déduit, comme dans la console, sauf si
 *     l'OPCO a été saisi à la main (`opcoIdentifie` non vide : jamais écrasé).
 *   · AUCUNE SUPPRESSION : une valeur absente, nulle ou vide ne change rien.
 *   · Fiche inconnue ou non « entreprise » : ignorée. Le CRM n'en crée jamais.
 *   · PAS D'ÉCHO : ce qui vient du CRM ne repart pas. Si le dossier n'avait
 *     aucun changement en attente d'envoi, son empreinte est mise à jour ; sinon
 *     seul `crm_vu_le` bouge et le prochain balayage enverra l'ensemble.
 *   · Une trace d'audit `client.mis_a_jour_depuis_crm` (champs, valeur avant et
 *     après : données d'entreprise, jamais d'une personne ; l'ancienne valeur
 *     ne se perd pas) ; l'écriture passe par `emettreFaitClient` comme tout
 *     écrivain de la fiche (cliquet des écrivains).
 */

import { prisma } from "@/lib/prisma";
import { inferOpcoDepuisTable } from "@/server/qualiopi/crm/naf-opco";
import { isOpcoId, nomOpcoDuClient } from "@/server/qualiopi/financements/opco-referentiel";
import { chargeClientAvant, emettreFaitClient } from "@/server/partners-sync/producteurs/client";

import { lireEntreeDossier } from "./lire-dossier";
import { dossierPourCrm, empreinteDossier, entreprisePourCrm } from "./instantane-dossier";

export const ACTION_MIS_A_JOUR_DEPUIS_CRM = "client.mis_a_jour_depuis_crm";
export const TYPE_RETOUR_DOSSIER = "company_dossier_changed";

/** Le seul champ que le CRM peut faire revenir. */
export const CLES_RETOUR_DOSSIER = ["naf_code"] as const;
export type CleRetourDossier = (typeof CLES_RETOUR_DOSSIER)[number];

export interface RetourDossier {
  readonly event_id: string;
  readonly event_type: typeof TYPE_RETOUR_DOSSIER;
  readonly origin: "crm";
  readonly occurred_at: string;
  readonly clientId: string;
  readonly fields: Partial<Record<CleRetourDossier, string>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NAF = /^\d{4}[A-Z]$/;

/** Colonne de la fiche pour chaque clé du message. */
const COLONNES: Record<CleRetourDossier, "nafCode"> = {
  naf_code: "nafCode",
};

function nettoyer(cle: CleRetourDossier, valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const v = valeur.replace(/\s+/g, " ").trim();
  if (v === "") return null;
  const naf = v.replace(".", "").toUpperCase();
  return cle === "naf_code" && NAF.test(naf) ? naf : null;
}

/** Valide le corps. `null` : contrat violé (422). Clé inconnue ⇒ refus. */
export function parseRetourDossier(input: unknown): RetourDossier | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const permises = new Set([
    "event_id",
    "event_type",
    "origin",
    "occurred_at",
    "subject_ref",
    "fields",
  ]);
  if (Object.keys(raw).some((k) => !permises.has(k))) return null;

  const eventId = raw["event_id"];
  if (typeof eventId !== "string" || eventId.length < 8 || eventId.length > 80) return null;
  if (raw["event_type"] !== TYPE_RETOUR_DOSSIER || raw["origin"] !== "crm") return null;
  const occurredAt = raw["occurred_at"];
  if (typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt))) return null;
  const ref = raw["subject_ref"];
  const m = typeof ref === "string" ? /^site:client:(.+)$/.exec(ref) : null;
  if (m === null || !UUID.test(m[1]!)) return null;

  const champs = raw["fields"];
  if (!champs || typeof champs !== "object" || Array.isArray(champs)) return null;
  const fields: Partial<Record<CleRetourDossier, string>> = {};
  for (const [cle, valeur] of Object.entries(champs)) {
    if (!(CLES_RETOUR_DOSSIER as readonly string[]).includes(cle)) return null;
    const propre = nettoyer(cle as CleRetourDossier, valeur);
    // Vide ou invalide : ni refus ni écriture — jamais de suppression.
    if (propre !== null) fields[cle as CleRetourDossier] = propre;
  }
  return {
    event_id: eventId,
    event_type: TYPE_RETOUR_DOSSIER,
    origin: "crm",
    occurred_at: occurredAt,
    clientId: m[1]!,
    fields,
  };
}

/**
 * Ce qu'il faut écrire dans la fiche : seulement les valeurs DIFFÉRENTES, et
 * seulement si le changement du CRM est plus récent que la fiche. Pur.
 */
export function colonnesAAppliquer(
  fiche: {
    readonly nafCode: string | null;
    readonly updatedAt: Date;
  },
  fields: RetourDossier["fields"],
  occurredAt: Date,
): Partial<Record<(typeof COLONNES)[CleRetourDossier], string>> {
  if (occurredAt.getTime() <= fiche.updatedAt.getTime()) return {};
  const data: Partial<Record<(typeof COLONNES)[CleRetourDossier], string>> = {};
  for (const cle of CLES_RETOUR_DOSSIER) {
    const valeur = fields[cle];
    if (valeur === undefined) continue;
    const colonne = COLONNES[cle];
    if (fiche[colonne] !== valeur) data[colonne] = valeur;
  }
  return data;
}

export type IssueRetourDossier = "applique" | "inchange" | "ignore";

export async function appliquerRetourDossier(msg: RetourDossier): Promise<IssueRetourDossier> {
  // Borné à maintenant : une horloge du CRM en avance ne gagne pas à tous les coups.
  const occurredAt = new Date(Math.min(Date.parse(msg.occurred_at), Date.now()));
  const clientId = msg.clientId;

  // Empreinte AVANT : y avait-il un changement de la console en attente d'envoi ?
  const avantLu = await lireEntreeDossier(clientId, new Date());
  if (avantLu === null) return "ignore";
  const empreinteAvant = empreinteDossier(
    entreprisePourCrm(avantLu.entree),
    dossierPourCrm(avantLu.entree),
  );

  const applique = await prisma.$transaction(async (tx) => {
    const fiche = await tx.client.findUnique({
      where: { id: clientId },
      select: {
        type: true,
        nafCode: true,
        idcc: true,
        opcoIdentifie: true,
        opco: true,
        updatedAt: true,
      },
    });
    if (fiche === null || fiche.type !== "entreprise") return null;
    const data = colonnesAAppliquer(fiche, msg.fields, occurredAt);
    const champs = Object.keys(data);
    if (champs.length === 0) return [];
    const avant = await chargeClientAvant(tx, clientId);
    // Même règle que la console : un NAF nouveau recalcule l'OPCO déduit, sauf
    // s'il a été saisi (valeur posée = saisie, jamais écrasée).
    let opcoDeduit: Record<string, string> = {};
    if (data.nafCode !== undefined && nomOpcoDuClient(fiche) === "OPCO (à préciser)") {
      const infere = await inferOpcoDepuisTable(tx, { idcc: fiche.idcc, naf: data.nafCode });
      if (infere !== null) {
        opcoDeduit = { opcoIdentifie: infere };
        if (fiche.opco == null && isOpcoId(infere)) opcoDeduit["opco"] = infere;
      }
    }
    await tx.client.update({ where: { id: clientId }, data: { ...data, ...opcoDeduit } });
    await emettreFaitClient(tx, clientId, { avant });
    await tx.activityLog.create({
      data: {
        adminUserId: null,
        action: ACTION_MIS_A_JOUR_DEPUIS_CRM,
        targetType: "Client",
        targetId: clientId,
        changes: {
          origine: "crm",
          eventId: msg.event_id,
          champs: [...champs, ...Object.keys(opcoDeduit)],
          avant: Object.fromEntries(champs.map((c) => [c, fiche[c as "nafCode"]])),
          apres: data,
        },
      },
    });
    return champs;
  });
  if (applique === null) return "ignore";
  if (applique.length === 0) return "inchange";

  // Anti-écho : ce qui vient du CRM ne repart pas.
  try {
    const etat = await prisma.crmDossierSynchro.findUnique({
      where: { clientId },
      select: { empreinte: true },
    });
    if (etat !== null) {
      const apres = await lireEntreeDossier(clientId, new Date());
      const rien_en_attente = etat.empreinte === empreinteAvant;
      const empreinteApres =
        apres === null
          ? null
          : empreinteDossier(entreprisePourCrm(apres.entree), dossierPourCrm(apres.entree));
      await prisma.crmDossierSynchro.update({
        where: { clientId },
        data: {
          crmVuLe: occurredAt,
          ...(empreinteApres !== null
            ? {
                crmEmpreinte: empreinteApres,
                ...(rien_en_attente ? { empreinte: empreinteApres } : {}),
              }
            : {}),
        },
      });
    }
  } catch (e) {
    // Au pire le prochain balayage renvoie au CRM ce qu'il vient de dire : le
    // CRM l'ignore (valeur identique). Jamais une raison d'échouer.
    console.error("[crm-sync] anti-écho du retour dossier non posé :", (e as Error).name);
  }
  return "applique";
}
