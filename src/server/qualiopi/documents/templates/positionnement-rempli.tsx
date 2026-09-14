/**
 * Qualiopi — Template PDF : positionnement REMPLI, nominatif et daté.
 *
 * 🔴 Constat C2-03 (audit initial 2026-09-14). La seule pièce « positionnement »
 * que l'outil produisait était le gabarit vierge (`positionnement.tsx`) : cases
 * à cocher et lignes vides, sans nom ni réponse. Le dossier d'audit la
 * présentait aux indicateurs 4 et 8 — un formulaire vierge à la place de la
 * preuve qu'un besoin a été recueilli.
 *
 * Cette pièce-ci ne porte QUE ce que la stagiaire a répondu, lu par
 * `lirePositionnement`, avec l'instant de la réponse et le début de la session
 * pour que la chronologie se lise sans rien recouper. Une question sans réponse
 * l'écrit (« Non renseigné ») : rien n'est complété, rien n'est déduit.
 *
 * Ce n'est PAS une pièce du registre (`DocumentGenere`) : elle est rendue à la
 * volée depuis la base au moment de constituer le dossier, comme les registres.
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
import {
  libelleBesoinAdaptation,
  type PositionnementLu,
} from "@/server/qualiopi/positionnement/lecture-positionnement";

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
  niveauRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  niveauObjectif: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
    paddingRight: 8,
  },
  niveauValeur: {
    fontSize: 10,
    color: brandColor("fg"),
    width: 150,
  },
});

export interface PositionnementRempliData {
  /** Référence stable de la pièce (dérivée de l'identifiant du questionnaire). */
  reference: string;
  nomStagiaire: string;
  intituleFormation: string;
  /** Début de la session, date et heure de Paris. */
  debutSession: string;
  /** Instant de la réponse, date et heure de Paris. */
  reponduLe: string;
  /** « avant / après le début de la session » (`chronologieReponse`). */
  chronologie: string;
  /** Instant RÉEL du tirage de la pièce, date et heure de Paris. Jamais antidaté. */
  tireeLe: string;
  positionnement: PositionnementLu;
}

function Reponse({ question, valeur }: { question: string; valeur: string | null }) {
  return (
    <View>
      <Text style={localStyles.question}>{question}</Text>
      <Text style={localStyles.reponse}>{valeur ?? NON_RENSEIGNE}</Text>
    </View>
  );
}

export function PositionnementRempliPdf({
  data,
  identite,
}: {
  data: PositionnementRempliData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const p = data.positionnement;
  return (
    <Document>
      <QualiopiPage
        docTitle="Positionnement à l'entrée — réponses"
        docNumber={data.reference}
        identite={identite}
      >
        <View style={{ marginBottom: 10 }}>
          <FieldRow label="Stagiaire" value={data.nomStagiaire} />
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Début de la session" value={data.debutSession} />
          <FieldRow
            label="Réponse enregistrée le"
            value={`${data.reponduLe}, ${data.chronologie}`}
          />
          <Text style={pdfStyles.paragraph}>{`Pièce tirée le ${data.tireeLe}.`}</Text>
          {p.saisieAdmin ? (
            <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
              Réponses saisies par l&apos;organisme, et non par le ou la stagiaire.
            </Text>
          ) : null}
        </View>

        <DocSection title="Contexte professionnel">
          <Reponse question="Fonction" valeur={p.fonction} />
          <Reponse question="Secteur d'activité" valeur={p.secteur} />
          <Reponse question="Outils d'IA déjà utilisés" valeur={p.outilsUtilises} />
          <Reponse question="Fréquence d'usage" valeur={p.frequenceUsage} />
        </DocSection>

        <DocSection title="Niveau déclaré sur les objectifs de la formation">
          {p.niveaux.length === 0 ? (
            <Text style={localStyles.reponse}>{NON_RENSEIGNE}</Text>
          ) : (
            p.niveaux.map((n) => (
              <View key={n.objectif} style={localStyles.niveauRow}>
                <Text style={localStyles.niveauObjectif}>{n.objectif}</Text>
                <Text style={localStyles.niveauValeur}>{n.libelle}</Text>
              </View>
            ))
          )}
        </DocSection>

        <DocSection title="Besoins et attentes">
          <Reponse question="Attentes exprimées" valeur={p.attentes} />
          <Reponse question="Tâche du quotidien à traiter" valeur={p.tacheVisee} />
        </DocSection>

        <DocSection title="Besoin d'adaptation">
          <Reponse
            question="Besoin d'adaptation déclaré"
            valeur={libelleBesoinAdaptation(p.besoinAdaptation, p.saisieAdmin)}
          />
          {p.besoinAdaptation === true ? (
            <Reponse question="Précision" valeur={p.detailAdaptation} />
          ) : null}
        </DocSection>

        <LegalCallout variant="legal">
          Pièce établie à partir des réponses enregistrées au questionnaire de positionnement —
          Indicateurs Qualiopi 4, 8 et 10. Traitement conforme au RGPD. Droit d&apos;accès :{" "}
          {identite.dpoEmail || identite.email || "contact@formation"}.
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
