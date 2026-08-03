/**
 * Qualiopi — Procédure : dispositions en matière de sous-traitance et de
 * co-traitance (indicateur 27 du RNQ).
 *
 * ## Ce que cette pièce est, et ce qu'elle n'est pas
 *
 * L'indicateur 27 attend DEUX choses : une règle écrite, et la preuve qu'on
 * l'applique. Les registres portent la seconde ; cette procédure est la
 * première — et c'est elle que l'auditeur demande en premier.
 *
 * Distincte de `contrat-sous-traitance.tsx`, qui engage UN intervenant nommé :
 * la procédure est la règle de l'organisme, valable AVANT le premier recours.
 * C'est elle qui conditionne la sélection, et non l'inverse.
 *
 * ## Le texte est FIGÉ dans le gabarit, à dessein
 *
 * Une procédure qualité n'est pas un formulaire : ses articles engagent
 * l'organisme et doivent être identiques d'une édition à l'autre. Les rendre
 * saisissables inviterait à les réécrire au fil de l'eau, et l'auditeur qui
 * compare deux tirages y verrait une règle instable. Seuls varient l'identité de
 * l'organisme, la version, la date et le signataire.
 *
 * 🔴 Modifier un article ici, c'est modifier la procédure de l'organisme :
 * incrémenter `version` et regénérer la pièce, sans quoi deux tirages portant le
 * même numéro de version diraient des choses différentes.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  BulletList,
  LegalCallout,
  SignatureZone,
  pdfStyles,
  type PreuveSignature,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface ProcedureSousTraitanceData {
  numero: string;
  estCopie?: boolean;
  /** Version de la procédure (ex. « 1.0 »). Change dès qu'un article change. */
  version: string;
  /** Date d'entrée en application, déjà formatée en français. */
  applicableLe: string;
  /** Nom et qualité du signataire (ex. « Williams Jullin, Président »). */
  signataireNom: string;
  signataireQualite: string;
  /**
   * Preuve de signature électronique, `null` (défaut) si la pièce sort à signer
   * à la main. Une procédure s'approuve une fois, pas à chaque tirage : le canal
   * de signature n'est pas branché ici, mais le champ existe pour le jour où il
   * le sera, sans changer la forme du document.
   */
  signature?: PreuveSignature | null;
}

// ============================================================
// Composant principal
// ============================================================

