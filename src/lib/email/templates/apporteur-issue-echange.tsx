// E-mails — l'ISSUE de l'échange de 15 minutes avec un candidat apporteur
// (2026-09-28). Trois messages, trois noms de job, un seul fichier :
//   · `apporteur-issue-absent`     — « nous vous avons attendu », un nouveau créneau ;
//   · `apporteur-issue-retenu`     — bienvenue dans le réseau, le récapitulatif ;
//   · `apporteur-issue-non-retenu` — le refus courtois, porte ouverte.
//
// Ils ne partent JAMAIS seuls : Will clique l'issue sur la fiche du candidat ou
// sur la carte du rendez-vous, relit l'aperçu (ce rendu exact), puis confirme.
// La règle vit dans `features/admin-rendezvous/issue-apporteur.ts`, l'envoi
// dans `issue-apporteur-envoi.ts` (un envoi par issue et par personne).
//
// Même châssis que l'invitation : famille B (lien d'opposition dans le pied de
// page), vouvoiement, sans rangée sociale, signature du fondateur (§6.1, sans
// téléphone).
//
// ── Vocabulaire (anti-requalification) ────────────────────────────────────
// « échange », « rejoindre le réseau », « apporteur indépendant »,
// « commission », « mis à votre disposition ». JAMAIS « entretien », « poste »,
// « embauche », « recrutement », « objectifs », « horaires », « salaire »,
// « mission ». Balayé sur le rendu texte par
// `__tests__/l-issue-de-l-echange-apporteur-a-ses-trois-e-mails.spec.tsx`.
//
// ── Les montants ne s'écrivent PAS ici ────────────────────────────────────
// Ils se lisent dans le SSOT (`content/pricing.ts`) : un taux recopié à la main
// finit toujours par diverger de la page publique — c'est arrivé en août.

import { Text } from "@react-email/components";
import type { ReactElement } from "react";

import { EmailLayout, emailStyles } from "./_layout";
import { BlocKitApporteur } from "./_kit-apporteur";
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR, getCommissionById } from "@/content/pricing";
import { FENETRE_ATTRIBUTION_APPORTEUR_MOIS } from "@/lib/commercial-application/kit-apporteur";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Nom tel que saisi dans la fiche : seul le premier mot est dit. */
  contactName?: string;
  /** Absent seulement : le lien de réservation (`CALENDLY_APPORTEUR_URL`, validé à l'envoi). */
  calendlyUrl?: string;
  /** Absent seulement : « mardi 22 septembre », déjà formaté en heure de Paris. */
  dateEchange?: string;
  /** Quelques mots de Will, ajoutés en haut du message. Facultatif. */
  motPersonnel?: string;
}

type Langue = "fr" | "en";

const langue = (locale: Locale): Langue => (locale === "fr" ? "fr" : "en");

function prenomDe(p: Payload): string {
  return (typeof p.contactName === "string" ? p.contactName : "").trim().split(/\s+/)[0] ?? "";
}

function texteOuNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** « 30 % », « 30% » — la typographie de chaque langue. */
function pourcent(n: number, l: Langue): string {
  return l === "fr" ? `${n} %` : `${n}%`;
}

const PCT_AUDIT = getCommissionById("com-audit").percent ?? 0;
const PCT_INTEGRATION = getCommissionById("com-integration").percent ?? 0;

// ── Textes ───────────────────────────────────────────────────────────────

