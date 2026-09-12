/**
 * Contrat de travail d'un formateur SALARIÉ.
 *
 * ⛔ CE N'EST PAS UNE VARIANTE DU CONTRAT DE SOUS-TRAITANCE, et les confondre
 * coûterait cher dans les deux sens. Le contrat de sous-traitance lie deux
 * PROFESSIONNELS et se négocie ; celui-ci crée un LIEN DE SUBORDINATION et est
 * encadré par le Code du travail et par une convention collective. Une clause
 * absente n'y est pas un silence : c'est le régime supplétif qui s'applique, et
 * il est toujours plus favorable au salarié.
 *
 * ── LES MENTIONS QUE LA PIÈCE PORTE, ET CE QUE CHACUNE ÉVITE ────────────────
 *
 *   · convention collective → sans elle, ni classification ni période d'essai
 *     ne sont énonçables. La pièce sort alors en SPÉCIMEN ;
 *   · classification et coefficient → ils fixent le minimum conventionnel. Une
 *     classification fausse se paie en rappel de salaire sur toute la durée ;
 *   · durée hebdomadaire → un temps partiel qui ne l'énonce pas est PRÉSUMÉ à
 *     temps plein (art. L.3123-6), à charge pour l'employeur de prouver l'inverse ;
 *   · terme et motif du CDD → leur absence le requalifie en CDI (art. L.1242-12
 *     et L.1242-2).
 *
 * ── ⚠️ LA CLAUSE DE RÉMUNÉRATION VARIABLE EST LA PLUS DÉLICATE ──────────────
 *
 * Le fixe est une AVANCE sur commissions : les commissions s'y imputent, et le
 * salarié ne perçoit un complément qu'au-delà. Trois garde-fous sont écrits dans
 * la clause, et aucun n'est décoratif :
 *
 *   1. le fixe est un MINIMUM GARANTI — il est versé quoi qu'il arrive ;
 *   2. aucun solde négatif n'est jamais exigible du salarié — réclamer une
 *      avance non couverte serait faire porter le risque d'exploitation à un
 *      salarié, ce que le droit du travail interdit ;
 *   3. le report s'éteint à la rupture — une dette d'avance ne survit pas au
 *      contrat.
 *
 * Sans ces trois-là, le mécanisme serait une retenue sur salaire déguisée.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";

import {
  QualiopiPage,
  DocSection,
  FieldRow,
  LegalCallout,
  SignatureZone,
  pdfStyles,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

export interface ContratTravailData {
  numero: string;
  estCopie?: boolean;
  estSpecimen?: boolean;
  specimenMotif?: string;

  salarie: {
    nom: string;
    prenom: string;
    /** Formatées fr-FR. */
    dateNaissance: string;
    lieuNaissance: string;
    adresse: string;
  };

  /** « cdi » ou « cdd ». */
  type: "cdi" | "cdd";
  dateEmbauche: string;
  /** Terme du CDD. Vide pour un CDI. */
  dateFin?: string;
  /** Motif de recours au CDD (art. L.1242-2). Vide pour un CDI. */
  motifCdd?: string;

  poste: string;
  classification: string;
  /** Ex. « 35 » ou « 24,50 ». */
  dureeHebdoHeures: string;
  lieuTravail: string;
  periodeEssaiMois: number | null;

  /** Rémunération mensuelle brute, formatée « 2 000,00 € ». */
  remunerationMensuelle: string;
  /**
   * La rémunération variable est-elle en place ? Quand elle l'est, la clause
   * d'imputation est rendue — et elle ne l'est JAMAIS autrement. Écrire une
   * clause de variable pour quelqu'un qui n'en a pas créerait une attente.
   */
  variableActive: boolean;

  /**
   * Qui signe pour l'employeur. Lu de la configuration (`dirigeant_nom`), pas de
   * `OrganismeIdentite` — cette dernière ne le porte pas, et l'inventer ici
   * produirait « représentée par son représentant légal » sur une pièce qui
   * doit nommer une personne.
   */
  representant: string;

  /** Convention collective de l'organisme. Vide → la pièce est un spécimen. */
  conventionCollective: string;
  conventionIdcc: string;

  dateContrat: string;
  signatures?: PreuvesParPartie;
}

