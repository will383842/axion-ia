/**
 * Réseau d'apporteurs — e-mail « l'entreprise n'a pas pu être retenue », envoyé à l'apporteur
 * quand le dirigeant écarte une présentation depuis la console.
 *
 * Derrière `APPORTEURS_EMAIL_REFUS` (facultative, ÉTEINTE par défaut ; « true » = allumée).
 * Clé d'idempotence `apporteur-refus-<presentationId>` : un seul envoi par présentation.
 * PAS de `gabaritRepli` (AGENTS.md, lot S3) : aucun gabarit ancien n'est vrai pour un refus
 * (`apporteur-presentation-refusee` dit « nous ne pouvons pas vous la réserver »). N'allumer
 * `APPORTEURS_EMAIL_REFUS` qu'une fois le worker en ligne sur un commit qui contient ce gabarit ;
 * sinon un worker antérieur reporte le job 9 fois puis échoue.
 * Ne LÈVE jamais vers son appelant : le statut posé ne se défait pas si l'e-mail échoue.
 */

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { dejaEnvoye } from "./commissions";
import { envoyer } from "./envois";
import { signalerErreurReseau } from "./signaler";

export type StatutRefus = "dementie" | "deja_connue" | "hors_champ";

const MOTIF: Readonly<Record<StatutRefus, "non-confirmee" | "deja-connue" | "hors-champ">> = {
  dementie: "non-confirmee",
  deja_connue: "deja-connue",
  hors_champ: "hors-champ",
};

export const emailRefusAllume = (): boolean => process.env.APPORTEURS_EMAIL_REFUS === "true";

export const jobIdRefus = (presentationId: string): string => `apporteur-refus-${presentationId}`;

/** Vrai si l'e-mail part (ou attend validation) maintenant ; faux sinon (éteint, déjà parti, échec). */
export async function annoncerRefus(presentationId: string, statut: StatutRefus): Promise<boolean> {
  if (!emailRefusAllume()) return false;
  try {
    const jobId = jobIdRefus(presentationId);
    if (await dejaEnvoye(jobId)) return false;
    const p = await prisma.presentationEntreprise.findUnique({
      where: { id: presentationId },
      select: {
        id: true,
        statut: true,
        denomination: true,
        apporteur: { select: { prenom: true, nom: true, email: true } },
      },
    });
    if (!p || p.statut !== statut) return false;
    const email = decryptPii(p.apporteur.email) ?? "";
    if (!email) return false;
    const r = await envoyer({
      gabarit: "apporteur-presentation-non-retenue",
      destinataire: email,
      payload: {
        contactName: [decryptPii(p.apporteur.prenom), decryptPii(p.apporteur.nom)]
          .filter(Boolean)
          .join(" "),
        entreprise: p.denomination,
        motif: MOTIF[statut],
      },
      entityType: "PresentationEntreprise",
      entityId: p.id,
      jobId,
    });
    return r === "envoye" || r === "en-validation";
  } catch (err) {
    signalerErreurReseau("annonce de refus", err);
    return false;
  }
}
