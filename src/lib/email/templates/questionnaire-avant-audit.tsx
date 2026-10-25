// E-mail CLIENT — l'invitation au questionnaire avant audit (2026-10-24, réécrit le 2026-10-26).
//
// Envoyé UNIQUEMENT par clic de Will (« Envoyer » sur la rencontre, après aperçu de cet e-mail
// exact) : aucun chemin automatique. Le lien est un SECRET (jeton) propre au client : il n'est
// pas imprimé en clair (`ctaSecret`). Vouvoiement, mots simples, aucune durée de remplissage,
// aucune promesse. Textes : plan « e-mails, relances, Telegram » §7 E1, mot pour mot.
//
// Payload RÉTRO-COMPATIBLE : `{ prenom?, lien? }` comme avant, plus `auditTexte`, `auditCourt`,
// `lieuAudit` facultatifs et PRÉ-FORMATÉS par l'appelant (aucun calcul de fuseau au rendu).
//
// ⛔ Jamais « J'aide », « Aucun gain garanti », « Grenoble » (ordres de Will).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { OBJET_MAX } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: string;
  /** Le lien secret du questionnaire. */
  lien?: string;
  /** « vendredi 6 novembre à 8 h 30 » */
  auditTexte?: string;
  /** « 6 novembre » */
  auditCourt?: string;
  /** « dans vos locaux » (texte de Will) */
  lieuAudit?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** L'objet daté s'il tient dans `OBJET_MAX`, sinon l'objet standard. */
export const objetOuRepli = (date: string, standard: string): string =>
  date.length <= OBJET_MAX ? date : standard;

export const OBJET_INVITATION = "Préparons votre audit : votre questionnaire";
export const BOUTON_INVITATION = "Accéder au questionnaire";
export const NOTE_LIEN_PERSONNEL = "Ce lien vous est personnel : merci de ne pas le transférer.";

export const questionnaireAvantAuditSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const court = texte((payload as Payload).auditCourt);
  return court === ""
    ? OBJET_INVITATION
    : objetOuRepli(`Audit du ${court} : votre questionnaire`, OBJET_INVITATION);
};

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
  const auditTexte = texte(p.auditTexte);
  const lieu = texte(p.lieuAudit);
  const prevu = auditTexte === "" ? "" : `, prévu le ${auditTexte}${lieu ? ` ${lieu}` : ""},`;
  return (
    <EmailLayout
      famille="C"
      preview="Vos réponses nous permettent d'arriver avec des pistes concrètes pour votre entreprise."
      title="Préparons votre audit ensemble"
      {...(lien ? { cta: { label: BOUTON_INVITATION, href: lien } } : {})}
      ctaSecret
      {...(lien ? { ctaNote: NOTE_LIEN_PERSONNEL } : {})}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</Text>
      <Text style={emailStyles.paragraphStyle}>
        Merci pour notre échange. Pour préparer notre audit{prevu} nous avons préparé un
        questionnaire en ligne, pensé pour votre entreprise.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Il nous aide à comprendre votre quotidien : vos tâches, vos outils, ce qui vous prend du
        temps. Plus vos réponses sont complètes, plus l&apos;audit sera précis, et plus les pistes
        que nous vous présenterons seront utiles : du temps gagné, une meilleure rentabilité, de
        quoi développer votre chiffre d&apos;affaires.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Vous pouvez faire une pause et revenir plus tard avec ce même bouton : ce que vous avez déjà
        saisi vous attend.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Si vous travaillez avec une équipe, le questionnaire vous proposera un lien à transmettre à
        vos collaborateurs : chacun répond de son côté.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        À très bientôt,
        <br />
        Williams Jullin, Axion-IA
      </Text>
    </EmailLayout>
  );
}
