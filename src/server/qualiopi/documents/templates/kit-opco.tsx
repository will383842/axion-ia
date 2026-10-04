/**
 * Qualiopi — Kit OPCO : page récapitulative du dossier de prise en charge.
 *
 * Récapitule les pièces requises par l'OPCO + la ventilation horaire
 * (participants × heures × barème → montant pris en charge + reste à charge).
 * Rappel : durée en centièmes (formatHeuresCentiemes), NDA/Qualiopi/exonération TVA.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
  DataTable,
  formatEurosFromCents,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formatHeuresCentiemes } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";
import type { EncartDepot } from "@/server/qualiopi/financements/dossier-pret-a-deposer";

// ============================================================
// Styles spécifiques
// ============================================================

const styles = StyleSheet.create({
  pieceRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("sand"),
    alignItems: "center",
  },
  pieceCheck: {
    width: 9,
    height: 9,
    marginTop: 2,
    marginRight: 7,
    borderWidth: 0.8,
    borderStyle: "solid",
    fontSize: 10,
    borderColor: brandColor("sage"),
    color: brandColor("sage"),
  },
  /** Conteneur des deux lignes. C'est LUI qui prend la largeur restante. */
  /** Case COCHÉE : remplie, en géométrie (aucun glyphe, cf. correctif 2026-07-26). */
  pieceCheckCochee: { backgroundColor: brandColor("sage") },
  piecesManquantes: {
    marginTop: 6,
    fontSize: 9,
    color: brandColor("terracotta"),
  },
  pieceLabelBlock: { flex: 1 },
  pieceLabel: {
    fontSize: 10,
    // 🔴 PAS de `flex: 1` ici (retiré le 2026-08-03, vérifié sur
    // AXI-DOC-2026-018). Le parent est un conteneur en COLONNE : `flex: 1` sur
    // le label lui faisait réclamer toute la hauteur disponible, et la note
    // légale se rendait PAR-DESSUS. Les cinq lignes de « Pièces constitutives »
    // partaient illisibles à l'OPCO — « Convention de formation » et
    // « L.6353-1 / L.6353-2 » imprimés l'un sur l'autre.
    //
    // Le style venait de `kit-cpf.tsx`, où il est inoffensif : ce gabarit-là ne
    // rend qu'UNE ligne par pièce. `kit-france-travail.tsx`, qui a la même
    // structure à deux lignes que ce fichier, met bien le `flex` sur le
    // conteneur — c'est le modèle repris ici.
    color: brandColor("fg"),
  },
  pieceNote: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
  },
  ventilTotalRow: {
    flexDirection: "row",
    paddingVertical: 5,
    backgroundColor: brandColor("sand"),
    paddingHorizontal: 4,
    marginTop: 4,
    borderRadius: 2,
  },
  ventilTotalLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor("mocha"),
    flex: 2,
  },
  ventilTotalValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor("terracotta"),
    fontFamily: "Inconsolata",
    flex: 1.5,
    textAlign: "right",
  },
});

// ============================================================
// Types de données
// ============================================================

/**
 * Pied de kit financeur : NDA, et le n° Qualiopi UNIQUEMENT s'il existe.
 *
 * 🔴 F29 — « à renseigner » est une note de chantier destinée à Will. Elle
 * s'imprimait telle quelle sur un document adressé à un financeur, où elle se
 * lit comme un dossier bâclé. Un organisme non encore certifié n'a pas de numéro
 * Qualiopi : on omet la mention au lieu d'annoncer qu'elle manque.
 */
function qualiopiLigne(identite: OrganismeIdentite): string {
  const nda = identite.nda ? `NDA : ${identite.nda}` : "";
  const qualiopi = identite.qualiopi ? `Certification Qualiopi : ${identite.qualiopi}` : "";
  return [nda, qualiopi].filter((p) => p !== "").join(" — ");
}

export interface VentilationParticipant {
  nomParticipant: string;
  heuresRealisees: number;
  baremePrisEnChargeHeureCents: number;
  montantPrisEnChargeCents: number;
  resteAChargeCents: number;
}

/** Une pièce de la demande, telle que constatée au registre (chantier OPCO A6). */
export interface PieceKitOpco {
  libelle: string;
  presente: boolean;
  /** Numéro de la pièce jointe, ou pourquoi elle manque. */
  detail: string;
}

export interface KitOpcoData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  nomOpco: string;
  numeroDossier: string;
  intituleFormation: string;
  dateDebut: string;
  dateFin: string;
  ventilation: VentilationParticipant[];
  totalPrisEnChargeCents: number;
  totalResteAChargeCents: number;
  estCopie?: boolean;
  /**
   * État RÉEL des pièces de la demande (registre des documents). Absent : le
   * kit imprime l'ancienne liste fixe, sans rien cocher.
   */
  pieces?: PieceKitOpco[];
  /** Encart « Comment déposer chez <OPCO> », lu dans le référentiel OPCO. */
  encartDepot?: EncartDepot;
}

/** Pièces produites APRÈS la formation, à la facturation : jamais cochées ici. */
const PIECES_APRES_FORMATION = (mentionTva: string | undefined) => [
  {
    label: "Certificat de réalisation (durées en centièmes)",
    note: "R.6332-26 + arrêté 21/12/2018",
  },
  { label: "Feuilles d'émargement signées (présentiel)", note: "Par demi-journée" },
  {
    label: "Relevés de connexion (distanciel)",
    note: "Connexion/déconnexion horodatés",
  },
  // 🔴 F25 (3e passage) — la mention TVA de la CHECKLIST était restée en
  // dur alors que le pied de page avait été corrigé. On annonçait donc
  // encore une exonération non détenue à l'OPCO, dans la liste même des
  // pièces à fournir. La note ne s'affiche que si le régime la porte.
  { label: "Facture", note: mentionTva ?? "" },
];

