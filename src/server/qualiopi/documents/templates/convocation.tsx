/**
 * Qualiopi — Template PDF : Convocation à la formation.
 *
 * Mention réglementaire "À conserver". Contient les informations de session
 * (intitulé, dates, horaires heure de Paris, modalité, lieu/visio, formateur,
 * contact), les informations stagiaire, le matériel à prévoir (fiche de la
 * formation, hors distanciel pur), l'équipement requis et l'assistance à
 * distance (distanciel et mixte, art. D.6313-3-1), les documents mis à
 * disposition dans l'espace stagiaire et les mentions handicap/absence.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
  BulletList,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import {
  ASSISTANCE_COUPURE,
  ASSISTANCE_HORS_SESSION,
  ASSISTANCE_PENDANT_SESSION,
} from "@/server/qualiopi/legal/assistance-distance";
import {
  DISTANCIEL_CONNEXION,
  DISTANCIEL_ORDINATEUR,
  DISTANCIEL_VISIO,
} from "@/content/formations/materiel";

/** Première lettre en majuscule : les éléments du matériel commencent en minuscule. */
function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// ============================================================
// Types
// ============================================================

export interface ConvocationData {
  numero: string;
  estCopie?: boolean;
  // Infos session
  intituleFormation: string;
  dateDebut: string;
  dateFin: string;
  /**
   * Plage(s) horaire(s) NUE(S), sans mention de fuseau — ex. « 09h00–17h00 » ou
   * « 09h00–12h30, 13h30–17h00 ». Le gabarit ajoute lui-même « (heure de
   * Paris) » : une valeur qui porte déjà la mention l'imprimerait en double sur
   * une pièce légale. L'ancien commentaire donnait justement l'exemple inverse.
   */
  horaires: string;
  dureeHeures: number;
  modalite: "présentiel" | "distanciel" | "mixte";
  lieu?: string;
  /**
   * ⚠️ Modalité d'accès en distanciel — attendue par l'indicateur 9 au même
   * titre que l'adresse en présentiel. Le gabarit MASQUE `lieu` dès que la
   * modalité est « distanciel » : sans `lienVisio`, la convocation ne dit alors
   * strictement RIEN de la façon de rejoindre la session.
   *
   * 🔴 Constaté à l'audit blanc 2026-08-15 : le seul appelant
   * (`genererConvocationAction`, src/server/actions/qualiopi/documents.ts) ne
   * renseigne ni `lienVisio` ni `idReunion` ni `contactTelephone`, alors que la
   * session porte bien `lieuVisioUrl` en base. Toute convocation distancielle
   * part donc sans modalité d'accès. Correctif hors périmètre de ce fichier :
   * il se fait au point d'appel, pas ici.
   */
  lienVisio?: string;
  idReunion?: string;
  nomFormateur: string;
  contactEmail: string;
  contactTelephone?: string;
  // Infos stagiaire
  nomStagiaire: string;
  entreprise?: string;
  financement?: string;
  numeroOrdrePriseEnCharge?: string;
  /**
   * Matériel à prévoir sur place — le champ `moyens_techniques` DE LA
   * FORMATION, tel quel. Imprimé hors distanciel pur.
   *
   * 🔴 2026-09-18 — la convocation présentiel ne disait RIEN du matériel : la
   * section « Équipement requis » n'existait qu'en distanciel. Un stagiaire
   * convoqué en salle pouvait venir sans le poste que la formation suppose.
   * Règle GÉNÉRIQUE, décidée par le propriétaire : chaque formation déclare
   * son matériel dans sa fiche (certaines n'en exigent aucun), la convocation
   * le reprend — jamais une liste écrite ici. Absent → rien n'est imprimé :
   * aucun texte inventé sur une pièce remise au stagiaire.
   */
  materielAPrevoir?: string;
}

// ============================================================
// Composant
// ============================================================

