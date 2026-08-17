// Email — accusé de réception d'une demande RGPD déposée depuis le portail.
//
// ── Pourquoi ce gabarit existe ────────────────────────────────────────────
// Une demande d'accès (art. 15) ou d'effacement (art. 17) déposée depuis le
// portail stagiaire ne déclenchait RIEN : ni accusé à la personne, ni alerte
// interne. La demande pouvait dormir indéfiniment alors que le délai légal de
// réponse est d'UN MOIS à compter de la réception.
//
// L'accusé n'est pas une politesse : il matérialise la date de départ du délai
// pour les deux parties, et c'est la seule preuve que la personne détient que
// sa demande est arrivée.
//
// 🔴 Le délai annoncé (un mois) est une obligation, pas un engagement
// commercial. Ne pas l'allonger ici sans base juridique : l'article 12.3 ne
// permet une prolongation de deux mois que sur notification motivée.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** `export` (art. 15) ou `suppression` (art. 17). */
  type: string;
  /** Référence courte, à rappeler en cas d'échange. */
  reference: string;
  /** Date de dépôt, déjà formatée par l'appelant. */
  deposeeLe: string;
}

const COPY = {
  fr: {
    title: "Votre demande a bien été enregistrée",
    intro: "Bonjour,",
    objet: (t: string) =>
      t === "suppression"
        ? "Nous avons bien reçu votre demande de suppression de vos données personnelles (article 17 du RGPD)."
        : "Nous avons bien reçu votre demande d'accès à vos données personnelles (article 15 du RGPD).",
    delai:
      "Nous y répondrons dans un délai maximum d'un mois à compter de cette date, comme le prévoit la réglementation.",
    ref: (r: string, d: string) => `Référence : ${r} — déposée le ${d}.`,
    contact:
      "Pour toute question sur cette demande, répondez simplement à ce message ou écrivez à contact@axion-ia.com.",
  },
  en: {
    title: "Your request has been recorded",
    intro: "Hello,",
    objet: (t: string) =>
      t === "suppression"
        ? "We have received your request to delete your personal data (GDPR article 17)."
        : "We have received your request to access your personal data (GDPR article 15).",
    delai:
      "We will respond within one month of this date at the latest, as required by regulation.",
    ref: (r: string, d: string) => `Reference: ${r} — submitted on ${d}.`,
    contact:
      "For any question about this request, simply reply to this message or write to contact@axion-ia.com.",
  },
} as const;

export const rgpdDemandeRecueSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr"
    ? "Votre demande RGPD a bien été reçue — Axion-IA"
    : "Your GDPR request has been received — Axion-IA";

export function RgpdDemandeRecueEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.objet(p.type)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.delai}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.ref(p.reference, p.deposeeLe)}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.contact}
      </Text>
    </EmailLayout>
  );
}
