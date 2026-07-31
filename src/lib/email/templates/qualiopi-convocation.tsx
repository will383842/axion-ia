// Email — convocation stagiaire à une session de formation (T15).
// Envoyé dès la confirmation de l'inscription (envoyerConvocation).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  dateDebut: string; // ISO ou formatée côté service
  dateFin: string;
  lieu: string;
  modalite: string;
  numeroSession: string;
  lienPortail?: string;
}

const COPY = {
  fr: {
    title: "Votre convocation à la formation",
    intro: (n: string) => `Bonjour ${n},`,
    body: (titre: string, debut: string, fin: string, lieu: string, modalite: string) =>
      `Nous avons le plaisir de vous convoquer à la formation « ${titre} » du ${debut} au ${fin} — ${modalite} — ${lieu}.`,
    kit: "Votre convocation officielle et les modalités pratiques (accès, matériel, règlement intérieur) sont disponibles dans votre espace stagiaire.",
    // Annonce SANS lien, et c'est voulu : un jeton d'émargement créé ici serait
    // révoqué par celui du rappel J-7 (un seul jeton vivant par inscription), et
    // le stagiaire cliquerait un lien mort le jour J. On annonce, le J-7 livre.
    emargement:
      "Quelques jours avant la session, vous recevrez par e-mail votre lien personnel de signature de présence — gardez-le pour le jour de la formation.",
    cta: "Accéder à mon espace",
    refRow: (n: string) => `Référence session : ${n}`,
  },
} as const;

export const qualiopiConvocationSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return `Convocation — ${p.titreFormation ?? "Formation"} — Axion-IA`;
  }
  return `Training convocation — ${p.titreFormation ?? "Training"} — Axion-IA`;
};

export function QualiopiConvocationEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY.fr; // T15 : emails publics en FR uniquement (EN désactivé runtime)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienPortail ?? `${baseUrl}/fr/portail/mon-espace`;
  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.stagiairePrenomNom)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.body(p.titreFormation, p.dateDebut, p.dateFin, p.lieu, p.modalite)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.kit}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.emargement}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.numeroSession)}
      </Text>
    </EmailLayout>
  );
}
