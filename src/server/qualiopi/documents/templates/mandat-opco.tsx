/**
 * Qualiopi — Mandat de l'entreprise pour agir auprès de son OPCO.
 *
 * ## Ce que cette pièce est, et ce qu'elle n'est pas
 *
 * Un mandat SPÉCIAL (art. 1987 et 1988 C. civ.) : il ne vise qu'UNE demande de
 * prise en charge, pour UNE action désignée — formation, dates, stagiaires,
 * OPCO. Il est LIMITÉ au dépôt de cette demande et à son suivi, et RÉVOCABLE à
 * tout moment par écrit (art. 2004 C. civ.).
 *
 * 🔴 Il ne confère AUCUN pouvoir de recevoir des fonds. Un mandat de déposer
 * n'est pas une subrogation de paiement : si l'OPCO règle l'organisme
 * directement, c'est au titre de la convention et de ses propres règles, jamais
 * au titre de cette pièce. La confusion des deux ferait de l'organisme un
 * encaisseur pour compte de tiers, ce qu'il n'est pas.
 *
 * ⚠️ Pièce DISTINCTE de l'annexe 2 du contrat d'apporteur d'affaires : celle-ci
 * lie l'organisme à un partenaire commercial ; celle-là lie l'entreprise à
 * l'organisme. Le mandataire ne peut d'ailleurs se substituer personne
 * (art. 1994 C. civ.) — un apporteur ne tient aucun pouvoir de cette pièce.
 *
 * Texte SOBRE, à dessein : il n'engage l'organisme qu'au dépôt. Aucune promesse
 * de résultat, aucun délai garanti — la décision et son calendrier
 * appartiennent à l'OPCO seul. Relu par la juriste avant toute émission.
 *
 * Signature par le CANAL MAISON (ADR 0037), comme les conventions : d'où la
 * mention du plafond probant imprimée au-dessus des signatures.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  NdaFieldRow,
  SignatureZone,
  pdfStyles,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import { MENTION_PLAFOND_CANAL_MAISON } from "@/server/qualiopi/documents/signature/mentions-document";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface MandatOpcoData {
  numero: string;
  estCopie?: boolean;
  /** Injecté par `generateDocument` quand l'identité de l'OF est incomplète. */
  estSpecimen?: boolean;
  specimenMotif?: string;
  /** Le MANDANT : l'entreprise adhérente de l'OPCO. */
  entreprise: {
    raisonSociale: string;
    siret: string;
    adresse: string;
    /** Personne qui signe pour l'entreprise. */
    representant: string;
    /** Sa qualité — c'est elle qui rend le pouvoir de donner mandat opposable. */
    qualiteRepresentant: string;
  };
  /** L'OPCO auprès duquel, et auprès duquel SEULEMENT, le mandat s'exerce. */
  opco: {
    nom: string;
    adresse?: string;
  };
  /** L'action DÉSIGNÉE — ce qui rend le mandat spécial et non général. */
  action: {
    intitule: string;
    dateDebut: string;
    dateFin: string;
    dureeHeures: number;
    /** Stagiaires, nom et prénom. */
    stagiaires: string[];
    /** Numéro de la convention que le mandat accompagne, s'il existe déjà. */
    numeroConvention?: string;
  };
  dateMandat: string;
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo — même contrat que les
   * conventions : le circuit papier reste un chemin de plein droit.
   */
  signatures?: PreuvesParPartie;
}

// ============================================================
// Styles locaux
// ============================================================

const local = StyleSheet.create({
  listItem: {
    fontSize: 10,
    marginBottom: 2,
    paddingLeft: 8,
  },
  plafond: {
    fontSize: 8,
    fontStyle: "italic",
    marginBottom: 6,
    color: pdfStyles.legalNote.color,
  },
});

// ============================================================
// Composant
// ============================================================

