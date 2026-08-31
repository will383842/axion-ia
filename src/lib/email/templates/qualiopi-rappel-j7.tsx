// Email — rappel J-7 avant le démarrage de la session (T15).
// Envoyé à tous les stagiaires inscrits 7 jours avant dateDebut.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  dateDebut: string;
  dateFin: string;
  lieu: string;
  modalite: string;
  numeroSession: string;
  lienPortail?: string;
  /**
   * Lien PERSONNEL de signature de présence (émargement). Présent uniquement si
   * ce rappel est le premier à mettre un lien en circulation pour cette
   * inscription — sinon le lien déjà distribué reste le seul valide et cet
   * e-mail n'en parle pas (cf. `getLienEmargementSiPremier`).
   */
  lienEmargement?: string;
}

export const qualiopiRappelJ7Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return objetCompose("Rappel J-7 —", p.titreFormation ?? "Formation");
  }
  return objetCompose("7-day reminder —", p.titreFormation ?? "Training");
};

export function QualiopiRappelJ7Email({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienPortail ?? `${baseUrl}/fr/portail/mon-espace`;
  return (
    <EmailLayout
      famille="C"
      preview="Convocation et informations pratiques vous attendent dans votre espace."
      title="Rappel — votre formation arrive !"
      cta={{ label: "Accéder à mon espace", href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Votre formation <strong>{p.titreFormation}</strong> démarre le{" "}
        <strong>{p.dateDebut}</strong> — {p.modalite} — {p.lieu}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.stagiairePrenomNom} — pensez à consulter votre convocation et les informations
        pratiques dans votre espace stagiaire avant la date de démarrage.
      </Text>
      {p.lienEmargement ? (
        <>
          <Text style={emailStyles.paragraphStyle}>
            <strong>Votre lien personnel de signature de présence :</strong> le jour de la
            formation, ouvrez-le sur votre téléphone pour signer chaque demi-journée.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            <a href={p.lienEmargement}>Signer ma présence</a>
          </Text>
          <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
            Ce lien est strictement personnel — il vaut signature, ne le transférez à personne. Il
            reste valable jusqu&apos;à 48 h après la fin de la session.
          </Text>
        </>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Référence session : {p.numeroSession}
      </Text>
    </EmailLayout>
  );
}
