/**
 * L'UNIQUE chemin qui envoie le questionnaire de pré-audit (2026-10-24).
 *
 * Ordre de Will : AUCUN envoi automatique, jamais. Ce module n'est appelé que par l'action
 * « Envoyer » de la console (clic de Will, après l'aperçu exact de l'e-mail). Le cliquet
 * `aucun-envoi-automatique.spec.ts` rougit si un autre fichier met ce gabarit en file.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { renderEmailTemplate, type RenderedEmail } from "@/lib/email/templates";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";

import { MESSAGE_REFUS, refusEnvoiReel } from "./config";
import { annulerEnvoi, reserverEnvoi, urlArretRelances, urlPreaudit } from "./serveur";
import { payloadCourrier } from "./suivi";
import { resoudreTexte } from "./gabarit-invitation";
import type { TextePayload, TexteSaisi } from "@/lib/email/questionnaire-avant-audit-texte";

const adresse = z.string().trim().toLowerCase().email().max(200);

function lienOuRefus(id: string): string {
  const lien = urlPreaudit(id);
  if (lien === null) throw new MessagePourWill("Aucun lien sécurisé ne peut être fabriqué ici.");
  return lien;
}

/** Le payload de l'invitation : le même calcul que le worker (date et lieu de l'audit compris). */
function payloadInvitation(
  lien: string,
  prenom: string,
  audit: { dateAudit: Date | null; lieuAudit: string | null },
  texte: TextePayload = {},
): Record<string, unknown> {
  // Le texte modifiable (objet, message, corps) s'ajoute au payload du calcul commun : l'aperçu et
  // l'envoi passent par ici, donc Will voit EXACTEMENT ce qui part. Le lien n'est jamais modifiable.
  const base = payloadCourrier("invitation", {
    prenom: prenom.trim().slice(0, 60) || undefined,
    societe: "",
    dateAudit: audit.dateAudit,
    lieuAudit: audit.lieuAudit,
    lien,
    lienArret: "",
    brouillonEnCours: false,
    role: "dirigeant",
    prenomRepondant: undefined,
    recuLe: new Date(),
    env: process.env,
  }).payload;
  return { ...base, ...texte };
}

/** L'e-mail EXACT qui partira (même rendu que l'envoi), pour l'aperçu de Will. */
export async function apercuEnvoi(
  questionnaireId: string,
  destinataire: string,
  prenom: string,
  audit: { dateAudit: Date | null; lieuAudit: string | null } = {
    dateAudit: null,
    lieuAudit: null,
  },
  texte: TexteSaisi = {},
): Promise<RenderedEmail> {
  return renderEmailTemplate(
    "questionnaire-avant-audit",
    "fr",
    payloadInvitation(lienOuRefus(questionnaireId), prenom, audit, await resoudreTexte(texte)),
    { destinataire },
  );
}

/** Les e-mails de suivi tels qu'ils partiraient (rendu seul, RIEN n'est mis en file). */
export const APERCUS_SUIVI = [
  { nature: "relance_1", libelle: "Rappel 1", brouillon: false },
  { nature: "relance_2", libelle: "Rappel 2", brouillon: false },
  { nature: "relance_3", libelle: "Rappel 3", brouillon: false },
  { nature: "relance_2", libelle: "Rappel (brouillon en cours)", brouillon: true },
  { nature: "confirmation_dirigeant", libelle: "Confirmation au dirigeant", brouillon: false },
  {
    nature: "confirmation_collaborateur",
    libelle: "Confirmation à un collaborateur",
    brouillon: false,
  },
] as const;

