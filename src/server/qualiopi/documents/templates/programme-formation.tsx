/**
 * Qualiopi — Programme de l'action de formation.
 *
 * L'ANNEXE que la convention annonce en section « Documents annexés » depuis
 * l'origine, et que rien ne produisait. C'est aussi l'une des trois pièces
 * exigées à l'appui de la déclaration d'activité (art. R.6351-5 C. trav.), avec
 * la première convention signée et la liste des intervenants.
 *
 * 🔴 Les données viennent du SNAPSHOT de la session, jamais de la formation
 * vivante (cf. `readFormationForDocs`). Un programme annexé à une convention
 * décrit l'action telle qu'elle a été VENDUE ; si le catalogue est refondu six
 * mois plus tard, cette annexe ne doit pas changer sous les pieds du client ni
 * de l'auditeur. C'est la même source que la convention elle-même, donc les deux
 * pièces d'un même dossier ne peuvent pas se contredire.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { View, Document, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  BulletList,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formaterDuree, type ModuleProgramme } from "@/server/qualiopi/documents/programme-modules";
import { brandColor, QUALIOPI_PDF_TYPE } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Types
// ============================================================

export interface ProgrammeFormationData {
  numero: string;
  estCopie?: boolean;
  estSpecimen?: boolean;
  specimenMotif?: string;

  /** Intitulé de l'action, tel que porté par la convention. */
  intitule: string;
  /** Version du programme figée au snapshot (traçabilité auditeur). */
  versionProgramme?: string;
  /** Date d'édition, déjà formatée. */
  dateEdition: string;

  /** Durée CONTRACTUELLE en heures — celle qui engage. */
  dureeHeures: number;
  modalite: string;
  lieu: string;
  publicVise: string;
  prerequis: string;
  /** Niveau visé, libellé lisible. */
  niveau?: string;
  accessibleHandicap: boolean;

  objectifs: string[];
  modules: ModuleProgramme[];
  methodesPedagogiques: string;
  moyensTechniques?: string;
  /** Modalités d'évaluation et de sanction de l'action. */
  modalitesEvaluation: string;
  /** Libellé de la sanction (attestation, certificat…). */
  sanction: string;

  /** Contact du référent handicap, si désigné. */
  referentHandicapEmail?: string;
}

export interface ProgrammeFormationProps {
  data: ProgrammeFormationData;
  identite: OrganismeIdentite;
}

// ============================================================
// Styles locaux
// ============================================================

