/**
 * Action serveur du lot B10 : « Demander au dirigeant de relancer son équipe ».
 *
 * Elle crée un BROUILLON d'e-mail AU DIRIGEANT SEUL, garé « à valider » (`garerPourValidation`) :
 * Will le relit et le valide dans la boîte des e-mails. RIEN n'est envoyé ici, jamais : si le
 * garage échoue (`null`), on AFFICHE une erreur, on n'envoie pas « normalement ». Le brouillon ne
 * porte aucune réponse (on a seulement COMPTÉ) et aucun lien de collaborateur.
 *
 * (Le gabarit n'est jamais passé à `enqueueEmail` ici : c'est l'approbation de Will, dans la boîte,
 * qui le met en file.)
 *
 * Le rôle est revérifié ici (super-administrateur, comme l'export du questionnaire) : masquer le
 * bouton n'est pas interdire. Rien n'est supprimé.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { prisma } from "@/lib/prisma";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import {
  fichesCouvertes,
  questionnairesDesFiches,
} from "@/features/questionnaire-preaudit/de-la-fiche";
import { lireSuiviParPersonne } from "@/features/questionnaire-preaudit/suivi-par-personne";
import { garerPourValidation } from "@/server/email/outbox-service";
import { entreeDepuisSuivi, prenomDe } from "./questionnaire-en-bref";

const uuid = z.string().uuid();

const TEMPLATE = "questionnaire-relance-equipe";
const TYPE_ENTITE = "questionnaire_preaudit";

const champ = (fd: FormData, cle: string): string => {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim().toLowerCase() : "";
};

interface Prepare {
  readonly adresse: string;
  readonly prenomDirigeant: string | null;
  readonly manquants: string[];
  readonly auditCourt: string;
}

/** Lit ce qu'il faut au brouillon, ou dit pourquoi on ne le prépare pas. Aucune écriture. */
async function preparer(
  clientId: string,
  questionnaireId: string,
): Promise<Prepare | { readonly erreur: string }> {
  const illisible = { erreur: "Lecture impossible : aucun message préparé." } as const;
  try {
    const q = await prisma.questionnaireAvantAudit.findFirst({
      where: { id: questionnaireId, ...questionnairesDesFiches(await fichesCouvertes(clientId)) },
      select: { id: true, destinataire: true, envoyeLe: true, closLe: true, expireLe: true },
    });
    if (q === null) return { erreur: "Questionnaire introuvable sur cette fiche." };
    if (q.envoyeLe === null) return { erreur: "Ce questionnaire n'est pas encore envoyé." };
    if (q.closLe !== null) return { erreur: "Ce questionnaire est clos." };

    const deja = await prisma.emailOutbox.findFirst({
      where: { template: TEMPLATE, entityType: TYPE_ENTITE, entityId: q.id, statut: "a_valider" },
      select: { id: true },
    });
    if (deja !== null) return { erreur: "Un message est déjà prêt : relisez-le dans la boîte." };

    if (q.destinataire === null) return { erreur: "L'adresse du dirigeant est introuvable." };
    const adresse = dechiffrerParole(q.destinataire).trim().toLowerCase();

    const suivi = (await lireSuiviParPersonne([q.id])).get(q.id)?.suivi;
    if (suivi === undefined) return illisible;
    const entree = entreeDepuisSuivi(suivi);
    if (entree.manquants.length + entree.manquantsSansNom === 0) {
      return { erreur: "Toutes les réponses sont arrivées : rien à relancer." };
    }
    return {
      adresse,
      prenomDirigeant:
        suivi.dirigeant.sourceNom === "brouillon" ? null : prenomDe(suivi.dirigeant.nom),
      manquants: [...entree.manquants],
      auditCourt:
        q.expireLe === null
          ? ""
          : new Intl.DateTimeFormat("fr-FR", {
              day: "numeric",
              month: "long",
              timeZone: "Europe/Paris",
            }).format(q.expireLe),
    };
  } catch {
    return illisible;
  }
}

export async function demanderAuDirigeantDeRelancerSonEquipeAction(fd: FormData): Promise<void> {
  const clientId = champ(fd, "clientId");
  const questionnaireId = champ(fd, "questionnaireId");
  if (!uuid.safeParse(clientId).success) redirect(adminPath("fr", "qualiopi/clients"));
  const retour = `${adminPath("fr", `qualiopi/clients/${clientId}`)}?onglet=questionnaire`;
  const echec = (texte: string): never => redirect(avecMessageDeRetour(retour, "erreur", texte));

  const session = await auth();
  const user = session?.user as { id?: string; role?: string | null } | undefined;
  if (!user?.id) echec("Session expirée : reconnectez-vous.");
  if (user?.role !== "super_admin") echec("Réservé au super-administrateur.");
  if (!uuid.safeParse(questionnaireId).success) echec("Questionnaire inconnu.");

  // Le questionnaire doit appartenir à CETTE fiche (ou à une fiche qu'elle a absorbée).
  // `redirect` lève une exception : jamais à l'intérieur du `try` (elle y serait avalée).
  const lu = await preparer(clientId, questionnaireId);
  if ("erreur" in lu) return echec(lu.erreur);
  const { adresse, prenomDirigeant, manquants, auditCourt } = lu;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) {
    return echec("L'adresse du dirigeant est illisible.");
  }

  const id = await garerPourValidation({
    template: TEMPLATE,
    recipient: adresse,
    locale: "fr",
    payload: {
      ...(prenomDirigeant !== null ? { prenom: prenomDirigeant } : {}),
      manquants,
      ...(auditCourt !== "" ? { auditCourt } : {}),
    },
    sujet: "Votre équipe et le questionnaire",
    clientId,
    entityType: TYPE_ENTITE,
    entityId: questionnaireId,
  });
  // `null` : le message n'a PAS pu être mis de côté. On le dit ; on n'envoie jamais directement.
  if (id === null) echec("Le message n'a pas pu être préparé : rien n'a été envoyé.");
  redirect(
    avecMessageDeRetour(
      retour,
      "message",
      "Message prêt pour le dirigeant : relisez-le dans la boîte avant tout envoi.",
    ),
  );
}
