// E-mail — INVITATION à un échange de 15 minutes, envoyée par Will depuis la
// console à une personne intéressée par le réseau d'apporteurs d'affaires
// (2026-09-19).
//
// ── Pourquoi un envoi MANUEL ──────────────────────────────────────────────
// Le lien de réservation n'est pas distribué automatiquement : envoyé à chaque
// personne qui laisse son adresse, il saturerait l'agenda de Will. Il part
// donc, un par un, aux personnes qu'il choisit — depuis la fiche du contact
// (Contacts › Commercial) ou au moment d'une saisie manuelle.
//
// Contenu : l'invitation (CTA = le créneau Calendly), le kit apporteur
// (document de présentation + catalogue), et — si la personne n'a pas encore
// envoyé son dossier — le lien pour le compléter.
//
// ── D'où vient l'adresse (art. 14 RGPD), 2026-09-19 ──────────────────────
// Une personne saisie à la main porte une `provenance` :
//   · `directe` (e-mail, appel, salon, réponse à notre annonce) : elle nous a
//     donné son adresse ; le message le lui rappelle en une phrase ;
//   · `indirecte` (recommandation, autre) : elle n'a JAMAIS écrit à Axion-IA.
//     Le premier message doit lui dire d'où vient son adresse, qui traite ses
//     données, pourquoi, combien de temps, et ses droits — dont la réclamation
//     auprès de la CNIL. Il ne la remercie donc pas d'un « intérêt » qu'elle
//     n'a pas exprimé.
// Sans `provenance` (personne venue d'un formulaire du site, ou job enfilé
// avant ce changement) : texte STRICTEMENT inchangé — un instantané le garde.
//
// Vocabulaire (anti-requalification, `docs/partners/ANTI-REQUALIFICATION.md`) :
// « échange », « faire connaissance », « recommander » ; jamais « entretien »,
// « poste », « recrutement », « commercial », « vendre ». Et « aucun
// engagement » : la personne décide après.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { BlocKitApporteur } from "./_kit-apporteur";
import { IDENTITE_LEGALE, adresseSiegeUneLigne } from "@/lib/identite-legale-ssot";
import { SITE_URL } from "@/lib/site-url";
import type { Locale } from "../../../../prisma/generated/client";
// 🔑 `import type`, et rien d'autre : le type est celui que la console FABRIQUE
// (`invitation-apporteur.ts`), le gabarit ne fait que le lire. L'import est
// effacé à la compilation — aucun module serveur n'entre dans le graphe du
// worker, que `email-worker.opposition.graphe-worker.spec.ts` surveille. Deux
// déclarations jumelles auraient fini par diverger en silence : ce gabarit rend
// un texte dont le sens dépend du `mode`.
import type { Provenance } from "@/features/commercial-application/invitation-apporteur";

interface Payload {
  contactName?: string;
  /** Lien de réservation Calendly (validé à l'envoi : https, calendly.com). */
  calendlyUrl: string;
  /** Présent seulement si le dossier complet n'est pas encore arrivé. */
  dossierUrl?: string;
  /** Saisie manuelle seulement. Absent : texte d'origine (jobs anciens compris). */
  provenance?: Provenance;
  /**
   * La personne a CANDIDATÉ (formulaire du site, annonce Indeed importée) —
   * posé par la console pour toute fiche qui n'est pas une saisie manuelle
   * (2026-09-27). L'objet et l'ouverture disent alors « ta candidature ».
   * Absent (saisie manuelle, job ancien) : texte d'origine.
   */
  candidature?: boolean;
  /** Numéro de l'objet parmi `sujetsCandidature`, stable par fiche (2026-09-27). */
  variante?: number;
  /**
   * Réservé à l'APERÇU RECONSTITUÉ de la console (2026-09-27) — jamais posé par
   * un envoi. Les invitations parties avant l'ajout de la signature (le 27/09,
   * avant 18:15 UTC) n'en portaient pas : les reconstituer avec la signature
   * ferait mentir l'aperçu. Cf. `reconstitution-invitation.ts`.
   */
  sansSignature?: boolean;
}

