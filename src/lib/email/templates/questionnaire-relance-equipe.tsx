// E-mail CLIENT — « Un petit coup de pouce auprès de votre équipe » (lot B10, 2026-10-29).
//
// BROUILLON uniquement : garé « à valider » par `garerPourValidation` à la demande de Will
// (fiche client, onglet Questionnaire), relu par lui avant tout envoi. Destinataire UNIQUE : le
// dirigeant, jamais un collaborateur. Aucune réponse n'y figure, aucun lien de collaborateur ;
// il peut nommer les personnes qui manquent, puisque c'est la liste du dirigeant lui-même.
//
// ⛔ Ton et formulations : suivre les ordres de Will (pas de promesse de résultat, pas de lieu).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: string;
  manquants?: ReadonlyArray<string>;
  auditCourt?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const noms = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(texte).filter((n) => n !== "") : [];

const enumerer = (l: ReadonlyArray<string>): string =>
  l.length <= 1 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`;

export const questionnaireRelanceEquipeSubject = (
  _locale: Locale,
  _payload: Record<string, unknown>,
): string => "Votre équipe et le questionnaire";

export function QuestionnaireRelanceEquipeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const prenom = texte(p.prenom);
  const manquants = noms(p.manquants);
  const auditCourt = texte(p.auditCourt);
  return (
    <EmailLayout
      famille="C"
      preview="Quelques réponses de votre équipe sont encore attendues."
      title="Un petit coup de pouce auprès de votre équipe"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</Text>
      <Text style={emailStyles.paragraphStyle}>
        Merci pour votre temps sur le questionnaire. Certaines réponses de votre équipe ne sont pas
        encore arrivées
        {manquants.length > 0 ? ` : il manque ${enumerer(manquants)}` : ""}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Pourriez-vous leur rappeler de répondre{auditCourt ? ` avant le ${auditCourt}` : ""}, avec
        le lien que vous leur avez transmis ? Cela nous aide à préparer notre audit à votre mesure.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        À très bientôt,
        <br />
        Williams Jullin, Axion-IA
      </Text>
    </EmailLayout>
  );
}
