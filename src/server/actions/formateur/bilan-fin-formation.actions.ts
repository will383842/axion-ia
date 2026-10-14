"use server";

/**
 * Espace formateur — le BILAN DE FIN DE FORMATION (lot G2) : évaluer chaque stagiaire,
 * donner son avis, « Terminer ». Les formulaires vivent sur la page EXISTANTE de la
 * session (`#fin-de-formation`) : aucune route nouvelle, aucun JavaScript client.
 *
 * 🔒 La session vient du cookie, par la garde commune de l'espace (`getFormateurSession`,
 * qui refuse après une fin de collaboration), jamais du formulaire. Le service revérifie
 * que ce formateur a animé la session et que le stagiaire en fait partie.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getFormateurSession } from "@/server/formateur/guard";
import { FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";
import {
  enregistrerAvisFormateur,
  enregistrerEvaluationFinaleFormateur,
  terminerBilanFormateur,
} from "@/server/qualiopi/formateurs-independants/bilan-fin-formation/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Plafond du nombre d'objectifs lus dans un formulaire. */
const OBJECTIFS_MAX = 50;

function page(sessionId: string, issue: string): string {
  return `${FORMATEUR_SESSIONS_PATH}/${sessionId}?bilan=${issue}#fin-de-formation`;
}

/**
 * Garde commune ; redirige toujours (rien n'est rendu ici). Aucun anti-abus de plus :
 * chaque geste est borné par nature (une finale par stagiaire, un avis, un « Terminer »).
 */
async function preparer(formData: FormData): Promise<{ trainerId: string; sessionId: string }> {
  const session = await getFormateurSession();
  if (session === null) redirect(FORMATEUR_CONNEXION_PATH);
  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string" || !UUID.test(sessionId)) {
    redirect(`${FORMATEUR_SESSIONS_PATH}`);
  }
  return { trainerId: session.trainerId, sessionId: sessionId as string };
}

export async function evaluerStagiaireFormAction(formData: FormData): Promise<void> {
  const { trainerId, sessionId } = await preparer(formData);
  const enrollmentId = formData.get("enrollmentId");
  if (typeof enrollmentId !== "string" || !UUID.test(enrollmentId)) {
    redirect(page(sessionId, "stagiaire_inconnu"));
  }
  const notes: number[] = [];
  for (let k = 0; k < OBJECTIFS_MAX; k++) {
    const v = formData.get(`note-${k}`);
    if (v === null) break;
    notes.push(typeof v === "string" && /^[123]$/.test(v) ? Number(v) : NaN);
  }
  const issue = await enregistrerEvaluationFinaleFormateur({
    sessionId,
    trainerId,
    enrollmentId: enrollmentId as string,
    notes,
    maintenant: new Date(),
  });
  revalidatePath(`${FORMATEUR_SESSIONS_PATH}/${sessionId}`);
  redirect(page(sessionId, issue));
}

export async function donnerAvisFormAction(formData: FormData): Promise<void> {
  const { trainerId, sessionId } = await preparer(formData);
  const commentaire = formData.get("commentaire");
  const note = formData.get("note");
  const noteLue = typeof note === "string" && /^[1-5]$/.test(note) ? Number(note) : undefined;
  const issue = await enregistrerAvisFormateur({
    sessionId,
    trainerId,
    commentaire: typeof commentaire === "string" ? commentaire : "",
    ...(noteLue !== undefined ? { note: noteLue } : {}),
    maintenant: new Date(),
  });
  revalidatePath(`${FORMATEUR_SESSIONS_PATH}/${sessionId}`);
  redirect(page(sessionId, issue));
}

export async function terminerBilanFormAction(formData: FormData): Promise<void> {
  const { trainerId, sessionId } = await preparer(formData);
  const issue = await terminerBilanFormateur({ sessionId, trainerId, maintenant: new Date() });
  revalidatePath(`${FORMATEUR_SESSIONS_PATH}/${sessionId}`);
  redirect(page(sessionId, issue === "ok" ? "termine_ok" : issue));
}
