"use server";

/**
 * Espace formateur — « Signaler un désaccord » sur une facture de mission (lot D2,
 * M10 ; F58). Le formulaire vit sur « Mes honoraires » (paramètre `desaccord`) :
 * aucune route nouvelle dans l'espace.
 *
 * 🔒 La session vient du cookie, jamais du formulaire : un formateur n'agit que
 * sur SES relevés, contrôlé côté serveur par `signalerDesaccord`. Un identifiant
 * qui n'est pas à lui reçoit la même réponse qu'un identifiant inconnu.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { checkRateLimit } from "@/lib/rate-limit";
import { getFormateurSession } from "@/server/formateur/guard";
import { FORMATEUR_BASE_PATH, FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
import { signalerDesaccord } from "@/server/qualiopi/formateurs-independants/paiement/desaccord-mission";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE = `${FORMATEUR_BASE_PATH}/remuneration`;

export async function signalerDesaccordFormAction(formData: FormData): Promise<void> {
  const session = await getFormateurSession();
  if (session === null) redirect(FORMATEUR_CONNEXION_PATH);
  const id = formData.get("statementId");
  const texte = formData.get("texte");
  if (typeof id !== "string" || !UUID.test(id) || typeof texte !== "string") {
    redirect(`${PAGE}?signale=introuvable`);
  }
  // Anti-abus : quelques signalements par heure suffisent largement.
  const rl = await checkRateLimit(`formateur:desaccord:${session.trainerId}`, {
    limit: 5,
    windowSec: 3600,
    surPanne: "refuser",
  });
  if (!rl.allowed) redirect(`${PAGE}?signale=trop_tot`);
  const issue = await signalerDesaccord({
    trainerId: session.trainerId,
    statementId: id as string,
    texte: texte as string,
    maintenant: new Date(),
  });
  revalidatePath(PAGE);
  redirect(
    issue === "texte_invalide"
      ? `${PAGE}?desaccord=${id}&signale=${issue}#releve-${id}`
      : `${PAGE}?signale=${issue}#releve-${id}`,
  );
}