export async function apercusSuivi(
  questionnaireId: string,
  destinataire: string,
  prenom: string,
  audit: { dateAudit: Date | null; lieuAudit: string | null; societe: string },
): Promise<ReadonlyArray<{ libelle: string; email: RenderedEmail }>> {
  const lien = lienOuRefus(questionnaireId);
  const lienArret = urlArretRelances(questionnaireId) ?? "";
  const p = prenom.trim().slice(0, 60) || undefined;
  return Promise.all(
    APERCUS_SUIVI.map(async (a) => {
      const { template, payload } = payloadCourrier(a.nature, {
        prenom: p,
        societe: audit.societe,
        dateAudit: audit.dateAudit,
        lieuAudit: audit.lieuAudit,
        lien,
        lienArret,
        brouillonEnCours: a.brouillon,
        role: a.nature === "confirmation_collaborateur" ? "collaborateur" : "dirigeant",
        // Le prénom du collaborateur n'est connu qu'à sa réponse : l'aperçu dit « Bonjour, »
        // (jamais un « Bonjour Prénom » fictif que Will prendrait pour le vrai rendu).
        prenomRepondant: a.nature === "confirmation_collaborateur" ? undefined : p,
        recuLe: new Date(),
        env: process.env,
      });
      return {
        libelle: a.libelle,
        email: await renderEmailTemplate(template, "fr", payload, { destinataire }),
      };
    }),
  );
}

/** Mise en file de l'e-mail au prospect. Refusée si éteint ou si la notice RGPD est vide. */
export async function envoyerQuestionnaire(args: {
  readonly questionnaireId: string;
  readonly destinataire: string;
  readonly prenom: string;
  /** Date et lieu de l'audit, écrits dans l'e-mail (facultatifs). */
  readonly dateAudit?: Date | null;
  readonly lieuAudit?: string | null;
  /** Texte modifié par Will avant ce premier envoi (objet, message personnel, corps). */
  readonly texte?: TexteSaisi;
}): Promise<"envoye" | "retenu_corbeille"> {
  const refus = refusEnvoiReel();
  if (refus !== null) throw new MessagePourWill(MESSAGE_REFUS[refus]);
  const a = adresse.safeParse(args.destinataire);
  if (!a.success) throw new MessagePourWill("Cette adresse e-mail n'est pas valide.");
  const q = await prisma.questionnaireAvantAudit.findUnique({
    where: { id: args.questionnaireId },
    select: { id: true, rencontre: { select: { clientId: true } } },
  });
  if (q === null) throw new MessagePourWill("Questionnaire introuvable.");
  const lien = lienOuRefus(q.id);
  const texte = await resoudreTexte(args.texte ?? {});
  // Réservation AVANT la mise en file : un double clic (ou deux onglets) ne fait partir qu'un e-mail.
  const maintenant = new Date();
  const avant = await reserverEnvoi(q.id, a.data, maintenant);
  if (avant === null) {
    throw new MessagePourWill(
      "Un envoi vient d'avoir lieu : patientez une minute avant de renvoyer.",
    );
  }
  let garde = false;
  let echec: string | null = null;
  try {
    const r = await enqueueEmail(
      "questionnaire-avant-audit",
      a.data,
      "fr",
      payloadInvitation(
        lien,
        args.prenom,
        {
          dateAudit: args.dateAudit ?? null,
          lieuAudit: args.lieuAudit ?? null,
        },
        texte,
      ),
      {
        // Idempotent : le même envoi réservé ne produit jamais deux tâches.
        jobId: `preaudit-${q.id}-${maintenant.getTime()}`,
        entityType: "QuestionnaireAvantAudit",
        entityId: q.id,
        clientId: q.rencontre?.clientId ?? null,
      },
    );
    // Retenu dans la corbeille « E-mails à valider » : l'e-mail EXISTE et partira à la validation
    // de Will. Le questionnaire reste « envoyé » (sinon : lien 404 après validation, copies à
    // chaque nouvel essai). On ne passe JAMAIS `bypassValidation`.
    garde = r.garePourValidation === true;
    if (!r.enqueued && !garde) {
      echec = r.retenu
        ? `L'e-mail n'est pas parti : adresse retenue (${r.retenu}).`
        : r.corbeilleIndisponible
          ? "Les e-mails à valider sont indisponibles : rien n'est parti. Réessayez plus tard."
          : r.essaiBloque
            ? "Envoi bloqué : cette adresse n'est pas autorisée pendant la session d'essai."
            : "L'e-mail n'a pas pu être mis en file. Réessayez.";
    }
  } catch (e) {
    await annulerEnvoi(q.id, avant);
    throw e;
  }
  if (echec !== null) {
    await annulerEnvoi(q.id, avant);
    throw new MessagePourWill(echec);
  }
  return garde ? "retenu_corbeille" : "envoye";
}
