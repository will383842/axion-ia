"use server";

/**
 * Espace formateur — saisie de l'évaluation finale d'un stagiaire (lot L08).
 *
 * 🔒 Le formateur vient du cookie (`getFormateurSession`), la date est celle du
 * serveur : ni l'un ni l'autre ne se lit dans le formulaire. Le service
 * revérifie l'appartenance à la session, l'inscription, le verrou du dossier et
 * l'interrupteur. Aucun JavaScript client : un formulaire HTML, une redirection
 * avec un code fermé.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getFormateurSession } from "@/server/formateur/guard";
import { FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";
import { enregistrerEvaluationFormateur } from "@/server/qualiopi/pedagogie/saisie-evaluation-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECTIFS_MAX = 50;

function page(sessionId: string, issue: string): string {
  return `${FORMATEUR_SESSIONS_PATH}/${sessionId}?evaluation=${issue}#evaluation-finale`;
}

export async function saisirEvaluationFinaleFormAction(formData: FormData): Promise<void> {
  const session = await getFormateurSession();
  if (session === null) redirect(FORMATEUR_CONNEXION_PATH);

  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string" || !UUID.test(sessionId)) redirect(FORMATEUR_SESSIONS_PATH);
  const enrollmentId = formData.get("enrollmentId");
  if (typeof enrollmentId !== "string" || !UUID.test(enrollmentId)) {
    redirect(page(sessionId as string, "stagiaire_inconnu"));
  }

  const notes: number[] = [];
  const observations: string[] = [];
  for (let k = 0; k < OBJECTIFS_MAX; k++) {
    const note = formData.get(`note-${k}`);
    const observation = formData.get(`observation-${k}`);
    if (note === null && observation === null) break;
    notes.push(typeof note === "string" && /^[123]$/.test(note) ? Number(note) : Number.NaN);
    observations.push(typeof observation === "string" ? observation : "");
  }
  const recommandations = formData.get("recommandations");

  let code: string;
  try {
    const r = await enregistrerEvaluationFormateur({
      sessionId: sessionId as string,
      trainerId: session.trainerId,
      enrollmentId: enrollmentId as string,
      notes,
      observations,
      ...(typeof recommandations === "string" && recommandations.trim() !== ""
        ? { recommandations }
        : {}),
      maintenant: new Date(),
    });
    code = r.issue;
  } catch (e) {
    // Le nom seul : un message d'erreur peut citer une donnée de stagiaire.
    console.error(
      "[espace-formateur] saisie d'évaluation :",
      e instanceof Error ? e.name : "erreur",
    );
    code = "erreur";
  }
  revalidatePath(`${FORMATEUR_SESSIONS_PATH}/${sessionId as string}`);
  redirect(page(sessionId as string, code));
}
