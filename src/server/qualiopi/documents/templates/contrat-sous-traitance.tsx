/**
 * Qualiopi — Contrat de sous-traitance (indicateur 27 du RNQ).
 *
 * Contrat écrit conclu entre l'organisme de formation (donneur d'ordre) et un
 * intervenant/prestataire indépendant rémunéré en honoraires. Répond à
 * l'exigence de l'indicateur 27 du Référentiel National Qualité : lorsque
 * l'organisme fait appel à la sous-traitance, il précise les MISSIONS confiées
 * et s'assure du respect de la conformité au référentiel national qualité
 * (article L.6316-3 du Code du travail).
 *
 * Distinct de la lettre de mission (lettre-mission.tsx), qui est rattachée à une
 * SESSION précise (formations confiées + tarif journalier). Ce contrat encadre
 * la RELATION de sous-traitance dans son ensemble (missions, durée, honoraires,
 * clause de vérification RNQ, confidentialité/RGPD) et se rattache au registre
 * des sous-traitants (`SousTraitant`).
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  BulletList,
  LegalCallout,
  SignatureZone,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface ContratSousTraitanceData {
  numero: string;
  estCopie?: boolean;
  // Sous-traitant (intervenant/prestataire indépendant, mandataire)
  sousTraitant: {
    /** Raison sociale ou nom/prénom de l'intervenant. */
    nom: string;
    /** SIRET propre du sous-traitant. */
    siret?: string;
    /** NDA propre du sous-traitant (si organisme de formation lui-même). */
    nda?: string;
    adresse?: string;
    email?: string;
  };
  /**
   * Missions PRÉCISES confiées au sous-traitant (exigence ind. 27). Au moins une
   * ligne. Ex. « Animer les modules IA générative du catalogue AXI-034 ».
   */
  missions: string[];
  // Durée du contrat
  dateDebut: string;
  /** Date de fin — "" pour une collaboration à durée indéterminée / au fil des missions. */
  dateFin?: string;
  /**
   * Modalités de rémunération en honoraires (montant + base : au jour, à la
   * mission, au forfait). Texte libre pour couvrir les cas honoraires.
   */
  remuneration: string;
  /**
   * Date de vérification de la conformité RNQ du sous-traitant (recherche
   * data.gouv.fr / RNQ, capture archivée) formatée fr-FR — "" si non vérifiée.
   */
  conformiteVerifieeAt?: string;
  dateContrat: string;
}

// ============================================================
// Composant
// ============================================================

