/**
 * Autorisation de captation et d'utilisation de l'image et de la voix.
 *
 * ## Pourquoi une pièce SÉPARÉE, et pas une clause du contrat
 *
 * 🔴 Le consentement à l'image relève de l'article 9 du Code civil et du RGPD :
 * il doit être LIBRE, spécifique, éclairé et univoque (art. 4-11), et
 * RÉVOCABLE à tout moment (art. 7-3).
 *
 * Enfoui dans une convention ou une lettre de mission — c'est-à-dire dans un
 * document qu'on signe pour être formé ou pour être payé — il n'est pas
 * « libre » : le refus y serait indissociable du refus de la prestation. Un
 * consentement qui conditionne l'accès à un service est écarté par la CNIL.
 *
 * D'où une autorisation autonome, qu'on peut refuser sans rien perdre — et la
 * pièce le DIT explicitement, parce que c'est cette phrase qui la rend valable.
 *
 * ⚠️ Elle vaut pour les STAGIAIRES autant que pour les intervenants : filmer une
 * session, c'est filmer les participants. C'est l'oubli le plus courant.
 *
 * ⚠️ Les finalités sont ÉNUMÉRÉES à la génération, jamais génériques : « toute
 * utilisation par l'organisme » n'est pas un consentement spécifique, c'est un
 * blanc-seing — et il est nul.
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
  SignatureZone,
  pdfStyles,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface AutorisationCaptationData {
  numero: string;
  estCopie?: boolean;
  estSpecimen?: boolean;
  specimenMotif?: string;

  /** Personne dont l'image est captée. */
  personne: {
    nomPrenom: string;
    /** « Stagiaire », « Formateur »… — dit à quel titre elle est présente. */
    qualite: string;
    /** Entreprise du stagiaire, si applicable. */
    entreprise?: string;
  };
  /** Action au cours de laquelle la captation a lieu. */
  intitule: string;
  dateAction: string;
  lieu: string;
  /** Date d'édition, déjà formatée. */
  dateEdition: string;

  /**
   * Finalités PRÉCISES. Jamais « toute utilisation » : un consentement doit
   * être spécifique, sous peine de nullité.
   */
  finalites: string[];
  /** Supports de diffusion envisagés, énumérés. */
  supports: string[];
  /** Durée d'utilisation, en années. */
  dureeAnnees: number;

  signatures?: PreuvesParPartie;
}

// ============================================================
// Composant
// ============================================================

export function AutorisationCaptationPdf({
  data,
  identite,
}: {
  data: AutorisationCaptationData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const contact = identite.dpoEmail || identite.email || "l'organisme";

  return (
    <Document>
      <QualiopiPage
        docTitle="Autorisation de captation et d'utilisation de l'image"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        <Text style={pdfStyles.legalNote}>
          Autorisation recueillie au titre de l&apos;article 9 du Code civil (droit à l&apos;image)
          et du Règlement (UE) 2016/679. Elle est facultative, spécifique et révocable à tout
          moment.
        </Text>

        {/* 1. Personne concernée */}
        <DocSection title="1. Personne concernée">
          <FieldRow label="Nom et prénom" value={data.personne.nomPrenom} required />
          <FieldRow label="Qualité" value={data.personne.qualite} />
          {data.personne.entreprise ? (
            <FieldRow label="Entreprise" value={data.personne.entreprise} />
          ) : null}
        </DocSection>

        {/* 2. Contexte */}
        <DocSection title="2. Action concernée">
          <FieldRow label="Intitulé" value={data.intitule} />
          <FieldRow label="Date" value={data.dateAction} />
          <FieldRow label="Lieu" value={data.lieu} />
          <FieldRow label="Responsable du traitement" value={identite.raisonSociale} required />
        </DocSection>

        {/* 3. Ce qui est autorisé */}
        <DocSection title="3. Objet de l'autorisation">
          <Text style={pdfStyles.paragraph}>
            J&apos;autorise {identite.raisonSociale} à me photographier, à m&apos;enregistrer et à
            me filmer au cours de l&apos;action mentionnée ci-dessus, ainsi qu&apos;à utiliser
            l&apos;image, la voix et les propos ainsi captés dans les conditions suivantes.
          </Text>
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>Finalités autorisées</Text>
          <BulletList items={data.finalites} />
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>Supports de diffusion</Text>
          <BulletList items={data.supports} />
          <FieldRow
            label="Durée d'utilisation"
            value={`${data.dureeAnnees} an(s) à compter de la signature`}
          />
        </DocSection>

        {/* 4. Ce qui n'est PAS autorisé */}
        <DocSection title="4. Limites">
          <Text style={pdfStyles.paragraph}>
            Les captations ne seront utilisées pour aucune autre finalité que celles énumérées
            ci-dessus. Elles ne seront ni cédées ni vendues à des tiers, ni exploitées à des fins
            portant atteinte à la dignité ou à la réputation de la personne concernée. Aucune
            captation ne fera l&apos;objet d&apos;un traitement de reconnaissance faciale.
          </Text>
        </DocSection>

        {/* 5. Droits — la section qui rend le consentement valable */}
        <DocSection title="5. Vos droits">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Cette autorisation est facultative. La refuser n&apos;a aucune conséquence sur votre
            participation à la formation, sur son déroulement, ni sur les documents qui vous sont
            délivrés.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Vous pouvez retirer votre consentement à tout moment, sans avoir à vous justifier, par
            simple demande adressée à {contact}. Le retrait vaut pour l&apos;avenir : les captations
            concernées cessent d&apos;être diffusées dans un délai raisonnable, sans remettre en
            cause les utilisations déjà réalisées.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Vous disposez également des droits d&apos;accès, de rectification, d&apos;effacement, de
            limitation et d&apos;opposition prévus par le RGPD, exerçables auprès de {contact}, et
            du droit d&apos;introduire une réclamation auprès de la CNIL.
          </Text>
        </DocSection>

        {/* 6. Signature — la personne SEULE : un consentement est unilatéral */}
        <DocSection title="6. Signature">
          <SignatureZone
            intro="Fait pour valoir ce que de droit. Mention « Lu et approuvé, bon pour autorisation » à recopier avant signature."
            faitLe={`${identite.rcsVille || "_________________________"}, le ${data.dateEdition}`}
            parties={[
              {
                titre: "La personne concernée",
                signature: data.signatures?.beneficiaire ?? null,
                nom: data.personne.nomPrenom,
                mention: "Nom et signature — ou mention « Je refuse »",
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
