/**
 * Qualiopi — Convention de formation professionnelle (personnes morales).
 *
 * Conforme L.6353-1 et L.6353-2 du Code du travail.
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  NdaFieldRow,
  SignatureZone,
  pdfStyles,
  assainirEspacesPdf,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface ConventionData {
  numero: string;
  estCopie?: boolean;
  /** Injecte par `generateDocument` quand l'identite de l'OF est incomplete. */
  estSpecimen?: boolean;
  specimenMotif?: string;
  // Partie cliente
  client: {
    raisonSociale: string;
    siret: string;
    adresse: string;
    contact: string;
  };
  // Objet de la formation
  intitule: string;
  objectifs: string[];
  publicVise: string;
  dureeHeures: number;
  dateDebut: string;
  dateFin: string;
  modalite: "Présentiel" | "Distanciel" | "Mixte";
  lieu: string;
  effectif: number;
  // Conditions financières
  prixHt: number;
  acomptePercent?: number;
  /**
   * Moyens pédagogiques et techniques mobilisés — MENTION EXIGÉE par l'article
   * L.6353-1 du Code du travail, absente jusqu'ici de la convention. Repli sur
   * une formule décrivant le dispositif réel de la plateforme.
   */
  moyensPedagogiques?: string;
  /**
   * Modalités de suivi de l'exécution et d'appréciation des résultats — même
   * exigence, même article. Repli sur le dispositif réel.
   */
  modalitesEvaluation?: string;
  /** Sanction de la formation (L.6353-1). Repli : attestation de fin de formation. */
  sanction?: string;
  // Dates convention
  dateConvention: string;
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
// Styles locaux
// ============================================================

const local = StyleSheet.create({
  annexeList: {
    marginTop: 4,
  },
  annexeItem: {
    fontSize: 9,
    marginBottom: 2,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 10,
    marginBottom: 2,
    paddingLeft: 8,
  },
  amountRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: pdfStyles.fieldRow.borderBottomColor,
  },
  amountLabel: {
    fontSize: 10,
  },
  amountValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
});

// ============================================================
// Helpers
// ============================================================

// 🔴 Correctif glyphes 2026-07-26. `Intl` fr-FR emet U+202F (fine insecable)
// comme separateur de milliers ; aucune police du projet ne possede ce glyphe,
// @react-pdf bascule sur Helvetica/WinAnsi et ecrit l'octet 0x2F, soit « / ».
// Tout montant >= 1 000 EUR sortait donc « 1/440,00 € ». Detail mesure dans
// `assainirEspacesPdf` (base-layout.tsx). Ce duplicat local echappait au
// correctif du helper partage : il doit assainir lui aussi.
function formatEur(montant: number): string {
  return assainirEspacesPdf(
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(montant),
  );
}

// ============================================================
// Composant
// ============================================================

