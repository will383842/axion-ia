/**
 * Formateurs indépendants — ce qui suit la DÉCISION de la console sur une pièce
 * (lot E, M13 ; plan 08 §12.3 S6 bis, §12.4 F-13/F-14).
 *
 *  - REFUS par motif fermé (`pieces-motifs-refus.ts`) : F41, variante « Pièce
 *    refusée », avec le motif de la liste. Un motif libre n'envoie rien (le texte
 *    soumis à Will ne connaît que la liste).
 *  - VALIDATION : si le dossier était bloqué et ne l'est plus (`blocageLeve`), F57
 *    « Votre dossier est à jour », une seule fois par épisode (clé
 *    `fi-a-jour-<fiche>-<pièce>`). Puis les missions acceptées du formateur sont
 *    réévaluées : la garde relit la pièce, et le moteur lève le blocage sans attendre
 *    son passage horaire.
 *
 * 🔴 ÉTEINT : `formateurs.dossier_en_ligne` coupé = rien n'est lu. Un salarié ou un
 * dirigeant : rien ne se passe (comportement d'avant). Ne lève jamais : la décision
 * est déjà écrite, une panne ici ne la défait pas.
 *
 * Journaux : aucune donnée personnelle (l'adaptateur d'envoi trace par la fiche).
 */

import { prisma } from "@/lib/prisma";

import { envoyer } from "./envois";
import { envoiAllume } from "./interrupteurs-envoi";
import { reevaluerMissionsDuFormateur } from "./moteur-mission";
import { lirePiecesSuivies } from "./mon-dossier";
import { blocageLeve, dossierBloque, type PieceLue } from "./pieces-a-renouveler";
import { libelleMotifRefus, type MotifRefusPiece } from "./pieces-motifs-refus";

/** Le crochet à choix du texte F41 (variante 3), tel qu'il est écrit. */
const CROCHET_MOTIF_F41 =
  "motif : illisible / périmée / ne correspond pas à votre nom / incomplète";

/** Numéro (1 = première) de la variante « Pièce refusée » de F41. */
const ETAPE_F41_PIECE_REFUSEE = 3;

/** Enfilé, ou garé pour relecture : le message existe. */
const parti = (issue: string): boolean => issue === "envoye" || issue === "en-validation";

export type BilanDecisionPiece =
  | { readonly etat: "coupe" | "hors_perimetre" | "erreur" }
  | {
      readonly etat: "fait";
      readonly f41: boolean;
      readonly f57: boolean;
      readonly missions: number;
    };

export async function apresDecisionPiece(p: {
  readonly documentId: string;
  readonly decision: "valide" | "rejete";
  readonly motifFerme: MotifRefusPiece | null;
  readonly maintenant: Date;
}): Promise<BilanDecisionPiece> {
  if (!(await envoiAllume("dossier_en_ligne"))) return { etat: "coupe" };
  try {
    const doc = await prisma.trainerDocument.findUnique({
      where: { id: p.documentId },
      select: {
        id: true,
        trainerId: true,
        trainer: {
          select: {
            statut: true,
            actif: true,
            finCollaborationAt: true,
            prenom: true,
            email: true,
          },
        },
      },
    });
    if (doc === null || doc.trainer.statut !== "sous_traitant") return { etat: "hors_perimetre" };
    const t = doc.trainer;

    if (p.decision === "rejete") {
      if (p.motifFerme === null) return { etat: "fait", f41: false, f57: false, missions: 0 };
      const motif = libelleMotifRefus(p.motifFerme);
      const issue = await envoyer({
        gabarit: "formateur-piece-a-renouveler",
        destinataire: t.email,
        entityType: "Trainer",
        entityId: doc.trainerId,
        jobId: `fi-piece-refusee-${doc.id}`,
        payload: {
          prenom: t.prenom,
          etape: ETAPE_F41_PIECE_REFUSEE,
          valeurs: { [CROCHET_MOTIF_F41]: motif, motif },
        },
      });
      return { etat: "fait", f41: parti(issue), f57: false, missions: 0 };
    }

    const apres = await lirePiecesSuivies(doc.trainerId);
    // Avant la décision, la pièce n'était pas validée (en attente ou refusée : même effet).
    const avant: PieceLue[] = apres.map((d) =>
      d.id === doc.id ? { ...d, statutValidation: "en_attente", valideAt: null } : d,
    );
    let f57 = false;
    if (
      t.actif &&
      t.finCollaborationAt === null &&
      blocageLeve(dossierBloque(avant, p.maintenant), dossierBloque(apres, p.maintenant))
    ) {
      const issue = await envoyer({
        gabarit: "formateur-dossier-a-jour",
        destinataire: t.email,
        entityType: "Trainer",
        entityId: doc.trainerId,
        jobId: `fi-a-jour-${doc.trainerId}-${doc.id}`,
        payload: { prenom: t.prenom },
      });
      f57 = parti(issue);
    }
    const missions = await reevaluerMissionsDuFormateur(doc.trainerId, p.maintenant);
    return { etat: "fait", f41: false, f57, missions };
  } catch {
    return { etat: "erreur" };
  }
}
