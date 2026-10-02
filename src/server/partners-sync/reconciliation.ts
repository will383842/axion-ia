/**
 * reconciliation.ts — `rejouerEvenement` et `POST /api/partners/reconciliation` (INT-T08-A,
 * REQ-INT-013).
 *
 * Quand la réconciliation de Partners trouve des `event_id` manquants, elle demande leur REJEU.
 * axionia RÉARME les lignes de sa file de sortie : `pending`, tentatives à zéro, dues maintenant,
 * erreur effacée. Le CORPS et la SÉQUENCE ne changent pas : l'octet exact repart par le relais,
 * signé comme au premier envoi, et Partners déduplique par `event_id`. Rien n'est reconstruit.
 *
 * ── Authentification de la requête (Partners → axionia) ──────────────────────────────────────
 * Le secret de relecture (`PARTNERS_RELECTURE_SECRET`) et les en-têtes de la relecture
 * (`X-Partners-Timestamp` / `X-Partners-Signature`, fenêtre de 300 s). Ce qui est signé est
 * « <horodatage>.<chemin>\n<corps> » : la CIBLE et le CORPS, sans quoi une signature valable pour un
 * rejeu le serait pour n'importe quel autre pendant 5 minutes.
 *
 * ── Les bornes ───────────────────────────────────────────────────────────────────────────────
 * Un corps `{"eventIds": [...]}`, strict : de 1 à `REJEU_MAX_PAR_APPEL` uuid. Les doublons sont
 * fondus. Un rejeu est une écriture par identifiant : un identifiant inconnu n'écrit rien et est
 * rendu dans `introuvables`.
 *
 * ── Authentification de la réponse (axionia → Partners) ──────────────────────────────────────
 * Comme la relecture : `X-Axionia-Timestamp` / `X-Axionia-Signature` sur « t.corps », secret
 * d'émission.
 *
 * ── Inertie ──────────────────────────────────────────────────────────────────────────────────
 * Canal fermé, build, ou secret absent : 404, avant toute lecture — la route n'existe pas.
 */
import { z } from "zod";

import { horodatageSignature, signerCorps } from "@/server/partners/enveloppe";

import { canalPartnersOuvert, secretPartners, secretRelecture } from "./config";
import { verifierRequetePartners } from "./relecture";

/** La borne d'un appel : cent identifiants au plus. */
export const REJEU_MAX_PAR_APPEL = 100;

export interface EcrivainRejeu {
  partnersSyncOutbox: {
    updateMany(args: {
      where: { eventId: string };
      data: { status: "pending"; attempts: number; nextAttemptAt: Date; lastError: null };
    }): PromiseLike<{ count: number }>;
  };
}

export type DependancesReconciliation = {
  prisma?: EcrivainRejeu;
  maintenantMs?: number;
};

const schemaDemande = z
  .object({ eventIds: z.array(z.string().uuid()).min(1).max(REJEU_MAX_PAR_APPEL) })
  .strict();

/**
 * Réarme la ligne de `eventId` : `true` si elle existe. Le corps et la séquence ne sont pas dans
 * l'écriture : ils ne changent pas.
 */
export async function rejouerEvenement(
  eventId: string,
  prisma: EcrivainRejeu,
  maintenant: Date,
): Promise<boolean> {
  const { count } = await prisma.partnersSyncOutbox.updateMany({
    where: { eventId },
    data: { status: "pending", attempts: 0, nextAttemptAt: maintenant, lastError: null },
  });
  return count === 1;
}

function texte(statut: number, corps: string): Response {
  return new Response(corps, {
    status: statut,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function repondreReconciliation(
  requete: Request,
  dependances: DependancesReconciliation = {},
): Promise<Response> {
  if (!canalPartnersOuvert()) return texte(404, "not_found");
  const secretLecture = secretRelecture();
  const secretEmission = secretPartners();
  if (secretLecture === null || secretEmission === null) return texte(404, "not_found");

  const corpsRecu = await requete.text();
  const cible = `${new URL(requete.url).pathname}\n${corpsRecu}`;
  const maintenantMs = dependances.maintenantMs ?? Date.now();
  if (!verifierRequetePartners(requete, cible, secretLecture, maintenantMs))
    return texte(401, "signature_refusee");

  let brut: unknown;
  try {
    brut = JSON.parse(corpsRecu);
  } catch {
    return texte(400, "corps_illisible");
  }
  const demande = schemaDemande.safeParse(brut);
  if (!demande.success) return texte(400, "corps_illisible");

  const prisma =
    dependances.prisma ?? ((await import("@/lib/prisma")).prisma as unknown as EcrivainRejeu);
  const maintenant = new Date(maintenantMs);
  const rearmes: string[] = [];
  const introuvables: string[] = [];
  for (const eventId of [...new Set(demande.data.eventIds)]) {
    ((await rejouerEvenement(eventId, prisma, maintenant)) ? rearmes : introuvables).push(eventId);
  }

  const corps = JSON.stringify({ rearmes, introuvables });
  const horodatage = horodatageSignature(new Date(maintenantMs));
  return new Response(corps, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Axionia-Timestamp": horodatage,
      "X-Axionia-Signature": signerCorps(secretEmission, horodatage, corps),
    },
  });
}
