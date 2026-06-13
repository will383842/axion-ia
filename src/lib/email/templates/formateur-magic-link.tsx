// Email — lien de connexion passwordless à l'espace formateur.
// Envoyé sur demande (« recevoir mon lien »). Contient un lien magique signé
// (HMAC, scope formateur_login), à usage unique, valable 15 min. FR canonique.

import { Text, Link, Section } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  magicLink: string;
  formateurNom?: string;
  expiresInMin?: number;
}

export const formateurMagicLinkSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Votre lien de connexion — Espace formateur Axion-IA"
    : "Your sign-in link — Axion-IA trainer space";

export function FormateurMagicLinkEmail({
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
      preview="Votre lien de connexion sécurisé à l'espace formateur"
      title="Connexion à votre espace formateur"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.formateurNom ? ` ${p.formateurNom}` : ""},
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Cliquez sur le bouton ci-dessous pour vous connecter à votre espace formateur Axion-IA.
        Aucun mot de passe n&apos;est nécessaire.
      </Text>

      <Section style={{ margin: "16px 0 8px 0" }}>
        <Link href={p.magicLink} style={emailStyles.ctaStyle}>
          Me connecter
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
        Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez simplement cet e-mail —
        aucun accès ne sera ouvert.
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
