// Email — convocation pratique du FORMATEUR, 7 jours avant la session (2026-09-03).
//
// Le stagiaire recevait sa convocation et son rappel J-7 ; le formateur, rien.
// Il apprenait l'adresse en ouvrant son espace — où elle ne figurait d'ailleurs
// qu'à moitié (ville et code postal, jamais la salle ni le contact). Ce message
// lui met sous les yeux TOUT ce qu'il faut pour arriver au bon endroit, à la
// bonne heure, et entrer : adresse, salle, lien visio, contact sur place,
// consignes d'accès, horaires, effectif, kit.
//
// 🔴 « Dans 7 jours » n'est PAS toujours vrai (recette 2026-09-03). Le cron qui
// pose ce message sélectionne par ÉTAT, pas par date : toute affectation d'une
// session qui démarre dans les 7,5 jours et dont la trace d'envoi est vide est
// convoquée au passage suivant — c'est délibéré, pour qu'une affectation posée
// à J-3 ne manque pas sa convocation « parce que J-7 est passé »
// (`qualiopi-formation-crons-worker.ts`, `affectationsAConvoquer`). L'objet et
// le titre, eux, disaient « dans 7 jours » et « dans une semaine » quels que
// soient les faits : une formatrice affectée la veille a reçu « VOTRE SESSION
// DÉMARRE DANS UNE SEMAINE » pour une session du lendemain. On DÉRIVE donc les
// deux du délai réel, porté par la charge utile.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import {
  InfosPratiquesFormateurBloc,
  type InfosPratiquesFormateur,
} from "./_infos-pratiques-formateur";
import type { Locale } from "../../../../prisma/generated/client";

type Payload = InfosPratiquesFormateur & {
  /** Vrai si le formateur n'a pas encore répondu à la proposition de mission. */
  missionEnAttente?: boolean;
  /** Jours civils (Paris) entre l'envoi et le démarrage. Absent ⇒ on ne dit rien. */
  joursAvantDebut?: number;
};

/**
 * Ce que le message a le droit de DIRE du délai, en français et en anglais.
 *
 * PUR et exporté pour être éprouvé seul. Un délai absent ou illisible ne
 * fabrique aucune promesse : on retombe sur « informations pratiques », qui est
 * vrai quel que soit le jour. Une valeur par défaut de 7 refabriquerait le
 * défaut exact qu'on corrige.
 */
export function libelleDelaiConvocation(
  jours: number | undefined,
  locale: Locale,
): { prefixeObjet: string; titre: string } {
  const fr = locale === "fr";
  if (typeof jours !== "number" || !Number.isFinite(jours)) {
    return fr
      ? { prefixeObjet: "Infos pratiques —", titre: "Vos informations pratiques" }
      : { prefixeObjet: "Practical details —", titre: "Your practical details" };
  }
  const n = Math.round(jours);
  if (n <= 0) {
    return fr
      ? { prefixeObjet: "Aujourd'hui —", titre: "Votre session démarre aujourd'hui" }
      : { prefixeObjet: "Today —", titre: "Your session starts today" };
  }
  if (n === 1) {
    return fr
      ? { prefixeObjet: "Demain —", titre: "Votre session démarre demain" }
      : { prefixeObjet: "Tomorrow —", titre: "Your session starts tomorrow" };
  }
  if (n === 7) {
    return fr
      ? { prefixeObjet: "Dans 7 jours —", titre: "Votre session démarre dans une semaine" }
      : { prefixeObjet: "In 7 days —", titre: "Your session starts in a week" };
  }
  return fr
    ? { prefixeObjet: `Dans ${n} jours —`, titre: `Votre session démarre dans ${n} jours` }
    : { prefixeObjet: `In ${n} days —`, titre: `Your session starts in ${n} days` };
}

export const formateurConvocationJ7Subject = (
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

export function FormateurConvocationJ7Email({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const { titre } = libelleDelaiConvocation(p.joursAvantDebut, locale);
  return (
    <EmailLayout
      famille="C"
      preview="Adresse, salle, contact sur place, horaires et effectif : tout est dans ce message."
      title={titre}
      cta={{ label: "Ouvrir la session dans mon espace", href: p.lienEspace }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Vous animez <strong>{p.titreFormation}</strong> à partir du <strong>{p.dateDebut}</strong> —{" "}
        {p.modalite}. Voici les informations pratiques.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.formateurPrenomNom} — relisez-les maintenant, et signalez-nous sans attendre ce
        qui manque ou ne vous convient pas.
      </Text>
      <InfosPratiquesFormateurBloc p={p} />
      {p.missionEnAttente === true ? (
        <Text style={{ ...emailStyles.paragraphStyle, marginTop: 12 }}>
          <strong>Vous n&apos;avez pas encore confirmé cette mission.</strong> Répondez depuis votre
          espace, sinon nous devrons chercher un autre intervenant.
        </Text>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, marginTop: 12 }}>
        {p.kitDisponible === true
          ? "Le kit formateur imprimé (feuilles d'émargement, liste des stagiaires) est publié : téléchargez-le depuis la page de la session."
          : "La feuille d'émargement se signe depuis votre espace, sur votre poste ou celui des stagiaires."}
      </Text>
    </EmailLayout>
  );
}
