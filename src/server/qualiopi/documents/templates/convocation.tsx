/**
 * Qualiopi — Template PDF : Convocation à la formation.
 *
 * Mention réglementaire "À conserver". Contient les informations de session
 * (intitulé, dates, horaires heure de Paris, modalité, lieu/visio, formateur,
 * contact), les informations stagiaire, l'équipement requis (distanciel),
 * les documents joints et les mentions handicap/absence.
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
  horaires: string; /** Heure de Paris, ex: "09h00–17h00 (heure de Paris)" */
  dureeHeures: number;
  modalite: "présentiel" | "distanciel" | "mixte";
  lieu?: string;
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
          <FieldRow label="Durée totale" value={`${data.dureeHeures} heure(s)`} />
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

        {/* Section 3 : Équipement requis (distanciel uniquement) */}
        {isDistanciel ? (
          <DocSection title="Équipement requis (distanciel)">
            <Text style={pdfStyles.paragraph}>
              Pour participer dans de bonnes conditions, veuillez disposer de :
            </Text>
            <BulletList
              items={[
                "Un ordinateur avec caméra et micro fonctionnels.",
                "Une connexion internet stable (≥ 5 Mbit/s recommandé).",
                "L'application de visioconférence installée et testée avant la session.",
                "Un espace calme et éclairé.",
              ]}
            />
          </DocSection>
        ) : null}

        {/* Section 4 : Documents joints */}
        <DocSection title="Documents joints à cette convocation">
          <Text style={pdfStyles.paragraph}>
            Les documents suivants vous sont transmis avec cette convocation :
          </Text>
          <BulletList
            items={[
              "Programme de formation détaillé",
              "Règlement intérieur des stagiaires",
              "Livret d'accueil stagiaire",
              "Questionnaire de positionnement (à remplir avant la formation)",
            ]}
          />
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
