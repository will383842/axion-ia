// E-mail — INFORMATION de la personne dont un apporteur nous a transmis les coordonnées
// (lot 7a, 2026-11-25). ⛔ GABARIT NEUF, NON BRANCHÉ : il n'est inscrit ni dans le registre
// (`index.tsx`), ni dans le catalogue d'aperçu, ni dans `envois.ts`. Rien ne l'envoie ; un
// autre lot le branchera, après relecture du texte par le dirigeant.
//
// Il accompagne la future règle « validation par rendez-vous » (contrat 2.8). Ce n'est PAS
// la prise de contact (`entreprise-prise-de-contact-apporteur`, dans `apporteur-demarrage.tsx`,
// qui reste intacte) : ici on INFORME, on ne propose rien et on ne demande rien.
//
// ── Ce que ce message ne fait JAMAIS ──────────────────────────────────────
//   · demander une réponse, un accord ou un geste ;
//   · porter un bouton ou un lien d'action (aucun `cta`) : le seul lien du corps est la
//     politique de confidentialité. Signature COURTE pour la même raison : la signature
//     longue du fondateur porte le lien de réservation d'un échange ;
//   · laisser entendre que l'on s'assure de la parole de l'apporteur (Will, 2026-10-05 :
//     « contre-vendeur ») ;
//   · parler de prix, de rémunération de l'apporteur ou d'un événement ;
//   · donner les coordonnées de l'apporteur : son prénom et son nom, rien d'autre.
//
// Même châssis que les autres messages du réseau : famille B, sans rangée sociale,
// vouvoiement, signature du fondateur. Le pied de page légal (raison sociale, adresse du
// siège, SIREN) et le lien d'opposition du destinataire viennent du châssis.

import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";
import { EMAIL_LEGAL } from "../legal-footer";
import { salutation } from "../salutation";
import { SITE_URL as SITE_URL_BRUT } from "@/lib/site-url";
import type { Locale } from "../../../../prisma/generated/client";

// Le filet anti-localhost de `site-url.ts` : jamais un lien localhost dans un e-mail de prod.
const SITE_URL = SITE_URL_BRUT.replace(/\/+$/, "");
/** La section de la politique écrite pour CES personnes (même ancre que la prise de contact). */
export const LIEN_CONFIDENTIALITE_PERSONNES_PRESENTEES = `${SITE_URL}/fr/politique-confidentialite#personnes-presentees-par-un-apporteur`;

interface Payload {
  /** La personne informée : son prénom, ou à défaut le premier mot de `contactName`. */
  prenom?: string;
  contactName?: string;
  /** « Monsieur » / « Madame », et le nom de famille. */
  civilite?: string;
  nomFamille?: string;
  /** Prénom et nom de l'apporteur. Jamais ses coordonnées. */
  nomApporteur?: string;
}

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

function texteOuNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

export const COPY_INFORMATION_COORDONNEES = {
  // ≤ 45 caractères sans le nom (§3.4).
  subject: (a: string) =>
    a ? `${a} nous a transmis vos coordonnées` : "Vos coordonnées professionnelles chez Axion-IA",
  title: "D'où viennent vos coordonnées",
  preview: "Un simple message d'information : vous n'avez rien à faire, et voici vos droits.",
  origine: (a: string) =>
    `Axion-IA a reçu vos coordonnées professionnelles de la part de ${a || "une personne de notre réseau"}, qui a pensé que nos services pouvaient vous intéresser.`,
  usage: (responsable: string) =>
    `Ces coordonnées servent seulement à pouvoir échanger avec vous si vous le souhaitez. Elles sont traitées par ${responsable}, dont l'adresse figure au bas de ce message.`,
  droits: (adresse: string) =>
    `Vos droits : vous pouvez à tout moment demander à y accéder, à les faire rectifier ou effacer, ou vous opposer à leur utilisation. Il suffit de nous écrire à ${adresse}. Tout est détaillé dans notre `,
  droitsLien: "politique de confidentialité",
  rienAFaire:
    "Vous n'avez rien à faire : ce message est une simple information, et vous ne recevrez aucune relance.",
} as const;

export const entrepriseInformationCoordonneesSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  COPY_INFORMATION_COORDONNEES.subject(
    texteOuNull((payload as Payload | undefined)?.nomApporteur) ?? "",
  );

export function EntrepriseInformationCoordonneesEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_INFORMATION_COORDONNEES;
  // Civilité + nom, sinon prénom, sinon « Bonjour, » : jamais le nom complet (`salutation`).
  const prenom = texteOuNull(p.prenom) ?? (texteOuNull(p.contactName) ?? "").split(/\s+/)[0];
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>
        {salutation({ civilite: p.civilite, nomFamille: p.nomFamille, prenom }, "fr")}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.origine(texteOuNull(p.nomApporteur) ?? "")}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.usage(EMAIL_LEGAL.legalName)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.droits(EMAIL_LEGAL.contactEmail)}
        <a
          href={LIEN_CONFIDENTIALITE_PERSONNES_PRESENTEES}
          style={{ color: emailStyles.COLORS.terracotta }}
        >
          {t.droitsLien}
        </a>
        .
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.rienAFaire}</Text>
    </EmailLayout>
  );
}
