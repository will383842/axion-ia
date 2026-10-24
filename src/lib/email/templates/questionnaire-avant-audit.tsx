// E-mail CLIENT — le lien du questionnaire de pré-audit (2026-10-24).
//
// Envoyé UNIQUEMENT par clic de Will (« Envoyer » sur la rencontre, après aperçu de cet e-mail
// exact) : aucun chemin automatique, aucune relance automatique. Le lien est un SECRET (jeton) :
// il n'est pas imprimé en clair (`ctaSecret`). Vouvoiement, mots simples, aucune promesse.
//
// ⛔ Jamais « J'aide », « Aucun gain garanti », « Grenoble » (ordres de Will).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: string;
  /** Le lien secret du questionnaire. */
  lien?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const questionnaireAvantAuditSubject = (
  _locale: Locale,
  _payload: Record<string, unknown>,
): string => objetCompose("Avant notre audit :", "votre questionnaire");

export function QuestionnaireAvantAuditEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const prenom = texte(p.prenom);
  const lien = texte(p.lien);
  return (
    <EmailLayout
      famille="C"
      preview="Un questionnaire pour préparer notre audit : à remplir à votre rythme."
      title="Préparons notre audit ensemble"
      {...(lien ? { cta: { label: "Ouvrir le questionnaire", href: lien } } : {})}
      ctaSecret
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</Text>
      <Text style={emailStyles.paragraphStyle}>
        Pour que notre audit parte de votre quotidien plutôt que de généralités, nous vous proposons
        un questionnaire en ligne. Vous pouvez vous arrêter et reprendre plus tard : vos réponses
        restent sur votre appareil tant que vous ne les avez pas envoyées.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Les questions marquées d&apos;un cadenas sont facultatives. Si vous avez des collaborateurs,
        le questionnaire vous donnera un lien à leur transmettre : chacun répond de son côté.
      </Text>
    </EmailLayout>
  );
}