export function ConvocationPdf({
  data,
  identite,
}: {
  data: ConvocationData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const isDistanciel = data.modalite === "distanciel" || data.modalite === "mixte";

  return (
    <Document>
      <QualiopiPage
        docTitle="Convocation à la formation"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie !== undefined ? { estCopie: data.estCopie } : {})}
      >
        {/* Mention "À conserver" */}
        <View style={{ marginBottom: 12 }}>
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Document à conserver — merci de le présenter le jour de la formation.
          </Text>
        </View>

        {/* Section 1 : Informations session */}
        <DocSection title="Informations sur la session">
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
          <FieldRow label="Horaires" value={`${data.horaires} (heure de Paris)`} />
          <FieldRow
            label="Durée totale"
            value={`${data.dureeHeures} heure${data.dureeHeures > 1 ? "s" : ""}`}
          />
          <FieldRow label="Modalité" value={data.modalite} />
          {data.modalite !== "distanciel" && data.lieu ? (
            <FieldRow label="Lieu" value={data.lieu} />
          ) : null}
          {isDistanciel && data.lienVisio ? (
            <FieldRow label="Lien visioconférence" value={data.lienVisio} />
          ) : null}
          {isDistanciel && data.idReunion ? (
            <FieldRow label="ID de réunion" value={data.idReunion} />
          ) : null}
          <FieldRow label="Formateur / Formatrice" value={data.nomFormateur} />
          <FieldRow label="Contact" value={data.contactEmail} />
          {data.contactTelephone ? (
            <FieldRow label="Téléphone contact" value={data.contactTelephone} />
          ) : null}
        </DocSection>

        {/* Section 2 : Vos informations */}
        <DocSection title="Vos informations">
          <FieldRow label="Nom et prénom" value={data.nomStagiaire} />
          {data.entreprise ? (
            <FieldRow label="Entreprise / Structure" value={data.entreprise} />
          ) : null}
          {data.financement ? <FieldRow label="Financement" value={data.financement} /> : null}
          {data.numeroOrdrePriseEnCharge ? (
            <FieldRow label="N° prise en charge OPCO" value={data.numeroOrdrePriseEnCharge} />
          ) : null}
        </DocSection>

        {/* Section 3a : Matériel à prévoir sur place — la fiche de la formation */}
        {data.modalite !== "distanciel" && data.materielAPrevoir ? (
          <DocSection title="Matériel à prévoir sur place">
            <Text style={pdfStyles.paragraph}>{data.materielAPrevoir}</Text>
          </DocSection>
        ) : null}

        {/* Section 3b : Équipement requis (distanciel et mixte) — les éléments
            viennent de `content/formations/materiel.ts`, ceux que publient les
            fiches : la convocation exige ce que le site annonce. */}
        {isDistanciel ? (
          <DocSection title="Équipement requis (distanciel)">
            <Text style={pdfStyles.paragraph}>
              Pour participer dans de bonnes conditions, veuillez disposer de :
            </Text>
            <BulletList
              items={[
                `${majuscule(DISTANCIEL_ORDINATEUR)} fonctionnels.`,
                `${majuscule(DISTANCIEL_CONNEXION)} (≥ 5 Mbit/s recommandé).`,
                `${DISTANCIEL_VISIO} : caméra, micro, son.`,
                "Un espace calme et éclairé.",
              ]}
            />
          </DocSection>
        ) : null}

        {/* Section 3c : Assistance à distance (distanciel et mixte) — D.6313-3-1.
            Même texte que le livret d'accueil : `legal/assistance-distance.ts`. */}
        {isDistanciel ? (
          <DocSection title="Assistance à distance">
            <BulletList items={[ASSISTANCE_PENDANT_SESSION, ASSISTANCE_HORS_SESSION]} />
            <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
              Si la visioconférence tombe
            </Text>
            <BulletList items={[...ASSISTANCE_COUPURE]} />
          </DocSection>
        ) : null}

        {/* Section 4 : Documents mis à disposition */}
        {/*
          🔴 Audit blanc 2026-08-15. Cette section s'intitulait « Documents joints
          à cette convocation » et affirmait « Les documents suivants vous sont
          transmis avec cette convocation ». Or l'e-mail de convocation
          (`envoyerConvocation`, notifications-service.ts) n'attache AUCUN
          fichier : il porte un lien personnel vers l'espace stagiaire, lequel
          délivre effectivement ces quatre éléments. La pièce attestait donc une
          transmission qui n'avait pas lieu sous la forme annoncée — et
          l'auditeur qui confronte la convocation au journal d'envoi relève la
          contradiction sans même ouvrir le portail.

          La formule décrit désormais ce qui se passe réellement. NE PAS la
          re-durcir en « joints » sans avoir d'abord attaché les pièces à
          l'e-mail : c'est la phrase qui suit le code, jamais l'inverse.
          Indicateur 9 (information sur les conditions de déroulement).
        */}
        <DocSection title="Documents mis à votre disposition">
          <Text style={pdfStyles.paragraph}>
            Les documents suivants sont mis à votre disposition dans votre espace stagiaire,
            accessible par le lien personnel qui vous est adressé par courriel avec cette
            convocation :
          </Text>
          <BulletList
            items={[
              "Programme de formation détaillé",
              "Règlement intérieur des stagiaires",
              "Livret d'accueil stagiaire",
              "Questionnaire de positionnement (à remplir avant la formation)",
            ]}
          />
          <Text style={pdfStyles.paragraph}>
            Si vous ne parvenez pas à accéder à votre espace stagiaire, signalez-le au contact
            indiqué ci-dessus : ces documents vous seront adressés par un autre moyen.
          </Text>
        </DocSection>

        {/* Section 5 : Situation handicap */}
        <DocSection title="Situation de handicap — référent dédié">
          <Text style={pdfStyles.paragraph}>
            Si vous êtes en situation de handicap et nécessitez un aménagement, contactez notre
            référent handicap au plus tôt avant la session :
          </Text>
          {/*
            Nom d'abord, puis les deux canaux. L'ancienne version n'affichait que
            l'email — et c'est le contact GÉNÉRAL de l'OF : le stagiaire lisait
            « Référent handicap : contact@axion-ia.com », une adresse générique
            qui n'identifie personne. L'indicateur 26 demande un référent
            IDENTIFIÉ et joignable ; L.6352-3 impose sa désignation.
            Le nom et le téléphone étaient en configuration depuis toujours.
          */}
          {identite.referentHandicapNom ? (
            <FieldRow label="Référent handicap" value={identite.referentHandicapNom} />
          ) : null}
          {identite.referentHandicapEmail ? (
            <FieldRow label="Email" value={identite.referentHandicapEmail} />
          ) : null}
          {identite.referentHandicapTelephone ? (
            <FieldRow label="Téléphone" value={identite.referentHandicapTelephone} />
          ) : null}
          <Text style={[pdfStyles.legalNote]}>{LEGAL_MENTIONS.referentHandicap}</Text>
        </DocSection>

        {/* Section 6 : Absence / retard */}
        <DocSection title="Absence ou retard">
          <Text style={pdfStyles.paragraph}>
            Tout retard ou absence devra être signalé dès que possible auprès du contact indiqué
            ci-dessus. En cas d'annulation tardive, les conditions prévues aux Conditions Générales
            de Vente (CGV) s'appliquent.
          </Text>
        </DocSection>

        {/* Mention légale — UNIQUEMENT si le NDA existe. Avant l'enregistrement,
            cette ligne affirmait « déclaration enregistrée auprès du préfet »
            alors que l'en-tête de la même page disait « non encore enregistrée » :
            deux mentions contradictoires, dont une fausse. L'en-tête suffit. */}
        {identite.nda ? (
          <View style={{ marginTop: 8 }}>
            <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.declarationActivite}</Text>
          </View>
        ) : null}
      </QualiopiPage>
    </Document>
  );
}
