// Email — DEMANDE DE CONFIRMATION DE PRÉSENCE au stagiaire (QNC NC6, P-12 étape 3).
//
// Part de J-3 à J-1, entre 9 h et 19 h (Paris), puis une seule relance
// (`relance: true`). Le stagiaire répond par UN CLIC sur la page ouverte par le
// lien : le lien lui-même n'enregistre rien (décision de Will, 19/10).
//
// ⚠️ Le lien désigne UNE inscription et porte une réponse : il est personnel.
// ⚠️ Toujours en français et en `/fr/portail/presence/<jeton>` (jamais `/en/`).
// ⚠️ Aucune mention de financement public (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom?: string;
  titreFormation?: string;
  /** Date de début, déjà formatée en toutes lettres (ex. « lundi 26 octobre 2026 »). */
  dateDebutFormation?: string;
  /** Lien personnel `/fr/portail/presence/<jeton>`. */
  lienPresence?: string;
  /** Vrai pour l'unique relance. */
  relance?: boolean;
}

export const qualiopiPresenceConfirmationSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Payload;
  return objetCompose(
    p.relance === true ? "Rappel : confirmez votre présence —" : "Confirmez votre présence —",
    p.titreFormation ?? "votre formation",
  );
};

export function QualiopiPresenceConfirmationEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienPresence ?? `${baseUrl}/fr/portail/mon-espace`;
  const relance = p.relance === true;

  return (
    <EmailLayout
      famille="A"
      preview={
        relance
          ? "Nous n'avons pas encore votre réponse : un clic suffit."
          : "Un clic pour nous dire si vous serez présent(e)."
      }
      title={relance ? "Rappel : confirmez votre présence" : "Confirmez votre présence"}
      cta={{ label: "Répondre", href: ctaHref }}
      /* Le lien est personnel : le corps le dit, et l'imprimer en clair dans la
         version texte contredirait la consigne. */
      ctaSecret
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.stagiairePrenomNom ? ` ${p.stagiairePrenomNom}` : ""}, la formation{" "}
        <strong>{p.titreFormation}</strong> débute le {p.dateDebutFormation}.
        {relance ? " Nous n'avons pas encore reçu votre réponse." : ""}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Pour que tout soit prêt le jour venu, merci de nous dire si vous serez présent(e). Il suffit
        d&apos;ouvrir la page avec le bouton ci-dessous, puis de cliquer sur votre réponse. Cela ne
        prend que quelques secondes.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Gardez ce lien pour vous : il est personnel. Si vous ne pouvez finalement pas venir,
        répondez-nous aussi : c&apos;est utile pour organiser la session.
      </Text>
    </EmailLayout>
  );
}