export function ConventionPdf({
  data,
  identite,
}: {
  data: ConventionData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  // 🔴 Réconciliation des sources de l'acompte, 2026-07-27.
  //
  // L'absence de plafond ici est VOULUE, et c'est la différence de fond avec
  // `contrat-formation.tsx` : le plafond de 30 % de l'article L.6353-6 protège
  // une PERSONNE PHYSIQUE qui finance sa propre formation. Une convention
  // (L.6353-1) lie l'organisme à une personne morale ou à un financeur — aucun
  // plafond légal ne s'y applique, l'acompte y est purement contractuel.
  //
  // Ne PAS « harmoniser » en plafonnant ici : ce serait s'interdire une clause
  // parfaitement licite entre professionnels, et brouiller la raison d'être du
  // plafond là où il compte vraiment.
  //
  // Le pourcentage par défaut de 30 % est un usage commercial, pas une règle de
  // droit — sa coïncidence avec le plafond B2C est fortuite, et c'est
  // précisément ce qui rend les deux documents faciles à confondre.
  const acomptePercent = data.acomptePercent ?? 30;
  const acompte = (data.prixHt * acomptePercent) / 100;
  const solde = data.prixHt - acompte;

  return (
    <Document>
      <QualiopiPage
        docTitle="Convention de formation professionnelle"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/* Mention légale de tête */}
        <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.convention}</Text>

        {/* 1. Parties */}
        <DocSection title="1. Parties">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Organisme de formation (prestataire)
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
          <FieldRow label="Email" value={identite.email || "—"} />
          <FieldRow label="Téléphone" value={identite.telephone || "—"} />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Client (commanditaire)
          </Text>
          <FieldRow label="Raison sociale" value={data.client.raisonSociale} />
          <FieldRow label="SIRET" value={data.client.siret} />
          <FieldRow label="Adresse" value={data.client.adresse} />
          <FieldRow label="Contact" value={data.client.contact} />
        </DocSection>

        {/* 2. Objet */}
        <DocSection title="2. Objet de la convention">
          <FieldRow label="Intitulé" value={data.intitule} />
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>Objectifs</Text>
            <View style={{ flex: 1 }}>
              {data.objectifs.map((obj, i) => (
                <Text key={i} style={local.listItem}>
                  • {obj}
                </Text>
              ))}
            </View>
          </View>
          <FieldRow label="Public visé" value={data.publicVise} />
          <FieldRow
            label="Durée"
            value={`${data.dureeHeures} heure${data.dureeHeures > 1 ? "s" : ""}`}
          />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
          <FieldRow label="Modalité" value={data.modalite} />
          <FieldRow label="Lieu" value={data.lieu} />
          <FieldRow
            label="Effectif prévu"
            value={`${data.effectif} stagiaire${data.effectif > 1 ? "s" : ""}`}
          />
          {/*
            🔴 Trois mentions EXIGÉES par l'article L.6353-1 et absentes de la
            convention jusqu'au 2026-08-02 : moyens pédagogiques et techniques,
            modalités de suivi de l'exécution et d'appréciation des résultats,
            sanction de la formation. Leur absence rend la convention
            incomplète au regard du texte qu'elle invoque en tête de page — et
            c'est exactement ce qu'un instructeur DREETS lit en premier.

            Les replis décrivent le dispositif RÉEL de la plateforme
            (émargement par demi-journée, positionnement, évaluation des acquis,
            attestation) : les inventer par session les ferait diverger de ce que
            le système produit effectivement.
          */}
          <FieldRow
            label="Moyens pédagogiques et techniques"
            value={
              data.moyensPedagogiques ||
              "Apports méthodologiques, démonstrations et mises en situation ; supports pédagogiques remis à chaque participant ; poste de travail et outils numériques nécessaires à la mise en pratique."
            }
          />
          <FieldRow
            label="Suivi de l'exécution et évaluation"
            value={
              data.modalitesEvaluation ||
              "Feuille d'émargement signée par demi-journée en présentiel, relevé de connexion horodaté en distanciel. Questionnaire de positionnement en amont, évaluation des acquis au regard des objectifs en fin d'action, recueil de la satisfaction des participants."
            }
          />
          <FieldRow
            label="Sanction de la formation"
            value={data.sanction || "Attestation de fin de formation (article L.6353-1)."}
          />
        </DocSection>

        {/* 3. Conditions financières */}
        <DocSection title="3. Conditions financières">
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Prix total HT</Text>
            <Text style={local.amountValue}>{formatEur(data.prixHt)}</Text>
          </View>
          {/*
            Acompte à 0 : on ne rend PAS « Acompte (0 %) : 0,00 € » — une clause
            qui annonce un versement nul se lit comme une erreur de génération,
            et prête à discussion au moment de payer. On écrit ce qui est
            convenu : la totalité à réception de facture. C'est le cas normal
            d'une convention régularisée APRÈS la tenue de l'action, où un
            « acompte à la signature » n'a plus d'objet.
          */}
          {acompte > 0 ? (
            <>
              <View style={local.amountRow}>
                <Text style={local.amountLabel}>Acompte à la signature ({acomptePercent} %)</Text>
                <Text style={local.amountValue}>{formatEur(acompte)}</Text>
              </View>
              <View style={local.amountRow}>
                <Text style={local.amountLabel}>Solde à la fin de la formation</Text>
                <Text style={local.amountValue}>{formatEur(solde)}</Text>
              </View>
            </>
          ) : (
            <Text style={pdfStyles.paragraph}>
              Payable en totalité à réception de facture — aucun acompte à la signature.
            </Text>
          )}
          {/*
            🔴 F25 — la mention TVA vient du régime CONFIGURÉ, jamais d'une
            constante. L'exonération 261-4-4° était imprimée en dur alors que
            `regime_tva` vaut « assujetti » : on annonçait une exonération non
            détenue sur une pièce contractuelle et sur les kits financeurs.
            `null` en régime assujetti → aucun bloc, ce qui est correct.
          */}
          {identite.mentionTvaRegime ? (
            <Text style={pdfStyles.legalNote}>{identite.mentionTvaRegime}</Text>
          ) : (
            /* En régime assujetti, aucune mention n'était portée : le client
               découvrait la TVA sur la facture. On dit que les prix sont HT. */
            <Text style={pdfStyles.legalNote}>
              Prix exprimés hors taxes. La taxe sur la valeur ajoutée au taux en vigueur au jour de
              la facturation s&apos;y ajoute.
            </Text>
          )}
          <Text style={pdfStyles.legalNote}>
            Règlement à trente (30) jours à compter de la date d&apos;émission de la facture. Tout
            retard de paiement entraîne de plein droit des pénalités au taux directeur de la Banque
            centrale européenne majoré de 10 points, ainsi qu&apos;une indemnité forfaitaire de
            recouvrement de 40 € (articles L.441-10 et D.441-5 du Code de commerce).
          </Text>
        </DocSection>

        {/* 4. Conditions d'annulation */}
        <DocSection title="4. Conditions d'annulation">
          <Text style={pdfStyles.paragraph}>
            En cas de désistement du client, les frais d'annulation suivants s'appliquent :
          </Text>
          <Text style={local.listItem}>
            • Annulation à plus de 15 jours ouvrés avant le début : 0 %
          </Text>
          <Text style={local.listItem}>
            • Annulation entre 8 et 15 jours ouvrés avant le début : 50 % du prix HT
          </Text>
          <Text style={local.listItem}>
            • Annulation à moins de 8 jours ouvrés avant le début : 100 % du prix HT
          </Text>
          {/*
            🔴 F51 — le report gratuit était promis par les CGV et absent de la
            convention, alors que les deux sont signées ensemble. Les CGV ont été
            alignées sur ce barème (jours ouvrés) ; la promesse de report, elle,
            devait remonter ici pour que les deux textes disent la même chose.
          */}
          <Text style={local.listItem}>
            • Dans tous les cas, la prestation est reportable une fois sans frais à une date
            convenue entre les parties, le report se substituant alors à l&apos;annulation.
          </Text>
        </DocSection>

        {/*
          Sections 5 à 9 — 2026-08-02.

          La convention couvrait l'objet, le prix et l'annulation, et rien
          d'autre : aucune clause de propriété intellectuelle sur les supports,
          aucune confidentialité, aucune limitation de responsabilité, aucun
          droit applicable, et pas un mot sur les données personnelles alors
          qu'elle en fait traiter à chaque session (identité des stagiaires,
          émargements, évaluations).

          Autrement dit, en cas de litige — support recopié et rediffusé,
          résultat commercial déçu, incident de traitement — l'organisme
          n'opposait aucun texte, et le RGPD était muet sur une pièce qui est
          pourtant le support du traitement.
        */}

        {/* 5. Obligations des parties */}
        <DocSection title="5. Obligations des parties">
          <Text style={pdfStyles.paragraph}>
            L&apos;organisme s&apos;engage à réaliser l&apos;action conformément au programme
            annexé, à mettre à disposition les moyens décrits ci-dessus, à remettre au client les
            documents attestant de la réalisation (feuille d&apos;émargement, attestation) et à
            respecter la confidentialité des informations dont il a connaissance.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Le client s&apos;engage à assurer la présence des participants inscrits, à informer
            l&apos;organisme de toute contrainte d&apos;accessibilité au plus tôt afin que les
            adaptations nécessaires soient étudiées, et — lorsque la formation se déroule sur site —
            à mettre à disposition un local et les équipements convenus, conformes aux règles
            d&apos;hygiène et de sécurité qui lui incombent.
          </Text>
        </DocSection>

        {/* 6. Données personnelles */}
        <DocSection title="6. Données à caractère personnel">
          <Text style={pdfStyles.paragraph}>
            Chaque partie agit en qualité de responsable de traitement pour les données qu&apos;elle
            collecte. L&apos;organisme traite les données d&apos;identité, d&apos;émargement et
            d&apos;évaluation des participants aux seules fins d&apos;exécuter la présente
            convention et de satisfaire à ses obligations légales, notamment la conservation des
            pièces justificatives pendant cinq (5) ans.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Les personnes concernées disposent des droits d&apos;accès, de rectification,
            d&apos;effacement, de limitation et d&apos;opposition prévus par le Règlement (UE)
            2016/679, exerçables auprès de {identite.dpoEmail || identite.email || "l'organisme"}.
            Elles peuvent introduire une réclamation auprès de la CNIL. Aucune donnée n&apos;est
            cédée à des tiers à des fins commerciales.
          </Text>
        </DocSection>

        {/* 7. Propriété intellectuelle et confidentialité */}
        <DocSection title="7. Propriété intellectuelle et confidentialité">
          <Text style={pdfStyles.paragraph}>
            Les supports pédagogiques, méthodes et contenus demeurent la propriété exclusive de
            l&apos;organisme. Ils sont remis aux participants pour leur usage professionnel
            personnel ; toute reproduction, diffusion à des tiers, revente ou utilisation à des fins
            de formation par le client est soumise à l&apos;accord écrit préalable de
            l&apos;organisme.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Chaque partie s&apos;engage à ne pas divulguer les informations confidentielles portées
            à sa connaissance à l&apos;occasion de l&apos;action, pendant sa durée et les deux (2)
            années qui suivent son terme.
          </Text>
        </DocSection>

        {/* 8. Responsabilité et force majeure */}
        <DocSection title="8. Responsabilité et force majeure">
          <Text style={pdfStyles.paragraph}>
            L&apos;organisme est tenu d&apos;une obligation de moyens quant à l&apos;atteinte des
            objectifs pédagogiques, dont la réalisation dépend de l&apos;implication des
            participants. Sa responsabilité éventuelle est limitée au montant hors taxes
            effectivement réglé au titre de la présente convention, à l&apos;exclusion des dommages
            indirects tels que perte d&apos;exploitation, de clientèle ou de chiffre
            d&apos;affaires.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Aucune des parties ne peut être tenue responsable d&apos;un manquement résultant
            d&apos;un cas de force majeure au sens de l&apos;article 1218 du Code civil. La partie
            empêchée en informe l&apos;autre sans délai ; l&apos;action est alors reportée à une
            date convenue entre les parties.
          </Text>
        </DocSection>

        {/* 9. Différends */}
        <DocSection title="9. Droit applicable et différends">
          <Text style={pdfStyles.paragraph}>
            La présente convention est régie par le droit français. En cas de différend relatif à sa
            formation, son exécution ou son interprétation, les parties s&apos;efforceront de
            trouver une solution amiable. À défaut d&apos;accord dans un délai de trente (30) jours
            à compter de la première notification écrite, le litige sera porté devant le tribunal
            compétent du ressort du siège de l&apos;organisme.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Toute réclamation relative au déroulement de l&apos;action peut être adressée à{" "}
            {identite.email || "l'organisme"} ; elle est enregistrée, traitée et fait l&apos;objet
            d&apos;une réponse motivée.
          </Text>
        </DocSection>

        {/* 10. Annexes */}
        <DocSection title="10. Documents annexés">
          <View style={local.annexeList}>
            <Text style={local.annexeItem}>– Programme détaillé de la formation</Text>
            <Text style={local.annexeItem}>– Règlement intérieur des stagiaires</Text>
            <Text style={local.annexeItem}>– Conditions générales de vente (CGV)</Text>
          </View>
        </DocSection>

        {/* 11. Signatures */}
        {/* « Fait à » = ville du siège : la pièce est établie par l'OF, pas sur le
            lieu de formation. Un blanc ici sortait « Fait à ______ » sur une pièce
            signée électroniquement, que personne ne complète jamais à la main. */}
        <DocSection title="11. Signatures">
          <SignatureZone
            intro="La présente convention est établie en deux exemplaires originaux, un pour chaque partie."
            faitLe={`${identite.rcsVille || "_________________________"}, le ${data.dateConvention}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Pour le client",
                signature: data.signatures?.client ?? null,
                nom: data.client.raisonSociale,
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