/**
 * Durée de conservation annoncée — celle de la purge des dossiers classés
 * (`DEFAULTS.submissionsArchived` de `retention-purge-worker.ts`), et celle que
 * publie la politique de confidentialité, section « Réseau d'apporteurs
 * d'affaires ». Les trois doivent dire la même chose.
 */
const CONSERVATION_MOIS = 24;

/** Ancre de la section apporteurs dans la politique (titre → slug, cf. `LegalPageTemplate`). */
const ANCRE_POLITIQUE = "reseau-d-apporteurs-d-affaires";
const ANCRE_POLITIQUE_EN = "business-introducer-network";

const COPY = {
  fr: {
    title: "Et si on en parlait 15 minutes ?",
    preview: "Choisis le moment qui t'arrange : 15 minutes en visio pour faire connaissance.",
    // 2026-09-27 (Will) : la personne a POSTULÉ, et c'est nous qui retenons sa
    // candidature — le message ne se place pas en demandeur. Quatre objets en
    // rotation : un envoi groupé aux objets identiques ressemble à une campagne.
    // Vocabulaire tenu : « étape suivante », « échange » — jamais « entretien ».
    sujetsCandidature: [
      "Ta candidature apporteur d'affaires chez Axion-IA est retenue",
      "Axion-IA : ta candidature d'apporteur d'affaires passe à l'étape suivante",
      "Ta candidature apporteur d'affaires Axion-IA : réserve ton échange en visio",
      "Suite à ta candidature apporteur d'affaires chez Axion-IA : l'étape suivante",
    ],
    titleCandidature: "Ta candidature est retenue",
    previewCandidature:
      "Ta candidature au réseau d'apporteurs d'affaires d'Axion-IA est retenue pour l'étape suivante : un échange de 15 minutes en visio.",
    bodyCandidature:
      "Nous avons étudié ta candidature au réseau d'apporteurs d'affaires d'Axion-IA : elle est retenue pour l'étape suivante, un échange de 15 minutes en visio avec nous.",
    bodyCandidatureSuite:
      "On y fait connaissance, on te présente concrètement le fonctionnement du réseau et on répond à tes questions. Sans engagement : à l'issue, chacun décide librement de la suite.",
    kitCandidature: "Pour préparer l'échange :",
    dossierCandidature:
      "Il nous manque encore ton dossier : complète-le avant l'échange — trois minutes, sans CV. Tes coordonnées sont déjà remplies : ",
    creneauCandidature:
      "Les créneaux sont limités : réserve le tien dès maintenant avec le bouton ci-dessous.",
    ctaCandidature: "Réserver mon créneau",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: "Merci pour ton intérêt pour le réseau d'apporteurs d'affaires d'Axion-IA. On te propose un échange de 15 minutes en visio : faire connaissance, t'expliquer simplement comment ça marche et répondre à tes questions. Aucun engagement : tu décides après.",
    provenanceDirecte: (l: string) => `Tu nous as donné ton adresse ${l}.`,
    provenanceIndirecte: (l: string) => `Nous avons ton adresse ${l}.`,
    bodyIndirecte:
      "On te propose un échange de 15 minutes en visio sur le réseau d'apporteurs d'affaires d'Axion-IA : faire connaissance, t'expliquer simplement comment ça marche et répondre à tes questions. Aucun engagement : tu décides après.",
    info: (responsable: string, adresse: string) =>
      `Qui traite ton adresse : ${responsable}, ${adresse}. ` +
      "Pourquoi : te proposer un échange sur le réseau d'apporteurs d'affaires. " +
      `Combien de temps : ${CONSERVATION_MOIS} mois après le classement de ton dossier. ` +
      "Tes droits : accès, rectification, effacement, opposition, et réclamation auprès de la CNIL. " +
      "Tout est détaillé dans notre ",
    infoLien: "politique de confidentialité",
    desinscription:
      "Si tu ne souhaites plus recevoir de message de notre part, un clic suffit : le lien est en bas de ce message.",
    creneau: "Choisis toi-même le moment qui t'arrange, en un clic, avec le bouton ci-dessous.",
    dossier:
      "Si tu ne l'as pas encore fait, tu peux aussi compléter ton dossier — trois minutes, sans CV. Tes coordonnées sont déjà remplies : ",
    dossierLien: "compléter mon dossier",
    cta: "Choisir mon créneau",
  },
  en: {
    title: "How about a 15-minute chat?",
    preview: "Pick the time that suits you: 15 minutes on video to get acquainted.",
    sujetsCandidature: [
      "Your business introducer application at Axion-IA has been selected",
      "Axion-IA: your business introducer application moves to the next step",
      "Your Axion-IA business introducer application: book your video call",
      "Following your business introducer application at Axion-IA: the next step",
    ],
    titleCandidature: "Your application has been selected",
    previewCandidature:
      "Your application to Axion-IA's business introducer network has been selected for the next step: a 15-minute video call.",
    bodyCandidature:
      "We have reviewed your application to Axion-IA's network of business introducers: it has been selected for the next step, a 15-minute video call with us.",
    bodyCandidatureSuite:
      "We get acquainted, show you concretely how the network works and answer your questions. No commitment: afterwards, each side freely decides what comes next.",
    kitCandidature: "To prepare for the call:",
    dossierCandidature:
      "We are still missing your file: please complete it before the call — three minutes, no resume. Your details are already filled in: ",
    creneauCandidature: "Slots are limited: book yours now with the button below.",
    ctaCandidature: "Book my slot",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: "Thank you for your interest in Axion-IA's network of business introducers. We suggest a 15-minute video call: get acquainted, explain simply how it works and answer your questions. No commitment: you decide afterwards.",
    provenanceDirecte: (l: string) => `You gave us your address ${l}.`,
    provenanceIndirecte: (l: string) => `We have your address ${l}.`,
    bodyIndirecte:
      "We suggest a 15-minute video call about Axion-IA's network of business introducers: get acquainted, explain simply how it works and answer your questions. No commitment: you decide afterwards.",
    info: (responsable: string, adresse: string) =>
      `Who processes your address: ${responsable}, ${adresse}. ` +
      "Why: to offer you a call about the business introducer network. " +
      `How long: ${CONSERVATION_MOIS} months after your file is closed. ` +
      "Your rights: access, rectification, erasure, objection, and a complaint to the CNIL (French data protection authority). " +
      "Everything is detailed in our ",
    infoLien: "privacy policy",
    desinscription:
      "If you no longer wish to hear from us, one click is enough: the link is at the bottom of this message.",
    creneau: "Pick the time that suits you, in one click, with the button below.",
    dossier:
      "If you have not done it yet, you can also complete your file — three minutes, no resume. Your details are already filled in: ",
    dossierLien: "complete my file",
    cta: "Pick my slot",
  },
} as const;

