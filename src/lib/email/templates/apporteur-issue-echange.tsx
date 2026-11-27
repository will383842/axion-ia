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
import { ligneAPreparer } from "./_bareme-apporteur";
import { lienDeReservationDuSite } from "@/lib/calendly/lien-du-site";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Nom tel que saisi dans la fiche : seul le premier mot est dit. */
  contactName?: string;
  /** Absent seulement : le lien de réservation (`CALENDLY_APPORTEUR_URL`, validé à l'envoi). */
  calendlyUrl?: string;
  /** Retenu seulement : le lien personnel du dossier en ligne (démarrage manuel, 2026-10-05). */
  dossierUrl?: string;
  /** Retenu seulement : le dossier est déjà signé (à vérifier ou contresigné). */
  dossierSigne?: boolean;
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
        "Merci pour notre échange : votre dossier à compléter et vos documents à jour, en un clic.",
      merci:
        "Merci pour notre échange. Nous sommes ravis de vous accueillir dans le réseau d'apporteurs d'affaires indépendants d'Axion-IA.",
      fonctionnementTitre: "Comment ça marche",
      fonctionnement: [
        "Vous nous mettez en relation avec une entreprise qui a un besoin : formation à l'IA, audit ou intégration.",
        "L'entreprise vous est réservée 60 jours à partir de votre déclaration. Elle vous est attribuée dès son premier rendez-vous avec nous, s'il a été pris pendant ces 60 jours (même s'il a lieu après ; un rendez-vous annulé par Axion-IA compte comme tenu), ou dès qu'elle signe une commande pendant ces 60 jours ; elle est alors commissionnée pendant la durée prévue à compter de ce rendez-vous ou de cette commande. Nous gérons tout le reste : rendez-vous, devis et réalisation.",
        // Seul le montant Journée IA est cité (décision de Will du 27/11/2026) ; le reste vit dans le contrat et la fiche des commissions.
        "Vous touchez une commission quand l'entreprise a payé l'intégralité de sa commande. Pour une Journée IA : 500 € HT par journée, au prorata du prix effectivement payé. Pour nos autres prestations, les montants sont dans votre contrat et dans la fiche des commissions ci-dessous ; votre contrat fait foi.",
      ],
      statutTitre: "Votre statut",
      statut:
        "Vous restez indépendant, libre de votre organisation, sans objectif ni exclusivité. Pour signer votre contrat et facturer vos commissions, il vous faut un numéro SIREN (une micro-entreprise, par exemple).",
      suiteTitre: "La suite",
      // 2026-09-28 (Will) : pas de délai promis — le contrat v2 (prorata, paiement
      // à 100 %, confirmation par l'entreprise) est relu avant toute signature.
      contrat: "Nous vous enverrons votre contrat d'apporteur, à signer en ligne.",
      // 2026-10-05 (Will) : plus de date promise pour l'espace en ligne.
      espace:
        "Dès votre contrat signé, vous pourrez nous présenter des entreprises depuis votre espace, avec le formulaire « Déclarer une entreprise ».",
      documentsTitre: "Vos documents, toujours à jour",
      documentsIntro:
        "Ces liens ouvrent toujours la dernière version. Ils vous sont personnels : gardez cet e-mail.",
      documents: [
        {
          chemin: "/fiche-commissions",
          libelle: "La fiche des commissions",
          detail: "ce que vous touchez, prestation par prestation, et quand c'est versé",
        },
        {
          chemin: "/livret",
          libelle: "Le livret d'accueil",
          detail: "le réseau et son fonctionnement",
        },
        {
          chemin: "/guide",
          libelle: "Le guide de démarrage",
          detail: "des idées pour bien commencer, à votre rythme",
        },
        {
          chemin: "/documents",
          libelle: "Mon espace apporteur",
          detail: "votre dossier, votre contrat et tous vos documents au même endroit",
        },
      ],
      // 2026-10-05 : quand la console ouvre le dossier en ligne, le lien part avec cet e-mail.
      dossier:
        "Première étape : complétez votre dossier et signez votre contrat en ligne avec le bouton ci-dessous (environ 10 minutes). Nous le contresignons ensuite, après vérification.",
      ctaDossier: "Compléter mon dossier et signer mon contrat",
      // 07/10 : Bienvenue à un dossier DÉJÀ signé — plus de « Première étape : complétez… ».
      dossierSigne:
        "Votre dossier et votre contrat signé nous sont déjà parvenus : nous les vérifions, et vous recevrez votre contrat contresigné par e-mail.",
      ctaDossierSigne: "Voir mon dossier",
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
        "Thank you for our call: your file to complete and your up-to-date documents, in one click.",
      merci:
        "Thank you for our call. We are delighted to welcome you to Axion-IA's network of independent business introducers.",
      fonctionnementTitre: "How it works",
      fonctionnement: [
        "You put us in touch with a company that has a need: AI training, audit or integration.",
        "The company is reserved for you for 60 days from your declaration. It is attributed to you as soon as its first meeting with us is booked during those 60 days (even if it takes place later; a meeting cancelled by Axion-IA counts as held), or as soon as it signs an order during those 60 days; it is then commissioned for the agreed period from that meeting or that order. We handle everything else: meetings, quote and delivery.",
        "You earn a commission once the company has paid its order in full. For an AI Day: €500 excl. VAT per day, pro rata to the price actually paid. For our other services, the amounts are in your agreement and in the commission sheet below; your agreement prevails.",
      ],
      statutTitre: "Your status",
      statut:
        "You remain independent, free to organise yourself, with no target and no exclusivity. To sign your agreement and invoice your commissions, you need a French SIREN number (a micro-enterprise, for example).",
      suiteTitre: "Next steps",
      contrat: "We will send you your introducer agreement to sign online.",
      espace:
        "Once your agreement is signed, you can introduce companies to us from your space, with the “Declare a company” form.",
      documentsTitre: "Your documents, always up to date",
      documentsIntro:
        "These links always open the latest version. They are personal to you: keep this email.",
      documents: [
        {
          chemin: "/fiche-commissions",
          libelle: "The commission sheet",
          detail: "what you earn, service by service, and when it is paid",
        },
        {
          chemin: "/livret",
          libelle: "The welcome booklet",
          detail: "the network and how it works",
        },
        {
          chemin: "/guide",
          libelle: "The getting-started guide",
          detail: "ideas to get going, at your own pace",
        },
        {
          chemin: "/documents",
          libelle: "My introducer space",
          detail: "your file, your agreement and all your documents in one place",
        },
      ],
      dossier:
        "First step: complete your file and sign your agreement online with the button below (about 10 minutes). We countersign it after review.",
      ctaDossier: "Complete my file and sign my contract",
      dossierSigne:
        "Your file and signed contract have already reached us: we are reviewing them, and you will receive your countersigned contract by email.",
      ctaDossierSigne: "View my file",
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
      {...(calendlyUrl
        ? {
            // 2026-10-05 : NOTRE page de réservation quand l'adresse est celle de
            // l'échange apporteur, l'adresse reçue sinon (`lien-du-site.ts`).
            cta: {
              label: t.absent.cta,
              href: lienDeReservationDuSite(calendlyUrl, { depuis: "email-issue-apporteur" }),
            },
          }
        : {})}
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
  const dossierUrl = texteOuNull(p.dossierUrl);
  const signe = p.dossierSigne === true;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale}
      sansReseauxSociaux
      signature="fondateur-court"
      {...(dossierUrl
        ? {
            cta: { label: signe ? t.ctaDossierSigne : t.ctaDossier, href: dossierUrl },
            ctaSecret: true,
          }
        : {})}
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

      <Text style={intertitre}>{t.statutTitre}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.statut}</Text>

      <Text style={intertitre}>{t.suiteTitre}</Text>
      <Text style={puce}>• {signe ? t.dossierSigne : dossierUrl ? t.dossier : t.contrat}</Text>
      {dossierUrl && !signe ? <Text style={puce}>{ligneAPreparer(l)}</Text> : null}
      <Text style={emailStyles.paragraphStyle}>• {t.espace}</Text>

      {dossierUrl ? (
        <>
          <Text style={intertitre}>{t.documentsTitre}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.documentsIntro}</Text>
          {t.documents.map((d) => (
            <Text key={d.chemin} style={puce}>
              →{" "}
              <a
                href={`${dossierUrl.replace(/\/+$/, "")}${d.chemin}`}
                style={{ color: emailStyles.COLORS.terracotta }}
              >
                {d.libelle}
              </a>{" "}
              {d.detail}
            </Text>
          ))}
        </>
      ) : null}
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
