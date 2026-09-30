/**
 * Qualiopi — Template PDF : questionnaire de satisfaction RÉPONDU, nominatif et
 * daté de la réponse.
 *
 * 🔴 Constat du dossier ZIP du 2026-09-30. L'indicateur 30 n'y avait AUCUNE
 * preuve de recueil : la seule pièce « satisfaction » était le gabarit vierge
 * (`satisfaction.tsx`). Cette pièce-ci ne porte QUE ce qui a été enregistré —
 * note, commentaire, et pour une saisie de l'organisme ce qu'il a saisi — avec
 * l'instant de la réponse. Une question sans réponse l'écrit (« Non
 * renseigné ») : rien n'est complété, rien n'est déduit.
 *
 * Même modèle que `positionnement-rempli.tsx` : une saisie par l'organisme est
 * titrée comme telle et ne vaut pas réponse du stagiaire.
 *
 * Ce n'est PAS une pièce du registre (`DocumentGenere`) : elle est rendue à la
 * volée depuis la base au moment de constituer le dossier.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
  LegalCallout,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

const NON_RENSEIGNE = "Non renseigné";

const localStyles = StyleSheet.create({
  question: {
    fontSize: 9,
    color: brandColor("fg-soft"),
    fontWeight: "bold",
    marginBottom: 2,
  },
  reponse: {
    fontSize: 10,
    color: brandColor("fg"),
    marginBottom: 8,
  },
});

export interface SatisfactionRemplieData {
  /** Référence stable de la pièce (dérivée de l'identifiant du questionnaire). */
  reference: string;
  /** « à chaud » (fin de session) ou « à froid » (après la session). */
  moment: "chaud" | "froid";
  nomStagiaire: string;
  intituleFormation: string;
  /** Début et fin de la session, date et heure de Paris. */
  debutSession: string;
  finSession: string;
  /** Instant de la réponse, date et heure de Paris. */
  reponduLe: string;
  /** Instant RÉEL du tirage de la pièce, date et heure de Paris. Jamais antidaté. */
  tireeLe: string;
  saisieOrganisme: boolean;
  /** Note globale /5 — `null` si non renseignée. */
  noteGlobale: number | null;
  commentaire: string | null;
  objectifsAtteints: string | null;
  pointsForts: string | null;
  axesAmelioration: string | null;
}

function Reponse({ question, valeur }: { question: string; valeur: string | null }) {
  return (
    <View>
      <Text style={localStyles.question}>{question}</Text>
      <Text style={localStyles.reponse}>{valeur ?? NON_RENSEIGNE}</Text>
    </View>
  );
}

export function SatisfactionRempliePdf({
  data,
  identite,
}: {
  data: SatisfactionRemplieData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const moment = data.moment === "chaud" ? "à chaud" : "à froid";
  const docTitle = data.saisieOrganisme
    ? `Satisfaction ${moment} — saisie par l'organisme`
    : `Questionnaire de satisfaction ${moment} — réponses`;
  const origine = data.saisieOrganisme
    ? `Pièce établie à partir des éléments saisis par l'organisme au questionnaire de satisfaction ${moment} — Indicateur Qualiopi 30.`
    : `Pièce établie à partir des réponses enregistrées au questionnaire de satisfaction ${moment} — Indicateur Qualiopi 30.`;

  return (
    <Document>
      <QualiopiPage docTitle={docTitle} docNumber={data.reference} identite={identite}>
        <View style={{ marginBottom: 10 }}>
          <FieldRow label="Stagiaire" value={data.nomStagiaire} />
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Session" value={`du ${data.debutSession} au ${data.finSession}`} />
          <FieldRow
            label={data.saisieOrganisme ? "Saisie enregistrée le" : "Réponse enregistrée le"}
            value={data.reponduLe}
          />
          <Text style={pdfStyles.paragraph}>{`Pièce tirée le ${data.tireeLe}.`}</Text>
          {data.saisieOrganisme ? (
            <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
              Éléments saisis par l&apos;organisme, et non par le ou la stagiaire : ils ne valent
              pas réponse du stagiaire.
            </Text>
          ) : null}
        </View>

        <DocSection title="Appréciation">
          <Reponse
            question="Note globale"
            valeur={data.noteGlobale !== null ? `${data.noteGlobale}/5` : null}
          />
          <Reponse question="Commentaire" valeur={data.commentaire} />
        </DocSection>

        {data.saisieOrganisme ||
        data.objectifsAtteints !== null ||
        data.pointsForts !== null ||
        data.axesAmelioration !== null ? (
          <DocSection title="Détail">
            <Reponse question="Objectifs atteints" valeur={data.objectifsAtteints} />
            <Reponse question="Points forts" valeur={data.pointsForts} />
            <Reponse question="Axes d'amélioration" valeur={data.axesAmelioration} />
          </DocSection>
        ) : null}

        <LegalCallout variant="legal">
          {origine} Droit d&apos;accès :{" "}
          {identite.dpoEmail || identite.email || "contact@formation"}.
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
