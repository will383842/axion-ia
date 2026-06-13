// Email — lien de connexion passwordless à l'espace ressources (commerciaux +
// formateurs). Lien magique signé (HMAC, scope ressources_login), usage unique,
// valable 15 min. FR canonique.

import { Text, Link, Section } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  magicLink: string;
  destinataireNom?: string;
  expiresInMin?: number;
}

export const ressourcesMagicLinkSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Votre lien de connexion — Espace ressources Axion-IA"
    : "Your sign-in link — Axion-IA resources space";

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
      preview="Votre lien de connexion sécurisé à l'espace ressources"
      title="Connexion à votre espace ressources"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.destinataireNom ? ` ${p.destinataireNom}` : ""},
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Cliquez sur le bouton ci-dessous pour accéder à vos documents Axion-IA (supports,
        programmes, livrables). Aucun mot de passe n&apos;est nécessaire.
      </Text>

      <Section style={{ margin: "16px 0 8px 0" }}>
        <Link href={p.magicLink} style={emailStyles.ctaStyle}>
          Accéder à mes ressources
        </Link>
      </Section>

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
      <Text
        style={{
          ...emailStyles.paragraphStyle,
          fontSize: "12px",
          color: emailStyles.COLORS.textMuted,
        }}
      >
        Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
        {p.magicLink}
      </Text>
    </EmailLayout>
  );
}