export function MandatOpcoPdf({
  data,
  identite,
}: {
  data: MandatOpcoData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const organisme = identite.raisonSociale || "l'organisme de formation";
  const stagiaires = data.action.stagiaires;
  return (
    <Document>
      <QualiopiPage
        docTitle="Mandat spécial de représentation auprès de l'OPCO"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        <Text style={pdfStyles.legalNote}>
          Mandat spécial, limité et révocable, établi en application des articles 1984 et suivants
          du Code civil.
        </Text>

        {/* 1. Parties */}
        <DocSection title="1. Parties">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Le mandant (l&apos;entreprise)
          </Text>
          <FieldRow label="Raison sociale" value={data.entreprise.raisonSociale} required />
          <FieldRow label="SIRET" value={data.entreprise.siret} required />
          <FieldRow label="Adresse" value={data.entreprise.adresse} />
          <FieldRow label="Représentée par" value={data.entreprise.representant} required />
          <FieldRow label="En qualité de" value={data.entreprise.qualiteRepresentant} required />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Le mandataire (l&apos;organisme de formation)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale} required />
          <FieldRow label="SIRET" value={identite.siret} required />
          <NdaFieldRow nda={identite.nda} />
          <FieldRow label="Siège social" value={identite.adresseSiege} required />
          <FieldRow label="Email" value={identite.email || "—"} />
        </DocSection>

        {/* 2. Objet */}
        <DocSection title="2. Objet du mandat">
          <Text style={pdfStyles.paragraph}>
            Le mandant donne au mandataire, qui l&apos;accepte, le mandat spécial d&apos;accomplir
            en son nom et pour son compte, auprès de l&apos;opérateur de compétences désigné
            ci-dessous, les démarches nécessaires au dépôt de la demande de prise en charge de la
            seule action de formation désignée ci-dessous.
          </Text>
          <FieldRow label="OPCO" value={data.opco.nom} required />
          {data.opco.adresse ? (
            <FieldRow label="Adresse de l'OPCO" value={data.opco.adresse} />
          ) : null}
          <FieldRow label="Formation" value={data.action.intitule} required />
          <FieldRow label="Date de début" value={data.action.dateDebut} required />
          <FieldRow label="Date de fin" value={data.action.dateFin} required />
          <FieldRow
            label="Durée"
            value={`${data.action.dureeHeures} heure${data.action.dureeHeures > 1 ? "s" : ""}`}
          />
          {data.action.numeroConvention ? (
            <FieldRow
              label="Convention de formation"
              value={`n° ${data.action.numeroConvention}`}
            />
          ) : null}
          <Text style={[pdfStyles.paragraph, { marginTop: 6 }]}>
            {stagiaires.length > 1 ? "Stagiaires concernés :" : "Stagiaire concerné :"}
          </Text>
          {stagiaires.length > 0 ? (
            stagiaires.map((s, i) => (
              <Text key={i} style={local.listItem}>
                – {s}
              </Text>
            ))
          ) : (
            <Text style={local.listItem}>– Non renseigné</Text>
          )}
        </DocSection>

        {/* 3. Étendue et limites */}
        <DocSection title="3. Étendue et limites du mandat">
          <Text style={pdfStyles.paragraph}>
            Le mandat est limité à la constitution et au dépôt de la demande de prise en charge de
            l&apos;action désignée à l&apos;article 2, à la transmission à l&apos;OPCO des pièces
            fournies ou validées par le mandant, et à la réponse aux demandes de complément de
            l&apos;OPCO portant sur cette demande.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Il ne confère au mandataire aucun autre pouvoir. En particulier, le mandataire ne peut
            ni présenter une autre demande, ni modifier les informations transmises sans
            l&apos;accord du mandant, ni prendre au nom du mandant un engagement autre que la
            demande décrite.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Le présent mandat ne confère aucun pouvoir de recevoir des fonds : le mandataire ne peut
            ni recevoir, ni encaisser, ni percevoir aucune somme pour le compte du mandant. Le
            présent mandat ne vaut pas subrogation de paiement ; celle-ci, lorsqu&apos;elle existe,
            relève de la convention de formation et des règles de l&apos;OPCO, et non du présent
            mandat.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Le mandataire exécute le mandat personnellement et ne peut se substituer aucune autre
            personne, notamment un apporteur d&apos;affaires ou un partenaire commercial. Le mandant
            conserve la faculté d&apos;agir lui-même auprès de l&apos;OPCO.
          </Text>
        </DocSection>

        {/* 4. Obligations */}
        <DocSection title="4. Obligations des parties">
          <Text style={pdfStyles.paragraph}>
            Le mandataire accomplit les démarches sur la base des informations et des pièces
            fournies par le mandant, et l&apos;informe du dépôt de la demande ainsi que des réponses
            reçues de l&apos;OPCO.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Le mandant fournit des informations exactes et complètes et demeure responsable de leur
            exactitude.
          </Text>
        </DocSection>

        {/* 5. Décision de l'OPCO */}
        <DocSection title="5. Décision de l'OPCO">
          <Text style={pdfStyles.paragraph}>
            La décision de prise en charge, son montant et son délai appartiennent à l&apos;OPCO
            seul, selon ses propres règles. Le mandataire ne garantit ni l&apos;accord de
            l&apos;OPCO, ni le montant pris en charge, ni le délai de réponse. Le présent mandat ne
            modifie pas les engagements des parties au titre de la convention de formation.
          </Text>
        </DocSection>

        {/* 6. Durée et révocation */}
        <DocSection title="6. Durée et révocation">
          <Text style={pdfStyles.paragraph}>
            Le mandat prend effet à sa signature par les deux parties. Il prend fin à la décision de
            l&apos;OPCO sur la demande de prise en charge, ou à sa révocation.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Le mandant peut révoquer le mandat à tout moment, sans motif, par écrit adressé au
            mandataire ({identite.email || "par courrier au siège de l'organisme"}). La révocation
            prend effet à sa réception ; le mandataire cesse alors toute démarche au titre du
            présent mandat. Les démarches accomplies avant la réception demeurent.
          </Text>
        </DocSection>

        {/* 7. Données personnelles */}
        <DocSection title="7. Données à caractère personnel">
          <Text style={pdfStyles.paragraph}>
            Les données d&apos;identification des stagiaires et du mandant sont transmises à
            l&apos;OPCO aux seules fins de l&apos;instruction de la demande de prise en charge. Le
            présent mandat est conservé par {organisme} avec les pièces de l&apos;action de
            formation.
          </Text>
        </DocSection>

        {/* 8. Signatures — le mandant donne, le mandataire accepte EN DERNIER. */}
        <DocSection title="8. Signatures">
          <Text style={local.plafond}>{MENTION_PLAFOND_CANAL_MAISON}</Text>
          <SignatureZone
            intro="Le présent mandat est distinct de tout autre acte. Chaque partie en reçoit un exemplaire."
            faitLe={`${identite.rcsVille || "_________________________"}, le ${data.dateMandat}`}
            parties={[
              {
                titre: "Le mandant",
                signature: data.signatures?.client ?? null,
                nom: data.entreprise.raisonSociale,
              },
              {
                titre: "Le mandataire, pour acceptation",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
