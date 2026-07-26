/**
 * Qualiopi — Livret d'accueil stagiaire.
 *
 * Présentation de l'organisme, contacts, modalités pratiques,
 * évaluation, accessibilité handicap, réclamations, RGPD.
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { View, Document, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  BulletList,
  LegalCallout,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import {
  LEGAL_MENTIONS,
  DOCUMENT_RETENTION_YEARS,
  HANDICAP_PARTENAIRES,
} from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface LivretAccueilData {
  numero: string;
  estCopie?: boolean;
  // Contacts pédago
  contactPedagogique: {
    nomPrenom: string;
    email: string;
    telephone?: string;
  };
  contactAdministratif?: {
    nomPrenom: string;
    email: string;
    telephone?: string;
  };
  // Version du livret
  dateVersion: string;
}

// ============================================================
// Styles locaux
// ============================================================

const local = StyleSheet.create({
  welcomeText: {
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  contactBlock: {
    marginBottom: 6,
  },
});

// ============================================================
// Composant
// ============================================================

export function LivretAccueilPdf({
  data,
  identite,
}: {
  data: LivretAccueilData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Livret d'accueil stagiaire"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        {/* Bienvenue */}
        <DocSection title="Bienvenue">
          <Text style={local.welcomeText}>
            Nous sommes heureux de vous accueillir au sein de notre organisme de formation. Ce
            livret a pour objectif de vous présenter notre fonctionnement, nos engagements qualité
            et les informations pratiques dont vous aurez besoin tout au long de votre parcours de
            formation.
          </Text>
          <Text style={pdfStyles.legalNote}>Version du {data.dateVersion}</Text>
        </DocSection>

        {/* Présentation de l'organisme */}
        <DocSection title="1. Présentation de l'organisme">
          <FieldRow label="Raison sociale" value={identite.raisonSociale || "Axion-IA SAS"} />
          <FieldRow label="SIRET" value={identite.siret} required />
          <FieldRow label="NDA" value={identite.nda} required />
          {/*
            🔴 F29 — la ligne n'apparaît QUE si le numéro existe.
            Marquée `required`, elle imprimait « Non renseigné » dans le style
            des champs manquants sur chaque convention, contrat et certificat —
            c'est-à-dire précisément les pièces qui partent chez le client, chez
            l'OPCO et chez le certificateur. Attirer l'œil en rouge sur une
            absence est pire que l'omettre : un organisme non encore certifié
            n'a simplement pas de numéro Qualiopi à porter, et la ligne n'a
            aucune raison d'exister. Même traitement que la facture et le devis.
          */}
          {identite.qualiopi ? (
            <FieldRow label="Certification Qualiopi" value={identite.qualiopi} />
          ) : null}
          <FieldRow label="Siège social" value={identite.adresseSiege} required />
          <FieldRow
            label="Lieu d'exercice"
            value={identite.adresseExercice || identite.adresseSiege || "—"}
          />
          <FieldRow label="Site internet" value={identite.site || "—"} />
          <Text style={[local.bodyText, { marginTop: 6 }]}>
            Notre organisme est certifié Qualiopi, gage de qualité de nos processus de formation.
            Nous dispensons des formations professionnelles dans les domaines de l'intelligence
            artificielle, du numérique et des technologies émergentes.
          </Text>
        </DocSection>

        {/* Contacts pédagogiques */}
        <DocSection title="2. Vos contacts">
          <Text style={[local.bodyText, { fontWeight: "bold" }]}>Référent pédagogique</Text>
          <View style={local.contactBlock}>
            <FieldRow label="Nom / Prénom" value={data.contactPedagogique.nomPrenom} />
            <FieldRow label="Email" value={data.contactPedagogique.email} />
            {data.contactPedagogique.telephone ? (
              <FieldRow label="Téléphone" value={data.contactPedagogique.telephone} />
            ) : null}
          </View>

          {data.contactAdministratif ? (
            <>
              <Text style={[local.bodyText, { fontWeight: "bold", marginTop: 4 }]}>
                Contact administratif
              </Text>
              <View style={local.contactBlock}>
                <FieldRow label="Nom / Prénom" value={data.contactAdministratif.nomPrenom} />
                <FieldRow label="Email" value={data.contactAdministratif.email} />
                {data.contactAdministratif.telephone ? (
                  <FieldRow label="Téléphone" value={data.contactAdministratif.telephone} />
                ) : null}
              </View>
            </>
          ) : null}
        </DocSection>

        {/* Modalités pratiques */}
        <DocSection title="3. Modalités pratiques">
          <Text style={[local.bodyText, { fontWeight: "bold" }]}>En présentiel</Text>
          <BulletList
            items={[
              "L'accueil est assuré 15 minutes avant le début de chaque session.",
              "Merci de vous munir d'une pièce d'identité lors de votre première journée.",
              "Des pauses sont prévues selon le programme communiqué.",
              "L'émargement est obligatoire à chaque demi-journée.",
            ]}
          />

          <Text style={[local.bodyText, { fontWeight: "bold", marginTop: 6 }]}>En distanciel</Text>
          <BulletList
            items={[
              "Le lien de connexion vous est communiqué par email avant la session.",
              "Merci d'activer votre caméra pendant les séquences synchrones.",
              "Un relevé de connexion automatique fait office d'émargement.",
              "En cas de problème technique, contactez immédiatement votre référent pédagogique.",
            ]}
          />
        </DocSection>

        {/* Évaluation et attestation */}
        <DocSection title="4. Évaluation et attestation">
          <Text style={local.bodyText}>
            Votre progression est évaluée tout au long de la formation (évaluations formatives) et
            en fin de parcours (évaluation sommative). Ces évaluations permettent de mesurer
            l'acquisition des compétences visées.
          </Text>
          <Text style={local.bodyText}>
            À l'issue de la formation, vous recevrez une attestation de fin de formation mentionnant
            les objectifs, la durée, les dates et les résultats de votre évaluation.
          </Text>
          <LegalCallout variant="info">
            La participation active aux évaluations est obligatoire pour obtenir votre attestation.
          </LegalCallout>
        </DocSection>

        {/* Accessibilité et handicap */}
        <DocSection title="5. Accessibilité et situation de handicap">
          <Text style={local.bodyText}>{LEGAL_MENTIONS.referentHandicap}</Text>
          <Text style={local.bodyText}>
            Nous nous engageons à rendre nos formations accessibles à toutes et tous. Si vous êtes
            en situation de handicap ou si vous avez des besoins spécifiques (mobilité réduite,
            troubles visuels ou auditifs, difficultés d'apprentissage…), notre référent handicap est
            à votre disposition pour étudier les aménagements nécessaires.
          </Text>
          <FieldRow label="Référent handicap" value={identite.raisonSociale || "Axion-IA SAS"} />
          <FieldRow
            label="Contact"
            value={identite.referentHandicapEmail || identite.email || "—"}
          />
          <Text style={[local.bodyText, { marginTop: 6, fontWeight: "bold" }]}>
            Nos partenaires et relais spécialisés
          </Text>
          <BulletList items={HANDICAP_PARTENAIRES.map((p) => `${p.nom} — ${p.role} (${p.url})`)} />
          <Text style={pdfStyles.legalNote}>
            Nous vous encourageons à nous contacter avant le début de la formation pour anticiper
            tout aménagement spécifique.
          </Text>
        </DocSection>

        {/* Réclamations */}
        <DocSection title="6. Réclamations">
          <Text style={local.bodyText}>
            Votre satisfaction est notre priorité. Si vous rencontrez un problème ou si vous
            souhaitez formuler une réclamation, nous vous invitons à nous contacter :
          </Text>
          <BulletList
            items={[
              "Par écrit (courrier ou email) auprès de votre référent pédagogique.",
              "Dans un délai de 10 jours ouvrés suivant la situation litigieuse.",
              "Nous vous accuserons réception sous 5 jours ouvrés et vous apporterons une réponse circonstanciée dans un délai maximum de 15 jours ouvrés.",
            ]}
          />
          <FieldRow label="Email réclamations" value={identite.email || "—"} />
        </DocSection>

        {/* RGPD */}
        <DocSection title="7. Protection de vos données personnelles (RGPD)">
          <Text style={local.bodyText}>{LEGAL_MENTIONS.rgpd}</Text>
          <Text style={local.bodyText}>
            Vos données personnelles (identité, coordonnées, données de connexion, évaluations) sont
            collectées aux fins de gestion administrative et pédagogique de votre formation. Elles
            sont conservées pendant {DOCUMENT_RETENTION_YEARS} ans à compter de la fin de votre
            formation, conformément aux obligations légales de l'organisme.
          </Text>
          <Text style={local.bodyText}>
            Vous disposez des droits d'accès, de rectification, d'effacement, de limitation et de
            portabilité de vos données, ainsi que du droit de vous opposer à leur traitement.
          </Text>
          <FieldRow
            label="Exercice de vos droits (DPO)"
            value={identite.dpoEmail || identite.email || "—"}
          />
          <Text style={pdfStyles.legalNote}>
            Pour toute question relative au traitement de vos données, vous pouvez également
            contacter la Commission Nationale de l'Informatique et des Libertés (CNIL) :
            www.cnil.fr.
          </Text>
        </DocSection>

        {/* Bonne formation */}
        <View style={{ marginTop: 12 }}>
          <Text style={local.welcomeText}>
            Nous vous souhaitons une excellente formation et espérons que ce parcours contribuera
            pleinement à votre développement professionnel.
          </Text>
          <Text style={[local.bodyText, { fontWeight: "bold" }]}>
            L'équipe {identite.raisonSociale || "Axion-IA SAS"}
          </Text>
        </View>
      </QualiopiPage>
    </Document>
  );
}
