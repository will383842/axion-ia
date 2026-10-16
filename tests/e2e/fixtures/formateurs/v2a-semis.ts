// Banc @formateurs, VÉRIFICATION 2 — équipe A (argent) : ce que les specs `v2a*`
// partagent. Données FICTIVES (adresses `example.test`, numéros `BANC-`), toutes les
// dates en 2040-2042 : aucun autre scénario du banc ne date ses sessions là, et aucun
// passage planifié du worker (heure réelle) ne les atteint.
//
// Les étapes elles-mêmes sont celles de l'exécuteur d'argent de la vérification 1
// (`argent-protocole.ts`), le code serveur RÉEL ; ce module ne fait que les composer.

import { prisma } from "./base";
import { cle } from "./argent-semis";
import type { EtapeArgent } from "./argent-protocole";

/** Bascule du paiement par mission des scénarios v2a : un 1er du mois, avant toutes leurs dates. */
export const BASCULE_V2A = "2040-01-01";

/** Le passage du paiement par mission, restreint aux sessions du test (M-D déclaré). */
export function passageV2a(
  maintenant: string,
  sessionIds: readonly string[],
  o: { readonly bilanAllumeLe?: string; readonly dateBascule?: string } = {},
): EtapeArgent {
  return {
    etape: "passage",
    maintenant,
    dateBascule: o.dateBascule ?? BASCULE_V2A,
    sessionIds,
    retraitMd: "declare",
    ...(o.bilanAllumeLe ? { bilanAllumeLe: o.bilanAllumeLe } : {}),
  };
}

/** Les deux demi-journées d'une journée, contresignées par ce formateur le soir même. */
export function contresignerJournee(
  sessionId: string,
  formateur: { readonly id: string; readonly nomComplet: string },
  date: string,
  demi: ReadonlyArray<"matin" | "apres_midi"> = ["matin", "apres_midi"],
): EtapeArgent[] {
  return demi.map((demiJournee) => ({
    etape: "contresigner",
    sessionId,
    trainerId: formateur.id,
    date,
    demiJournee,
    nomConfirme: formateur.nomComplet,
    maintenant: `${date}T16:30:00Z`,
  }));
}

/** Un organisme sous-traitant (personne morale qui facture pour ses intervenants). */
export async function semerOrganisme(): Promise<{ id: string; contactEmail: string }> {
  const k = cle();
  const contactEmail = `organisme.v2a.${k}@example.test`;
  const o = await prisma.sousTraitant.create({
    data: {
      nom: `Organisme Banc V2A ${k}`,
      objetPrestation: "Animation de formations (banc)",
      contactNom: "Contact Organisme",
      contactEmail,
      siret: "98765432400019",
    },
    select: { id: true },
  });
  return { id: o.id, contactEmail };
}

/** Des honoraires DÉJÀ facturés (un relevé mensuel payé), pour placer le cumul URSSAF. */
export async function honorairesDejaPayes(
  trainerId: string,
  htCents: number,
  periode: { readonly year: number; readonly month: number },
): Promise<void> {
  await prisma.trainerStatement.create({
    data: {
      trainerId,
      periodeYear: periode.year,
      periodeMonth: periode.month,
      statut: "paye",
      origine: "releve_mensuel",
      tvaRegime: "franchise_293b",
      totalHtCents: htCents,
      tvaCents: 0,
      totalTtcCents: htCents,
      payeAt: new Date(`${periode.year}-${String(periode.month).padStart(2, "0")}-20T10:00:00Z`),
    } as never,
  });
}

/** Une attestation URSSAF VALIDÉE, telle que la validation la laisse (fin = date saisie). */
export async function attestationValidee(
  trainerId: string,
  o: { readonly emission: string; readonly fin: string; readonly valideLe: string },
): Promise<void> {
  await prisma.trainerDocument.create({
    data: {
      trainerId,
      type: "attestation_vigilance_urssaf",
      statutValidation: "valide",
      dateEmission: new Date(`${o.emission}T00:00:00Z`),
      dateExpiration: new Date(`${o.fin}T00:00:00Z`),
      valideAt: new Date(`${o.valideLe}T10:00:00Z`),
      numeroPiece: `BANC-V2A-URSSAF-${cle()}`,
    },
  });
}
