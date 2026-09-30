/**
 * L'action UNIQUE du questionnaire de cadrage et de l'e-mail de suivi
 * (chantier visio, PR 7).
 *
 * Une seule action pour toutes les vues (champ caché `geste`), comme la page
 * du compte rendu : chaque action serveur référencée pèse sur le cliquet des
 * pages de la console. Formulaires sans JavaScript.
 *
 * Elle vérifie ELLE-MÊME la session (décision A2 : Will et les
 * administrateurs) : une Server Action s'appelle directement, masquer un
 * bouton n'est pas interdire. Aucune n'appelle OpenAI, aucune n'envoie
 * d'e-mail : elles programment une étape, ou garent un e-mail en
 * « E-mails à valider ».
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { GesteRefuse } from "@/server/visio/gestes-compte-rendu";
import {
  clore,
  demanderEmailSuivi,
  demanderQuestionnaire,
  emailSuiviGabaritFixe,
  enregistrerReponses,
  marquerPoseeDeViveVoix,
  marquerQuestionnaireCopie,
  rejeterFaitDeReponse,
  validerFaitDeReponse,
} from "@/server/visio/gestes-suivi";
import { envoiEmailSuiviReel } from "@/server/visio/passes/etapes-a-la-demande";

const uuid = z.string().uuid();
const id = (fd: FormData, nom: string): string => uuid.parse(fd.get(nom));

const RETOURS_ADMIS = [
  /^\/[a-z]{2}\/[\w-]+\/qualiopi\/clients\/[0-9a-f-]{36}\/projets\/[0-9a-f-]{36}\?vue=questionnaire$/,
  /^\/[a-z]{2}\/[\w-]+\/rendez-vous\?emailSuivi=[0-9a-f-]{36}$/,
];

/** L'adresse de retour : une des deux vues (jamais une URL extérieure). */
function lireRetour(fd: FormData): string {
  const r = String(fd.get("retour") ?? "");
  return RETOURS_ADMIS.some((re) => re.test(r)) ? r : "/";
}

type Geste = (fd: FormData, adminId: string) => Promise<string>;

const GESTES: Readonly<Record<string, Geste>> = {
  questionnaire_demander: (fd, adminId) =>
    demanderQuestionnaire(prisma, {
      clientId: id(fd, "clientId"),
      projetId: id(fd, "projetId"),
      parAdminId: adminId,
    }),
  questionnaire_copie: (fd) => marquerQuestionnaireCopie(prisma, id(fd, "questionnaireId")),
  questionnaire_vive_voix: (fd) =>
    marquerPoseeDeViveVoix(prisma, id(fd, "questionId"), fd.get("valeur") === "oui"),
  questionnaire_reponses: (fd) => {
    const reponses = new Map<string, string>();
    for (const [cle, valeur] of fd.entries()) {
      const m = /^reponse_([0-9a-f-]{36})$/.exec(cle);
      if (m?.[1] && typeof valeur === "string") reponses.set(m[1], valeur);
    }
    return enregistrerReponses(prisma, { questionnaireId: id(fd, "questionnaireId"), reponses });
  },
  questionnaire_clore: (fd) => clore(prisma, id(fd, "questionnaireId")),
  reponse_valider: (fd, adminId) =>
    validerFaitDeReponse(prisma, { faitId: id(fd, "faitId"), parAdminId: adminId }),
  reponse_rejeter: (fd, adminId) =>
    rejeterFaitDeReponse(prisma, { faitId: id(fd, "faitId"), parAdminId: adminId }),
  email_preparer: (fd, adminId) =>
    demanderEmailSuivi(prisma, {
      rencontreId: id(fd, "rencontreId"),
      contactId: id(fd, "contactId"),
      parAdminId: adminId,
    }),
  email_gabarit_fixe: (fd, adminId) =>
    emailSuiviGabaritFixe(prisma, envoiEmailSuiviReel, {
      rencontreId: id(fd, "rencontreId"),
      contactId: id(fd, "contactId"),
      parAdminId: adminId,
    }),
};

/** Exécute le geste nommé et revient sur la vue avec un message. */
export async function gesteSuiviAction(fd: FormData): Promise<never> {
  const retour = lireRetour(fd);
  let cle = "message";
  let message: string;
  try {
    const { userId } = await exigerAccesEchanges();
    const geste = GESTES[String(fd.get("geste") ?? "")];
    if (!geste) throw new GesteRefuse("Geste inconnu.");
    message = await geste(fd, userId);
    revalidatePath(retour.split("?")[0] ?? "/");
  } catch (err) {
    cle = "erreur";
    message =
      err instanceof GesteRefuse
        ? err.message
        : err instanceof z.ZodError
          ? "Demande incomplète."
          : err instanceof Error
            ? err.message
            : "Erreur inattendue.";
  }
  redirect(`${retour}${retour.includes("?") ? "&" : "?"}${cle}=${encodeURIComponent(message)}`);
}
