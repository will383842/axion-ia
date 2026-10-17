/**
 * Les lignes de l'indicateur 10 d'UNE session — extraites de
 * `conformite/dossier-session.ts` (chantier QNC, L11) pour que le ZIP et le
 * bloc « Adaptation » du dossier complet les écrivent par la MÊME fonction.
 *
 * Le détail déclaré (santé) n'est jamais chargé : un booléen « besoin déclaré »,
 * la mesure consignée et les dates du circuit.
 */

import { HORODATAGE_CIRCUIT_VIDE, besoinAdaptationDeclare } from "../adaptation/reponse-organisme";
import { lireCircuitAdaptation } from "../adaptation/journal-consignation";
import { sectionIndicateur10, type SectionIndicateur10 } from "../adaptation/dossier-adaptation";

export interface InscriptionPourIndicateur10 {
  readonly id: string;
  readonly traineeId: string;
  readonly adaptationsRealisees: string | null;
  readonly besoinAdaptationDeclareAt?: Date | null;
  readonly questionnaires?: readonly { reponses: unknown; reponduAt: Date | null }[];
  readonly trainee: {
    readonly nom: string;
    readonly prenom: string;
    readonly deletedAt: Date | null;
    readonly situationHandicap: boolean | null;
  };
}

export async function sectionIndicateur10Session(
  inscriptions: readonly InscriptionPourIndicateur10[],
  session: { readonly dateDebut: Date; readonly dateFin: Date | null },
): Promise<SectionIndicateur10> {
  const circuit = await lireCircuitAdaptation(
    inscriptions.map((e) => ({
      id: e.id,
      traineeId: e.traineeId,
      finSession: session.dateFin ?? null,
      positionnements: (e.questionnaires ?? []).map((q) => ({
        reponses: q.reponses,
        reponduAt: q.reponduAt ?? null,
      })),
    })),
  );
  return sectionIndicateur10(
    inscriptions.map((e) => ({
      stagiaire:
        e.trainee.deletedAt !== null
          ? "[inscription sous droit à l'effacement]"
          : `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
      // Lecture défensive : une ligne incomplète ne doit pas faire perdre la
      // section entière au fail-soft de l'appelant.
      besoinDeclare: besoinAdaptationDeclare({
        situationHandicap: e.trainee.situationHandicap === true,
        reponsesPositionnements: (e.questionnaires ?? []).map((q) => q.reponses),
        besoinAdaptationDeclareAt: e.besoinAdaptationDeclareAt ?? null,
      }),
      adaptationsRealisees: e.adaptationsRealisees ?? null,
      horodatage: circuit.get(e.id) ?? HORODATAGE_CIRCUIT_VIDE,
    })),
    session.dateDebut,
  );
}
