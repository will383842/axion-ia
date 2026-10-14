/**
 * C4 — une lettre de mission PÉRIMÉE ne se signe plus.
 *
 * Le moteur reconnaît une lettre périmée (`etape-mission.ts`, étape
 * `lettre_perimee`) : l'empreinte rangée à l'émission
 * (`metadata.empreinteMission`) n'est plus celle des conditions actuelles de
 * la mission (`empreinteDeLaMission`). Sans cette garde, le formateur pouvait
 * encore la signer depuis son lien, et la console la contresigner : un
 * engagement sur des dates, un lieu ou un tarif qui ne sont plus ceux de la
 * mission.
 *
 * Règles :
 *  - pièce autre qu'une `lettre_mission` : rien à objecter ;
 *  - lettre SANS empreinte (émise hors du moteur) : jamais périmée, comme pour
 *    le moteur ;
 *  - lettre du moteur que plus aucune mission ne porte : remplacée, refusée ;
 *  - lecture en échec : refus (garde fermée).
 *
 * Module neutre (Prisma seulement).
 */

import { prisma } from "@/lib/prisma";

import { empreinteDeMetadata } from "./empreinte-mission";
import { EMPREINTE_SELECT, empreinteDeLaMission } from "./empreinte-mission-lecture";

export const MESSAGES_LETTRE_PERIMEE = {
  formateur:
    "Cette lettre de mission ne peut plus être signée : les conditions de la mission (dates, lieu, tarif…) ont changé depuis son envoi. Une lettre à jour va vous être adressée ; pour toute question, répondez à notre e-mail.",
  console:
    "Signature impossible : cette lettre de mission est périmée, les conditions de la mission ont changé depuis son émission. Émettez la lettre rectifiée et faites-la signer.",
  erreur:
    "La lettre de mission n'a pas pu être vérifiée pour l'instant : signature refusée par prudence. Réessayez dans un instant.",
} as const;

export async function objectionLettreMissionPerimee(input: {
  readonly documentGenereId: string;
  readonly type: string;
  readonly metadata: unknown;
  readonly partie: string;
}): Promise<{ message: string } | null> {
  if (input.type !== "lettre_mission") return null;
  const rangee = empreinteDeMetadata(input.metadata);
  if (rangee === null) return null;
  const message =
    input.partie === "formateur"
      ? MESSAGES_LETTRE_PERIMEE.formateur
      : MESSAGES_LETTRE_PERIMEE.console;
  try {
    const mission = await prisma.missionFormateur.findFirst({
      where: { lettreMissionId: input.documentGenereId },
      select: EMPREINTE_SELECT,
    });
    if (mission === null) return { message };
    return empreinteDeLaMission(mission).empreinte === rangee ? null : { message };
  } catch {
    return { message: MESSAGES_LETTRE_PERIMEE.erreur };
  }
}
