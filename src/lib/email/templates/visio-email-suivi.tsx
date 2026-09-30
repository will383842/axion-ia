// E-mail — le SUIVI d'un rendez-vous client (chantier visio, PR 7 ; V-14).
//
// Il ne part JAMAIS seul : il est toujours mis en file `exigerValidation: true`
// (`src/server/visio/passes/etapes-a-la-demande.ts` et l'action du gabarit
// fixe), donc garé dans « E-mails à valider ». Will le relit, le corrige et
// clique « Envoyer ».
//
// Même châssis que l'issue de l'échange apporteur (`apporteur-issue-echange.tsx`) :
// famille B, vouvoiement, sans rangée sociale, signature du fondateur (§6.1,
// sans téléphone). Le texte vient des faits VALIDÉS (rédigé par l'IA et vérifié
// par le code, ou gabarit fixe) : ni prix, ni lien, ni adresse.
//
// Art. 14 RGPD : au PREMIER message à une personne dont Axion-IA a appris
// l'existence par un tiers (contact `origine = mention`), une ligne dit d'où
// vient son adresse et renvoie à la politique de confidentialité.

import { Text } from "@react-email/components";
import type { ReactElement } from "react";

import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
export const URL_POLITIQUE_SUIVI = `${SITE}/fr/politique-confidentialite`;

interface Payload {
  /** Nom tel que saisi dans la fiche : seul le premier mot est dit. */
  contactName?: string;
  /** Objet validé (vérifié : ni prix, ni lien). */
  objet?: string;
  /** Paragraphes, dans l'ordre, en texte brut. */
  paragraphes?: string[];
  /** Premier message à une personne citée par un tiers : ligne d'information art. 14. */
  informationArt14?: boolean;
}

export const INFORMATION_ART14 =
  "Vous recevez ce message parce qu'un de vos collègues nous a transmis vos coordonnées lors d'un échange avec Axion-IA. Vous pouvez à tout moment nous demander de ne plus vous écrire, ou de supprimer vos données : notre politique de confidentialité explique comment.";

const OBJET_PAR_DEFAUT = "Suite à notre échange";

function prenomDe(p: Payload): string {
  return (typeof p.contactName === "string" ? p.contactName : "").trim().split(/\s+/)[0] ?? "";
}

function paragraphesDe(p: Payload): string[] {
  return Array.isArray(p.paragraphes)
    ? p.paragraphes.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
}

export const visioEmailSuiviSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const o = (payload as Payload).objet;
  return typeof o === "string" && o.trim() !== "" ? o.trim().slice(0, 80) : OBJET_PAR_DEFAUT;
};

export function VisioEmailSuiviEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}): ReactElement {
  const p = payload as Payload;
  const prenom = prenomDe(p);
  return (
    <EmailLayout
      famille="B"
      preview="Le récapitulatif de notre rendez-vous et la suite convenue."
      title="Suite à notre échange"
      locale={locale}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</Text>
      {paragraphesDe(p).map((texte, i) => (
        <Text key={i} style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>
          {texte}
        </Text>
      ))}
      {p.informationArt14 === true ? (
        <Text style={{ ...emailStyles.paragraphStyle, fontSize: "13px" }}>
          {INFORMATION_ART14} {URL_POLITIQUE_SUIVI}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
