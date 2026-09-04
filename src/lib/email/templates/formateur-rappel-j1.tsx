// Email — rappel de la veille au FORMATEUR (2026-09-03).
//
// Même bloc pratique que la convocation J-7 (un seul rendu, cf.
// `_infos-pratiques-formateur.tsx`) : la veille, on ne découvre rien de
// nouveau, on relit l'adresse, l'heure et le nom de la personne qui ouvre la
// porte. Le lien de visio, lui, est cliquable directement.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import {
  InfosPratiquesFormateurBloc,
  type InfosPratiquesFormateur,
} from "./_infos-pratiques-formateur";
import { libelleDelaiConvocation } from "./formateur-convocation-j7";
import type { Locale } from "../../../../prisma/generated/client";

type Payload = InfosPratiquesFormateur & {
  /** « 09:00 » — l'heure du premier créneau, si les journées sont saisies. */
  heureDebutJ1?: string;
  /**
   * 🔴 Le délai RÉEL en jours civils, déjà porté par le payload commun aux deux
   * messages. Ce gabarit disait « demain » EN DUR : or son cron sélectionne
   * dans une fenêtre de 36 h, il part donc aussi l'avant-veille au soir, et
   * « demain » y est faux d'un jour. Même défaut que celui fermé sur la
   * convocation le 2026-09-03 — et fermé ici de la même façon, avec la même
   * fonction, pour que les deux messages ne puissent plus diverger.
   */
  joursAvantDebut?: number;
};

export const formateurRappelJ1Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const { prefixeObjet } = libelleDelaiConvocation(p.joursAvantDebut, locale);
  return objetCompose(
    prefixeObjet,
    p.titreFormation ?? (locale === "fr" ? "Formation" : "Training"),
  );
};

export function FormateurRappelJ1Email({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  // Le même délai que l'objet — un titre qui contredirait la ligne d'objet
  // ferait douter du reste du message.
  const { titre, quand } = libelleDelaiConvocation(p.joursAvantDebut, locale);
  return (
    <EmailLayout
      famille="C"
      preview="Lieu, heure d'arrivée et personne à contacter sur place — relisez avant de partir."
      title={titre}
      cta={{ label: "Ouvrir la session dans mon espace", href: p.lienEspace }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        <strong>{p.titreFormation}</strong> démarre {quand}, le <strong>{p.dateDebut}</strong>
        {p.heureDebutJ1 ? (
          <>
            {" "}
            à <strong>{p.heureDebutJ1}</strong>
          </>
        ) : null}{" "}
        — {p.lieu}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.formateurPrenomNom} — voici tout ce qu&apos;il faut pour arriver au bon endroit
        et entrer.
      </Text>
      <InfosPratiquesFormateurBloc p={p} />
      <Text style={{ ...emailStyles.paragraphStyle, marginTop: 12 }}>
        Un empêchement de dernière minute ? Prévenez-nous immédiatement par téléphone, puis répondez
        à ce message : une session sans formateur se reporte, elle ne s&apos;annule pas toute seule.
      </Text>
    </EmailLayout>
  );
}
