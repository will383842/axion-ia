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
 *   fields       { naf_code?, adresse_rue?, adresse_code_postal?, adresse_ville? }
 *                — liste FERMÉE. Rien d'autre ne peut venir du CRM : ni score,
 *                étiquette, étape, ni donnée sur une personne.
 *
 * ── Règles ──────────────────────────────────────────────────────────────────
 *   · LE PLUS RÉCENT GAGNE : une valeur du CRM n'est appliquée que si
 *     `occurred_at` est postérieur à la dernière écriture de la fiche
 *     (`client.updatedAt`) ; sinon la console, plus récente, garde la sienne.
 *   · AUCUNE SUPPRESSION : une valeur absente, nulle ou vide ne change rien.
 *   · Fiche inconnue ou non « entreprise » : ignorée. Le CRM n'en crée jamais.
 *   · PAS D'ÉCHO : ce qui vient du CRM ne repart pas. Si le dossier n'avait
 *     aucun changement en attente d'envoi, son empreinte est mise à jour ; sinon
 *     seul `crm_vu_le` bouge et le prochain balayage enverra l'ensemble.
 *   · Une trace d'audit `client.mis_a_jour_depuis_crm` (noms des champs, jamais
 *     un texte libre) ; l'écriture passe par `emettreFaitClient` comme tout
 *     écrivain de la fiche (cliquet des écrivains).
 */

import { prisma } from "@/lib/prisma";
import { chargeClientAvant, emettreFaitClient } from "@/server/partners-sync/producteurs/client";

import { lireEntreeDossier } from "./lire-dossier";
import { dossierPourCrm, empreinteDossier, entreprisePourCrm } from "./instantane-dossier";

export const ACTION_MIS_A_JOUR_DEPUIS_CRM = "client.mis_a_jour_depuis_crm";
export const TYPE_RETOUR_DOSSIER = "company_dossier_changed";

/** Les quatre champs que le CRM peut faire revenir — miroir de l'émetteur CRM. */
export const CLES_RETOUR_DOSSIER = [
  "naf_code",
  "adresse_rue",
  "adresse_code_postal",
  "adresse_ville",
] as const;
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
const CODE_POSTAL = /^[0-9A-Za-z -]{3,12}$/;

/** Colonne de la fiche pour chaque clé du message. */
const COLONNES: Record<
  CleRetourDossier,
  "nafCode" | "adresseRue" | "adresseCodePostal" | "adresseVille"
> = {
  naf_code: "nafCode",
  adresse_rue: "adresseRue",
  adresse_code_postal: "adresseCodePostal",
  adresse_ville: "adresseVille",
};

function nettoyer(cle: CleRetourDossier, valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const v = valeur.replace(/\s+/g, " ").trim();
  if (v === "") return null;
  if (cle === "naf_code") {
    const naf = v.replace(".", "").toUpperCase();
    return NAF.test(naf) ? naf : null;
  }
  if (cle === "adresse_code_postal") return CODE_POSTAL.test(v) ? v : null;
  return v.slice(0, cle === "adresse_rue" ? 300 : 120);
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
    readonly adresseRue: string | null;
    readonly adresseCodePostal: string | null;
    readonly adresseVille: string | null;
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
  const occurredAt = new Date(msg.occurred_at);
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
        adresseRue: true,
        adresseCodePostal: true,
        adresseVille: true,
        updatedAt: true,
      },
    });
    if (fiche === null || fiche.type !== "entreprise") return null;
    const data = colonnesAAppliquer(fiche, msg.fields, occurredAt);
    const champs = Object.keys(data);
    if (champs.length === 0) return [];
    const avant = await chargeClientAvant(tx, clientId);
    await tx.client.update({ where: { id: clientId }, data });
    await emettreFaitClient(tx, clientId, { avant });
    await tx.activityLog.create({
      data: {
        adminUserId: null,
        action: ACTION_MIS_A_JOUR_DEPUIS_CRM,
        targetType: "Client",
        targetId: clientId,
        changes: { origine: "crm", eventId: msg.event_id, champs },
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