export function ContratSousTraitancePdf({
  data,
  identite,
}: {
  data: ContratSousTraitanceData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const missions = data.missions.length > 0 ? data.missions : ["Missions à préciser."];
  const dureeValeur = data.dateFin
    ? `Du ${data.dateDebut} au ${data.dateFin}`
    : `À compter du ${data.dateDebut}, pour la durée des missions confiées`;

  return (
    <Document>
      <QualiopiPage
        docTitle="Contrat de sous-traitance"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        {/* Mention légale de tête */}
        <Text style={pdfStyles.legalNote}>
          Contrat de sous-traitance conclu au titre de l&apos;indicateur 27 du Référentiel National
          Qualité (article L.6316-3 du Code du travail).
        </Text>

        {/* 1. Parties */}
        <DocSection title="1. Entre les soussignés">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            L&apos;organisme de formation (donneur d&apos;ordre)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale} required />
          <FieldRow label="SIRET" value={identite.siret} required />
          <FieldRow label="NDA" value={identite.nda} required />
          <FieldRow label="Certification Qualiopi" value={identite.qualiopi} required />
          <FieldRow label="Siège social" value={identite.adresseSiege} required />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Le sous-traitant (intervenant / prestataire)
          </Text>
          <FieldRow label="Nom / Raison sociale" value={data.sousTraitant.nom} required />
          <FieldRow label="SIRET" value={data.sousTraitant.siret ?? ""} required />
          <FieldRow label="NDA propre" value={data.sousTraitant.nda ?? "Sans objet"} />
          <FieldRow
            label="Adresse"
            value={data.sousTraitant.adresse || "_______________________________"}
          />
          <FieldRow label="Email" value={data.sousTraitant.email || "—"} />
        </DocSection>

        {/* 2. Objet et missions confiées (ind. 27) */}
        <DocSection title="2. Objet et missions confiées">
          <Text style={pdfStyles.paragraph}>
            L&apos;organisme de formation confie au sous-traitant, qui l&apos;accepte, la réalisation
            des missions suivantes, dans le respect des référentiels pédagogiques, des méthodes et
            de la démarche qualité de l&apos;organisme :
          </Text>
          <BulletList items={missions} variant="objective" />
        </DocSection>

        {/* 3. Durée */}
        <DocSection title="3. Durée du contrat">
          <FieldRow label="Période" value={dureeValeur} />
          <Text style={pdfStyles.legalNote}>
            Chaque mission fait l&apos;objet d&apos;une confirmation écrite (lettre de mission ou bon
            de commande) précisant l&apos;action, les dates et le lieu ou la modalité.
          </Text>
        </DocSection>

        {/* 4. Rémunération (honoraires) */}
        <DocSection title="4. Rémunération">
          <FieldRow label="Honoraires" value={data.remuneration} required />
          <Text style={pdfStyles.legalNote}>
            La rémunération est versée sur présentation d&apos;une facture d&apos;honoraires conforme
            émise par le sous-traitant après réalisation de chaque mission. Les montants sont
            exprimés hors taxes ; la TVA est appliquée selon le régime fiscal propre au
            sous-traitant.
          </Text>
        </DocSection>

        {/* 5. Conformité au Référentiel National Qualité (ind. 27) */}
        <DocSection title="5. Conformité au Référentiel National Qualité (indicateur 27)">
          <Text style={pdfStyles.paragraph}>
            Conformément à l&apos;indicateur 27 du Référentiel National Qualité et à
            l&apos;article L.6316-3 du Code du travail, l&apos;organisme de formation s&apos;assure du
            respect, par le sous-traitant, des exigences du référentiel national qualité pour les
            missions qui lui sont confiées. Le sous-traitant s&apos;y engage et communique à
            l&apos;organisme, à première demande, tout justificatif utile (certification, référentiel
            appliqué, moyens pédagogiques, qualification des intervenants).
          </Text>
          <FieldRow
            label="Conformité RNQ vérifiée le"
            value={data.conformiteVerifieeAt || ""}
            required
          />
          <LegalCallout variant="legal" title="Engagement qualité du sous-traitant">
            Le sous-traitant s&apos;engage à respecter le référentiel pédagogique, à assurer la
            traçabilité de ses actions (émargements, évaluations, positionnement), à concourir au
            traitement des réclamations et à informer sans délai l&apos;organisme de toute évolution
            susceptible d&apos;affecter sa conformité au référentiel national qualité.
          </LegalCallout>
        </DocSection>

        {/* 6. Confidentialité et protection des données (RGPD) */}
        <DocSection title="6. Confidentialité et protection des données">
          <Text style={pdfStyles.paragraph}>
            Le sous-traitant s&apos;engage à ne divulguer à aucun tiers, pendant la durée du contrat
            et pendant cinq (5) ans après son terme, toute information confidentielle relative à
            l&apos;organisme de formation, à ses clients, stagiaires, méthodes pédagogiques, outils
            ou supports, sauf autorisation écrite préalable ou obligation légale.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Lorsqu&apos;il traite des données à caractère personnel pour le compte de
            l&apos;organisme, le sous-traitant agit conformément au Règlement (UE) 2016/679 (RGPD) et
            à la loi Informatique et Libertés : traitement limité aux seules finalités des missions
            confiées, mesures de sécurité appropriées et suppression ou restitution des données au
            terme de la mission.
          </Text>
        </DocSection>

        {/* 7. Signatures */}
        <DocSection title="7. Signatures">
          <SignatureZone
            intro="Le présent contrat est établi en deux exemplaires originaux, un pour chaque partie."
            faitLe={`_________________________, le ${data.dateContrat}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Le sous-traitant",
                nom: data.sousTraitant.nom,
                mention: "Nom, qualité, signature et cachet",
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