export const COPY_ISSUE_ECHANGE = {
  fr: {
    bonjour: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    absent: {
      // ≤ 45 caractères (§3.4).
      subject: "Nous vous avons attendu : un autre créneau ?",
      title: "On reprend un créneau ?",
      preview:
        "Un imprévu arrive à tout le monde : choisissez un nouveau moment pour notre échange de 15 minutes.",
      attendu: (date: string | null) =>
        date
          ? `Nous vous avons attendu pour notre échange en visio du ${date}. Aucun souci : un imprévu arrive à tout le monde.`
          : "Nous vous avons attendu pour notre échange en visio. Aucun souci : un imprévu arrive à tout le monde.",
      reprendre:
        "Si le réseau d'apporteurs d'affaires d'Axion-IA vous intéresse toujours, choisissez simplement un nouveau créneau avec le bouton ci-dessous : 15 minutes suffisent.",
      sinon:
        "Et si ce n'est plus d'actualité pour vous, vous n'avez rien à faire : nous ne vous relancerons pas.",
      cta: "Choisir un nouveau créneau",
    },
    retenu: {
      subject: "Bienvenue parmi les apporteurs d'Axion-IA",
      title: "Bienvenue dans le réseau",
      preview:
        "Merci pour notre échange : voici comment fonctionne le réseau, votre commission et les prochaines étapes.",
      merci:
        "Merci pour notre échange. Nous sommes ravis de vous accueillir dans le réseau d'apporteurs d'affaires indépendants d'Axion-IA.",
      fonctionnementTitre: "Comment ça marche",
      fonctionnement: [
        "Vous nous mettez en relation avec une entreprise qui a un besoin : formation à l'IA, audit ou intégration.",
        "Nous gérons tout le reste : rendez-vous, devis et réalisation.",
        "Vous touchez une commission.",
      ],
      commissionTitre: "Votre commission",
      formation: (eur: number) =>
        `Formation : ${eur} € HT par journée de formation au tarif public (réduite au prorata en cas de remise accordée au client).`,
      audit: (pct: string) => `Audit : ${pct} du montant HT de la facture.`,
      integration: (pct: string) => `Intégration : ${pct} du montant HT de la facture.`,
      versement: (mois: number) =>
        `Elle vous est versée dès que le client a réglé l'intégralité de sa facture. Chaque entreprise que vous nous présentez vous est attribuée pendant ${mois} mois.`,
      statutTitre: "Votre statut",
      statut:
        "Vous restez indépendant, libre de votre organisation, sans objectif ni exclusivité. Pour facturer vos commissions, il vous faut un numéro SIRET (une micro-entreprise, par exemple).",
      suiteTitre: "La suite",
      // 2026-09-28 (Will) : pas de délai promis — le contrat v2 (prorata, paiement
      // à 100 %, confirmation par l'entreprise) est relu avant toute signature.
      contrat: "Nous vous enverrons votre contrat d'apporteur, à signer en ligne.",
      espace:
        "Votre espace apporteur personnel ouvrira d'ici un mois. D'ici là, pour nous présenter une entreprise, répondez simplement à cet e-mail avec son nom et celui de votre contact.",
      kit: "Le document de présentation et le catalogue restent à votre disposition :",
    },
    nonRetenu: {
      subject: "Suite à notre échange",
      title: "Merci pour notre échange",
      preview: "Merci pour le temps que vous nous avez accordé.",
      merci:
        "Merci pour le temps que vous nous avez accordé lors de notre échange, et pour l'intérêt que vous portez à Axion-IA.",
      decision:
        "Après réflexion, nous ne donnons pas suite pour le moment à votre candidature au réseau d'apporteurs d'affaires.",
      porte:
        "Si votre situation évolue, n'hésitez pas à revenir vers nous : notre porte reste ouverte.",
      souhait: "Nous vous souhaitons sincèrement le meilleur pour la suite de vos projets.",
    },
  },
  en: {
    bonjour: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    absent: {
      subject: "Shall we pick another slot for our call?",
      title: "Shall we pick another slot?",
      preview:
        "Something unexpected happens to everyone: choose a new time for our 15-minute call.",
      attendu: (date: string | null) =>
        date
          ? `We waited for you for our video call on ${date}. No worries: something unexpected happens to everyone.`
          : "We waited for you for our video call. No worries: something unexpected happens to everyone.",
      reprendre:
        "If Axion-IA's business introducer network still interests you, simply choose a new slot with the button below: 15 minutes is enough.",
      sinon:
        "And if it is no longer relevant for you, there is nothing to do: we will not remind you.",
      cta: "Choose a new slot",
    },
    retenu: {
      subject: "Welcome to Axion-IA's introducer network",
      title: "Welcome to the network",
      preview:
        "Thank you for our call: here is how the network works, your commission and the next steps.",
      merci:
        "Thank you for our call. We are delighted to welcome you to Axion-IA's network of independent business introducers.",
      fonctionnementTitre: "How it works",
      fonctionnement: [
        "You put us in touch with a company that has a need: AI training, audit or integration.",
        "We handle everything else: meetings, quote and delivery.",
        "You earn a commission.",
      ],
      commissionTitre: "Your commission",
      formation: (eur: number) =>
        `Training: €${eur} excl. VAT per training day at the public rate (reduced pro rata if a discount is granted to the client).`,
      audit: (pct: string) => `Audit: ${pct} of the invoice amount excl. VAT.`,
      integration: (pct: string) => `Integration: ${pct} of the invoice amount excl. VAT.`,
      versement: (mois: number) =>
        `It is paid as soon as the client has settled their invoice in full. Each company you introduce to us is attributed to you for ${mois} months.`,
      statutTitre: "Your status",
      statut:
        "You remain independent, free to organise yourself, with no target and no exclusivity. To invoice your commissions, you need a French SIRET number (a micro-enterprise, for example).",
      suiteTitre: "Next steps",
      contrat: "We will send you your introducer agreement to sign online.",
      espace:
        "Your personal introducer space will open within a month. Until then, to introduce a company, simply reply to this email with its name and your contact's name.",
      kit: "The presentation document and the catalogue remain at your disposal:",
    },
    nonRetenu: {
      subject: "Following our call",
      title: "Thank you for our call",
      preview: "Thank you for the time you gave us.",
      merci:
        "Thank you for the time you gave us during our call, and for your interest in Axion-IA.",
      decision:
        "After consideration, we are not taking your application to the business introducer network further for the time being.",
      porte: "If your situation changes, feel free to come back to us: our door remains open.",
      souhait: "We sincerely wish you all the best in your future projects.",
    },
  },
} as const;

