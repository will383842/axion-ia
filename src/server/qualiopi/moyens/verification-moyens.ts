/**
 * 🔴 CHANTIER QNC, LOT L07 — BLOC « VÉRIFICATION DES MOYENS » D'UNE SESSION (O11).
 *
 * Six points (salle, wifi, projection, postes, comptes, matériel du stagiaire)
 * constatés AVANT le début de la session ; chez l'entreprise (`sur_site`), ce
 * qu'elle fournit et sa confirmation. L'horodatage est celui du SERVEUR.
 *
 * Stockage : une ligne du journal d'activité (`activity_logs`) par vérification,
 * action `qualiopi.moyens.verification_session`, cible la session. Aucune table
 * nouvelle (le socle L00 n'en prévoit pas) ; `exiger: true` : sans trace, pas de
 * vérification enregistrée. Une nouvelle vérification s'AJOUTE, l'ancienne reste.
 */

import { journaliser, type ClientJournal } from "@/server/journal/journaliser";
import {
  validerBlocVerification,
  type BlocVerification,
  type ResultatBloc,
} from "@/server/qualiopi/moyens/moyens-regles";

export const ACTION_VERIFICATION = "qualiopi.moyens.verification_session" as const;
export const ACTION_TEST_LIEN = "qualiopi.moyens.test_lien_j1" as const;

export interface SessionVerifiable {
  readonly dateDebut: Date;
  readonly lieuType: string | null;
  readonly estTestInterne: boolean;
}

export type ResultatEnregistrement = ResultatBloc | { ok: false; raison: "session_introuvable" };

export async function enregistrerVerificationMoyens(
  client: ClientJournal & {
    trainingSession: {
      findUnique(args: {
        where: { id: string };
        select: Record<string, true>;
      }): Promise<SessionVerifiable | null>;
    };
  },
  sessionId: string,
  bloc: BlocVerification,
  auteurId: string,
  maintenant: Date,
): Promise<ResultatEnregistrement> {
  const s = await client.trainingSession.findUnique({
    where: { id: sessionId },
    select: { dateDebut: true, lieuType: true, estTestInterne: true },
  });
  if (s === null) return { ok: false, raison: "session_introuvable" };
  const chezEntreprise = s.lieuType === "sur_site";
  const r = validerBlocVerification(bloc, { debut: s.dateDebut, maintenant, chezEntreprise });
  if (!r.ok) return r;
  await journaliser(
    client,
    {
      action: ACTION_VERIFICATION,
      targetType: "TrainingSession",
      targetId: sessionId,
      changes: {
        bloc,
        chezEntreprise,
        enregistreLe: maintenant.toISOString(),
        debutSession: s.dateDebut.toISOString(),
      },
      session: { userId: auteurId },
    },
    { exiger: true },
  );
  return { ok: true };
}