export function ProcedureSousTraitancePdf({
  data,
  identite,
}: {
  data: ProcedureSousTraitanceData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const organisme = identite.raisonSociale || "AXION IA SAS";

  return (
    <Document>
      <QualiopiPage
        docTitle="Procédure — sous-traitance et co-traitance"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        <DocSection title="Objet et référence">
          <Text style={pdfStyles.paragraph}>
            La présente procédure définit les dispositions de {organisme} en matière de
            sous-traitance et de co-traitance des actions de formation. Elle répond à
            l&apos;indicateur 27 du Référentiel National Qualité et à l&apos;article L.6316-3 du
            Code du travail.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Version {data.version} — applicable à compter du {data.applicableLe}.
          </Text>
        </DocSection>

        <DocSection title="1. Situation de l'organisme et perspective">
          <Text style={pdfStyles.paragraph}>
            À la date de rédaction, l&apos;intégralité des actions de formation de {organisme} est
            conçue et animée par son dirigeant-formateur.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Le recours à des formateurs indépendants est prévu dans le développement de
            l&apos;activité. Le critère 6 du Référentiel National Qualité visant expressément les «
            sous-traitants et formateurs occasionnels », tout intervenant extérieur rémunéré pour
            animer une action relève de la présente procédure, qu&apos;il soit qualifié de
            sous-traitant, de formateur occasionnel ou de vacataire.
          </Text>
          <Text style={pdfStyles.paragraph}>
            La procédure est donc établie avant le premier recours, et non après : c&apos;est elle
            qui conditionne la sélection, et non l&apos;inverse.
          </Text>
        </DocSection>

        <DocSection title="2. Champ d'application">
          <Text style={pdfStyles.paragraph}>
            Est considéré comme sous-traitant ou formateur occasionnel tout organisme ou intervenant
            indépendant à qui {organisme} confie tout ou partie de la conception ou de
            l&apos;animation d&apos;une action de formation, en conservant la responsabilité
            contractuelle vis-à-vis du client. La qualification retenue au contrat — sous-traitance,
            prestation de formation, vacation — est sans effet sur l&apos;application de la présente
            procédure.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Est considéré comme co-traitant tout organisme intervenant conjointement, chacun étant
            contractuellement lié au client pour sa part.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Ne relèvent pas de cette procédure les prestataires n&apos;intervenant pas dans
            l&apos;acte de formation (hébergement, comptabilité, outils numériques).
          </Text>
        </DocSection>

        <DocSection title="3. Principe directeur">
          <LegalCallout>
            {`${organisme} reste responsable, devant le bénéficiaire, le financeur et le certificateur, du respect du Référentiel National Qualité par ses sous-traitants. La sous-traitance ne transfère aucune obligation qualité.`}
          </LegalCallout>
        </DocSection>

        <DocSection title="4.1 Critères de sélection — conditions impératives">
          <Text style={pdfStyles.paragraph}>
            Aucun sous-traitant n&apos;est retenu sans que les trois points suivants soient réunis
            et tracés dans le registre des sous-traitants de la console qualité :
          </Text>
          <BulletList
            items={[
              "Existence légale — SIRET actif, vérifié sur une source publique (annuaire des entreprises, data.gouv.fr), avec la date de vérification consignée et la capture d'écran de cette vérification archivée. Une date sans pièce n'est qu'une déclaration.",
              "Déclaration d'activité — numéro de déclaration d'activité (NDA) valide, vérifié sur la liste publique des organismes de formation. Un intervenant personne physique facturant en son nom propre doit être lui-même déclaré.",
              "Compétences — CV à jour de moins de 24 mois, expérience et qualification en rapport avec les objectifs de l'action confiée.",
            ]}
          />
        </DocSection>

        {/*
          🔴 § 4.2 — Article SENSIBLE. La RC pro est délibérément NON impérative
          (décision du dirigeant, 2026-08-03) : aucun texte ne l'impose à un
          formateur indépendant, et en faire une condition de sélection
          réduirait le vivier sans nécessité. L'article le DIT, pour qu'une
          lecture rapide ne le range pas parmi les conditions du § 4.1.
        */}
        <DocSection title="4.2 Assurance responsabilité civile professionnelle — demandée et suivie">
          <Text style={pdfStyles.paragraph}>
            L&apos;attestation de responsabilité civile professionnelle est systématiquement
            demandée et, lorsqu&apos;elle est fournie, archivée au registre avec sa date
            d&apos;échéance, qui déclenche un rappel avant expiration.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Son absence ne fait pas obstacle à l&apos;engagement d&apos;un intervenant : aucun texte
            ne l&apos;impose à un formateur indépendant, et en faire une condition impérative
            réduirait sans nécessité le vivier d&apos;intervenants mobilisables. Elle est en
            revanche signalée comme point de vigilance dans le registre tant qu&apos;elle fait
            défaut, et sa présence est un critère d&apos;arbitrage lorsque plusieurs intervenants
            conviennent également à une mission.
          </Text>
          <Text style={pdfStyles.paragraph}>
            {organisme} demeure, en toute hypothèse, responsable devant le bénéficiaire et le client
            de la bonne exécution des actions sous-traitées (article 3).
          </Text>
        </DocSection>

        <DocSection title="5. Engagement contractuel">
          <Text style={pdfStyles.paragraph}>
            Tout sous-traitant signe un contrat de sous-traitance avant toute intervention. Ce
            contrat comporte a minima :
          </Text>
          <BulletList
            items={[
              "l'objet, le périmètre et les livrables de la prestation confiée ;",
              "l'engagement explicite de respecter le Référentiel National Qualité et de se soumettre aux contrôles du certificateur de l'organisme ;",
              "l'obligation de transmettre les preuves d'exécution (émargements, évaluations, supports) ;",
              "les obligations de confidentialité et de protection des données personnelles (RGPD), avec qualification du rôle de sous-traitant au sens de l'article 28 du RGPD ;",
              "la non-sollicitation de la clientèle de l'organisme pendant la durée du contrat et 24 mois après son terme ;",
              "les conditions de rémunération et de résiliation.",
            ]}
          />
        </DocSection>

        <DocSection title="6. Information du bénéficiaire">
          <Text style={pdfStyles.paragraph}>
            Le recours à un sous-traitant est porté à la connaissance du client avant la signature
            de la convention de formation, et le nom de l&apos;intervenant figure sur la convocation
            ainsi que sur la feuille d&apos;émargement.
          </Text>
        </DocSection>

        <DocSection title="7. Suivi et évaluation">
          <Text style={pdfStyles.paragraph}>Pour chaque action sous-traitée :</Text>
          <BulletList
            items={[
              "les appréciations des bénéficiaires sont recueillies selon le même dispositif que les actions réalisées en propre (questionnaires à chaud et à froid) ;",
              "la prestation fait l'objet d'une évaluation par l'organisme portant sur le respect du programme, la qualité de l'animation et la remise des preuves ;",
              "toute difficulté est consignée au registre des incidents, en désignant l'intervenant mis en cause et le fait qui lui est reproché, et instruite selon la procédure de traitement des réclamations en vigueur.",
            ]}
          />
        </DocSection>

        <DocSection title="8. Reconduction et retrait">
          <BulletList
            items={[
              "La vérification des pièces (NDA, assurance, CV) est renouvelée annuellement, et sa date consignée.",
              "Un sous-traitant dont l'évaluation est insuffisante, ou dont une pièce n'est plus valide, n'est pas reconduit. La décision et son motif sont consignés.",
            ]}
          />
        </DocSection>

        <DocSection title="9. Revue">
          <Text style={pdfStyles.paragraph}>
            Les dispositions de sous-traitance sont examinées lors de la revue de direction
            annuelle, au même titre que les autres processus qualité, et adaptées si l&apos;activité
            évolue.
          </Text>
        </DocSection>

        <DocSection title="Approbation">
          <SignatureZone
            intro="La présente procédure est approuvée par la direction de l'organisme et s'applique à compter de la date indiquée ci-dessus."
            faitLe={`${identite.rcsVille || "_________________________"}, le ${data.applicableLe}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                signature: data.signature ?? null,
                nom: data.signataireNom,
                mention: data.signataireQualite,
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
