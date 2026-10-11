/**
 * F24 — « La proposition de mission du … est close » (lot L11c), quand la date
 * limite est passée sans réponse. Formateur INDÉPENDANT seulement.
 *
 * Interrupteurs `formateurs.lettre_auto` ET `formateurs.lettre_v2` (ceux du
 * moteur) : l'un ou l'autre coupé, rien (comportement d'avant).
 * Le texte ne part que s'il est validé (l'adaptateur `envois.ts` le vérifie).
 * Ne lève jamais.
 */

import { envoyer } from "./envois";
import { interrupteurAllume } from "./interrupteur-allume";
import { envoiAllume } from "./interrupteurs-envoi";

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export async function notifierPropositionClose(m: {
  id: string;
  solliciteAt: Date;
  trainerId: string;
  trainer: {
    statut: string;
    organismeSousTraitantId: string | null;
    prenom: string;
    email: string;
  };
}): Promise<void> {
  try {
    // Indépendant en nom propre seulement : un organisme a son propre circuit.
    if (m.trainer.statut !== "sous_traitant" || m.trainer.organismeSousTraitantId !== null) return;
    if (!(await envoiAllume("lettre_auto")) || !(await interrupteurAllume("lettre_v2"))) return;
    await envoyer({
      gabarit: "formateur-proposition-close",
      destinataire: m.trainer.email,
      entityType: "Trainer",
      entityId: m.trainerId,
      jobId: `formateur-proposition-close-${m.id}`,
      payload: { prenom: m.trainer.prenom, valeurs: { date: DATE_LONGUE.format(m.solliciteAt) } },
    });
  } catch {
    // Un message manqué ne défait pas le passage « sans réponse ».
  }
}
