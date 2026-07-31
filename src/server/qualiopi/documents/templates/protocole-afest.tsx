/**
 * Qualiopi — Protocole individuel AFEST (action de formation en situation de
 * travail), exigence du décret D.6313-3-1 §3 pour le coaching 1-to-1.
 *
 * Cadre l'AFEST AVANT le démarrage : parties (organisme, entreprise, bénéficiaire,
 * formateur/accompagnateur AFEST, tuteur entreprise), analyse de l'activité,
 * objectifs, séquences (alternance mises en situation ↔ phases réflexives),
 * modalités d'évaluation, durée prévue. Signé par les 3 parties.
 *
 * Mention légale EXACTE : LEGAL_MENTIONS.afestProtocole (L.6313-1-2 / D.6313-3-1).
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
  BulletList,
  SignatureZone,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";

// ============================================================
// Styles spécifiques
// ============================================================

const styles = StyleSheet.create({
  intro: {
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  listText: {
    fontSize: 10,
    flex: 1,
    lineHeight: 1.5,
  },
});

// ============================================================
// Types de données
// ============================================================

export interface ProtocoleAfestPartie {
  nom: string;
  /** Fonction / rôle (ex. « Responsable pédagogique », « Tuteur entreprise »). */
  role?: string;
}

export interface ProtocoleAfestData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  /** Intitulé du parcours (intervention 1-to-1). */
  intitule: string;
  beneficiaire: { nom: string; prenom: string; entreprise?: string; fonction?: string };
  /** Formateur/accompagnateur AFEST désigné (D.6313-3-1 §2). */
  formateurAfest: ProtocoleAfestPartie;
  /** Tuteur en milieu professionnel, le cas échéant. */
  tuteurEntreprise?: ProtocoleAfestPartie;
  /** Synthèse de l'analyse de l'activité (cartographie) — texte libre. */
  analyseActivite: string;
  /** Objectifs pédagogiques individualisés. */
  objectifs: string[];
  /** Situations de travail support de l'apprentissage. */
  misesEnSituation: string[];
  /** Modalités des phases réflexives (alternance D.6313-3-1 §4). */
  phasesReflexives: string;
  /** Modalités d'évaluation des acquis (avant / après). */
  modalitesEvaluation: string;
  /** Durée prévue à la convention (heures). */
  dureePrevueHeures: number;
  dateDebut: string;
  dateFin: string;
  /** Affiché uniquement si le périmètre AFEST est certifié (flag). */
  perimetreCertifie?: boolean;
  qrToken?: string;
  qrDataUrl?: string;
  estCopie?: boolean;
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo, comportement historique
   * INCHANGÉ. Le circuit papier reste un chemin de plein droit.
   *
   * ⚠️ L'ORDRE des cadres suit le SSOT, où `axionia` figure EN PREMIER pour
   * cette pièce : l'organisme propose le cadrage avant que l'entreprise et le
   * bénéficiaire y adhèrent. Ce n'est pas le cas des autres circuits.
   */
  signatures?: PreuvesParPartie;
}

// ============================================================
// Composant principal
// ============================================================

export function ProtocoleAfestPdf({ data }: { data: ProtocoleAfestData }): React.ReactElement {
  const { identite } = data;
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();

  return (
    <Document>
      <QualiopiPage
        docTitle="Protocole individuel AFEST"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Intro + base légale */}
        <View style={pdfStyles.section}>
          <Text style={styles.intro}>
            {`Le présent protocole organise l'action de formation en situation de travail (AFEST) « ${data.intitule} » au bénéfice de ${prenomNom}.`}
          </Text>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.afestProtocole}</Text>
        </View>

        {/* Parties */}
        <DocSection title="Parties">
          <FieldRow label="Organisme de formation" value={identite.raisonSociale} required />
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
          {data.beneficiaire.entreprise ? (
            <FieldRow label="Entreprise" value={data.beneficiaire.entreprise} />
          ) : null}
          <FieldRow
            label="Bénéficiaire"
            value={
              data.beneficiaire.fonction
                ? `${prenomNom} (${data.beneficiaire.fonction})`
                : prenomNom
            }
          />
          <FieldRow
            label="Formateur AFEST"
            value={
              data.formateurAfest.role
                ? `${data.formateurAfest.nom} — ${data.formateurAfest.role}`
                : data.formateurAfest.nom
            }
          />
          {data.tuteurEntreprise ? (
            <FieldRow
              label="Tuteur entreprise"
              value={
                data.tuteurEntreprise.role
                  ? `${data.tuteurEntreprise.nom} — ${data.tuteurEntreprise.role}`
                  : data.tuteurEntreprise.nom
              }
            />
          ) : null}
        </DocSection>

        {/* Analyse de l'activité (AFEST §1) */}
        <DocSection title="Analyse de l'activité">
          <Text style={styles.listText}>{data.analyseActivite}</Text>
        </DocSection>

        {/* Objectifs pédagogiques */}
        <DocSection title="Objectifs pédagogiques">
          <BulletList items={data.objectifs} variant="objective" />
        </DocSection>

        {/* Séquences : alternance mises en situation ↔ phases réflexives (§4) */}
        <DocSection title="Mises en situation de travail">
          <BulletList items={data.misesEnSituation} />
        </DocSection>
        <DocSection title="Phases réflexives">
          <Text style={styles.listText}>{data.phasesReflexives}</Text>
        </DocSection>

        {/* Modalités d'évaluation + durée */}
        <DocSection title="Évaluation et durée">
          <FieldRow label="Évaluation des acquis" value={data.modalitesEvaluation} />
          <FieldRow
            label="Durée prévue"
            value={`${data.dureePrevueHeures.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`}
          />
          <FieldRow label="Du" value={data.dateDebut} />
          <FieldRow label="Au" value={data.dateFin} />
          {data.perimetreCertifie ? (
            <FieldRow
              label="Financement"
              value="Action éligible au financement de la formation professionnelle continue."
            />
          ) : null}
        </DocSection>

        {/* Signatures 3 parties */}
        <DocSection title="Signatures">
          <SignatureZone
            faitLe={`${identite.adresseSiege || "—"}, le ${data.dateEmission}`}
            parties={[
              { titre: "L'organisme", signature: data.signatures?.axionia ?? null },
              { titre: "L'entreprise", signature: data.signatures?.client ?? null },
              { titre: "Le bénéficiaire", signature: data.signatures?.beneficiaire ?? null },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
