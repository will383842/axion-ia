// E-mail CLIENT — relance 1, 2 ou 3 du questionnaire avant audit (2026-10-26).
//
// Enfilé UNIQUEMENT par le balayage du worker (`features/questionnaire-preaudit/suivi.ts`), et
// seulement si Will a coché « Programmer les 3 relances » en cliquant « Envoyer » : son clic
// couvre l'invitation ET ses relances. Arrêt dès la réponse du dirigeant, par le lien « Ne plus
// recevoir de rappel » (`unsubscribeHref`, page à POST), par Will, ou par l'opposition globale
// (`GABARITS_SOLLICITATION_SOUMIS_A_OPPOSITION`). Lien à jeton : `ctaSecret`.
// Textes : plan « e-mails, relances, Telegram » §7 E2 à E4, mot pour mot.
//
// ⛔ Jamais « J'aide », « Aucun gain garanti », « Grenoble » (ordres de Will).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import {
  BOUTON_INVITATION,
  NOTE_LIEN_PERSONNEL,
  apresLaDate,
  objetOuRepli,
  SignatureCorps,
} from "./questionnaire-avant-audit";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  rang?: number;
  prenom?: string;
  lien?: string;
  /** La page « Ne plus recevoir de rappel » (jeton d'arrêt, distinct du jeton du questionnaire). */
  lienArret?: string;
  auditTexte?: string;
  auditCourt?: string;
  lieuAudit?: string;
  brouillonEnCours?: boolean;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const rangDe = (v: unknown): 1 | 2 | 3 => (v === 2 ? 2 : v === 3 ? 3 : 1);

export const LIBELLE_ARRET_RAPPELS = "Ne plus recevoir de rappel";

const OBJETS: Readonly<Record<1 | 2 | 3, { standard: string; date?: (c: string) => string }>> = {
  1: {
    standard: "Votre questionnaire vous attend",
    date: (c) => `${c} : votre questionnaire vous attend`,
  },
  2: { standard: "Votre questionnaire : où en êtes-vous ?" },
  3: {
    standard: "Dernier rappel : votre questionnaire",
    date: (c) => `Avant le ${c} : dernier rappel`,
  },
};

export const questionnaireAvantAuditRelanceSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Payload;
  const o = OBJETS[rangDe(p.rang)];
  const court = texte(p.auditCourt);
  return court === "" || o.date === undefined
    ? o.standard
    : objetOuRepli(o.date(court), o.standard);
};

export function QuestionnaireAvantAuditRelanceEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const rang = rangDe(p.rang);
  const prenom = texte(p.prenom);
  const lien = texte(p.lien);
  const lienArret = texte(p.lienArret);
  const auditTexte = texte(p.auditTexte);
  const auditCourt = texte(p.auditCourt);
  const lieu = texte(p.lieuAudit);
  const brouillon = p.brouillonEnCours === true;
  const bouton = brouillon ? "Reprendre mon questionnaire" : BOUTON_INVITATION;
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";

  const entete = {
    1: {
      preview: "Chaque réponse nous aide à préparer un audit à votre mesure.",
      title: "Votre questionnaire vous attend",
    },
    2: {
      preview: "Vous pouvez y répondre en plusieurs fois, à votre rythme.",
      title: "Où en êtes-vous ?",
    },
    3: {
      preview: "Un dernier message, puis nous en parlerons ensemble.",
      title: "Un dernier mot sur votre questionnaire",
    },
  }[rang];

  return (
    <EmailLayout
      famille="C"
      preview={entete.preview}
      title={entete.title}
      {...(lien ? { cta: { label: bouton, href: lien } } : {})}
      ctaSecret
      apresCta={<SignatureCorps />}
      {...(lien ? { ctaNote: NOTE_LIEN_PERSONNEL } : {})}
      {...(lienArret
        ? { unsubscribeHref: lienArret, unsubscribeLabel: LIBELLE_ARRET_RAPPELS }
        : {})}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour}</Text>
      {rang === 1 ? (
        <>
          <Text style={emailStyles.paragraphStyle}>
            Je reviens vers vous au sujet du questionnaire qui prépare notre audit
            {auditTexte ? ` du ${auditTexte}` : ""}.
          </Text>
          {brouillon ? (
            <Text style={emailStyles.paragraphStyle}>
              Vous l&apos;avez déjà commencé : vous reprendrez exactement là où vous vous étiez
              arrêté.
            </Text>
          ) : null}
          <Text style={emailStyles.paragraphStyle}>
            Vos réponses nous permettent de cibler ce qui compte pour vous : les tâches à
            simplifier, le temps à récupérer, les pistes pour faire grandir votre activité.
          </Text>
        </>
      ) : rang === 2 ? (
        <>
          <Text style={emailStyles.paragraphStyle}>
            Avez-vous pu ouvrir le questionnaire qui prépare notre audit ? Vous pouvez y répondre en
            plusieurs fois : ce que vous avez saisi est gardé d&apos;une fois sur l&apos;autre.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            Si vous travaillez avec une équipe, vos collaborateurs peuvent aussi répondre de leur
            côté, avec le lien que le questionnaire vous propose : leur regard sur le terrain rend
            l&apos;audit plus juste.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            Plus nous connaissons votre quotidien, plus nos propositions seront concrètes.
          </Text>
        </>
      ) : (
        <>
          <Text style={emailStyles.paragraphStyle}>
            C&apos;est mon dernier rappel au sujet du questionnaire.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            {auditTexte ? `Notre audit a lieu le ${auditTexte}${apresLaDate(lieu)}. ` : ""}
            Si vous pouvez le remplir avant, nous arriverons avec une vision déjà claire de votre
            organisation, et le temps passé ensemble ira à l&apos;essentiel : vos priorités.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            Sinon, aucune inquiétude : nous en parlerons de vive voix
            {auditCourt ? ` le ${auditCourt}` : ""}.
          </Text>
        </>
      )}
    </EmailLayout>
  );
}
