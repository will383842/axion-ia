// Email — code à usage unique pour SIGNER un devis (signature électronique « simple renforcée », lot 4 bis).
//
// Transactionnel, famille A : envoyé UNIQUEMENT quand le signataire clique « Recevoir mon code » sur la
// page de signature de son devis (`server/qualiopi/devis/code-signature-devis.ts`), jamais par un cron
// ni à l'envoi du devis. Il part à l'adresse figée sur le lien de signature.
//
// 🔴 Le code ne traverse la file que SCELLÉ (`code-en-file.ts`) ; il n'est ouvert qu'au rendu, ici, et
// la copie conservée du message le masque (`gabarits-a-code.ts`). Aucun lien, aucun montant, aucune
// donnée du devis hormis son numéro : un message de sécurité reste sobre.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

function valeurs(payload: Record<string, unknown>): Record<string, unknown> {
  const v = payload["valeurs"];
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function texte(v: unknown, repli: string): string {
  return typeof v === "string" && v.trim() !== "" ? v : repli;
}

const COPY = {
  fr: {
    title: "Votre code de signature",
    intro: "Bonjour,",
    body: (num: string) =>
      num !== ""
        ? `Voici le code à saisir pour signer le devis ${num} :`
        : "Voici le code à saisir pour signer votre devis :",
    validite: (d: string) => `Ce code est valable ${d} et ne peut servir qu'une seule fois.`,
    ignore:
      "Vous n'avez pas demandé ce code ? Ignorez ce message : sans ce code, rien ne peut être signé. Ne le communiquez à personne.",
    close: "Bien cordialement,\nL'équipe Axion-IA",
    preview: "Code à usage unique pour signer votre devis.",
  },
  en: {
    title: "Your signing code",
    intro: "Hello,",
    body: (num: string) =>
      num !== ""
        ? `Here is the code to enter to sign quote ${num}:`
        : "Here is the code to enter to sign your quote:",
    validite: (d: string) => `This code is valid for ${d} and can only be used once.`,
    ignore:
      "You did not request this code? Ignore this message: nothing can be signed without it. Do not share it with anyone.",
    close: "Best regards,\nThe Axion-IA team",
    preview: "One-time code to sign your quote.",
  },
} as const;

export const devisCodeSignatureSubject = (
  locale: Locale,
  _payload: Record<string, unknown>,
): string =>
  // Jamais le code dans l'objet : il resterait lisible dans les notifications et les listes de messages.
  locale === "fr" ? "Votre code pour signer le devis" : "Your code to sign the quote";

export function DevisCodeSignatureEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const t = COPY[locale];
  const v = valeurs(payload);
  const code = texte(v["code"], "");
  const duree = texte(v["durée"], "10 minutes");
  const numero = texte(payload["numero"], "");
  return (
    <EmailLayout famille="A" locale={locale} title={t.title} preview={t.preview}>
      <Text style={emailStyles.paragraphStyle}>{t.intro}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(numero)}</Text>
      <Text
        style={{
          ...emailStyles.paragraphStyle,
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "6px",
          textAlign: "center",
        }}
      >
        {code}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.validite(duree)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.ignore}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.close.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
    </EmailLayout>
  );
}