function LignePiece({
  label,
  note,
  cochee,
}: {
  label: string;
  note: string;
  cochee: boolean;
}): React.ReactElement {
  return (
    <View style={styles.pieceRow}>
      {/* 🔴 Correctif glyphes 2026-07-26. C'etait un caractere « ☐ »
        (U+2610), absent des 8 polices du projet — verifie a fontkit.
        @react-pdf basculait sur Helvetica/WinAnsi et ecrivait l'octet
        0x10, un caractere de CONTROLE : la colonne « pieces a fournir »
        envoyee au financeur etait donc entierement VIDE, sans que rien
        ne le signale. On dessine la case en geometrie plutot que de
        dependre d'un glyphe : une bordure s'imprime toujours. */}
      <View style={cochee ? [styles.pieceCheck, styles.pieceCheckCochee] : styles.pieceCheck} />
      <View style={styles.pieceLabelBlock}>
        <Text style={styles.pieceLabel}>{label}</Text>
        {/* Note omise si vide : un `<Text>` vide ajoute une ligne
            fantôme qui déséquilibre la hauteur des rangées. */}
        {note ? <Text style={styles.pieceNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

// ============================================================
// Composant principal
// ============================================================

export function KitOpcoPdf({ data }: { data: KitOpcoData }): React.ReactElement {
  const { identite } = data;

  return (
    <Document>
      <QualiopiPage
        docTitle="Kit dossier OPCO"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Informations OPCO */}
        <DocSection title="Informations OPCO et dossier">
          <FieldRow label="OPCO" value={data.nomOpco} />
          <FieldRow label="N° de dossier OPCO" value={data.numeroDossier} />
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
        </DocSection>

        {/* Encart de dépôt — c'est l'ENTREPRISE qui dépose (chantier OPCO A6). */}
        {data.encartDepot ? (
          <DocSection title={data.encartDepot.titre}>
            <FieldRow label="Qui dépose" value={data.encartDepot.qui} />
            <FieldRow label="Portail entreprise" value={data.encartDepot.portail} />
            <FieldRow label="Délai de dépôt de l'OPCO" value={data.encartDepot.delai} />
            <FieldRow label="Date limite de dépôt" value={data.encartDepot.dateLimite} />
            <FieldRow label="Régime de paiement" value={data.encartDepot.regime} />
            {data.encartDepot.etatFonds ? (
              <FieldRow label="État des fonds" value={data.encartDepot.etatFonds} />
            ) : null}
          </DocSection>
        ) : null}

        {/* Pièces de la demande : cochées SEULEMENT si présentes au registre. */}
        {data.pieces ? (
          <DocSection title="Pièces de la demande de prise en charge">
            {data.pieces.map((p, idx) => (
              <LignePiece
                key={idx}
                label={p.libelle}
                note={p.presente ? `Jointe — ${p.detail}` : `Manquante — ${p.detail}`}
                cochee={p.presente}
              />
            ))}
            {data.pieces.some((p) => !p.presente) ? (
              <Text style={styles.piecesManquantes}>
                {`Pièces manquantes : ${data.pieces
                  .filter((p) => !p.presente)
                  .map((p) => p.libelle)
                  .join(", ")}`}
              </Text>
            ) : null}
          </DocSection>
        ) : null}

        {/* Pièces à joindre */}
        <DocSection
          title={
            data.pieces ? "Pièces à produire après la formation" : "Pièces constitutives du dossier"
          }
        >
          {[
            // La convention figure déjà, vérifiée, dans la section ci-dessus.
            ...(data.pieces
              ? []
              : [
                  {
                    label: "Convention de formation / accord tripartite",
                    note: "L.6353-1 / D.6353-1",
                  },
                ]),
            ...PIECES_APRES_FORMATION(identite.mentionTvaRegime),
          ].map((piece, idx) => (
            <LignePiece key={idx} label={piece.label} note={piece.note} cochee={false} />
          ))}
        </DocSection>

        {/* Ventilation horaire */}
        <DocSection title="Ventilation horaire et financement">
          <DataTable
            columns={[
              { key: "participant", header: "Participant", flex: 2 },
              { key: "heures", header: "Heures", flex: 1.5, align: "right" },
              { key: "bareme", header: "Barème/h", flex: 1.5, align: "right" },
              { key: "prisEnCharge", header: "Pris en charge", flex: 2, align: "right" },
              { key: "rac", header: "RAC", flex: 1.5, align: "right" },
            ]}
            rows={data.ventilation.map((v) => ({
              participant: v.nomParticipant,
              heures: formatHeuresCentiemes(v.heuresRealisees),
              bareme: formatEurosFromCents(v.baremePrisEnChargeHeureCents),
              prisEnCharge: formatEurosFromCents(v.montantPrisEnChargeCents),
              rac: formatEurosFromCents(v.resteAChargeCents),
            }))}
          />

          {/* Totaux */}
          <View style={styles.ventilTotalRow}>
            <Text style={styles.ventilTotalLabel}>Total pris en charge OPCO</Text>
            <Text style={styles.ventilTotalValue}>
              {formatEurosFromCents(data.totalPrisEnChargeCents)}
            </Text>
          </View>
          <View style={[styles.ventilTotalRow, { backgroundColor: brandColor("terracotta-soft") }]}>
            <Text style={styles.ventilTotalLabel}>Total reste à charge</Text>
            <Text style={styles.ventilTotalValue}>
              {formatEurosFromCents(data.totalResteAChargeCents)}
            </Text>
          </View>
        </DocSection>

        {/* Mentions légales */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.legalNote}>{qualiopiLigne(identite)}</Text>
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
        </View>
      </QualiopiPage>
    </Document>
  );
}
