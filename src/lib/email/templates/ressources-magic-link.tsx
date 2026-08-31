// Email — lien de connexion passwordless à l'espace ressources (commerciaux +
// formateurs). Lien magique signé (HMAC, scope ressources_login), usage unique,
// valable 15 min. FR canonique.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  magicLink: string;
  destinataireNom?: string;
  expiresInMin?: number;
}

export const ressourcesMagicLinkSubject = (locale: Locale): string =>
  locale === "fr" ? "Votre lien de connexion ressources" : "Your resources sign-in link";

export function RessourcesMagicLinkEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const minutes = p.expiresInMin ?? 15;
  return (
    <EmailLayout
      famille="A"
      preview="Valable 15 minutes, à usage unique — supports, programmes et livrables."
      title="Connexion à votre espace ressources"
      cta={{ label: "Accéder à mes ressources", href: p.magicLink }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Vos documents Axion-IA — supports, programmes, livrables — sont accessibles par le lien
        ci-dessous, sans mot de passe.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.destinataireNom ? ` ${p.destinataireNom}` : ""}, un clic suffit.
      </Text>

      <Text
        style={{
          ...emailStyles.paragraphStyle,
          fontSize: "13px",
          color: emailStyles.COLORS.textMuted,
        }}
      >
        Ce lien est <strong>valable {minutes} minutes</strong> et à <strong>usage unique</strong>.
        Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez cet e-mail.
      </Text>
    </EmailLayout>
  );
}
