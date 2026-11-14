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
//   · SI la personne est inscrite à la lettre (amendement de Will du 24/09 :
//     adresse professionnelle, ou case cochée) : un paragraphe qui le dit, et
//     le lien « Se désabonner de la lettre » VISIBLE dans le corps — le worker
//     fait aussi du jeton l'en-tête `List-Unsubscribe` One-Click (RFC 8058).
//     Le pied de page garde le lien d'opposition de la famille B (lot 1b) ;
//   · SI elle s'était désabonnée : le bouton qui lui PROPOSE de revenir. Sa
//     demande du guide ne lève jamais son opposition ; seul ce clic le fait.
//     UN seul e-mail, jamais deux d'un coup ;
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

import { Button, Link, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";
import { GUIDE_IA_PAGES } from "@/content/guide-ia";
import { RE_CODE_GUIDE, titreGuideSur } from "@/server/guides-reseau/guide-a-livrer";
import { adressePageSuivre, TEXTE_SUIVRE_PAGE } from "@/server/guides-reseau/page-suivre";
import { CADENCE_LETTRE, TEXTE_REINSCRIPTION } from "@/content/guide-ia-formulaire";

interface Payload {
  downloadToken: string;
  /** Réinscription proposée à une personne désabonnée. */
  confirmToken?: string;
  /** Inscrite à la lettre : lien de désinscription visible + en-tête One-Click. */
  unsubscribeToken?: string;
  /** PV-1 — double accord d'une demande venue d'un réseau : bloc « confirmez d'un clic ». */
  doubleAccordToken?: string;
  /**
   * Demande venue d'un réseau (décision du 03/11/2026) : le guide et rien d'autre. Lien vers la
   * politique de confidentialité, AUCUN bloc de lettre, AUCUNE proposition d'autres envois.
   */
  reseau?: boolean;
  /**
   * Lot S2 — demande venue de la page « Recevoir le guide » : même e-mail « réseau », plus le
   * lien de désinscription (jeton d'opposition de l'adresse). Ignoré sans `reseau`.
   */
  pageGuide?: boolean;
  oppositionToken?: string;
  /** Réseau d'origine (page guide) : choisit l'adresse du lien « Suivre la page Axion IA ». */
  reseauOrigine?: string;
  reprise?: boolean;
  /**
   * PR-S2b — guide du CATALOGUE (jamais pour le guide-ia) : code `gde-…` et titre. La branche catalogue
   * du gabarit ne s'ouvre que si les DEUX sont sûrs (`catalogueDePayload`) ; sinon rendu du guide-ia.
   */
  guideCode?: unknown;
  guideTitre?: unknown;
}

/** Titre du guide du catalogue si (et seulement si) la charge porte un code ET un titre sûrs. */
function catalogueDePayload(p: Record<string, unknown>): string | null {
  const code = p["guideCode"];
  if (typeof code !== "string" || !RE_CODE_GUIDE.test(code)) return null;
  const titre = p["guideTitre"];
  return typeof titre === "string" ? titreGuideSur(titre) : null;
}

const COPY_CATALOGUE = {
  fr: {
    subject: (titre: string) => `Votre guide : ${titre}`,
    title: "Votre guide",
    body: (titre: string) => `Voici le guide que vous avez demandé : « ${titre} ».`,
    cta: "Télécharger le guide (PDF)",
  },
  en: {
    subject: (titre: string) => `Your guide: ${titre}`,
    title: "Your guide",
    body: (titre: string) => `Here is the guide you requested: « ${titre} » (in French).`,
    cta: "Download the guide (PDF)",
  },
} as const;

const COPY = {
  fr: {
    subject: `Votre guide IA entreprise (PDF, ${GUIDE_IA_PAGES} pages)`,
    preview: "Le lien de téléchargement est dans ce message, et il reste valable.",
    title: "Votre guide IA entreprise",
    reprise:
      "Vous aviez demandé à recevoir notre lettre avant la parution du guide : le voici, comme promis.",
    body: `Voici le guide que vous avez demandé : ${GUIDE_IA_PAGES} pages sur les usages concrets de l'IA en entreprise, les coûts réels, le retour sur investissement, la gouvernance et les écueils à éviter.`,
    astuce: "Commencez par la page 5 : l'essentiel en une page.",
    cta: "Télécharger le guide (PDF)",
    lettreTitre: "La lettre d'Axion-IA",
    lettreInscrite: `Vous recevrez aussi la lettre d'Axion-IA. ${CADENCE_LETTRE.fr} Pour ne pas la recevoir, un clic suffit :`,
    desinscription: "Se désabonner de la lettre",
    reinscription: TEXTE_REINSCRIPTION.fr,
    reinscriptionCta: "Recevoir à nouveau la lettre",
    note: "Vous n'avez pas fait cette demande ? Ignorez simplement ce message : vous ne recevrez rien d'autre.",
    confidentialite: "Comment vos données sont traitées : politique de confidentialité",
    noteReseau: "Vous n'avez pas fait cette demande ? Ignorez simplement ce message.",
    pageInformations:
      "Vous avez accepté de recevoir aussi des informations d'Axion-IA. Pour ne plus en recevoir, un clic suffit :",
    pageDesinscription: "Me désinscrire",
    noteInscrite:
      "Vous n'avez pas fait cette demande ? Cliquez sur « Se désabonner de la lettre » ci-dessus : vous ne recevrez rien d'autre.",
  },
  en: {
    subject: `Your enterprise AI guide (PDF, ${GUIDE_IA_PAGES} pages)`,
    preview: "The download link is in this message, and it stays valid.",
    title: "Your enterprise AI guide",
    reprise: "You asked to receive our letter before the guide came out: here it is, as promised.",
    body: `Here is the guide you requested: ${GUIDE_IA_PAGES} pages, in French, on concrete uses of AI in business, real costs, return on investment, governance and pitfalls to avoid.`,
    astuce: "Start with page 5: the essentials on one page.",
    cta: "Download the guide (PDF)",
    lettreTitre: "Axion-IA's letter",
    lettreInscrite: `You will also receive Axion-IA's letter. ${CADENCE_LETTRE.en} If you do not want it, one click is enough:`,
    desinscription: "Unsubscribe from the letter",
    reinscription: TEXTE_REINSCRIPTION.en,
    reinscriptionCta: "Receive the letter again",
    note: "Didn't request this? Just ignore this message: you will receive nothing else.",
    confidentialite: "How your data is handled: privacy policy",
    noteReseau: "Didn't request this? Just ignore this message.",
    pageInformations:
      "You agreed to also receive information from Axion-IA. To stop receiving it, one click is enough:",
    pageDesinscription: "Unsubscribe me",
    noteInscrite:
      'Didn\'t request this? Click "Unsubscribe from the letter" above: you will receive nothing else.',
  },
} as const;

export const guideIaEnvoiSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const titre = catalogueDePayload(p);
  return titre === null ? COPY[locale].subject : COPY_CATALOGUE[locale].subject(titre);
};

