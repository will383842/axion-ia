// E-mail à l'APPORTEUR — « file d'attente, premier rang » (article 3.5 du contrat).
//
// L'entreprise qu'il avait déclarée et qui n'était pas disponible l'est de nouveau : il PEUT la
// déclarer à nouveau, jusqu'à une date. Rien d'obligatoire : sans nouvelle déclaration, rien ne
// change pour lui.
//
// Gabarit livré au worker AVANT son émetteur (PR F #2464, fenêtre app/worker d'AGENTS.md).
// ⛔ Aucun nom d'un autre apporteur, aucune mention de celui qui détient l'entreprise : la charge n'en porte pas.
// ⛔ Texte à faire relire par Will. Aucun vocabulaire de subordination ni de pression (cf.
// `challenge-textes-interdits.ts`) ; gabarit « d'information », pas « d'argent » (`GABARITS_ARGENT`).

import { Text } from "@react-email/components";

import { salutation } from "../salutation";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Prénom de l'apporteur. */
  prenom: string;
  /** Dénomination de l'entreprise qu'il avait déclarée. */
  entreprise: string;
  /** Dernier jour pour la déclarer à nouveau, en toutes lettres (inclus). */
  jusquAu: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const apporteurFileAttenteSubject = (
  _locale: Locale,
  payload: Record<string, unknown> = {},
): string => {
  const e = texte(payload["entreprise"]);
  return e ? `${e} est de nouveau disponible` : "Une entreprise déclarée est de nouveau disponible";
};

export function ApporteurFileAttenteEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Partial<Payload>;
  const prenom = texte(p.prenom);
  const entreprise = texte(p.entreprise) || "L'entreprise";
  const jusquAu = texte(p.jusquAu);
  return (
    <EmailLayout
      famille="B"
      preview="Une entreprise que vous aviez déclarée est de nouveau disponible."
      title="Une entreprise est de nouveau disponible"
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>
        {salutation({ prenom }, locale)} l&apos;entreprise {entreprise}, que vous aviez déclarée et
        qui n&apos;était pas disponible, l&apos;est de nouveau.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Si vous le souhaitez, vous pouvez la déclarer à nouveau depuis votre espace
        {jusquAu ? ` jusqu'au ${jusquAu} inclus` : ""} (article 3.5 de votre contrat). Vous n&apos;y
        êtes pas tenu : sans nouvelle déclaration, rien ne change pour vous.
      </Text>
    </EmailLayout>
  );
}
