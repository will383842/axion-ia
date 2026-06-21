/**
 * Qualiopi — Règlement intérieur des stagiaires.
 *
 * Conforme L.6352-3 et suivants du Code du travail.
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  BulletList,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface ReglementInterieurData {
  numero: string;
  estCopie?: boolean;
  // Personnalisation optionnelle
  dateVersion: string;
}

// ============================================================
// Styles locaux
// ============================================================

const local = StyleSheet.create({
  articleBody: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 4,
  },
  signatureLu: {
    fontSize: 8,
    fontStyle: "italic",
    marginBottom: 12,
    color: pdfStyles.legalNote.color,
  },
  signatureInfoRow: {
    flexDirection: "row" as const,
    marginBottom: 6,
    gap: 8,
  },
  signatureInfoField: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: pdfStyles.fieldRow.borderBottomColor,
    paddingBottom: 4,
    fontSize: 9,
    color: pdfStyles.legalNote.color,
  },
});

// ============================================================
// Composant
// ============================================================

export function ReglementInterieurPdf({
  data,
  identite,
}: {
  data: ReglementInterieurData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Règlement intérieur des stagiaires"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        {/* Mention légale de tête */}
        <Text style={pdfStyles.legalNote}>
          {LEGAL_MENTIONS.reglementInterieur} — Version du {data.dateVersion}
        </Text>

        {/* Article 1 — Accès et identité */}
        <DocSection title="Article 1 — Accès et identification">
          <Text style={local.articleBody}>
            Tout stagiaire doit se présenter en début de formation avec une pièce d'identité valide.
            Pour les formations en distanciel, le stagiaire doit accéder à la session via son compte
            personnel et s'assurer que son identité est vérifiable par le formateur.
          </Text>
          <Text style={local.articleBody}>
            L'accès à la salle de formation (ou à l'espace numérique) est interdit à toute personne
            ne figurant pas sur la liste des stagiaires inscrits.
          </Text>
        </DocSection>

        {/* Article 2 — Assiduité et ponctualité */}
        <DocSection title="Article 2 — Assiduité et ponctualité">
          <Text style={local.articleBody}>
            Le stagiaire s'engage à être présent(e) et ponctuel(le) à toutes les sessions de
            formation. Toute absence ou retard doit être signalé le plus tôt possible à l'organisme
            de formation.
          </Text>
          <Text style={local.articleBody}>
            En formation distancielle, la caméra doit rester activée pendant les séquences
            synchrones sauf autorisation explicite du formateur. L'absence de caméra non justifiée
            peut entraîner la non-validation de la présence pour la demi-journée concernée.
          </Text>
          <Text style={local.articleBody}>
            La feuille d'émargement doit être signée à chaque demi-journée. En distanciel, le relevé
            de connexion fait office de justificatif de présence.
          </Text>
        </DocSection>

        {/* Article 3 — Discipline */}
        <DocSection title="Article 3 — Discipline et comportement">
          <Text style={local.articleBody}>Sont notamment interdits :</Text>
          <BulletList
            items={[
              "Tout comportement irrespectueux envers le formateur ou les autres stagiaires.",
              "L'enregistrement audio ou vidéo des sessions sans accord écrit préalable de l'organisme.",
              "L'usage de téléphones portables ou appareils personnels à des fins non pédagogiques pendant les séquences synchrones.",
              "La consommation d'alcool ou de substances illicites.",
            ]}
          />
          <Text style={local.articleBody}>
            Tout manquement grave aux règles de discipline peut entraîner l'exclusion définitive du
            stagiaire sans remboursement des frais de formation déjà engagés.
          </Text>
        </DocSection>

        {/* Article 4 — Propriété intellectuelle */}
        <DocSection title="Article 4 — Propriété intellectuelle">
          <Text style={local.articleBody}>
            Les supports de formation (présentations, documents, exercices, outils numériques) remis
            ou présentés pendant la formation sont la propriété exclusive de l'organisme de
            formation et/ou de ses formateurs. Ils sont mis à disposition du stagiaire à titre
            personnel et strictement non-cessible.
          </Text>
          <Text style={local.articleBody}>
            Toute reproduction, diffusion, revente ou exploitation commerciale des supports sans
            autorisation écrite est interdite et susceptible d'engager la responsabilité civile et
            pénale du stagiaire.
          </Text>
        </DocSection>

        {/* Article 5 — Confidentialité */}
        <DocSection title="Article 5 — Confidentialité">
          <Text style={local.articleBody}>
            Le stagiaire s'engage à traiter comme confidentiels tous les éléments relatifs aux
            autres stagiaires, aux formateurs, aux méthodes pédagogiques et aux contenus de
            formation auxquels il a accès dans le cadre du programme.
          </Text>
        </DocSection>

        {/* Article 6 — Sécurité */}
        <DocSection title="Article 6 — Sécurité">
          <Text style={local.articleBody}>
            En présentiel, le stagiaire doit respecter les consignes de sécurité affichées dans les
            locaux (sorties de secours, points de rassemblement). En cas d'accident, il doit en
            informer immédiatement le formateur ou le responsable des locaux.
          </Text>
          <Text style={local.articleBody}>
            En distanciel, le stagiaire est responsable de la sécurité de son environnement de
            travail (connexion sécurisée, confidentialité de son écran en espace partagé).
          </Text>
        </DocSection>

        {/* Article 7 — Évaluation et attestation */}
        <DocSection title="Article 7 — Évaluation et attestation de formation">
          <Text style={local.articleBody}>
            Des évaluations des acquis sont réalisées en cours et en fin de formation. La
            participation active aux évaluations conditionne la délivrance de l'attestation de fin
            de formation.
          </Text>
          <Text style={local.articleBody}>
            L'attestation de fin de formation est remise au stagiaire ayant suivi l'intégralité du
            programme ou, en cas d'absence partielle justifiée, au prorata des heures effectivement
            réalisées.
          </Text>
        </DocSection>

        {/* Article 8 — Réclamations */}
        <DocSection title="Article 8 — Réclamations">
          <Text style={local.articleBody}>
            Toute réclamation doit être formulée par écrit (courrier ou email) auprès du référent
            pédagogique de l'organisme dans un délai de 10 jours ouvrés suivant la situation
            litigieuse.
          </Text>
          <Text style={local.articleBody}>
            L'organisme s'engage à accuser réception de la réclamation dans les 5 jours ouvrés et à
            y répondre de manière circonstanciée dans un délai maximum de 15 jours ouvrés à compter
            de sa réception.
          </Text>
          <FieldRow label="Email réclamations" value={identite.email || "—"} />
        </DocSection>

        {/* Article 9 — Protection des données */}
        <DocSection title="Article 9 — Protection des données personnelles (RGPD)">
          <Text style={local.articleBody}>{LEGAL_MENTIONS.rgpd}</Text>
          <Text style={local.articleBody}>
            Les données personnelles du stagiaire (nom, prénom, coordonnées, données de connexion,
            évaluations) sont collectées aux fins de gestion administrative et pédagogique de la
            formation. Elles sont conservées pendant cinq (5) ans à compter de la fin de la
            formation, conformément aux obligations légales de l'organisme de formation.
          </Text>
          <Text style={local.articleBody}>
            Le stagiaire dispose des droits d'accès, de rectification, d'effacement, de limitation
            et de portabilité de ses données, ainsi que du droit de s'opposer à leur traitement. Ces
            droits s'exercent auprès du délégué à la protection des données (DPO) de l'organisme à
            l'adresse : {identite.dpoEmail || identite.email || "—"}.
          </Text>
        </DocSection>

        {/* Zone signature stagiaire */}
        <DocSection title="Engagement du stagiaire">
          <Text style={local.signatureLu}>
            Je soussigné(e), stagiaire, atteste avoir pris connaissance du présent règlement
            intérieur et m'engage à le respecter.
          </Text>
          <View style={local.signatureInfoRow}>
            <Text style={local.signatureInfoField}>
              Nom et prénom : ________________________________
            </Text>
            <Text style={local.signatureInfoField}>Date : ________________</Text>
          </View>
          <View style={pdfStyles.signatureBox}>
            <Text style={local.signatureLabel}>Signature du stagiaire</Text>
            <Text style={local.signatureLu}>Lu et approuvé</Text>
          </View>
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
