// Email — le contrat de travail du formateur SALARIÉ l'attend (2026-09-12).
//
// 🔴 CE MESSAGE EXISTE PARCE QUE LA PIÈCE ÉTAIT COMPLÈTE ET QUE PERSONNE
// N'ALLAIT LA CHERCHER. Le contrat est produit, numéroté, signable depuis
// l'espace du salarié — mais rien ne l'y envoyait. Une personne qu'on vient
// d'embaucher n'a aucune raison d'ouvrir un « espace formateur » de sa propre
// initiative : elle attend qu'on lui dise. C'est la même famille que la pièce
// joignable par URL et liée depuis aucun écran, d'un cran plus loin — le
// lecteur EXISTE, personne ne lui indique le chemin.
//
// ⚠️ AUCUN LIEN SECRET, ET C'EST DÉLIBÉRÉ. Le lien de connexion de l'espace
// formateur vaut QUINZE MINUTES (`LINK_TTL_MS`). Un message qu'on ouvre le soir,
// ou le lendemain, porterait un lien déjà mort — et l'intéressé lirait « lien
// expiré » sur le message qui lui annonce son contrat de travail. On l'envoie
// donc vers la page de connexion, où il demande son accès quand il le veut.
//
// ⚠️ AUCUNE PIÈCE JOINTE. Le contrat porte sa rémunération et son adresse
// personnelle ; l'espace le sert derrière une garde de propriété, une boîte aux
// lettres ne garde rien. La remise formelle reste celle que le contrat lui-même
// annonce : deux exemplaires originaux signés des deux parties.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  formateurPrenomNom: string;
  /** « CDI » ou « CDD » — la nature, parce qu'elle change ce qu'il doit vérifier. */
  natureContrat: string;
  /** Intitulé du poste, tel qu'il figure au contrat. */
  poste: string;
  /** Date d'entrée en fonction, formatée fr-FR. */
  dateEmbauche: string;
  /** Numéro de la pièce au registre — sa référence si quelque chose cloche. */
  numeroPiece: string;
  /** Page de connexion de l'espace formateur. Jamais un lien secret. */
  lienEspace: string;
  /**
   * Le contrat est-il DÉJÀ signé des deux parties ?
   *
   * 🔴 Recette du 13/09 : « Prévenir à nouveau » restait disponible après les
   * deux signatures, et renvoyait le message « à lire et à SIGNER » — objet
   * compris — à quelqu'un qui avait déjà signé. Le geste est légitime (rouvrir
   * l'accès à son exemplaire), c'est la phrase qui ne l'était pas.
   */
  dejaSigne?: boolean;
}

/**
 * ⚠️ L'OBJET NE PORTE NI LA NATURE NI LE POSTE, et le payload n'est donc pas lu.
 *
 * Un objet d'e-mail s'affiche en clair dans la liste des messages, sur un écran
 * de téléphone qu'on tend à quelqu'un, dans une notification de bureau. « CDD de
 * formateur » y annoncerait à qui regarde par-dessus l'épaule une information
 * que l'intéressé n'a pas encore lue lui-même. Le détail est DANS le message.
 */
export const formateurContratTravailSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  /*
    🔑 LE PAYLOAD N'EST LU QUE POUR UN BOOLÉEN, et la raison écrite ci-dessus
    tient toujours : un objet d'e-mail s'affiche en clair sur un écran qu'on
    tend à quelqu'un, donc il ne portera jamais la NATURE ni le POSTE. Savoir
    qu'un contrat est signé n'est pas du même ordre — et dire « à signer » à qui
    a déjà signé est une erreur que l'objet propage jusque dans la notification.
  */
  const dejaSigne = payload["dejaSigne"] === true;
  if (locale === "fr") {
    return objetCompose(
      "Votre contrat de travail",
      dejaSigne ? "votre exemplaire signé" : "à lire et à signer",
    );
  }
  return objetCompose(
    "Your employment contract",
    dejaSigne ? "your signed copy" : "to read and sign",
  );
};

export function FormateurContratTravailEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  return (
    <EmailLayout
      famille="C"
      preview={
        p.dejaSigne === true
          ? "Votre exemplaire signé des deux parties reste disponible dans votre espace."
          : "Votre contrat vous attend dans votre espace. Lisez-le en entier avant de le signer."
      }
      title="Votre contrat de travail est prêt"
      cta={{ label: "Ouvrir mon espace", href: p.lienEspace }}
      locale={locale}
    >
      {/*
        ⚠️ LE POSTE PEUT ÊTRE VIDE, ET LA PHRASE DOIT TENIR SANS LUI.

        Il valait autrefois « formateur » par défaut : une secrétaire recevait
        par écrit l'annonce de son contrat au poste de formateur. Le repli a été
        retiré côté action — un repli qui INVENTE est pire qu'une absence — et
        c'est ici que la phrase doit s'en accommoder. Sans cette branche, elle
        se lirait « pour le poste de est établi ».

        🔑 En pratique le cas ne se produit pas : `verifierEligibiliteContrat`
        refuse d'établir un contrat sans poste. On l'écrit quand même, parce
        qu'une phrase qui dépend d'une garde située trois modules plus loin est
        une phrase qui se cassera le jour où la garde bougera.
      */}
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.formateurPrenomNom}, votre <strong>{p.natureContrat}</strong>
        {p.poste ? (
          <>
            {" "}
            pour le poste de <strong>{p.poste}</strong>
          </>
        ) : null}{" "}
        est {p.dejaSigne === true ? "signé des deux parties" : "établi"}
        {/*
          🔑 CONDITIONNEL, comme le poste juste au-dessus (recette du 13/09).
          Le poste avait été protégé, la date non : une fiche sans date d'entrée
          en fonction produisait « est établi, avec une entrée en fonction au . »
          — une phrase cassée, dans le message le plus engageant qu'on adresse à
          quelqu'un. L'action refuse par ailleurs d'annoncer un contrat
          inétablissable ; les deux gardes se protègent mutuellement.
        */}
        {p.dateEmbauche ? (
          <>
            , avec une entrée en fonction au <strong>{p.dateEmbauche}</strong>
          </>
        ) : null}
        .
      </Text>
      {/*
        🔑 « Lisez-le EN ENTIER » n'est pas une politesse. En le signant, il
        scelle une mention qui affirme qu'il a pu en prendre connaissance dans
        son intégralité. La pièce doit donc être lisible AVANT — elle l'est, sa
        route de lecture vérifie exactement le même droit que la signature.
      */}
      <Text style={emailStyles.paragraphStyle}>
        Il vous attend dans votre espace formateur. <strong>Lisez-le en entier</strong> avant de le
        signer : il fixe votre poste, votre rémunération, votre durée de travail et la convention
        collective qui vous est applicable.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Le contrat porte <strong>deux signatures</strong> : la vôtre et celle de l&apos;employeur.
        Un exemplaire signé des deux parties vous est remis.
      </Text>
      {/*
        ⚠️ On DIT que rien ne l'oblige à signer sur-le-champ. Un message qui
        presse quelqu'un de signer un contrat de travail est déplacé, et un
        consentement obtenu dans l'urgence se conteste. S'il a une question, la
        poser AVANT de signer est le bon ordre.
      */}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Prenez le temps qu&apos;il vous faut : si une mention vous paraît inexacte ou si vous avez
        une question, écrivez-nous avant de signer. Référence de la pièce : {p.numeroPiece}.
      </Text>
    </EmailLayout>
  );
}
