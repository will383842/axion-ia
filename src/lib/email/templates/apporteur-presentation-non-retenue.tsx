// E-mail à l'APPORTEUR — l'entreprise qu'il a présentée n'a pas pu être retenue
// (statuts `dementie`, `deja_connue`, `hors_champ` posés depuis la console).
//
// Court, poli, factuel. Le motif est dit en mots simples ; le message ne dit JAMAIS qu'on a
// vérifié ou contrôlé l'apporteur, ne relance pas, ne fixe aucun objectif, ne promet aucun gain.
// Fichier À PART (une autre session travaille sur `apporteur-demarrage.tsx`).
// Envoi derrière `APPORTEURS_EMAIL_REFUS` (éteint par défaut) : voir `refus-annonce.ts`.

import { Text } from "@react-email/components";

import { salutation } from "../salutation";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

export type MotifNonRetenue = "deja-connue" | "hors-champ" | "non-confirmee";

interface Payload {
  /** « Claire Durand » : seul le prénom est dit. */
  contactName?: string;
  entreprise?: string;
  motif?: MotifNonRetenue;
}

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

function texte(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export const COPY_NON_RETENUE = {
  subject: (e: string) => (e ? `${e} : présentation non retenue` : "Présentation non retenue"),
  title: "Cette entreprise n'a pas pu être retenue",
  preview: "Une entreprise que vous nous avez présentée n'a pas pu être retenue.",
  corps: (e: string) =>
    `Merci de nous avoir présenté ${e || "cette entreprise"}. Nous vous informons que ${e || "l'entreprise"} n'a pas pu être retenue.`,
  motif: {
    "deja-connue": "Elle est déjà en relation avec nous.",
    "hors-champ": "Son activité ne fait pas partie de celles que nous accompagnons.",
    "non-confirmee": "L'entreprise n'a pas confirmé cette présentation.",
  },
  fin: "Cette information ne demande aucune démarche de votre part.",
} as const;

function lireMotif(v: unknown): MotifNonRetenue {
  return v === "deja-connue" || v === "hors-champ" ? v : "non-confirmee";
}

export const apporteurPresentationNonRetenueSubject = (
  _locale: Locale,
  payload: Record<string, unknown> = {},
): string => COPY_NON_RETENUE.subject(texte((payload as Payload).entreprise));

export function ApporteurPresentationNonRetenueEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const e = texte(p.entreprise);
  const prenom = texte(p.contactName).split(/\s+/)[0] ?? "";
  return (
    <EmailLayout
      famille="B"
      preview={COPY_NON_RETENUE.preview}
      title={COPY_NON_RETENUE.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>
        {salutation({ prenom }, locale)} {COPY_NON_RETENUE.corps(e)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_NON_RETENUE.motif[lireMotif(p.motif)]}</Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_NON_RETENUE.fin}</Text>
    </EmailLayout>
  );
}
