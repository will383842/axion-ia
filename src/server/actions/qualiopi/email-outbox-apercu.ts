"use server";

/**
 * I2-3 — aperçu exact d'un e-mail de la file « E-mails à valider ».
 *
 * L'aperçu appelle `renderEmailTemplate` comme le worker le fera : même gabarit, même
 * langue, même charge (`chargeApprouvee`, la fonction de l'approbation), vrai destinataire.
 * L'objet est forcé comme à l'envoi (`objetApprouve`). Avant de quitter le serveur, objet,
 * HTML et texte passent par `masquerSecretsEmail`, puis les liens par `rendreLiensInertes` :
 * le navigateur de la console ne reçoit ni jeton ni lien cliquable.
 *
 * Lecture seule : rien n'est écrit, rien n'est mis en file, aucun lien n'est créé.
 * Jamais journalisé, jamais mis en cache : le HTML rendu porte des liens personnels.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import {
  extrairePreEntete,
  rendreLiensInertes,
  type ApercuLecteur,
} from "@/lib/email/apercu-lecteur";
import { enveloppeExpedition } from "@/lib/email/enveloppe";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { renderEmailTemplate } from "@/lib/email/templates";
import { codeDuPayload, masquerCode, payloadPourRendu } from "@/server/email/code-en-file";
import { chargeApprouvee, objetApprouve } from "@/server/email/outbox-charge";
import { gabaritLitLeMessage } from "@/server/email/outbox-policy";

const apercuSchema = z.object({
  id: z.string().uuid(),
  sujet: z.string().trim().min(1).max(300).optional(),
  messagePersonnalise: z.string().trim().max(4000).optional(),
});

type Resultat = { data: ApercuLecteur & { html: string; objet: string } } | { error: string };

export async function apercuOutboxAction(input: z.infer<typeof apercuSchema>): Promise<Resultat> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  await requireAdminWrite();
  const parsed = apercuSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const v = parsed.data;

  const email = await prisma.emailOutbox.findUnique({
    where: { id: v.id },
    select: {
      template: true,
      recipient: true,
      locale: true,
      payload: true,
      sujet: true,
      statut: true,
      attachments: true,
    },
  });
  if (!email) return { error: "Email introuvable" };
  if (email.statut !== "a_valider") {
    return { error: `Cet email a déjà été traité (statut : ${email.statut}).` };
  }

  // Le message n'entre dans la charge que pour un gabarit qui le lit : le champ n'existe
  // pas à l'écran pour les autres.
  const message = gabaritLitLeMessage(email.template) ? v.messagePersonnalise : undefined;
  const charge = chargeApprouvee(email.payload, message);

  let rendu: Awaited<ReturnType<typeof renderEmailTemplate>>;
  try {
    rendu = await renderEmailTemplate(
      email.template as Parameters<typeof renderEmailTemplate>[0],
      email.locale === "en" ? "en" : "fr",
      payloadPourRendu(email.template, charge) as Parameters<typeof renderEmailTemplate>[2],
      { destinataire: email.recipient },
    );
  } catch {
    // Jamais l'erreur brute : elle peut citer la charge.
    return { error: "L'aperçu n'a pas pu être préparé pour cet e-mail." };
  }

  const code = codeDuPayload(email.template, charge);
  const objetBrut = objetApprouve(v.sujet, email.sujet) ?? rendu.subject;
  const masque = masquerSecretsEmail({
    subject: masquerCode(objetBrut, code),
    html: masquerCode(rendu.html, code),
    text: masquerCode(rendu.text, code),
  });
  const html = rendreLiensInertes(masque.html);
  const enveloppe = enveloppeExpedition();
  const pieces = Array.isArray(email.attachments)
    ? (email.attachments as Array<{ filename?: unknown }>)
        .map((p) => p.filename)
        .filter((n): n is string => typeof n === "string")
    : [];

  return {
    data: {
      html,
      texte: masque.text,
      objet: masque.subject,
      de: enveloppe.from,
      a: email.recipient,
      repondreA: enveloppe.replyTo,
      preEntete: extrairePreEntete(html),
      piecesJointes: pieces,
    },
  };
}
