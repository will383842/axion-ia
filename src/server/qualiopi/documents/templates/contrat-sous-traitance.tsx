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
  NdaFieldRow,
  BulletList,
  LegalCallout,
  SignatureZone,
  pdfStyles,
  type PreuvesParPartie,
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
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo, comportement historique
   * INCHANGÉ. Le circuit papier reste un chemin de plein droit.
   *
   * Renseignées, `SignatureZone` rend le tracé, l'horodatage et l'empreinte.
   * Sans ce branchement, la preuve n'existait QU'en base : le signataire signait
   * et la pièce qu'on lui remettait affichait encore des cadres vides.
   */
  signatures?: PreuvesParPartie;
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
          <NdaFieldRow nda={identite.nda} />
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
            L&apos;organisme de formation confie au sous-traitant, qui l&apos;accepte, la
            réalisation des missions suivantes, dans le respect des référentiels pédagogiques, des
            méthodes et de la démarche qualité de l&apos;organisme :
          </Text>
          <BulletList items={missions} variant="objective" />
        </DocSection>

        {/* 3. Durée */}
        <DocSection title="3. Durée du contrat">
          <FieldRow label="Période" value={dureeValeur} />
          <Text style={pdfStyles.legalNote}>
            Chaque mission fait l&apos;objet d&apos;une confirmation écrite (lettre de mission ou
            bon de commande) précisant l&apos;action, les dates et le lieu ou la modalité.
          </Text>
        </DocSection>

        {/* 4. Rémunération (honoraires) */}
        <DocSection title="4. Rémunération">
          <FieldRow label="Honoraires" value={data.remuneration} required />
          <Text style={pdfStyles.legalNote}>
            La rémunération est versée sur présentation d&apos;une facture d&apos;honoraires
            conforme émise par le sous-traitant après réalisation de chaque mission. Les montants
            sont exprimés hors taxes ; la TVA est appliquée selon le régime fiscal propre au
            sous-traitant.
          </Text>
        </DocSection>

        {/* 5. Conformité au Référentiel National Qualité (ind. 27) */}
        <DocSection title="5. Conformité au Référentiel National Qualité (indicateur 27)">
          <Text style={pdfStyles.paragraph}>
            Conformément à l&apos;indicateur 27 du Référentiel National Qualité et à l&apos;article
            L.6316-3 du Code du travail, l&apos;organisme de formation s&apos;assure du respect, par
            le sous-traitant, des exigences du référentiel national qualité pour les missions qui
            lui sont confiées. Le sous-traitant s&apos;y engage et communique à l&apos;organisme, à
            première demande, tout justificatif utile (certification, référentiel appliqué, moyens
            pédagogiques, qualification des intervenants).
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
            l&apos;organisme, le sous-traitant agit conformément au Règlement (UE) 2016/679 (RGPD)
            et à la loi Informatique et Libertés : traitement limité aux seules finalités des
            missions confiées, mesures de sécurité appropriées et suppression ou restitution des
            données au terme de la mission.
          </Text>
        </DocSection>

        {/*
          Sections 7 à 9 — 2026-08-02. Mêmes clauses que la lettre de mission, et
          pour les mêmes raisons.

          🔴 PAS de non-concurrence : imposer à un prestataire de ne pas
          travailler ailleurs est un indice de subordination retenu pour
          REQUALIFIER une sous-traitance en contrat de travail. On protège la
          clientèle par la NON-SOLLICITATION, proportionnée donc opposable — une
          non-concurrence trop large est annulée, et n'aurait rien protégé.

          La clause d'indépendance (§9) documente l'absence de subordination :
          c'est elle qui protège contre la requalification.
        */}

        {/* 7. Propriété intellectuelle */}
        <DocSection title="7. Propriété intellectuelle">
          <Text style={pdfStyles.paragraph}>
            Les référentiels, supports et méthodes transmis par l&apos;organisme demeurent sa
            propriété exclusive ; le sous-traitant les utilise pour les seuls besoins des
            prestations confiées et les restitue ou les détruit au terme du contrat.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Les supports et contenus créés spécifiquement dans le cadre des prestations sont cédés à
            l&apos;organisme à titre exclusif, pour toute la durée légale de protection et pour le
            monde entier, pour les droits de reproduction, représentation, adaptation et traduction,
            sur tout support. Cette cession est comprise dans la rémunération prévue en section 4.
            Le sous-traitant conserve la propriété de ses supports antérieurs et concède à
            l&apos;organisme le droit de les utiliser pour les prestations concernées.
          </Text>
        </DocSection>

        {/* 8. Non-sollicitation */}
        <DocSection title="8. Non-sollicitation">
          <Text style={pdfStyles.paragraph}>
            Pendant le contrat et durant dix-huit (18) mois après son terme, le sous-traitant
            s&apos;engage à ne pas solliciter directement, pour des prestations de même nature, les
            clients de l&apos;organisme auprès desquels il est intervenu à ce titre, ni à démarcher
            ses intervenants ou salariés en vue de les recruter.
          </Text>
          <Text style={pdfStyles.legalNote}>
            Cette clause ne restreint pas la liberté d&apos;exercice du sous-traitant : elle ne vise
            que la clientèle rencontrée à l&apos;occasion des prestations confiées.
          </Text>
        </DocSection>

        {/* 9. Indépendance, assurance et résiliation */}
        <DocSection title="9. Indépendance, assurance et résiliation">
          <Text style={pdfStyles.paragraph}>
            Le sous-traitant exerce en toute indépendance, organise librement son travail et
            n&apos;est soumis à aucun lien de subordination envers l&apos;organisme. Il déclare être
            régulièrement immatriculé, à jour de ses obligations sociales et fiscales, et détenir
            une assurance de responsabilité civile professionnelle couvrant son activité de
            formation. Il en justifie sur demande et signale sans délai toute cessation de garantie.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Chaque partie peut résilier le contrat par écrit moyennant un préavis de trente (30)
            jours, les prestations déjà engagées étant menées à leur terme. En cas de manquement
            grave — atteinte à la confidentialité, défaut d&apos;assurance, perte de la conformité
            exigée en section 5 — la résiliation peut intervenir sans préavis, après mise en demeure
            restée sans effet pendant huit (8) jours.
          </Text>
        </DocSection>

        {/*
          10 — RGPD article 28. OBLIGATION LÉGALE, pas une précaution.

          🔴 Le sous-traitant qui traite des données de stagiaires POUR LE COMPTE
          de l'organisme en est le sous-traitant au sens du RGPD, et l'article
          28-3 impose un contrat portant des mentions ÉNUMÉRÉES. Leur absence est
          sanctionnable — et c'est l'organisme, responsable de traitement, qui
          répond. La section 6 n'en couvrait que trois.
        */}
        <DocSection title="10. Traitement des données à caractère personnel">
          <Text style={pdfStyles.paragraph}>
            Pour l&apos;exécution des missions confiées, le sous-traitant traite pour le compte de
            l&apos;organisme, responsable de traitement, les données d&apos;identité, de présence et
            d&apos;évaluation des stagiaires, pour la seule durée des missions et aux seules fins de
            les réaliser. Il agit sur instruction documentée de l&apos;organisme.
          </Text>
          <BulletList
            items={[
              "Ne traiter ces données que pour les besoins des missions, jamais pour son compte propre.",
              "Garantir que les personnes autorisées à y accéder sont soumises à une obligation de confidentialité.",
              "Mettre en œuvre des mesures techniques et organisationnelles appropriées de sécurité.",
              "Ne recourir à aucun autre sous-traitant sans autorisation écrite préalable de l'organisme.",
              "Assister l'organisme pour répondre aux demandes d'exercice des droits des personnes concernées.",
              "Notifier à l'organisme toute violation de données sans délai après en avoir pris connaissance.",
              "Mettre à disposition les éléments nécessaires pour démontrer le respect de ces obligations et permettre les audits.",
              "Supprimer ou restituer l'ensemble des données au terme du contrat, sans en conserver de copie.",
            ]}
          />
        </DocSection>

        {/* 11. Responsabilité et force majeure */}
        <DocSection title="11. Responsabilité et force majeure">
          <Text style={pdfStyles.paragraph}>
            Chaque partie répond des dommages directs causés à l&apos;autre par un manquement à ses
            obligations. La responsabilité de chacune est limitée au montant hors taxes des
            prestations facturées au titre du présent contrat, à l&apos;exclusion des dommages
            indirects tels que perte d&apos;exploitation, de clientèle ou de chiffre
            d&apos;affaires. Cette limitation ne joue pas en cas de faute lourde ou dolosive, ni
            d&apos;atteinte aux personnes.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Aucune partie n&apos;est responsable d&apos;un manquement résultant d&apos;un cas de
            force majeure au sens de l&apos;article 1218 du Code civil. La partie empêchée en
            informe l&apos;autre sans délai ; la prestation est reportée à une date convenue, ou le
            contrat résilié sans indemnité si l&apos;empêchement se prolonge au-delà de trente (30)
            jours.
          </Text>
        </DocSection>

        {/* 12. Exécution personnelle */}
        <DocSection title="12. Exécution personnelle des missions">
          <Text style={pdfStyles.paragraph}>
            Les missions sont confiées en considération des compétences propres du sous-traitant. Il
            ne peut se faire remplacer ni sous-traiter tout ou partie de l&apos;animation sans
            l&apos;accord écrit préalable de l&apos;organisme. Tout intervenant substitué sans cet
            accord engage sa seule responsabilité et constitue un manquement grave.
          </Text>
          <Text style={pdfStyles.legalNote}>
            L&apos;organisme doit pouvoir justifier des compétences de CHAQUE intervenant
            (indicateur 21) et de la conformité de chaque sous-traitant (indicateur 27) : un
            remplaçant non validé rompt cette traçabilité.
          </Text>
        </DocSection>

        {/* 13. Droit applicable */}
        <DocSection title="13. Droit applicable et différends">
          <Text style={pdfStyles.paragraph}>
            Le présent contrat est régi par le droit français. En cas de différend relatif à sa
            formation, son exécution ou son interprétation, les parties s&apos;efforceront de
            trouver une solution amiable. À défaut d&apos;accord dans un délai de trente (30) jours
            à compter de la première notification écrite, le litige sera porté devant le tribunal
            compétent du ressort du siège de l&apos;organisme.
          </Text>
        </DocSection>

        {/* 14. Signatures */}
        {/* « Fait à » = ville du siège — même raisonnement que la convention : un
            blanc sur une pièce signée électroniquement reste vide pour toujours. */}
        <DocSection title="14. Signatures">
          <SignatureZone
            intro="Le présent contrat est établi en deux exemplaires originaux, un pour chaque partie."
            faitLe={`${identite.rcsVille || "_________________________"}, le ${data.dateContrat}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Le sous-traitant",
                signature: data.signatures?.sous_traitant ?? null,
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
