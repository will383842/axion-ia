/**
 * Qualiopi — Contrat de formation professionnelle (PARTICULIERS / B2C).
 *
 * Conforme aux articles L.6353-3 à L.6353-7 du Code du travail.
 * Distinct de la convention (personnes morales, L.6353-1/2) : ce contrat est
 * conclu directement avec une personne physique qui finance elle-même sa
 * formation. Mentions obligatoires (L.6353-4), délai de rétractation de 10 jours
 * (L.6353-5), interdiction de paiement avant l'expiration du délai + acompte ≤ 30 %
 * + échelonnement (L.6353-6), résiliation pour force majeure au prorata (L.6353-7).
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  SignatureZone,
  pdfStyles,
  assainirEspacesPdf,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { PLAFOND_ACOMPTE_PARTICULIER_PCT } from "@/server/qualiopi/financements/acompte";

// ============================================================
// Types
// ============================================================

export interface ContratFormationData {
  numero: string;
  estCopie?: boolean;
  /** Injecte par `generateDocument` quand l'identite de l'OF est incomplete. */
  estSpecimen?: boolean;
  specimenMotif?: string;
  // Stagiaire (personne physique signataire et financeur)
  stagiaire: {
    nomPrenom: string;
    adresse?: string;
    email?: string;
    telephone?: string;
  };
  // Objet de la formation (L.6353-4)
  intitule: string;
  objectifs: string[];
  /** Nature de l'action (L.6313-1) — par défaut « action de formation ». */
  natureAction?: string;
  /** Niveau de connaissances préalables requis (L.6353-4). */
  niveauPrealable?: string;
  /** Sanction de la formation (attestation de fin de formation). */
  sanction?: string;
  dureeHeures: number;
  dateDebut: string;
  dateFin: string;
  modalite: "Présentiel" | "Distanciel" | "Mixte";
  lieu: string;
  // Conditions financières (la mention TVA suit `qualiopi.regime_tva`)
  prixNet: number;
  /** Pourcentage d'acompte après le délai de rétractation (plafonné à 30 % — L.6353-6). */
  acomptePercent?: number;
  /**
   * Montant d'acompte RÉELLEMENT convenu, en euros. Prioritaire sur le
   * pourcentage : un contrat imprime ce qui a été convenu, il ne recalcule pas
   * un plafond. Reste borné à 30 % du prix (L.6353-6) même s'il est fourni.
   */
  acompteEuros?: number;
  /**
   * Échéancier DATÉ du solde — art. L.6353-6 point (3).
   *
   * 🔴 Ce n'est pas un agrément : la doctrine administrative impose que « les
   * modalités de règlement, notamment l'échéancier, figurent dans le contrat de
   * formation ». Jusqu'au 2026-07-30, ce contrat annonçait l'échelonnement sans
   * en donner une seule date — l'obligation était citée, pas remplie.
   *
   * ⚠️ Calculé sur les bornes CONTRACTUELLES de l'action, jamais sur le rythme
   * réel du stagiaire : un échéancier au prorata des heures consommées serait
   * inconnaissable à la signature, donc impossible à écrire ici.
   *
   * Absent → on retombe sur la ligne « solde échelonné » sans date, ce qui est le
   * comportement historique. On ne fabrique aucune échéance.
   */
  echeancierSolde?: ReadonlyArray<{
    libelle: string;
    montantEuros: number;
    dueLeLisible: string | null;
  }>;
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
// Styles locaux
// ============================================================