export function ContratTravailPdf({
  data,
  identite,
}: {
  data: ContratTravailData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const nomComplet = `${data.salarie.prenom} ${data.salarie.nom}`.trim();
  const estCdd = data.type === "cdd";
  const conventionLigne =
    data.conventionCollective === ""
      ? ""
      : data.conventionIdcc === ""
        ? data.conventionCollective
        : `${data.conventionCollective} (IDCC ${data.conventionIdcc})`;

  return (
    <Document>
      <QualiopiPage
        docTitle={estCdd ? "Contrat de travail à durée déterminée" : "Contrat de travail"}
        docNumber={data.numero}
        identite={identite}
        eyebrow="Employeur"
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        <DocSection title="1. Entre les soussignés">
          <Text style={pdfStyles.paragraph}>
            {`${identite.raisonSociale || "Axion-IA SAS"}, dont le siège social est situé ${identite.adresseSiege || "—"}, immatriculée sous le SIRET ${identite.siret || "—"}, représentée par ${data.representant || "son représentant légal"}, ci-après « l'employeur »,`}
          </Text>
          <Text style={pdfStyles.paragraph}>d&apos;une part,</Text>
          <FieldRow label="Nom et prénom" value={nomComplet} required />
          <FieldRow label="Né(e) le" value={data.salarie.dateNaissance} required />
          <FieldRow label="À" value={data.salarie.lieuNaissance} required />
          <FieldRow label="Demeurant" value={data.salarie.adresse} required />
          <Text style={pdfStyles.paragraph}>ci-après « le salarié », d&apos;autre part.</Text>
        </DocSection>

        {/*
          🔑 La convention collective vient TÔT, et en `required` : c'est elle
          qui commande la classification, la période d'essai et les minima. Un
          contrat qui ne la nomme pas laisse le salarié sans repère pour vérifier
          ce à quoi il a droit.
        */}
        <DocSection title="2. Convention collective applicable">
          <FieldRow label="Convention collective" value={conventionLigne} required />
          <Text style={pdfStyles.legalNote}>
            Les dispositions de cette convention s&apos;appliquent au présent contrat pour tout ce
            qu&apos;il ne prévoit pas expressément, notamment la classification, les minima de
            rémunération, la durée de la période d&apos;essai, les congés et le préavis. Un
            exemplaire est tenu à la disposition du salarié sur le lieu de travail.
          </Text>
        </DocSection>

        <DocSection title="3. Engagement et fonctions">
          <Text style={pdfStyles.paragraph}>
            {estCdd
              ? "L'employeur engage le salarié dans le cadre d'un contrat de travail à durée déterminée, régi par les articles L.1242-1 et suivants du Code du travail."
              : "L'employeur engage le salarié dans le cadre d'un contrat de travail à durée indéterminée."}
          </Text>
          <FieldRow label="Emploi occupé" value={data.poste} required />
          <FieldRow label="Classification conventionnelle" value={data.classification} required />
          <FieldRow label="Date d'entrée en fonction" value={data.dateEmbauche} required />
          {estCdd && <FieldRow label="Terme du contrat" value={data.dateFin ?? ""} required />}
        </DocSection>

        {/*
          ⛔ LE MOTIF DE RECOURS EST RENDU DANS SA PROPRE SECTION, et seulement
          pour un CDD. Son absence entraîne la requalification en CDI : le noyer
          dans un paragraphe d'objet le rendrait discutable.
        */}
        {estCdd && (
          <DocSection title="4. Motif de recours au contrat à durée déterminée">
            <Text style={pdfStyles.paragraph}>{data.motifCdd ?? ""}</Text>
            <Text style={pdfStyles.legalNote}>
              Mention obligatoire (art. L.1242-2 du Code du travail). Le contrat ne peut avoir ni
              pour objet ni pour effet de pourvoir durablement un emploi lié à l&apos;activité
              normale et permanente de l&apos;entreprise (art. L.1242-1).
            </Text>
          </DocSection>
        )}

        <DocSection title={estCdd ? "5. Lieu et durée du travail" : "4. Lieu et durée du travail"}>
          <FieldRow label="Lieu habituel de travail" value={data.lieuTravail} required />
          <FieldRow
            label="Durée hebdomadaire de travail"
            value={`${data.dureeHebdoHeures} heures`}
            required
          />
          <Text style={pdfStyles.legalNote}>
            La répartition de la durée du travail entre les jours de la semaine est fixée selon les
            nécessités de service et dans le respect des durées maximales légales et
            conventionnelles.
          </Text>
        </DocSection>

        <DocSection title={estCdd ? "6. Rémunération" : "5. Rémunération"}>
          <FieldRow
            label="Rémunération mensuelle brute"
            value={data.remunerationMensuelle}
            required
          />

          {/*
            ⚠️ LA CLAUSE LA PLUS DÉLICATE DE LA PIÈCE, et elle n'est rendue que
            si une rémunération variable est réellement en place. L'écrire pour
            quelqu'un qui n'en a pas créerait une attente sans objet.

            Les trois garde-fous ci-dessous ne sont pas des précautions de style :
            sans eux, imputer des commissions sur un salaire fixe serait une
            RETENUE SUR SALAIRE déguisée.
          */}
          {data.variableActive && (
            <>
              <Text style={pdfStyles.paragraph}>
                Le salarié perçoit en outre une rémunération variable, calculée sur les prestations
                de formation qu&apos;il assure selon le barème en vigueur, porté à sa connaissance
                et révisable.
              </Text>
              <Text style={pdfStyles.paragraph}>
                Cette rémunération variable s&apos;impute sur la rémunération mensuelle brute
                ci-dessus, qui constitue un{" "}
                <Text style={{ fontWeight: "bold" }}>minimum garanti</Text> : le salarié perçoit
                chaque mois le plus élevé des deux montants, et le complément éventuel lui est versé
                au-delà. Lorsque la rémunération variable d&apos;un mois n&apos;atteint pas ce
                minimum, la différence est reportée et s&apos;impute sur les variables des mois
                suivants.
              </Text>
              <LegalCallout variant="legal" title="Garanties attachées à la rémunération variable">
                <Text style={pdfStyles.legalNote}>
                  Le minimum garanti est versé en toute hypothèse et ne peut donner lieu à aucune
                  reprise. Aucun solde négatif n&apos;est exigible du salarié, à quelque moment que
                  ce soit. Le report mentionné ci-dessus s&apos;éteint de plein droit à la rupture
                  du contrat, sans qu&apos;aucune somme ne puisse être réclamée à ce titre.
                </Text>
                <Text style={pdfStyles.legalNote}>
                  La rémunération totale ne peut en aucun cas être inférieure au SMIC ni au minimum
                  conventionnel correspondant à la classification ci-dessus.
                </Text>
              </LegalCallout>
            </>
          )}
        </DocSection>

        {data.periodeEssaiMois !== null && (
          <DocSection title={estCdd ? "7. Période d'essai" : "6. Période d'essai"}>
            <FieldRow
              label="Durée de la période d'essai"
              value={`${data.periodeEssaiMois} mois`}
              required
            />
            <Text style={pdfStyles.legalNote}>
              Durée appréciée dans la limite des plafonds légaux (art. L.1221-19 et L.1242-10 du
              Code du travail) et de ceux, éventuellement plus courts, fixés par la convention
              collective applicable — auquel cas ces derniers prévalent. Pendant cette période,
              chacune des parties peut rompre le contrat en respectant le délai de prévenance légal.
            </Text>
          </DocSection>
        )}

        <DocSection
          title={estCdd ? "8. Congés, absences et préavis" : "7. Congés, absences et préavis"}
        >
          <Text style={pdfStyles.paragraph}>
            Le salarié bénéficie des congés payés dans les conditions légales et conventionnelles.
            Toute absence doit être portée sans délai à la connaissance de l&apos;employeur et
            justifiée.
          </Text>
          <Text style={pdfStyles.legalNote}>
            {estCdd
              ? "Le contrat prend fin à son terme sans préavis. L'indemnité de fin de contrat est versée dans les conditions de l'article L.1243-8 du Code du travail, sauf cas d'exclusion légale."
              : "En cas de rupture, la durée du préavis est celle fixée par la convention collective applicable ou, à défaut, par la loi."}
          </Text>
        </DocSection>

        <DocSection
          title={estCdd ? "9. Confidentialité et données" : "8. Confidentialité et données"}
        >
          <Text style={pdfStyles.paragraph}>
            Le salarié s&apos;engage à observer la plus stricte confidentialité sur les informations
            dont il a connaissance dans l&apos;exercice de ses fonctions, notamment les données
            relatives aux stagiaires et aux clients. Cet engagement survit à la rupture du contrat.
          </Text>
          <Text style={pdfStyles.legalNote}>
            Les données personnelles du salarié sont traitées aux seules fins de la gestion du
            contrat de travail et conservées pendant la durée légale applicable. Le salarié dispose
            des droits d&apos;accès, de rectification, d&apos;effacement et de limitation prévus par
            le RGPD.
          </Text>
        </DocSection>

        <DocSection title={estCdd ? "10. Signatures" : "9. Signatures"}>
          <SignatureZone
            intro="Le présent contrat est établi en deux exemplaires originaux, un pour chaque partie."
            faitLe={`${identite.rcsVille || "_________________________"}, le ${data.dateContrat}`}
            parties={[
              {
                titre: "Pour l'employeur",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Le salarié",
                signature: data.signatures?.formateur ?? null,
                nom: nomComplet,
                mention: "Signature précédée de la mention « Lu et approuvé »",
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
