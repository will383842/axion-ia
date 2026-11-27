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
  PageCharte,
  Carte,
  LigneChamp,
  ListePuces,
  CHARTE_COULEURS,
  CHARTE_TYPO,
} from "../charte/v1";
import { NoteLegale, Paragraphe } from "./charte-documents-formation";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formaterDuree, type ModuleProgramme } from "@/server/qualiopi/documents/programme-modules";
import { titreModuleSansPrefixe } from "@/server/qualiopi/documents/programme-modules";

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
  /**
   * Ressources pédagogiques mises à disposition des bénéficiaires — la preuve
   * attendue à l'INDICATEUR 19 du RNQ, que `audit-dossier.ts` fait porter à
   * cette pièce depuis l'origine sans qu'elle la porte jamais.
   *
   * Absent (et non « tableau vide ») quand la formation n'en déclare aucune :
   * le gabarit omet alors la section entière.
   */
  ressourcesPedagogiques?: string[];
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

// Style v2 : couleurs et tailles de `charte/v1` (aucun hexadécimal en dur).
const local = StyleSheet.create({
  moduleBloc: {
    marginBottom: 9,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: CHARTE_COULEURS.bleu,
  },
  moduleTitre: {
    fontSize: CHARTE_TYPO.titreCarte.taille,
    fontWeight: CHARTE_TYPO.graisses.grasse,
    color: CHARTE_COULEURS.texte,
    marginBottom: 2,
  },
  moduleDuree: {
    fontSize: CHARTE_TYPO.petit.taille,
    color: CHARTE_COULEURS.terracotta,
    marginBottom: 3,
  },
  sequenceItem: {
    fontSize: CHARTE_TYPO.petit.taille,
    lineHeight: CHARTE_TYPO.corps.interligne,
    color: CHARTE_COULEURS.texte,
    marginBottom: 1,
    paddingLeft: 8,
  },
  absent: {
    fontSize: CHARTE_TYPO.petit.taille,
    fontStyle: "italic",
    color: CHARTE_COULEURS.texte,
    lineHeight: CHARTE_TYPO.corps.interligne,
  },
});

// ============================================================
// Composant
// ============================================================

export function ProgrammeFormationPdf({
  data,
  identite,
}: ProgrammeFormationProps): React.ReactElement {
  const dureeContractuelle = `${data.dureeHeures} heure${data.dureeHeures > 1 ? "s" : ""}`;

  // Numérotation : la section « Ressources » n'existe que si la formation en
  // déclare. Sans ce calcul, une action sans ressources imprimerait « 5 » puis
  // « 7 » — un trou qu'un auditeur lit comme une page manquante.
  const ressources = data.ressourcesPedagogiques ?? [];
  const numEvaluation = ressources.length > 0 ? 7 : 6;

  return (
    <Document>
      <PageCharte
        docTitle="Programme de l'action de formation"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/* 1. Identification de l'action */}
        <Carte titre="1. Identification de l'action">
          <LigneChamp label="Intitulé" value={data.intitule} required />
          <LigneChamp label="Durée" value={dureeContractuelle} required />
          <LigneChamp label="Modalité" value={data.modalite} />
          <LigneChamp label="Lieu de déroulement" value={data.lieu} />
          {data.versionProgramme ? (
            <LigneChamp label="Version du programme" value={data.versionProgramme} />
          ) : null}
          <LigneChamp label="Date d'édition" value={data.dateEdition} />
        </Carte>

        {/* 2. Public et prérequis */}
        <Carte titre="2. Public visé et prérequis">
          <LigneChamp label="Public visé" value={data.publicVise} required />
          {/*
            « Aucun prérequis » est une INFORMATION, pas une absence de donnée :
            un stagiaire doit pouvoir lire qu'il peut s'inscrire sans condition.
            Laisser la ligne vide se lirait comme un oubli.
          */}
          <LigneChamp label="Prérequis" value={data.prerequis || "Aucun prérequis"} />
          {data.niveau ? <LigneChamp label="Niveau visé" value={data.niveau} /> : null}
          <LigneChamp
            label="Accessibilité"
            value={
              data.accessibleHandicap
                ? // Le référent se NOMME : « Contact référent : contact@axion-ia.com »
                  // n'identifiait personne (ind. 26 du Référentiel national qualité).
                  `Action accessible aux personnes en situation de handicap. Référent handicap : ${
                    identite.referentHandicapNom ? `${identite.referentHandicapNom} — ` : ""
                  }${data.referentHandicapEmail || identite.email || "—"}`
                : "Nous contacter pour étudier les adaptations possibles."
            }
          />
        </Carte>

        {/* 3. Objectifs pédagogiques */}
        <Carte titre="3. Objectifs pédagogiques">
          {data.objectifs.length > 0 ? (
            <ListePuces items={data.objectifs} />
          ) : (
            <Text style={local.absent}>Objectifs non renseignés au programme de cette action.</Text>
          )}
        </Carte>

        {/* 4. Contenu — le cœur de la pièce */}
        <Carte titre="4. Contenu de la formation">
          {data.modules.length > 0 ? (
            data.modules.map((m, i) => {
              const duree = formaterDuree(m.dureeMin);
              // Les titres stockés portent souvent déjà « Module N — » (contenu
              // généré) : préfixer sans vérifier imprimait « Module 1 — Module
              // 1 — L'IA… » sur la pièce (constaté sur AXI-DOC-2026-002).
              const titreSeul = titreModuleSansPrefixe(m.titre);
              return (
                <View key={`${i}-${m.titre}`} style={local.moduleBloc} wrap={false}>
                  <Text style={local.moduleTitre}>
                    Module {i + 1} — {titreSeul}
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
        </Carte>

        {/* 5. Méthodes et moyens */}
        <Carte titre="5. Moyens pédagogiques et techniques">
          <Paragraphe>{data.methodesPedagogiques || "—"}</Paragraphe>
          {data.moyensTechniques ? <Paragraphe>{data.moyensTechniques}</Paragraphe> : null}
        </Carte>

        {/* 6. Ressources pédagogiques — INDICATEUR 19.
            Omise, jamais vide : une section « Ressources » suivie d'un tiret
            prouverait le contraire de ce qu'elle est censée prouver. */}
        {ressources.length > 0 ? (
          <Carte titre="6. Ressources pédagogiques mises à disposition">
            <ListePuces items={ressources} />
          </Carte>
        ) : null}

        {/* Évaluation et sanction */}
        <Carte titre={`${numEvaluation}. Modalités d'évaluation et sanction`}>
          <Paragraphe>{data.modalitesEvaluation}</Paragraphe>
          <LigneChamp label="Sanction de la formation" value={data.sanction} />
        </Carte>

        <NoteLegale>
          Ce programme constitue l&apos;annexe pédagogique de la convention de formation
          professionnelle (articles L.6353-1 et D.6353-1 du Code du travail : intitulé, objectif,
          contenu, moyens, durée et modalités de déroulement, de suivi et de sanction de
          l&apos;action).
        </NoteLegale>
      </PageCharte>
    </Document>
  );
}
