// Email — accusé de réception d'une réclamation (chantier QNC, lot L09).
//
// ── Pourquoi ce gabarit existe ────────────────────────────────────────────
// L'indicateur 31 demande que chaque réclamation soit TRAITÉE, et l'exigence
// orale de l'auditeur (O6) va plus loin : un système professionnel, pas une
// boîte mail. L'accusé matérialise, pour la personne et pour l'organisme, la
// date de départ des deux délais publiés : accusé sous 5 jours ouvrés au plus
// (en pratique, ce message part à l'instant du dépôt), réponse écrite sous 15
// jours ouvrés.
//
// Il ne recopie PAS la réclamation : le message vit en base, l'e-mail ne
// porte que son numéro. Une réclamation peut nommer un tiers ; la renvoyer en
// clair dans une boîte mail la ferait voyager pour rien.
//
// Les dates arrivent déjà formatées (heure de Paris) : le gabarit ne calcule
// aucun délai — `server/qualiopi/reclamations/echeances.ts` le fait, une fois.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Numéro AXI-REC-AAAA-NNN, à rappeler dans tout échange. */
  numero: string;
  /** Date de réception, déjà formatée (heure de Paris). */
  recueLe: string;
  /** Échéance de la réponse écrite, déjà formatée (15 jours ouvrés). */
  reponseAvant: string;
}

const COPY = {
  fr: {
    title: "Votre réclamation est enregistrée",
    preview:
      "Réponse écrite de l'organisme au plus tard sous 15 jours ouvrés. Votre numéro est dans le message.",
    objet: (n: string) => `Votre réclamation est enregistrée sous le numéro ${n}.`,
    intro: "Bonjour,",
    delai: (d: string) =>
      `Elle est examinée par une personne de l'organisme, qui vous adressera une réponse écrite et signée au plus tard le ${d} (15 jours ouvrés).`,
    recue: (d: string) => `Reçue le ${d}.`,
    suite:
      "Pour compléter votre réclamation, répondez simplement à ce message en rappelant son numéro.",
  },
  en: {
    title: "Your complaint has been recorded",
    preview:
      "Written answer within 15 working days at the latest. Your reference is in the message.",
    objet: (n: string) => `Your complaint is recorded under reference ${n}.`,
    intro: "Hello,",
    delai: (d: string) =>
      `A member of our team is reviewing it and will send you a signed written answer by ${d} at the latest (15 working days).`,
    recue: (d: string) => `Received on ${d}.`,
    suite: "To add to your complaint, simply reply to this message quoting its reference.",
  },
} as const;

export const reclamationAccuseSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const numero = typeof p["numero"] === "string" ? ` ${p["numero"]}` : "";
  return locale === "fr" ? `Réclamation${numero} reçue` : `Complaint${numero} received`;
};

export function ReclamationAccuseEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  return (
    <EmailLayout famille="B" preview={t.preview} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.objet(p.numero)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.intro}
        <br />
        {t.delai(p.reponseAvant)}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.recue(p.recueLe)} {t.suite}
      </Text>
    </EmailLayout>
  );
}
