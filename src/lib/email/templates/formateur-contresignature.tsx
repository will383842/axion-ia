// Email — demande de CONTRESIGNATURE de l'émargement au formateur (2026-09-15).
//
// 🔴 Sur la seule session réelle, la stagiaire a signé et le formateur n'a
// jamais contresigné : rien ne le lui demandait. La contresignature reste non
// bloquante pour l'attestation (décision de Will), mais les OPCO la demandent,
// et elle ne se pose jamais à la place du formateur. Ce message est donc la
// DEMANDE, envoyée à la fin d'une journée signée par des stagiaires, rappelée
// au plus deux fois (`demande-contresignature.ts`).
//
// Il nomme chaque demi-journée : un « pensez à contresigner » sans date
// renverrait chercher dans l'espace ce que le message savait déjà. Et son seul
// bouton mène à la page authentifiée de la formation, à l'ancre du bloc
// d'émargement — aucune surface publique, aucun jeton.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  formateurPrenomNom: string;
  titreFormation: string;
  numeroSession: string;
  /** « mercredi 16 septembre 2026 — matin », une entrée par demi-journée. */
  demiJournees: string[];
  /** Page de la formation dans l'espace formateur, ancre `#emargement`. */
  lienEspace: string;
  /** 0 = première demande ; 1, 2 = rappels. */
  rangRappel?: number;
  /** Vrai sur le dernier envoi : ensuite, plus de rappel. */
  dernierRappel?: boolean;
}

export const formateurContresignatureSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const rappel = typeof p.rangRappel === "number" && p.rangRappel > 0;
  const prefixe =
    locale === "fr"
      ? rappel
        ? "Rappel : contresignez —"
        : "À contresigner —"
      : rappel
        ? "Reminder: countersign —"
        : "To countersign —";
  return objetCompose(prefixe, p.titreFormation ?? (locale === "fr" ? "Formation" : "Training"));
};

export function FormateurContresignatureEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const demiJournees = Array.isArray(p.demiJournees) ? p.demiJournees : [];
  const n = demiJournees.length;
  return (
    <EmailLayout
      famille="C"
      preview={`${n} demi-journée${n > 1 ? "s" : ""} signée${n > 1 ? "s" : ""} par vos stagiaires attend${n > 1 ? "ent" : ""} votre signature.`}
      title="Votre contresignature est attendue"
      cta={{ label: "Contresigner dans mon espace", href: p.lienEspace }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.formateurPrenomNom} — vos stagiaires ont émargé pour{" "}
        <strong>{p.titreFormation}</strong> ({p.numeroSession}). La feuille attend maintenant votre
        contresignature pour :
      </Text>
      {demiJournees.map((d) => (
        <Text key={d} style={{ ...emailStyles.paragraphStyle, margin: "0 0 4px 16px" }}>
          • {d}
        </Text>
      ))}
      <Text style={{ ...emailStyles.paragraphStyle, marginTop: 12 }}>
        Elle atteste que vous avez bien animé ces demi-journées : c&apos;est la signature que les
        financeurs demandent en plus de celle des stagiaires. Personne ne peut la signer à votre
        place — ouvrez la formation, bloc Émargement, et contresignez chaque demi-journée.
      </Text>
      {p.dernierRappel === true ? (
        <Text style={emailStyles.paragraphStyle}>
          C&apos;est le dernier rappel envoyé par e-mail : la demande reste visible dans votre
          espace tant que la contresignature manque.
        </Text>
      ) : null}
    </EmailLayout>
  );
}
