/**
 * E-mail — RÉPONSE À UN CANDIDAT, écrite à la main depuis la console.
 *
 * ## Ce qu'il ferme
 *
 * Répondre à une candidature imposait de sortir sur une boîte mail, et il ne
 * restait aucune trace côté produit de ce qui avait été dit. Ce gabarit est le
 * pendant, pour le recrutement, de `submission-reply` côté messages.
 *
 * ## FAMILLE C, et pas B comme son jumeau
 *
 * `submission-reply` est en famille B : réseaux sociaux, bandeau de confiance,
 * demande d'avis autorisée, et un bouton « Réserver un appel ». C'est cohérent
 * pour répondre à un prospect.
 *
 * 🔑 Ce message-ci part à quelqu'un qui postule — et une fois sur deux, pour lui
 * dire non. Lui servir un bandeau de certification, une rangée de liens
 * sociaux et une invitation à réserver un appel commercial serait au mieux
 * hors sujet, au pire blessant. La famille C retire tout cela et garde ce qui
 * compte ici : la **soupape de réponse**. Un candidat qui reçoit un refus doit
 * pouvoir répondre — c'est le seul geste qu'on lui doit.
 *
 * Aucun bouton d'action, donc. Le corps EST le message.
 *
 * ## Ce que ce gabarit ne décide pas
 *
 * Ni le ton, ni le contenu : ils viennent de la console, relus avant l'envoi.
 * Les textes pré-remplis (refus, invitation à un entretien, demande de pièce,
 * relance) vivent dans `src/content/recrutement/modeles-reponse.ts` — ce sont
 * des points de départ, pas des gabarits : ce qui part est ce qui a été relu.
 */

import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";
import { paragraphes, preEnTeteDepuisCorps, rendreParagraphe } from "./_markdown-leger";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Objet saisi dans la console — il devient aussi le titre du message. */
  subject: string;
  /** Corps en markdown léger (paragraphes, **gras**, *italique*, [lien](url)). */
  bodyMarkdown: string;
  /** Intitulé du poste, rappelé sous le titre. Facultatif : une candidature
   *  spontanée n'en a pas. */
  offerTitle?: string;
  /** Signature. Défaut : « Williams » — jamais le nom complet (règle de marque). */
  signature?: string;
}

export const candidatureReponseSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  return p.subject || "Votre candidature";
};

export function CandidatureReponseEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const isEn = locale === "en";
  const signature = p.signature ?? "Williams\nAxion-IA · cabinet IA opérationnel";
  const [nomSignature, ...resteSignature] = signature.split("\n");
  const corps = paragraphes(p.bodyMarkdown);

  return (
    <EmailLayout
      famille="C"
      preview={preEnTeteDepuisCorps(
        p.bodyMarkdown,
        isEn ? "About your application." : "Au sujet de votre candidature.",
      )}
      title={p.subject}
      locale={locale}
      eyebrow={
        p.offerTitle
          ? `${isEn ? "Your application" : "Votre candidature"} · ${p.offerTitle}`
          : isEn
            ? "Your application"
            : "Votre candidature"
      }
    >
      {corps.map((paragraphe, i) => (
        <Text key={i} style={emailStyles.paragraphStyle}>
          {rendreParagraphe(paragraphe)}
        </Text>
      ))}

      <Text
        style={{
          ...emailStyles.signatureStyle,
          margin: "28px 0 0 0",
          fontWeight: 600,
          fontFamily: emailStyles.SERIF,
        }}
      >
        {nomSignature}
      </Text>
      {resteSignature.length > 0 && (
        <Text
          style={{
            ...emailStyles.signatureStyle,
            margin: "2px 0 0 0",
            color: emailStyles.COLORS.textMuted,
          }}
        >
          {resteSignature.join(" · ")}
        </Text>
      )}
    </EmailLayout>
  );
}
