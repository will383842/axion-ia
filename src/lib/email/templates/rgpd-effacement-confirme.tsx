// Email — confirmation qu'un effacement RGPD (art. 17) a été exécuté.
//
// ── Pourquoi ce gabarit existe, et pourquoi il est URGENT ─────────────────
// L'effacement en libre-service supprimait les données sans jamais rien
// confirmer à la personne. Deux conséquences :
//
//   1. Elle n'avait AUCUNE preuve que sa demande avait abouti.
//   2. Son adresse étant anonymisée dans la foulée, plus rien ne permettait de
//      la recontacter ensuite. L'omission était donc DÉFINITIVE — impossible à
//      rattraper a posteriori, même en le voulant.
//
// 🔴 Cet e-mail est le dernier traitement fondé sur la demande initiale : il
// doit être mis en file AVANT que l'adresse ne disparaisse de toute autre
// source. Elle ne survit que dans la charge utile de la tâche d'envoi.
//
// Le détail de ce qui a été effacé n'est pas décoratif : l'article 19 impose
// d'informer la personne de la portée réelle de l'effacement, y compris de ce
// qui est conservé au titre d'une obligation légale.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Date d'exécution, déjà formatée par l'appelant. */
  effectueLe: string;
  /** Nombre de demandes de contact anonymisées. */
  demandes: number;
  /** Inscriptions newsletter supprimées. */
  newsletter: number;
  /** Conversations du chatbot supprimées. */
  conversations: number;
  /**
   * 🔴 `D5-5-03` (2026-08-20) — candidatures supprimées, FICHIERS COMPRIS.
   *
   * Cette énumération se donne pour exhaustive : elle est la PREUVE que la
   * personne conserve. Elle omettait la candidature — donc le CV, la photo et le
   * téléphone, les données les plus sensibles du dépôt. Quelqu'un pouvait croire
   * son dossier parti alors qu'il restait en base.
   */
  candidatures: number;
  /**
   * 🔴 2026-08-28 — les rendez-vous entrent dans l'énumération.
   *
   * Même motif que la candidature ci-dessus, une table plus loin. Une
   * réservation d'appel porte le nom, l'adresse, le TÉLÉPHONE, les réponses
   * libres au formulaire — et les liens qui permettent d'annuler le rendez-vous
   * sans authentification. La table n'était dans aucun des trois mécanismes
   * RGPD, et cette liste, qui se donne pour exhaustive, ne la mentionnait pas.
   */
  appels: number;
}

const COPY = {
  fr: {
    title: "Vos données ont été effacées",
    intro: "Bonjour,",
    fait: (d: string) =>
      `Votre demande d'effacement (article 17 du RGPD) a été exécutée le ${d}. Ce message en est la confirmation ; conservez-le, il constitue votre preuve.`,
    detail: "Ont été traités :",
    ligne: (dem: number, nl: number, conv: number, cand: number, rdv: number) =>
      `${dem} demande(s) de contact anonymisée(s), ${nl} inscription(s) à la lettre d'information supprimée(s), ${conv} conversation(s) avec l'assistant supprimée(s), ${cand} candidature(s) supprimée(s) avec leur CV et leur photo, ${rdv} rendez-vous anonymisé(s) avec leurs coordonnées et leurs liens d'annulation.`,
    conserve:
      "Certaines écritures restent conservées sous forme anonymisée : les pièces comptables et le registre des traitements, que la loi nous impose de garder. Elles ne permettent plus de vous identifier.",
    contact:
      "Si vous estimez que cet effacement est incomplet, écrivez à contact@axion-ia.com. Vous pouvez également saisir la CNIL.",
    dernier:
      "Ce message est le dernier que vous recevrez de notre part : votre adresse ne figure plus dans nos fichiers.",
  },
  en: {
    title: "Your data has been erased",
    intro: "Hello,",
    fait: (d: string) =>
      `Your erasure request (GDPR article 17) was carried out on ${d}. This message is your confirmation — keep it, it is your proof.`,
    detail: "The following were processed:",
    ligne: (dem: number, nl: number, conv: number, cand: number, rdv: number) =>
      `${dem} contact request(s) anonymised, ${nl} newsletter subscription(s) deleted, ${conv} assistant conversation(s) deleted, ${cand} job application(s) deleted along with their CV and photo, ${rdv} appointment(s) anonymised along with their contact details and cancellation links.`,
    conserve:
      "Some records are kept in anonymised form: accounting documents and the processing register, which the law requires us to retain. They can no longer identify you.",
    contact:
      "If you believe this erasure is incomplete, write to contact@axion-ia.com. You may also contact your supervisory authority.",
    dernier:
      "This is the last message you will receive from us: your address is no longer in our files.",
  },
} as const;

export const rgpdEffacementConfirmeSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr"
    ? "Confirmation : vos données ont été effacées — Axion-IA"
    : "Confirmed: your data has been erased — Axion-IA";

export function RgpdEffacementConfirmeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  return (
    <EmailLayout preview={t.title} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.intro}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.fait(p.effectueLe)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.detail}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.ligne(p.demandes, p.newsletter, p.conversations, p.candidatures, p.appels)}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.conserve}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.contact}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.dernier}
      </Text>
    </EmailLayout>
  );
}
