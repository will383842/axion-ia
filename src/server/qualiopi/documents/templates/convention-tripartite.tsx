/**
 * Qualiopi — Convention de formation tripartite (OF + Client + OPCO).
 *
 * Extension de la convention bipartite avec subrogation de paiement OPCO.
 * Conforme L.6353-1 et L.6353-2 du Code du travail.
 * Rendu serveur exclusif — NE PAS "use client".
 *
 * ## 🔴 Sous-lot 8B — la pièce que lit l'OPCO était la MOINS complète des deux
 *
 * Constat de l'audit OPCO du 15/08 (`_AUDIT/OPCO-COMMERCIAL-2026-08-15/`, T6) :
 * le 02/08, la convention BIPARTITE a reçu les trois mentions exigées par
 * L.6353-1 — moyens pédagogiques et techniques, suivi de l'exécution et
 * appréciation des résultats, sanction de la formation — puis cinq sections de
 * fond (obligations, RGPD, propriété intellectuelle, responsabilité, droit
 * applicable). **La tripartite n'a reçu ni les unes ni les autres.** Son type ne
 * portait même pas les champs, et son corps s'arrêtait à « 4. Annulation ».
 *
 * Elle invoquait pourtant L.6353-1 en tête de page. Une convention qui cite le
 * texte sans en porter les mentions est incomplète au regard de ce qu'elle
 * invoque — et c'est la première chose que lit un instructeur.
 *
 * Ce qui rendait l'écart coûteux : c'est la pièce **transmise au financeur**.
 * L'OPCO ne paie que sur pièces ; celle-ci était la plus exposée et la plus
 * pauvre. Elle est désormais alignée sur la bipartite, section pour section.
 *
 * ⚠️ La numérotation des sections a changé (annexes 5 → 10, signatures 6 → 11).
 * Vérifié avant de renuméroter : **aucun renvoi par rang** n'existe, ni dans la
 * pièce, ni dans les specs, ni dans les kits financeurs. Renuméroter une liste
 * référencée par rang casserait ses renvois — ce n'est pas le cas ici.
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

export interface ConventionTripartiteData {
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
  // Partie OPCO
  opco: {
    nom: string;
    numeroPriseEnCharge: string;
    adresse?: string;
    contact?: string;
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
  /**
   * Les trois mentions de l'article L.6353-1 — sous-lot 8B.
   *
   * Optionnelles, avec les mêmes replis que la bipartite : ces replis décrivent
   * le dispositif RÉEL de la plateforme (émargement par demi-journée,
   * positionnement, évaluation des acquis, attestation). Les réinventer session
   * par session les ferait diverger de ce que le système produit vraiment, et
   * une convention qui décrit un dispositif absent est pire qu'une convention
   * muette.
   */
  moyensPedagogiques?: string;
  modalitesEvaluation?: string;
  sanction?: string;
  // Conditions financières
  prixHt: number;
  /**
   * Montant TOTAL pris en charge par le financeur, en euros.
   *
   * 🔴 `null` = **non établi**, et il faut le dire. Ce champ recevait
   * auparavant `priseEnChargeMontantCents / 100` — c'est-à-dire un TARIF lu
   * comme un total : un OPCO couvrant 40 €/h sur 14 h et 8 participants faisait
   * imprimer « 40,00 € » au lieu de 4 480 €, sur une pièce signée par trois
   * parties, avec un reste à charge faux du même écart.
   *
   * ⚠️ Ne JAMAIS remplacer ce `null` par 0 : un zéro affirme que le financeur
   * ne prend rien en charge. L'absence de donnée n'est pas une donnée nulle.
   */
  montantPrisEnCharge: number | null;
  /** Reste à charge, en euros. `null` quand la prise en charge n'est pas établie. */
  resteAChargeClient: number | null;
  // Date convention
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
  subrogationNote: {
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 6,
    marginBottom: 6,
    color: pdfStyles.legalNote.color,
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

export function ConventionTripartitePdf({
  data,
  identite,
}: {
  data: ConventionTripartiteData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Convention de formation tripartite"
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

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Client (employeur / commanditaire)
          </Text>
          <FieldRow label="Raison sociale" value={data.client.raisonSociale} />
          <FieldRow label="SIRET" value={data.client.siret} />
          <FieldRow label="Adresse" value={data.client.adresse} />
          <FieldRow label="Contact" value={data.client.contact} />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            OPCO (organisme financeur)
          </Text>
          <FieldRow label="Nom de l'OPCO" value={data.opco.nom} />
          <FieldRow label="N° de prise en charge" value={data.opco.numeroPriseEnCharge} />
          {data.opco.adresse ? <FieldRow label="Adresse" value={data.opco.adresse} /> : null}
          {data.opco.contact ? <FieldRow label="Contact" value={data.opco.contact} /> : null}

          <Text style={local.subrogationNote}>
            En application de la subrogation de paiement, l'OPCO versera directement sa
            participation à l'organisme de formation. Le solde restant à charge reste dû par le
            client.
          </Text>
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
            🔴 Sous-lot 8B — les TROIS mentions de l'article L.6353-1. Elles
            manquaient à cette pièce alors qu'elle invoque le texte en tête, et
            alors que la bipartite les porte depuis le 02/08. Mêmes libellés,
            mêmes replis : deux formulations divergentes de la même obligation
            légale sur deux pièces du même dossier se lisent comme une
            incohérence, et c'est le financeur qui les compare.
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
          {/* 🔴 Un montant NON ÉTABLI se dit, il ne s'imprime pas à zéro.
              « 0,00 € » sur une convention affirme que le financeur ne prend
              rien en charge — une affirmation, et fausse. « À déterminer »
              décrit exactement l'état du dossier : le barème n'a pas encore été
              relevé, ou son unité n'a pas été saisie. */}
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Prise en charge OPCO ({data.opco.nom})</Text>
            <Text style={local.amountValue}>
              {data.montantPrisEnCharge !== null
                ? formatEur(data.montantPrisEnCharge)
                : "À déterminer"}
            </Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Reste à charge client</Text>
            <Text style={local.amountValue}>
              {data.resteAChargeClient !== null
                ? formatEur(data.resteAChargeClient)
                : "À déterminer"}
            </Text>
          </View>
          {data.montantPrisEnCharge === null ? (
            <Text style={local.subrogationNote}>
              Le montant de prise en charge sera arrêté par le financeur dans son accord écrit ; le
              solde correspondant restera dû par le client.
            </Text>
          ) : null}
          {/*
            🔴 F25 — la mention TVA vient du régime CONFIGURÉ, jamais d'une
            constante. L'exonération 261-4-4° était imprimée en dur alors que
            `regime_tva` vaut « assujetti » : on annonçait une exonération non
            détenue sur une pièce contractuelle et sur les kits financeurs.
            `null` en régime assujetti → aucun bloc, ce qui est correct.
          */}
          {identite.mentionTvaRegime ? (
            <Text style={pdfStyles.legalNote}>{identite.mentionTvaRegime}</Text>
          ) : null}
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
        </DocSection>

        {/*
          🔴 Sous-lot 8B — les cinq sections de fond, absentes de cette pièce.

          La bipartite les a reçues le 02/08 (obligations, RGPD, propriété
          intellectuelle, responsabilité, droit applicable) après le constat
          qu'elle ne couvrait que l'objet, le prix et l'annulation : en cas de
          litige — support recopié, résultat déçu, incident de traitement —
          l'organisme n'opposait aucun texte, et le RGPD restait muet sur la
          pièce même qui fait traiter des données de stagiaires.

          Le raisonnement vaut à l'identique ici, et davantage : la présence
          d'un troisième signataire n'ajoute aucune clause, elle ajoute
          seulement un lecteur de plus. Les textes sont donc REPRIS À
          L'IDENTIQUE de la bipartite — deux rédactions différentes du même
          engagement, sur deux pièces du même dossier, s'interpréteraient l'une
          contre l'autre.
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
          {/*
            La seule clause PROPRE à la tripartite. Elle ne double pas la note de
            subrogation du § 1 : celle-ci dit qui verse, celle-là dit ce qui se
            passe quand le versement n'arrive pas. C'est précisément le trou
            relevé à l'audit (Q3) — techniquement le système sait facturer N
            payeurs, mais aucun texte ne permettait de réémettre au client.
          */}
          <Text style={pdfStyles.paragraph}>
            La prise en charge par l&apos;OPCO est subordonnée à son accord écrit préalable et au
            respect de ses règles de financement. En cas de refus, de réduction, de caducité de
            l&apos;accord ou de non-paiement par l&apos;OPCO pour quelque cause que ce soit, les
            sommes correspondantes redeviennent exigibles auprès du client, qui demeure le débiteur
            du prix convenu à l&apos;article 3.
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
          {/*
            Spécifique à la tripartite : la transmission au financeur est un
            traitement de plus, et il doit être annoncé sur la pièce que le
            financeur lui-même reçoit. L'omettre reviendrait à faire circuler
            des données d'émargement et d'évaluation sans base annoncée.
          */}
          <Text style={pdfStyles.paragraph}>
            Les pièces justificatives de réalisation (feuille d&apos;émargement, attestation,
            facture) sont transmises à l&apos;OPCO aux seules fins d&apos;instruction et de
            règlement du dossier de prise en charge, en exécution de la présente convention.
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
          <Text style={local.annexeItem}>– Programme détaillé de la formation</Text>
          <Text style={local.annexeItem}>– Règlement intérieur des stagiaires</Text>
          <Text style={local.annexeItem}>– Conditions générales de vente (CGV)</Text>
          <Text style={local.annexeItem}>
            – Accord de prise en charge OPCO n° {data.opco.numeroPriseEnCharge}
          </Text>
        </DocSection>

        {/* 11. Signatures — 3 parties */}
        {/* « Fait à » = ville du siège — même raisonnement que la convention : un
            blanc sur une pièce signée électroniquement reste vide pour toujours. */}
        <DocSection title="11. Signatures">
          <SignatureZone
            intro="La présente convention est établie en trois exemplaires originaux, un pour chaque partie."
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
              {
                titre: "Pour l'OPCO",
                signature: data.signatures?.financeur ?? null,
                nom: data.opco.nom,
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