// ── Morceaux communs ─────────────────────────────────────────────────────

const intertitre: React.CSSProperties = {
  ...emailStyles.paragraphStyle,
  fontWeight: 700,
  margin: "20px 0 8px",
};

const puce: React.CSSProperties = { ...emailStyles.paragraphStyle, margin: "0 0 6px" };

/** Le mot personnel de Will, s'il y en a un — tel qu'il l'a tapé, retours à la ligne compris. */
function MotPersonnel({ p }: { p: Payload }): ReactElement | null {
  const mot = texteOuNull(p.motPersonnel);
  if (!mot) return null;
  return <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{mot}</Text>;
}

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

// ── Absent ───────────────────────────────────────────────────────────────

export const apporteurIssueAbsentSubject = (locale: Locale): string =>
  COPY_ISSUE_ECHANGE[langue(locale)].absent.subject;

export function ApporteurIssueAbsentEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const l = langue(locale);
  const t = COPY_ISSUE_ECHANGE[l];
  const calendlyUrl = texteOuNull(p.calendlyUrl);
  return (
    <EmailLayout
      famille="B"
      preview={t.absent.preview}
      title={t.absent.title}
      {...(calendlyUrl ? { cta: { label: t.absent.cta, href: calendlyUrl } } : {})}
      locale={locale}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{t.bonjour(prenomDe(p))}</Text>
      <MotPersonnel p={p} />
      <Text style={emailStyles.paragraphStyle}>{t.absent.attendu(texteOuNull(p.dateEchange))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.absent.reprendre}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.absent.sinon}</Text>
    </EmailLayout>
  );
}

// ── Retenu ───────────────────────────────────────────────────────────────

export const apporteurIssueRetenuSubject = (locale: Locale): string =>
  COPY_ISSUE_ECHANGE[langue(locale)].retenu.subject;

export function ApporteurIssueRetenuEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const l = langue(locale);
  const t = COPY_ISSUE_ECHANGE[l].retenu;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{COPY_ISSUE_ECHANGE[l].bonjour(prenomDe(p))}</Text>
      <MotPersonnel p={p} />
      <Text style={emailStyles.paragraphStyle}>{t.merci}</Text>

      <Text style={intertitre}>{t.fonctionnementTitre}</Text>
      {t.fonctionnement.map((ligne, i) => (
        <Text key={ligne} style={puce}>
          {i + 1}. {ligne}
        </Text>
      ))}

      <Text style={intertitre}>{t.commissionTitre}</Text>
      <Text style={puce}>• {t.formation(COMMISSION_FORMATION_PAR_JOURNEE_EUR)}</Text>
      <Text style={puce}>• {t.audit(pourcent(PCT_AUDIT, l))}</Text>
      <Text style={puce}>• {t.integration(pourcent(PCT_INTEGRATION, l))}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.versement(FENETRE_ATTRIBUTION_APPORTEUR_MOIS)}
      </Text>

      <Text style={intertitre}>{t.statutTitre}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.statut}</Text>

      <Text style={intertitre}>{t.suiteTitre}</Text>
      <Text style={puce}>• {t.contrat}</Text>
      <Text style={emailStyles.paragraphStyle}>• {t.espace}</Text>

      <BlocKitApporteur locale={l} intro={t.kit} />
      {/* « Une question ? Répondez à cet e-mail. » : le châssis le dit déjà,
          juste au-dessus de la signature — le répéter ferait doublon. */}
    </EmailLayout>
  );
}

// ── Non retenu ───────────────────────────────────────────────────────────

export const apporteurIssueNonRetenuSubject = (locale: Locale): string =>
  COPY_ISSUE_ECHANGE[langue(locale)].nonRetenu.subject;

export function ApporteurIssueNonRetenuEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const l = langue(locale);
  const t = COPY_ISSUE_ECHANGE[l].nonRetenu;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{COPY_ISSUE_ECHANGE[l].bonjour(prenomDe(p))}</Text>
      <MotPersonnel p={p} />
      <Text style={emailStyles.paragraphStyle}>{t.merci}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.decision}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.porte}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.souhait}</Text>
    </EmailLayout>
  );
}