/** URL du lien personnel — page du site, jamais le PDF direct. */
export function urlLienGuide(baseUrl: string, downloadToken: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/guide-ia/telecharger?t=${encodeURIComponent(downloadToken)}`;
}

/** URL de désinscription de la lettre — la page porte le bouton (un POST), comme ailleurs. */
export function urlDesinscriptionLettre(baseUrl: string, locale: Locale, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${locale}/desabonnement?token=${encodeURIComponent(token)}`;
}

/** Lien de désinscription de la page « Recevoir le guide » : porte d'opposition (page + bouton). */
export function urlDesinscriptionOpposition(baseUrl: string, oppositionToken: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/unsubscribe?token=${encodeURIComponent(oppositionToken)}`;
}

/** URL de confirmation de la lettre — une page avec un bouton, jamais un GET qui confirme. */
export function urlConfirmationLettre(baseUrl: string, locale: Locale, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${locale}/confirmation/newsletter?token=${encodeURIComponent(token)}`;
}

/** URL de la politique de confidentialité (route réelle : `app/[locale]/politique-confidentialite`). */
export function urlPolitiqueConfidentialite(baseUrl: string, locale: Locale): string {
  const chemin = locale === "en" ? "en/privacy-policy" : "fr/politique-confidentialite";
  return `${baseUrl.replace(/\/+$/, "")}/${chemin}`;
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
  const p0 = payload as unknown as Payload;
  // Demande venue d'un réseau : aucun jeton de lettre n'est lu, même s'il traînait dans la charge.
  const desinscriptionPage =
    p0.reseau === true && p0.pageGuide === true && typeof p0.oppositionToken === "string";
  const p: Payload =
    p0.reseau === true
      ? {
          downloadToken: p0.downloadToken,
          reseau: true,
          ...(desinscriptionPage
            ? {
                pageGuide: true,
                oppositionToken: p0.oppositionToken!,
                ...(p0.reseauOrigine ? { reseauOrigine: p0.reseauOrigine } : {}),
              }
            : {}),
        }
      : p0;
  const t = COPY[locale];
  const titreCatalogue = catalogueDePayload(payload);
  const tc = COPY_CATALOGUE[locale];
  // Simple lien du corps (jamais une condition du guide) ; aucune variable posée → aucun bloc.
  const adresseSuivre = desinscriptionPage ? adressePageSuivre(p.reseauOrigine) : null;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  return (
    <EmailLayout
      famille="B"
      signature="equipe"
      preview={t.preview}
      title={titreCatalogue === null ? t.title : tc.title}
      // Deux liens d'ACTION dans le corps (le guide, et la lettre) : la rangée
      // de réseaux sociaux (lien de notoriété) cède sa place, comme sur les
      // e-mails du réseau d'apporteurs (§5.4).
      sansReseauxSociaux={Boolean(p.confirmToken || p.unsubscribeToken)}
      locale={locale}
    >
      {p.reprise === true ? <Text style={emailStyles.paragraphStyle}>{t.reprise}</Text> : null}
      {titreCatalogue === null ? (
        <>
          <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.astuce}</Text>
        </>
      ) : (
        <Text style={emailStyles.paragraphStyle}>{tc.body(titreCatalogue)}</Text>
      )}
      {/*
        Le bouton du guide vient JUSTE APRÈS « Commencez par la page 5 », avant
        le bloc « lettre » (décision de Will du 25/09, point 1). Le CTA du
        châssis (`cta`) est rendu APRÈS tout le corps : il aurait placé le
        guide sous « Se désabonner » et sous « Recevoir à nouveau la lettre ».
        Il est donc rendu ici, avec le même style et la même classe.

        ⛔ Le lien est PERSONNEL : aucun repli en clair (ce que `ctaSecret`
        garantissait avec le CTA du châssis). L'afficher en ferait une adresse
        copiable et transférable, qui compterait comme « ouvert » le clic d'un
        autre. Verrou : `ip-en-clair-et-gabarit.spec.ts` (une seule occurrence).
      */}
      <Section style={{ textAlign: "center", margin: "30px 0 8px 0" }}>
        <Button
          href={urlLienGuide(baseUrl, p.downloadToken)}
          style={emailStyles.ctaStyle}
          className="ax-cta"
        >
          {titreCatalogue === null ? t.cta : tc.cta} &nbsp;→
        </Button>
      </Section>
      {p.unsubscribeToken ? (
        <Section style={{ margin: "8px 0 4px 0" }}>
          <Text style={{ ...emailStyles.paragraphStyle, fontWeight: 700 }}>{t.lettreTitre}</Text>
          <Text style={emailStyles.paragraphStyle}>
            {t.lettreInscrite}{" "}
            <Link
              href={urlDesinscriptionLettre(baseUrl, locale, p.unsubscribeToken)}
              style={{ color: emailStyles.COLORS.accent, textDecoration: "underline" }}
            >
              {t.desinscription}
            </Link>
          </Text>
        </Section>
      ) : p.confirmToken ? (
        <Section style={{ margin: "8px 0 4px 0" }}>
          <Text style={{ ...emailStyles.paragraphStyle, fontWeight: 700 }}>{t.lettreTitre}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.reinscription}</Text>
          <Button
            href={urlConfirmationLettre(baseUrl, locale, p.confirmToken)}
            style={boutonSecondaire}
            className="ax-cta"
          >
            {t.reinscriptionCta}
          </Button>
        </Section>
      ) : null}
      {desinscriptionPage ? (
        <Section style={{ margin: "8px 0 4px 0" }}>
          <Text style={emailStyles.paragraphStyle}>
            {t.pageInformations}{" "}
            <Link
              href={urlDesinscriptionOpposition(baseUrl, p.oppositionToken!)}
              style={{ color: emailStyles.COLORS.accent, textDecoration: "underline" }}
            >
              {t.pageDesinscription}
            </Link>
          </Text>
        </Section>
      ) : null}
      {adresseSuivre ? (
        <Section style={{ margin: "8px 0 4px 0" }}>
          <Text style={emailStyles.paragraphStyle}>
            <Link
              href={adresseSuivre}
              rel="noopener noreferrer"
              style={{ color: emailStyles.COLORS.accent, textDecoration: "underline" }}
            >
              {TEXTE_SUIVRE_PAGE}
            </Link>
          </Text>
        </Section>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {p.reseau === true ? t.noteReseau : p.unsubscribeToken ? t.noteInscrite : t.note}
      </Text>
      {p.reseau === true ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          <Link
            href={urlPolitiqueConfidentialite(baseUrl, locale)}
            style={{ color: emailStyles.COLORS.accent, textDecoration: "underline" }}
          >
            {t.confidentialite}
          </Link>
        </Text>
      ) : null}
    </EmailLayout>
  );
}