const local = StyleSheet.create({
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

export function ContratFormationPdf({
  data,
  identite,
}: {
  data: ContratFormationData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  // L.6353-6 : l'acompte versé à l'expiration du délai de rétractation ne peut
  // excéder 30 % du prix convenu. On plafonne donc à 30 % par sécurité.
  //
  // 🔴 Réconciliation des sources de l'acompte, 2026-07-27. Quatre endroits du
  // système calculaient un acompte, et deux d'entre eux répondaient à des
  // questions DIFFÉRENTES sans le dire :
  //
  //   · `calculerAcompte()` PROPOSE un montant — assiette = reste à charge,
  //     c'est-à-dire ce que le particulier avance réellement de sa poche ;
  //   · la garde L6353-6 de `facturation-hub` REFUSE un dépassement — assiette =
  //     prix convenu, lecture littérale de l'article ;
  //   · ce contrat et la convention IMPRIMENT un montant.
  //
  // Les deux premières ne se contredisent pas : 30 % du reste à charge est
  // toujours ≤ 30 % du prix convenu. L'une propose sous le plafond que l'autre
  // fait respecter. Ce sont deux étages, pas deux règles rivales — et c'est ce
  // qui a été pris à tort pour une contradiction.
  //
  // Le vrai défaut était ICI : `prixNet` reçoit `session.montantHtCents`, donc
  // le TOTAL. Ce contrat imprimait 30 % du total — le PLAFOND — comme si c'était
  // le montant demandé. Sur 2 000 € dont 1 200 € financés, il annonçait 600 €
  // quand le calcul en propose 240. Le client signait un chiffre que le système
  // n'appliquait pas.
  //
  // Un contrat n'a pas à recalculer un plafond : il imprime ce qui a été
  // CONVENU. Si le montant est fourni, on l'imprime tel quel ; sinon on retombe
  // sur le calcul historique, en le plafonnant toujours.
  const acomptePercent = Math.min(data.acomptePercent ?? 30, 30);
  const acompte =
    data.acompteEuros !== undefined
      ? Math.min(data.acompteEuros, (data.prixNet * PLAFOND_ACOMPTE_PARTICULIER_PCT) / 100)
      : (data.prixNet * acomptePercent) / 100;
  const solde = data.prixNet - acompte;
  const natureAction =
    data.natureAction ?? "Action de formation (article L.6313-1 du Code du travail)";
  const niveauPrealable = data.niveauPrealable ?? "Aucun prérequis particulier.";
  const sanction =
    data.sanction ??
    "Attestation de fin de formation remise à l'issue de l'action (article L.6353-1).";

  return (
    <Document>
      <QualiopiPage
        docTitle="Contrat de formation professionnelle"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/* Mention légale de tête */}
        <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.contratParticulier}</Text>

        {/* 1. Parties */}
        <DocSection title="1. Entre les soussignés">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            L'organisme de formation (prestataire)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale} required />
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
          <FieldRow label="Email" value={identite.email || "—"} />
          <FieldRow label="Téléphone" value={identite.telephone || "—"} />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Le stagiaire (personne physique)
          </Text>
          <FieldRow label="Nom et prénom" value={data.stagiaire.nomPrenom} />
          <FieldRow
            label="Adresse"
            value={data.stagiaire.adresse || "_______________________________"}
          />
          <FieldRow label="Email" value={data.stagiaire.email || "—"} />
          <FieldRow label="Téléphone" value={data.stagiaire.telephone || "—"} />
          <Text style={pdfStyles.legalNote}>
            Le présent contrat est conclu avec une personne physique qui entreprend la formation à
            titre individuel et à ses frais (articles L.6353-3 à L.6353-7 du Code du travail).
          </Text>
        </DocSection>

        {/* 2. Objet et nature de l'action (L.6353-4) */}
        <DocSection title="2. Objet, nature et organisation de l'action">
          <FieldRow label="Intitulé" value={data.intitule} />
          <FieldRow label="Nature de l'action" value={natureAction} />
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
          <FieldRow label="Niveau de connaissances préalables" value={niveauPrealable} />
          <FieldRow label="Durée" value={`${data.dureeHeures} heure(s)`} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
          <FieldRow label="Modalité de déroulement" value={data.modalite} />
          <FieldRow label="Lieu" value={data.lieu} />
          <FieldRow label="Sanction de la formation" value={sanction} />
        </DocSection>

        {/* 3. Prix et modalités de règlement (L.6353-4 / L.6353-6) */}
        <DocSection title="3. Prix et modalités de règlement">
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Prix total de la formation (net)</Text>
            <Text style={local.amountValue}>{formatEur(data.prixNet)}</Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>
              Acompte à l'expiration du délai de rétractation ({acomptePercent} % maximum)
            </Text>
            <Text style={local.amountValue}>{formatEur(acompte)}</Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>
              Solde échelonné au fur et à mesure du déroulement de l'action
            </Text>
            <Text style={local.amountValue}>{formatEur(solde)}</Text>
          </View>

          {/* 🔴 L'échéancier DATÉ — ce que la doctrine exige au contrat.
              Sans lui, la pièce citait L.6353-6 sans jamais dire QUAND le
              stagiaire paie. Absent, on garde la ligne « solde échelonné »
              ci-dessus : on ne fabrique aucune date. */}
          {data.echeancierSolde !== undefined && data.echeancierSolde.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>Échéancier du solde</Text>
              {data.echeancierSolde.map((e, i) => (
                <View key={i} style={local.amountRow}>
                  <Text style={local.amountLabel}>
                    {e.dueLeLisible !== null ? `${e.dueLeLisible} — ${e.libelle}` : e.libelle}
                  </Text>
                  <Text style={local.amountValue}>{formatEur(e.montantEuros)}</Text>
                </View>
              ))}
            </View>
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
          <Text style={pdfStyles.paragraph}>
            Conformément à l'article L.6353-6 du Code du travail, aucune somme ne peut être exigée
            du stagiaire avant l'expiration du délai de rétractation. À l'issue de ce délai, il ne
            peut être versé un acompte supérieur à 30 % du prix convenu ; le solde fait l'objet d'un
            échelonnement des paiements au fur et à mesure du déroulement de la formation.
          </Text>
        </DocSection>

        {/* 4. Délai de rétractation (L.6353-5) */}
        <DocSection title="4. Délai de rétractation">
          <Text style={pdfStyles.paragraph}>
            À compter de la date de signature du présent contrat, le stagiaire dispose d'un délai de{" "}
            <Text style={{ fontWeight: "bold" }}>dix (10) jours</Text> pour se rétracter. Il en
            informe l'organisme de formation par lettre recommandée avec accusé de réception.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Dans ce cas, aucune somme ne peut être retenue ni exigée du stagiaire (article L.6353-5
            du Code du travail).
          </Text>
        </DocSection>

        {/* 5. Interruption, abandon et résiliation (L.6353-7) */}
        <DocSection title="5. Interruption, abandon et résiliation">
          <Text style={pdfStyles.paragraph}>
            Si, par suite d'un cas de force majeure dûment reconnu, le stagiaire est empêché de
            suivre la formation, il peut rompre le contrat. Seules les prestations effectivement
            dispensées sont alors dues, à due proportion de leur valeur prévue au présent contrat
            (article L.6353-7 du Code du travail).
          </Text>
          <Text style={local.listItem}>
            • En cas d'inexécution totale ou partielle de la formation du fait de l'organisme, ce
            dernier rembourse au stagiaire les sommes indûment perçues.
          </Text>
          <Text style={local.listItem}>
            • En cas d'abandon en cours de formation pour un motif autre que la force majeure, les
            prestations effectivement réalisées restent dues.
          </Text>
        </DocSection>

        {/* 6. Documents annexés */}
        <DocSection title="6. Documents annexés">
          <Text style={local.listItem}>– Programme détaillé de la formation</Text>
          <Text style={local.listItem}>– Règlement intérieur des stagiaires</Text>
          <Text style={local.listItem}>– Conditions générales de vente (CGV)</Text>
        </DocSection>

        {/* 7. Signatures */}
        <DocSection title="7. Signatures">
          <SignatureZone
            intro="Le présent contrat est établi en deux exemplaires originaux, un pour chaque partie."
            faitLe={`_________________________, le ${data.dateContrat}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Le stagiaire",
                signature: data.signatures?.beneficiaire ?? null,
                nom: data.stagiaire.nomPrenom,
                mention: "Mention manuscrite « Lu et approuvé », date et signature",
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
