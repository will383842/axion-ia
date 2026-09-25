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
  /**
   * Lot L6 (2026-09-25) — demandes du guide IA supprimées (`guide_requests` :
   * adresse en clair, dates d'envoi et de clic). L'effacement les supprimait
   * depuis L2, mais cette liste, qui se donne pour exhaustive, les taisait.
   * Facultatif : une tâche mise en file par l'ancienne version de la route,
   * pendant le déploiement, n'en porte pas — le segment est alors OMIS (écrire
   * « 0 » affirmerait qu'on a cherché et rien trouvé, ce que l'ancienne route
   * ne disait pas).
   */
  demandesGuide?: number;
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
    // Le pré-en-tête dit ce que l'objet ne dit pas : ce message EST la preuve,
    // et c'est le dernier. Deux informations qui décident de le garder.
    preview: "Conservez ce message : il vaut preuve. C'est aussi le dernier que vous recevrez.",
    intro: "Bonjour,",
    fait: (d: string) =>
      `Votre demande d'effacement (article 17 du RGPD) a été exécutée le ${d}. Ce message en est la confirmation ; conservez-le, il constitue votre preuve.`,
    detail: "Ont été traités :",
    ligne: (
      dem: number,
      nl: number,
      gd: number | undefined,
      conv: number,
      cand: number,
      rdv: number,
    ) =>
      [
        `${dem} demande(s) de contact anonymisée(s)`,
        `${nl} inscription(s) à la lettre d'information supprimée(s)`,
        ...(gd === undefined ? [] : [`${gd} demande(s) du guide IA supprimée(s)`]),
        `${conv} conversation(s) avec l'assistant supprimée(s)`,
        `${cand} candidature(s) supprimée(s) avec leur CV et leur photo`,
        `${rdv} rendez-vous anonymisé(s) avec leurs coordonnées et leurs liens d'annulation`,
      ].join(", ") + ".",
    // Texte validé par Will (lot L6, relecture du 2026-09-25). L'ancien disait
    // « sous forme anonymisée » (c'est une pseudonymisation) et prêtait à la loi
    // la conservation du « registre des traitements » (qui ne contient aucune
    // donnée sur la personne) : deux affirmations fausses dans une preuve.
    conserve:
      "Certaines traces sont conservées sans votre adresse : les pièces comptables que la loi nous impose de garder, le journal de nos envois, et la preuve de ce que vous aviez accepté ou refusé (texte présenté, date). Votre adresse y est remplacée par une empreinte, qui ne permet pas de la retrouver ; elle sert seulement à ne plus vous écrire si votre adresse nous parvenait de nouveau.",
    contact:
      "Si vous estimez que cet effacement est incomplet, écrivez à contact@axion-ia.com. Vous pouvez également saisir la CNIL.",
    // « votre adresse ne figure plus dans nos fichiers » est RETIRÉ (L6) : ce
    // message-ci est journalisé à son envoi, adresse comprise (`email_logs`).
    dernier: "Ce message est le dernier que vous recevrez de notre part.",
  },
  en: {
    title: "Your data has been erased",
    preview: "Keep this message: it is your proof. It is also the last you will receive.",
    intro: "Hello,",
    fait: (d: string) =>
      `Your erasure request (GDPR article 17) was carried out on ${d}. This message is your confirmation — keep it, it is your proof.`,
    detail: "The following were processed:",
    ligne: (
      dem: number,
      nl: number,
      gd: number | undefined,
      conv: number,
      cand: number,
      rdv: number,
    ) =>
      [
        `${dem} contact request(s) anonymised`,
        `${nl} newsletter subscription(s) deleted`,
        ...(gd === undefined ? [] : [`${gd} AI guide request(s) deleted`]),
        `${conv} assistant conversation(s) deleted`,
        `${cand} job application(s) deleted along with their CV and photo`,
        `${rdv} appointment(s) anonymised along with their contact details and cancellation links`,
      ].join(", ") + ".",
    conserve:
      "Some records are kept without your address: accounting documents that the law requires us to retain, the log of the messages we sent, and the proof of what you had accepted or refused (text shown, date). In them, your address is replaced by a fingerprint from which it cannot be recovered; its only use is to stop us writing to you should your address reach us again.",
    contact:
      "If you believe this erasure is incomplete, write to contact@axion-ia.com. You may also contact your supervisory authority.",
    dernier: "This is the last message you will receive from us.",
  },
} as const;

export const rgpdEffacementConfirmeSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr"
    ? "Confirmation : vos données ont été effacées"
    : "Confirmed: your data has been erased";

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
    <EmailLayout famille="A" preview={t.preview} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.intro}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.fait(p.effectueLe)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.detail}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.ligne(
          p.demandes,
          p.newsletter,
          typeof p.demandesGuide === "number" ? p.demandesGuide : undefined,
          p.conversations,
          p.candidatures,
          p.appels,
        )}
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
