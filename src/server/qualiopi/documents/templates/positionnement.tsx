/**
 * Qualiopi — Template PDF : Questionnaire de positionnement.
 *
 * Mention "à remplir avant la formation — ne conditionne pas l'accès".
 * Sections : Identité, A) Rapport à l'IA, B) Besoins/attentes,
 * C) Contexte professionnel.
 * Champs vides à remplir manuellement ou via formulaire numérique.
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
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles locaux
// ============================================================

const localStyles = StyleSheet.create({
  checkRow: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "flex-start",
  },
  checkBox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    marginRight: 6,
    marginTop: 1,
  },
  checkLabel: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
  },
  emptyLine: {
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border-strong"),
    marginBottom: 10,
    minHeight: 20,
  },
  questionLabel: {
    fontSize: 9,
    color: brandColor("fg-soft"),
    fontWeight: "bold",
    marginBottom: 3,
  },
});

// ============================================================
// Types
// ============================================================

export interface PositionnementData {
  numero: string;
  estCopie?: boolean;
  intituleFormation: string;
  dateSession: string;
  // Identité préremplie si connue (optionnel — laissée vide sinon)
  nomStagiaire?: string;
  entreprise?: string;
}

// ============================================================
// Composant
// ============================================================

/** Ligne de case à cocher. */
function CheckOption({ label }: { label: string }): React.ReactElement {
  return (
    <View style={localStyles.checkRow}>
      <View style={localStyles.checkBox} />
      <Text style={localStyles.checkLabel}>{label}</Text>
    </View>
  );
}

/** Ligne de réponse libre. */
function FreeTextField({ label }: { label: string }): React.ReactElement {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={localStyles.questionLabel}>{label}</Text>
      <View style={localStyles.emptyLine} />
    </View>
  );
}

export function PositionnementPdf({
  data,
  identite,
}: {
  data: PositionnementData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Questionnaire de positionnement"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie !== undefined ? { estCopie: data.estCopie } : {})}
      >
        {/* Mention introductive */}
        <View style={{ marginBottom: 12 }}>
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            À remplir avant la formation — ce questionnaire ne conditionne pas l'accès à la
            formation.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Ces informations permettent au formateur d'adapter le contenu à vos besoins réels. Vos
            réponses sont confidentielles.
          </Text>
        </View>

        {/* Formation de référence */}
        <View style={{ marginBottom: 10 }}>
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date de session" value={data.dateSession} />
        </View>

        {/* Identité */}
        <DocSection title="Votre identité">
          <View style={{ marginBottom: 6 }}>
            <Text style={localStyles.questionLabel}>Nom et prénom</Text>
            <View style={[localStyles.emptyLine, { minHeight: 18 }]}>
              {data.nomStagiaire ? <Text style={{ fontSize: 10 }}>{data.nomStagiaire}</Text> : null}
            </View>
          </View>
          <View style={{ marginBottom: 6 }}>
            <Text style={localStyles.questionLabel}>Entreprise / Structure</Text>
            <View style={[localStyles.emptyLine, { minHeight: 18 }]}>
              {data.entreprise ? <Text style={{ fontSize: 10 }}>{data.entreprise}</Text> : null}
            </View>
          </View>
          <FreeTextField label="Intitulé du poste / fonction" />
        </DocSection>

        {/* A) Rapport à l'IA */}
        <DocSection title="A — Votre rapport à l'intelligence artificielle">
          <Text style={localStyles.questionLabel}>Niveau actuel avec les outils IA :</Text>
          <CheckOption label="Débutant(e) — je n'ai pas ou peu utilisé d'outil IA" />
          <CheckOption label="Intermédiaire — j'utilise occasionnellement quelques outils IA" />
          <CheckOption label="Avancé(e) — j'intègre régulièrement des outils IA dans mon travail" />
          <CheckOption label="Expert(e) — je conçois ou pilote des projets IA" />

          <View style={{ marginTop: 8 }}>
            <FreeTextField label="Outils IA déjà utilisés (ChatGPT, Copilot, Gemini, autre…)" />
          </View>

          <Text style={localStyles.questionLabel}>
            Avez-vous déjà suivi une formation sur l'IA ?
          </Text>
          <CheckOption label="Non" />
          <CheckOption label="Oui — préciser :" />
          <View style={localStyles.emptyLine} />
        </DocSection>

        {/* B) Besoins / attentes */}
        <DocSection title="B — Vos besoins et attentes">
          <Text style={localStyles.questionLabel}>Objectif principal de cette formation :</Text>
          <CheckOption label="Comprendre ce qu'est l'IA et ses enjeux" />
          <CheckOption label="Utiliser des outils IA pour gagner en productivité" />
          <CheckOption label="Intégrer l'IA dans mon métier / processus existants" />
          <CheckOption label="Piloter ou déployer des projets IA au sein de mon organisation" />
          <CheckOption label="Autre :" />
          <View style={localStyles.emptyLine} />

          <View style={{ marginTop: 6 }}>
            <FreeTextField label="Principaux défis ou points de blocage que vous souhaitez surmonter" />
          </View>
          <FreeTextField label="Résultats concrets attendus à l'issue de la formation" />
        </DocSection>

        {/* C) Contexte professionnel */}
        <DocSection title="C — Votre contexte professionnel">
          <FreeTextField label="Secteur d'activité de votre organisation" />
          <Text style={localStyles.questionLabel}>Taille de votre équipe :</Text>
          <CheckOption label="Indépendant(e) / Freelance" />
          <CheckOption label="TPE (1–10 personnes)" />
          <CheckOption label="PME (11–250 personnes)" />
          <CheckOption label="ETI (251–4 999 personnes)" />
          <CheckOption label="Grande entreprise (≥ 5 000 personnes)" />

          <View style={{ marginTop: 8 }}>
            <FreeTextField label="Contraintes spécifiques à signaler (handicap, aménagement, autre)" />
          </View>
          <Text style={[pdfStyles.legalNote, { marginTop: 4 }]}>
            {`En cas de besoin d'aménagement, notre référent handicap est à votre disposition.`}
          </Text>
        </DocSection>

        <Text style={pdfStyles.legalNote}>
          Données collectées dans le cadre du suivi pédagogique Qualiopi — Indicateur 7. Traitement
          conforme au RGPD. Droit d'accès :{" "}
          {identite.dpoEmail || identite.email || "contact@formation"}.
        </Text>
      </QualiopiPage>
    </Document>
  );
}