/** Vrai si la console a marqué la fiche comme une candidature (lecture défensive). */
function estCandidature(p: Record<string, unknown>): boolean {
  return p["candidature"] === true;
}

/** L'objet d'une candidature, choisi par `variante` — un nombre inattendu retombe sur le premier. */
function sujetCandidature(locale: Locale, variante: unknown): string {
  const sujets = COPY[locale === "fr" ? "fr" : "en"].sujetsCandidature;
  const n =
    typeof variante === "number" && Number.isInteger(variante) && variante >= 0 ? variante : 0;
  return sujets[n % sujets.length] ?? sujets[0];
}

export const apporteurInvitationAppelSubject = (
  locale: Locale,
  p: Record<string, unknown>,
): string =>
  estCandidature(p)
    ? sujetCandidature(locale, p["variante"])
    : COPY[locale === "fr" ? "fr" : "en"].title;

/** Provenance lue défensivement : un payload ancien ou malformé rend le texte d'origine. */
function lireProvenance(v: unknown): Provenance | null {
  if (!v || typeof v !== "object") return null;
  const p = v as { mode?: unknown; libelle?: unknown };
  if ((p.mode !== "directe" && p.mode !== "indirecte") || typeof p.libelle !== "string") {
    return null;
  }
  const libelle = p.libelle.trim();
  return libelle ? { mode: p.mode, libelle } : null;
}

export function ApporteurInvitationAppelEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  const dossierUrl =
    typeof p.dossierUrl === "string" && p.dossierUrl.length > 0 ? p.dossierUrl : null;
  const provenance = lireProvenance(p.provenance);
  // Une candidature n'a jamais de `provenance` (celle-ci ne naît que d'une
  // saisie manuelle) : les deux ne se croisent pas.
  const candidature = !provenance && estCandidature(payload);
  const lienPolitique =
    locale === "fr"
      ? `${SITE_URL}/fr/politique-confidentialite#${ANCRE_POLITIQUE}`
      : `${SITE_URL}/en/privacy-policy#${ANCRE_POLITIQUE_EN}`;
  return (
    <EmailLayout
      famille="B"
      preview={candidature ? t.previewCandidature : t.preview}
      title={candidature ? t.titleCandidature : t.title}
      cta={{ label: candidature ? t.ctaCandidature : t.cta, href: p.calendlyUrl }}
      locale={locale}
      tutoiement
      sansReseauxSociaux
      // 2026-09-27 (Will) : l'invitation d'un CANDIDAT ouvre un vrai dialogue
      // avec Will, qui mène l'échange — elle porte sa signature (§6.1, sans
      // téléphone). Hors candidature, rendu inchangé (instantané des jobs anciens).
      {...(candidature && p.sansSignature !== true
        ? { signature: "fondateur-court" as const }
        : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      {provenance?.mode === "indirecte" ? (
        <>
          <Text style={emailStyles.paragraphStyle}>
            {t.provenanceIndirecte(provenance.libelle)}
          </Text>
          {/* Information de l'art. 14 RGPD, D'ABORD : la personne n'a rien
              demandé, elle doit savoir qui lui écrit avant qu'on lui propose
              quoi que ce soit. */}
          <Text style={emailStyles.paragraphStyle}>
            {t.info(IDENTITE_LEGALE.legalName, adresseSiegeUneLigne())}
            <a href={lienPolitique} style={{ color: emailStyles.COLORS.terracotta }}>
              {t.infoLien}
            </a>
            .
          </Text>
          <Text style={emailStyles.paragraphStyle}>{t.desinscription}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.bodyIndirecte}</Text>
        </>
      ) : provenance?.mode === "directe" ? (
        <>
          <Text style={emailStyles.paragraphStyle}>{t.provenanceDirecte(provenance.libelle)}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
        </>
      ) : (
        <>
          <Text style={emailStyles.paragraphStyle}>{candidature ? t.bodyCandidature : t.body}</Text>
          {candidature ? (
            <Text style={emailStyles.paragraphStyle}>{t.bodyCandidatureSuite}</Text>
          ) : null}
        </>
      )}
      <BlocKitApporteur locale={locale} {...(candidature ? { intro: t.kitCandidature } : {})} />
      {dossierUrl ? (
        <Text style={emailStyles.paragraphStyle}>
          {candidature ? t.dossierCandidature : t.dossier}
          <a href={dossierUrl} style={{ color: emailStyles.COLORS.terracotta }}>
            {t.dossierLien}
          </a>
          .
        </Text>
      ) : null}
      {/* Juste au-dessus du bouton, qui porte le lien de réservation. */}
      <Text style={emailStyles.paragraphStyle}>
        {candidature ? t.creneauCandidature : t.creneau}
      </Text>
    </EmailLayout>
  );
}
