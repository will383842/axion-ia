// Email — réponse écrite de l'organisme à une réclamation (chantier QNC, L09).
//
// ── Ce que ce message engage ──────────────────────────────────────────────
// C'est la RÉPONSE de l'organisme (indicateur 31) : elle est écrite par une
// personne, SIGNÉE de son nom et de sa qualité, et ne part qu'après
// validation dans la corbeille « E-mails à valider » (`exigerValidation`).
// Le texte arrive tel que la personne l'a écrit dans la console ; il est
// aussi conservé, mot pour mot, dans l'étape « réponse » du journal
// `reclamation_etapes` — c'est cette copie qui fait foi devant l'auditeur.
//
// Le réexamen est toujours possible : le message le dit, et dit comment.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Numéro AXI-REC-AAAA-NNN. */
  numero: string;
  /** La réponse, telle qu'écrite dans la console. */
  reponse: string;
  /** Nom réel de la personne qui signe pour l'organisme. */
  signataireNom: string;
  /** Sa qualité (« Responsable qualité », « Dirigeant »…). */
  signataireQualite: string;
  /** Raison sociale de l'organisme. */
  organisme: string;
}

const COPY = {
  fr: {
    title: "Réponse à votre réclamation",
    preview: "La réponse écrite de l'organisme, signée. Un réexamen reste possible.",
    objet: (n: string) => `Voici la réponse de l'organisme à votre réclamation ${n}.`,
    signature: (o: string) => `Pour ${o},`,
    reexamen:
      "Si cette réponse ne vous satisfait pas, vous pouvez demander un réexamen : répondez simplement à ce message en expliquant pourquoi. Votre demande sera examinée à nouveau, par écrit.",
  },
  en: {
    title: "Answer to your complaint",
    preview: "Our signed written answer. A review remains possible.",
    objet: (n: string) => `Here is our answer to your complaint ${n}.`,
    signature: (o: string) => `On behalf of ${o},`,
    reexamen:
      "If this answer does not satisfy you, you may ask for a review: simply reply to this message explaining why. Your request will be examined again, in writing.",
  },
} as const;

export const reclamationReponseSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const numero = typeof p["numero"] === "string" ? ` ${p["numero"]}` : "";
  return locale === "fr"
    ? `Réclamation${numero} : notre réponse`
    : `Complaint${numero}: our answer`;
};

export function ReclamationReponseEmail({
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
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{p.reponse}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.signature(p.organisme)}
        <br />
        {p.signataireNom}, {p.signataireQualite}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.reexamen}
      </Text>
    </EmailLayout>
  );
}