// Couleurs et corps de texte pris aux jetons de marque — jamais d'hexadécimal en
// dur : `brand-tokens.ts` est sous test de parité avec `globals.css`, une valeur
// écrite ici échapperait à ce contrôle et le PDF dériverait du site.
const local = StyleSheet.create({
  moduleBloc: {
    marginBottom: 10,
    paddingLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: brandColor("border-strong"),
  },
  moduleTitre: {
    fontSize: QUALIOPI_PDF_TYPE.md,
    fontWeight: "bold",
    marginBottom: 2,
  },
  moduleDuree: {
    fontSize: QUALIOPI_PDF_TYPE.sm,
    color: brandColor("fg-muted"),
    marginBottom: 3,
  },
  sequenceItem: {
    fontSize: QUALIOPI_PDF_TYPE.sm,
    lineHeight: 1.5,
    marginBottom: 1,
    paddingLeft: 8,
  },
  bodyText: {
    fontSize: QUALIOPI_PDF_TYPE.base,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  absent: {
    fontSize: QUALIOPI_PDF_TYPE.sm,
    fontStyle: "italic",
    color: brandColor("fg-soft"),
    lineHeight: 1.5,
  },
});

// ============================================================
// Composant
// ============================================================

export function ProgrammeFormationPdf({
  data,
  identite,
}: ProgrammeFormationProps): React.ReactElement {
  const dureeContractuelle = `${data.dureeHeures} heure(s)`;

  return (
    <Document>
      <QualiopiPage
        docTitle="Programme de l'action de formation"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/* 1. Identification de l'action */}
        <DocSection title="1. Identification de l'action">
          <FieldRow label="Intitulé" value={data.intitule} required />
          <FieldRow label="Durée" value={dureeContractuelle} required />
          <FieldRow label="Modalité" value={data.modalite} />
          <FieldRow label="Lieu de déroulement" value={data.lieu} />
          {data.versionProgramme ? (
            <FieldRow label="Version du programme" value={data.versionProgramme} />
          ) : null}
          <FieldRow label="Date d'édition" value={data.dateEdition} />
        </DocSection>

        {/* 2. Public et prérequis */}
        <DocSection title="2. Public visé et prérequis">
          <FieldRow label="Public visé" value={data.publicVise} required />
          {/*
            « Aucun prérequis » est une INFORMATION, pas une absence de donnée :
            un stagiaire doit pouvoir lire qu'il peut s'inscrire sans condition.
            Laisser la ligne vide se lirait comme un oubli.
          */}
          <FieldRow label="Prérequis" value={data.prerequis || "Aucun prérequis"} />
          {data.niveau ? <FieldRow label="Niveau visé" value={data.niveau} /> : null}
          <FieldRow
            label="Accessibilité"
            value={
              data.accessibleHandicap
                ? `Action accessible aux personnes en situation de handicap. Contact référent : ${
                    data.referentHandicapEmail || identite.email || "—"
                  }`
                : "Nous contacter pour étudier les adaptations possibles."
            }
          />
        </DocSection>

        {/* 3. Objectifs pédagogiques */}
        <DocSection title="3. Objectifs pédagogiques">
          {data.objectifs.length > 0 ? (
            <BulletList items={data.objectifs} />
          ) : (
            <Text style={local.absent}>Objectifs non renseignés au programme de cette action.</Text>
          )}
        </DocSection>

        {/* 4. Contenu — le cœur de la pièce */}
        <DocSection title="4. Contenu de la formation">
          {data.modules.length > 0 ? (
            data.modules.map((m, i) => {
              const duree = formaterDuree(m.dureeMin);
              return (
                <View key={`${i}-${m.titre}`} style={local.moduleBloc} wrap={false}>
                  <Text style={local.moduleTitre}>
                    Module {i + 1} — {m.titre}
                  </Text>
                  {duree !== null ? <Text style={local.moduleDuree}>Durée : {duree}</Text> : null}
                  {m.sequences.map((s, j) => {
                    const dureeSeq = formaterDuree(s.dureeMin);
                    return (
                      <Text key={`${j}-${s.titre}`} style={local.sequenceItem}>
                        • {s.titre}
                        {dureeSeq !== null ? ` (${dureeSeq})` : ""}
                      </Text>
                    );
                  })}
                </View>
              );
            })
          ) : (
            /*
              🔴 On DIT que le découpage n'est pas structuré plutôt que d'imprimer
              une section vide. Une annexe muette laisse croire à un défaut
              d'impression ; une annexe qui nomme sa lacune est vérifiable, et
              l'intitulé, la durée et les objectifs ci-dessus restent opposables.
            */
            <Text style={local.absent}>
              Le découpage en modules n&apos;est pas structuré pour cette action. L&apos;intitulé,
              la durée, les objectifs et les modalités ci-dessus décrivent l&apos;action telle
              qu&apos;elle a été conclue.
            </Text>
          )}
        </DocSection>

        {/* 5. Méthodes et moyens */}
        <DocSection title="5. Moyens pédagogiques et techniques">
          <Text style={local.bodyText}>{data.methodesPedagogiques || "—"}</Text>
          {data.moyensTechniques ? (
            <Text style={local.bodyText}>{data.moyensTechniques}</Text>
          ) : null}
        </DocSection>

        {/* 6. Évaluation et sanction */}
        <DocSection title="6. Modalités d'évaluation et sanction">
          <Text style={local.bodyText}>{data.modalitesEvaluation}</Text>
          <FieldRow label="Sanction de la formation" value={data.sanction} />
        </DocSection>

        <Text style={pdfStyles.legalNote}>
          Programme établi conformément à l&apos;article L.6353-1 du Code du travail. Il constitue
          l&apos;annexe pédagogique de la convention de formation professionnelle.
        </Text>
      </QualiopiPage>
    </Document>
  );
}
