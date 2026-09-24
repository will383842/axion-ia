// Email — « Votre guide » : le guide IA entreprise, envoyé à la demande
// (lot L2, 2026-09-24).
//
// ── POURQUOI CE GABARIT ─────────────────────────────────────────────────────
// Décision n° 1 de Will : le guide part TOUT DE SUITE, sans confirmation
// préalable. Jusqu'ici, AUCUN e-mail ne contenait le guide : il ne se
// téléchargeait qu'une fois, sur la page de confirmation de la lettre, et la
// personne qui fermait l'onglet ne pouvait plus le retrouver.
//
// ── CE QU'IL PORTE ──────────────────────────────────────────────────────────
//   · le lien PERSONNEL `/api/guide-ia/telecharger?t=…` — une page du site avec
//     un bouton, et non le PDF direct : les antivirus des messageries
//     d'entreprise (Safe Links, prévisualisation) suivent les liens d'un GET,
//     et seul le clic sur le bouton (un POST) vaut « guide ouvert » ;
//   · SI la case « lettre » était cochée et l'adresse pas encore confirmée : le
//     bouton « Confirmer l'abonnement à la lettre ». UN seul e-mail pour les
//     deux, jamais deux e-mails d'un coup ;
//   · SI `reprise` : la phrase pour un abonné inscrit avant la parution du guide
//     (envoi unique, lot L7).
//
// ── SA NATURE ───────────────────────────────────────────────────────────────
// Famille B (livraison, cycle de vie). TRANSACTIONNEL : il répond à une
// demande (RGPD 6.1.b), part depuis `contact@` par ZeptoMail, sans le drapeau
// `marketing` — ZeptoMail interdit la lettre d'information, pas la livraison
// d'un document demandé. Aucun appel commercial appuyé dans le corps.
//
// ⛔ Tous les textes de ce gabarit sont PUBLICS : validés par Will avant envoi.

import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";
import { GUIDE_IA_PAGES } from "@/content/guide-ia";
import { CADENCE_LETTRE } from "@/content/guide-ia-formulaire";

interface Payload {
  downloadToken: string;
  confirmToken?: string;
  reprise?: boolean;
}

const COPY = {
  fr: {
    subject: `Votre guide IA entreprise (PDF, ${GUIDE_IA_PAGES} pages)`,
    preview: "Le lien de téléchargement est dans ce message, et il reste valable.",
    title: "Votre guide IA entreprise",
    reprise:
      "Vous vous étiez inscrit à notre lettre avant la parution du guide : le voici, comme promis.",
    body: `Voici le guide que vous avez demandé : ${GUIDE_IA_PAGES} pages sur les usages concrets de l'IA en entreprise, les coûts réels, le retour sur investissement, la gouvernance et les écueils à éviter.`,
    astuce: "Commencez par la page 5 : l'essentiel en une page.",
    cta: "Télécharger le guide (PDF)",
    lettreTitre: "Votre inscription à la lettre",
    lettre: `Vous avez aussi demandé à recevoir la lettre IA d'Axion-IA. ${CADENCE_LETTRE.fr} Confirmez d'un clic : sans cette confirmation, vous ne la recevrez pas.`,
    lettreCta: "Confirmer l'abonnement à la lettre",
    note: "Vous n'avez pas fait cette demande ? Ignorez simplement ce message : vous ne recevrez rien d'autre.",
  },
  en: {
    subject: `Your enterprise AI guide (PDF, ${GUIDE_IA_PAGES} pages)`,
    preview: "The download link is in this message, and it stays valid.",
    title: "Your enterprise AI guide",
    reprise: "You subscribed to our letter before the guide came out: here it is, as promised.",
    body: `Here is the guide you requested: ${GUIDE_IA_PAGES} pages, in French, on concrete uses of AI in business, real costs, return on investment, governance and pitfalls to avoid.`,
    astuce: "Start with page 5: the essentials on one page.",
    cta: "Download the guide (PDF)",
    lettreTitre: "Your letter subscription",
    lettre: `You also asked to receive Axion-IA's AI letter. ${CADENCE_LETTRE.en} Confirm with one click: without it, you will not receive it.`,
    lettreCta: "Confirm my letter subscription",
    note: "Didn't request this? Just ignore this message: you will receive nothing else.",
  },
} as const;

export const guideIaEnvoiSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  COPY[locale].subject;

/** URL du lien personnel — page du site, jamais le PDF direct. */
export function urlLienGuide(baseUrl: string, downloadToken: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/guide-ia/telecharger?t=${encodeURIComponent(downloadToken)}`;
}

/** URL de confirmation de la lettre — une page avec un bouton, jamais un GET qui confirme. */
export function urlConfirmationLettre(baseUrl: string, locale: Locale, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${locale}/confirmation/newsletter?token=${encodeURIComponent(token)}`;
}

const boutonSecondaire: React.CSSProperties = {
  ...emailStyles.ctaStyle,
  backgroundColor: "#ffffff",
  backgroundImage: "none",
  color: emailStyles.COLORS.accent,
  border: `2px solid ${emailStyles.COLORS.accent}`,
  boxShadow: "none",
};

export function GuideIaEnvoiEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  return (
    <EmailLayout
      famille="B"
      signature="equipe"
      preview={t.preview}
      title={t.title}
      cta={{ label: t.cta, href: urlLienGuide(baseUrl, p.downloadToken) }}
      // Le lien est PERSONNEL : l'afficher en clair en ferait une adresse
      // copiable et transférable, qui compterait comme « ouvert » le clic d'un
      // autre. Le bouton reste bulletproof.
      ctaSecret
      // Avec le bouton de confirmation de la lettre, le message porte deux
      // liens d'ACTION : la rangée de réseaux sociaux (lien de notoriété) cède
      // sa place, comme sur les e-mails du réseau d'apporteurs (§5.4).
      sansReseauxSociaux={Boolean(p.confirmToken)}
      locale={locale}
    >
      {p.reprise === true ? <Text style={emailStyles.paragraphStyle}>{t.reprise}</Text> : null}
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.astuce}</Text>
      {p.confirmToken ? (
        <Section style={{ margin: "8px 0 4px 0" }}>
          <Text style={{ ...emailStyles.paragraphStyle, fontWeight: 700 }}>{t.lettreTitre}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.lettre}</Text>
          <Button
            href={urlConfirmationLettre(baseUrl, locale, p.confirmToken)}
            style={boutonSecondaire}
            className="ax-cta"
          >
            {t.lettreCta}
          </Button>
        </Section>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.note}
      </Text>
    </EmailLayout>
  );
}
